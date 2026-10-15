import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { createNotification } from "@/lib/notifications";

export async function POST(req: Request) {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  try {
    const body = await req.json();
    const { userId, isBanned, reason } = body;

    if (!userId || typeof isBanned !== "boolean") {
      return apiError("User ID and 'isBanned' boolean are required", 400);
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return apiError("User not found", 404);
    }

    if (targetUser.role === "ADMIN") {
      return apiError("Cannot ban administrator accounts", 403);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: {
          isBanned,
          banReason: isBanned ? reason || "Banned for repeated policy violations or no-shows." : null,
          complianceScore: isBanned ? 0 : 75,
        },
      });

      if (isBanned) {
        // If restaurant is banned, cancel all their active listings
        if (u.role === "RESTAURANT") {
          await tx.surplusListing.updateMany({
            where: { donorId: userId, status: "AVAILABLE" },
            data: { status: "REMOVED_BY_ADMIN" },
          });
        }
        // If shelter is banned, cancel all their pending/approved claims
        if (u.role === "SHELTER") {
          await tx.claim.updateMany({
            where: { shelterId: userId, status: { in: ["PENDING", "APPROVED"] } },
            data: { status: "CANCELLED" },
          });
        }
      }

      return u;
    });

    await createNotification({
      userId,
      type: isBanned ? "ACCOUNT_SUSPENDED" : "ACCOUNT_REINSTATED",
      title: isBanned ? "Account Suspended by Compliance" : "Account Reinstated",
      message: isBanned
        ? `Your account access has been suspended: ${reason || "Repeated no-show or policy violations."}`
        : "Your account access has been reinstated by platform administration.",
    });

    return apiSuccess({
      message: isBanned ? `User ${updated.orgName} has been banned.` : `User ${updated.orgName} has been reinstated.`,
      user: {
        id: updated.id,
        orgName: updated.orgName,
        isBanned: updated.isBanned,
        banReason: updated.banReason,
      },
    });
  } catch (err: any) {
    console.error("[POST /api/admin/actors/ban]", err);
    return apiError("Failed to update actor ban status", 500);
  }
}
