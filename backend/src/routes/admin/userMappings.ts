import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { ApiError } from "../../middleware/errorHandler";
import { defaultPermissionsForRole, PERMISSIONS } from "../../constants/permissions";

export const adminUserMappingsRouter = Router();

adminUserMappingsRouter.get("/", async (req, res, next) => {
  try {
    const { clientId, projectId } = req.query as { clientId?: string; projectId?: string };
    const mappings = await prisma.losUserMapping.findMany({
      where: { ...(clientId ? { clientId } : {}), ...(projectId ? { projectId } : {}) },
      include: { client: true, project: true, permissions: true },
      orderBy: { displayName: "asc" },
    });
    res.json(
      mappings.map((m) => ({
        id: m.id,
        losUserId: m.losUserId,
        losUsername: m.losUsername,
        displayName: m.displayName,
        email: m.email,
        role: m.role,
        active: m.active,
        client: m.client.code,
        project: m.project.code,
        redmineUserId: m.redmineUserId,
        permissions: m.permissions.map((p) => p.permission),
        lastLoginAt: m.lastLoginAt,
      }))
    );
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  role: z.enum(["LOS_USER", "LOS_SUPPORT", "INTERNAL_SUPPORT", "INTERNAL_ADMIN"]).optional(),
  active: z.boolean().optional(),
  redmineUserId: z.number().int().nullable().optional(),
  permissions: z.array(z.enum(Object.keys(PERMISSIONS) as [string, ...string[]])).optional(),
});

adminUserMappingsRouter.put("/:id", async (req, res, next) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", parsed.error.errors.map((e) => e.message).join(", "));

    const { permissions, ...data } = parsed.data;

    await prisma.$transaction(async (tx) => {
      await tx.losUserMapping.update({ where: { id: req.params.id }, data });
      if (permissions) {
        await tx.userPermission.deleteMany({ where: { userMappingId: req.params.id } });
        await tx.userPermission.createMany({ data: permissions.map((permission) => ({ userMappingId: req.params.id, permission })) });
      } else if (data.role) {
        await tx.userPermission.deleteMany({ where: { userMappingId: req.params.id } });
        await tx.userPermission.createMany({ data: defaultPermissionsForRole(data.role).map((permission) => ({ userMappingId: req.params.id, permission })) });
      }
    });

    const updated = await prisma.losUserMapping.findUnique({ where: { id: req.params.id }, include: { permissions: true } });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
