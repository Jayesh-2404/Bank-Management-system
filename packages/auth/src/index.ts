import argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import type { Permission, Role } from "@bank/shared";
import { rolePermissions } from "@bank/shared";

export interface AuthPrincipal {
  userId: string;
  bankId?: string;
  branchId?: string;
  customerId?: string;
  roles: Role[];
  auditorScope?: "PLATFORM" | "BANK";
}

const encodeSecret = (secret: string) => new TextEncoder().encode(secret);

export async function hashPassword(password: string) {
  return argon2.hash(password);
}

export async function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password);
}

export async function signAccessToken(principal: AuthPrincipal, secret: string, expiresIn = "15m") {
  return new SignJWT({ ...principal })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(principal.userId)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(encodeSecret(secret));
}

export async function verifyAccessToken(token: string, secret: string) {
  const { payload } = await jwtVerify(token, encodeSecret(secret));
  return payload as unknown as AuthPrincipal;
}

export function hasPermission(principal: AuthPrincipal, permission: Permission) {
  return principal.roles.some((role) => rolePermissions[role].includes(permission));
}

export function assertPermission(principal: AuthPrincipal, permission: Permission) {
  if (!hasPermission(principal, permission)) {
    throw new Error(`Missing permission: ${permission}`);
  }
}

export function canAccessBank(principal: AuthPrincipal, bankId: string) {
  if (principal.roles.includes("PlatformAdmin")) return true;
  if (principal.roles.includes("Auditor") && principal.auditorScope === "PLATFORM") return true;
  return principal.bankId === bankId;
}

export function canActOnCustomer(principal: AuthPrincipal, customerId: string) {
  if (principal.customerId === customerId) return true;
  return hasPermission(principal, "act:on-behalf");
}
