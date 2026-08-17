import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

async function seedTicketTypes() {
  const types = ["Bug", "Incident", "Query", "Change Request", "Enhancement", "Data Issue", "Integration Issue", "Performance Issue", "Access Issue"];
  for (let i = 0; i < types.length; i++) {
    await prisma.ticketType.upsert({ where: { name: types[i] }, create: { name: types[i], sortOrder: i }, update: {} });
  }
}

async function seedModules() {
  const modules = [
    "Login", "Sourcing", "Application", "KYC", "Due Diligence", "Bureau", "Credit", "CAM", "Deviation",
    "Approval", "Deal Structure", "QC", "Disbursement", "Reports", "Mobile App", "Web Portal", "API", "Integration",
  ];
  for (let i = 0; i < modules.length; i++) {
    await prisma.ticketModule.upsert({ where: { name: modules[i] }, create: { name: modules[i], sortOrder: i }, update: {} });
  }
}

async function seedPriorities() {
  const priorities = [
    { name: "Low", sortOrder: 0 },
    { name: "Medium", sortOrder: 1 },
    { name: "High", sortOrder: 2 },
    { name: "Critical", sortOrder: 3 },
  ];
  for (const p of priorities) {
    await prisma.ticketPriority.upsert({ where: { name: p.name }, create: p, update: {} });
  }
  return prisma.ticketPriority.findMany();
}

async function seedStatuses() {
  const statuses = [
    { name: "Open", sortOrder: 0, isClosed: false },
    { name: "Assigned", sortOrder: 1, isClosed: false },
    { name: "In Progress", sortOrder: 2, isClosed: false },
    { name: "Pending Client", sortOrder: 3, isClosed: false },
    { name: "Pending Development", sortOrder: 4, isClosed: false },
    { name: "Resolved", sortOrder: 5, isClosed: false },
    { name: "Reopened", sortOrder: 6, isClosed: false },
    { name: "Closed", sortOrder: 7, isClosed: true },
  ];
  for (const s of statuses) {
    await prisma.ticketStatus.upsert({ where: { name: s.name }, create: s, update: {} });
  }
  return prisma.ticketStatus.findMany();
}

async function seedTransitions(statuses: { id: string; name: string }[]) {
  const byName = Object.fromEntries(statuses.map((s) => [s.name, s.id]));
  const edges: [string, string][] = [
    ["Open", "Assigned"],
    ["Assigned", "In Progress"],
    ["Open", "In Progress"],
    ["In Progress", "Pending Client"],
    ["In Progress", "Pending Development"],
    ["Pending Client", "In Progress"],
    ["Pending Development", "In Progress"],
    ["In Progress", "Resolved"],
    ["Resolved", "Closed"],
    ["Resolved", "Reopened"],
    ["Closed", "Reopened"],
    ["Reopened", "In Progress"],
  ];
  for (const [from, to] of edges) {
    if (!byName[from] || !byName[to]) continue;
    await prisma.statusTransition
      .upsert({
        where: { fromStatusId_toStatusId: { fromStatusId: byName[from], toStatusId: byName[to] } },
        create: { fromStatusId: byName[from], toStatusId: byName[to] },
        update: {},
      })
      .catch(() => undefined);
  }
}

async function seedDefaultSla(priorities: { id: string; name: string }[]) {
  const minutes: Record<string, number> = { Critical: 120, High: 240, Medium: 480, Low: 1440 };
  for (const p of priorities) {
    const resolveMins = minutes[p.name] ?? 1440;
    await prisma.slaRule.upsert({
      where: { projectId_priorityId: { projectId: null as any, priorityId: p.id } },
      create: { projectId: null, priorityId: p.id, responseMins: Math.round(resolveMins / 4), resolveMins },
      update: {},
    });
  }
}

async function seedAdmin() {
  const existing = await prisma.adminUser.findFirst({ where: { role: "SUPER_ADMIN" } });
  if (existing) return;

  const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const password = process.env.SEED_ADMIN_PASSWORD ?? randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.adminUser.create({
    data: { username, passwordHash, displayName: "Super Admin", role: "SUPER_ADMIN" },
  });

  if (!process.env.SEED_ADMIN_PASSWORD) {
    // eslint-disable-next-line no-console
    console.log(`\n[seed] Created initial admin user.\n  username: ${username}\n  password: ${password}\n  Log in once and rotate this password immediately - it is only shown here.\n`);
  }
}

async function main() {
  await seedTicketTypes();
  await seedModules();
  const priorities = await seedPriorities();
  const statuses = await seedStatuses();
  await seedTransitions(statuses);
  await seedDefaultSla(priorities);
  await seedAdmin();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
