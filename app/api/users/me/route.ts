import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { apiError, apiSuccess } from "@/lib/api-utils";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      role: true,
      orgName: true,
      contactName: true,
      phone: true,
      address: true,
      city: true,
      state: true,
      zipCode: true,
      latitude: true,
      longitude: true,
      isVerified: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  if (!user) {
    return apiError("User not found", 404);
  }

  return apiSuccess(user);
}
