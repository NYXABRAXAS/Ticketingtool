import { Router } from "express";
import { requireAdminSession, requireSuperAdmin } from "../../middleware/auth";
import { adminAuthRouter } from "./auth";
import { adminClientsRouter } from "./clients";
import { adminProjectsRouter } from "./projects";
import { adminUserMappingsRouter } from "./userMappings";
import { adminAssigneeMappingsRouter } from "./assigneeMappings";
import { adminTicketConfigRouter } from "./ticketConfig";
import { adminSlaRouter } from "./sla";
import { adminRedmineConfigRouter } from "./redmineConfig";
import { adminOriginsRouter } from "./origins";
import { adminIntegrationSecretsRouter } from "./integrationSecrets";
import { adminAuditLogsRouter } from "./auditLogs";

export const adminRouter = Router();

// Login/logout are the only unauthenticated admin routes.
adminRouter.use("/auth", adminAuthRouter);

adminRouter.use(requireAdminSession);

adminRouter.use("/clients", requireSuperAdmin, adminClientsRouter);
adminRouter.use("/projects", requireSuperAdmin, adminProjectsRouter);
adminRouter.use("/user-mappings", adminUserMappingsRouter);
adminRouter.use("/assignee-mappings", adminAssigneeMappingsRouter);
adminRouter.use("/config", adminTicketConfigRouter);
adminRouter.use("/sla", adminSlaRouter);
adminRouter.use("/redmine", requireSuperAdmin, adminRedmineConfigRouter);
adminRouter.use("/allowed-origins", requireSuperAdmin, adminOriginsRouter);
adminRouter.use("/integration-secrets", requireSuperAdmin, adminIntegrationSecretsRouter);
adminRouter.use("/audit-logs", adminAuditLogsRouter);
