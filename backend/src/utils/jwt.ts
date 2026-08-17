import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { env } from "../config/env";

export interface LaunchTokenPayload {
  losUserId: string;
  losUsername: string;
  displayName: string;
  email?: string;
  clientCode: string;
  projectCode: string;
  role?: string;
  losContext?: Record<string, string | undefined>;
  nonce: string;
}

export interface LaunchTokenClaims extends LaunchTokenPayload {
  iat: number;
  exp: number;
}

export interface SessionClaims {
  userMappingId: string;
  losUserId: string;
  clientId: string;
  projectId: string;
  iat: number;
  exp: number;
}

export interface AdminSessionClaims {
  adminUserId: string;
  role: string;
  iat: number;
  exp: number;
}

// Short-lived, signed, single-use launch token minted by the Ticketing Tool backend
// in response to a server-to-server /api/integration/launch-token call from the LOS.
export function signLaunchToken(payload: Omit<LaunchTokenPayload, "nonce">): { token: string; nonce: string } {
  const nonce = randomUUID();
  const token = jwt.sign({ ...payload, nonce }, env.launchTokenSecret, {
    expiresIn: env.launchTokenTtlSeconds,
    issuer: "los-ticketing-tool",
    audience: "los-ticketing-launch",
  });
  return { token, nonce };
}

export function verifyLaunchToken(token: string): LaunchTokenClaims {
  return jwt.verify(token, env.launchTokenSecret, {
    issuer: "los-ticketing-tool",
    audience: "los-ticketing-launch",
  }) as LaunchTokenClaims;
}

// Longer-lived browser session established after a launch token is redeemed once.
export function signSessionToken(payload: Omit<SessionClaims, "iat" | "exp">): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: `${env.sessionTtlHours}h`,
    issuer: "los-ticketing-tool",
    audience: "los-ticketing-session",
  });
}

export function verifySessionToken(token: string): SessionClaims {
  return jwt.verify(token, env.jwtSecret, {
    issuer: "los-ticketing-tool",
    audience: "los-ticketing-session",
  }) as SessionClaims;
}

export function signAdminSessionToken(payload: Omit<AdminSessionClaims, "iat" | "exp">): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: "8h",
    issuer: "los-ticketing-tool",
    audience: "los-ticketing-admin-session",
  });
}

export function verifyAdminSessionToken(token: string): AdminSessionClaims {
  return jwt.verify(token, env.jwtSecret, {
    issuer: "los-ticketing-tool",
    audience: "los-ticketing-admin-session",
  }) as AdminSessionClaims;
}
