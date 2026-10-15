import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { apiError } from "./api-utils";
import type { NextResponse } from "next/server";

/**
 * Get the current authenticated session, or return null.
 */
export async function getSession() {
  return getServerSession(authOptions);
}

/**
 * Require authentication. Returns the session or an error NextResponse.
 */
export async function requireAuth(): Promise<
  | { session: NonNullable<Awaited<ReturnType<typeof getSession>>>; error?: never }
  | { session?: never; error: NextResponse }
> {
  const session = await getSession();
  if (!session?.user) {
    return { error: apiError("Authentication required", 401) };
  }
  return { session };
}

/**
 * Require authentication AND a specific role.
 */
export async function requireRole(role: "RESTAURANT" | "SHELTER" | "ADMIN"): Promise<
  | { session: NonNullable<Awaited<ReturnType<typeof getSession>>>; error?: never }
  | { session?: never; error: NextResponse }
> {
  const result = await requireAuth();
  if (result.error) return result;

  if (result.session.user.role !== role) {
    return { error: apiError(`This action requires the ${role} role`, 403) };
  }
  return result;
}
