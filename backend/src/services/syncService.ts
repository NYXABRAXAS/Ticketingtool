import { prisma } from "../db/prisma";
import { redmineClient, RedmineIssue } from "./redmineClient";
import { ticketService } from "./ticketService";
import { logger } from "../utils/logger";

// Pulls the latest state of one Redmine issue into the local ticket record. Journals
// (comments) and attachments authored in Redmine are diffed against what's already
// stored locally by redmineJournalId / redmineAttachmentId so nothing is duplicated.
async function applyRedmineIssueToLocalTicket(issue: RedmineIssue) {
  const ticket = await prisma.ticket.findUnique({ where: { redmineIssueId: issue.id } });
  if (!ticket) return; // not a ticket created by this tool - ignore

  const [status, priority] = await Promise.all([
    prisma.ticketStatus.findFirst({ where: { redmineStatusId: issue.status.id } }),
    prisma.ticketPriority.findFirst({ where: { redminePriorityId: issue.priority.id } }),
  ]);

  let assignedTo = null;
  if (issue.assigned_to) {
    assignedTo = await prisma.losUserMapping.findFirst({ where: { projectId: ticket.projectId, redmineUserId: issue.assigned_to.id } });
  }

  const changes: Record<string, unknown> = { syncStatus: "SYNCED", lastSyncedAt: new Date(), syncError: null };
  if (status && status.id !== ticket.statusId) {
    changes.statusId = status.id;
    if (status.name === "Resolved") changes.resolvedAt = new Date();
    if (status.isClosed) changes.closedAt = new Date();
    await prisma.ticketHistory.create({ data: { ticketId: ticket.id, action: "STATUS_CHANGE", toValue: status.name, reason: "Synchronized from Redmine" } });
  }
  if (priority && priority.id !== ticket.priorityId) {
    changes.priorityId = priority.id;
    await prisma.ticketHistory.create({ data: { ticketId: ticket.id, action: "PRIORITY_CHANGE", toValue: priority.name, reason: "Synchronized from Redmine" } });
  }
  if ((assignedTo?.id ?? null) !== ticket.assignedToId) {
    changes.assignedToId = assignedTo?.id ?? null;
    await prisma.ticketHistory.create({ data: { ticketId: ticket.id, action: "REASSIGN", toValue: assignedTo?.displayName ?? "Unassigned", reason: "Synchronized from Redmine" } });
  }

  await prisma.ticket.update({ where: { id: ticket.id }, data: changes });

  for (const journal of issue.journals ?? []) {
    if (!journal.notes) continue;
    const exists = await prisma.ticketComment.findFirst({ where: { redmineJournalId: journal.id } });
    if (exists) continue;
    const author = await prisma.losUserMapping.findFirst({ where: { projectId: ticket.projectId, redmineUserId: journal.user.id } });
    if (!author) continue; // comment from a Redmine user with no LOS mapping (e.g. internal dev) - still record in history only
    await prisma.ticketComment.create({
      data: { ticketId: ticket.id, authorId: author.id, body: journal.notes, source: "REDMINE", redmineJournalId: journal.id, createdAt: new Date(journal.created_on) },
    });
    await prisma.ticketHistory.create({ data: { ticketId: ticket.id, actorId: author.id, action: "COMMENT", reason: "Synchronized from Redmine" } });
  }

  for (const att of issue.attachments ?? []) {
    const exists = await prisma.ticketAttachment.findFirst({ where: { redmineAttachmentId: att.id } });
    if (exists) continue;
    const uploader = (await prisma.losUserMapping.findFirst({ where: { projectId: ticket.projectId } })) ?? null;
    if (!uploader) continue;
    await prisma.ticketAttachment.create({
      data: {
        ticketId: ticket.id,
        uploadedById: uploader.id,
        fileName: att.filename,
        fileSize: att.filesize,
        mimeType: att.content_type ?? "application/octet-stream",
        redmineAttachmentId: att.id,
        redmineDownloadUrl: att.content_url,
        createdAt: new Date(att.created_on),
      },
    });
  }
}

export async function syncSingleIssueFromRedmine(redmineIssueId: number) {
  const issue = await redmineClient.getIssue(redmineIssueId);
  await applyRedmineIssueToLocalTicket(issue);
}

// Fallback poller for LOS/Redmine pairs that haven't configured a webhook. Reads a
// per-project watermark from integration_settings so each poll only asks Redmine for
// issues updated since the last successful run.
export async function pollRedmineForUpdates() {
  const projects = await prisma.project.findMany({ where: { active: true } });
  for (const project of projects) {
    const watermarkKey = `sync_watermark_project_${project.id}`;
    // eslint-disable-next-line no-await-in-loop
    const watermark = await prisma.integrationSetting.findUnique({ where: { key: watermarkKey } });
    const since = watermark?.value;
    try {
      // eslint-disable-next-line no-await-in-loop
      const issues = await redmineClient.getProjectIssues(project.redmineProjectId, since);
      // eslint-disable-next-line no-await-in-loop
      for (const summary of issues) {
        // eslint-disable-next-line no-await-in-loop
        const full = await redmineClient.getIssue(summary.id);
        // eslint-disable-next-line no-await-in-loop
        await applyRedmineIssueToLocalTicket(full);
      }
      // eslint-disable-next-line no-await-in-loop
      await prisma.integrationSetting.upsert({
        where: { key: watermarkKey },
        create: { key: watermarkKey, value: new Date().toISOString() },
        update: { value: new Date().toISOString() },
      });
    } catch (err: any) {
      logger.error("redmine_poll_failed", { projectId: project.id, message: err.message });
    }
  }
}

// Retries tickets that failed to create in Redmine or are still awaiting first sync.
// Guarded by redmineIssueId being null so a retry can never create a duplicate issue.
export async function retryPendingTicketSync() {
  const pending = await prisma.ticket.findMany({ where: { redmineIssueId: null, syncStatus: { in: ["PENDING_SYNC", "SYNC_FAILED"] } } });
  for (const ticket of pending) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await ticketService.syncTicketToRedmine(ticket.id);
    } catch (err: any) {
      logger.error("retry_sync_failed", { ticketId: ticket.id, message: err.message });
    }
  }
}
