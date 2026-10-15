import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { respondClaimSchema } from "@/lib/validators";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { notifyClaimApproved, notifyClaimRejected } from "@/lib/notifications";

interface RouteContext {
  params: { id: string };
}

/**
 * PATCH /api/claims/:id/respond
 * Restaurant approves or rejects a pending claim.
 * Uses a transaction to atomically update claim + listing status.
 */
export async function PATCH(
  req: Request,
  { params }: RouteContext
) {
  const { session, error } = await requireRole("RESTAURANT");
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = respondClaimSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        parsed.error.issues.map((i) => i.message).join(", "),
        400
      );
    }

    const { action, donorNotes } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      // Fetch the claim with listing info
      const claim = await tx.claim.findUnique({
        where: { id: params.id },
        include: {
          listing: { select: { id: true, donorId: true, title: true, quantity: true } },
        },
      });

      if (!claim) throw new Error("NOT_FOUND");
      if (claim.listing.donorId !== session.user.id) throw new Error("FORBIDDEN");
      if (claim.status !== "PENDING") {
        throw new Error("INVALID_STATUS");
      }

      const newStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";

      // Update the claim
      const updated = await tx.claim.update({
        where: { id: params.id },
        data: {
          status: newStatus as any,
          donorNotes: donorNotes || null,
        },
        include: {
          shelter: { select: { id: true, orgName: true } },
          listing: { select: { id: true, title: true } },
        },
      });

      // If approving, check if listing should be marked CLAIMED
      if (action === "APPROVE") {
        const totalApproved = await tx.claim.aggregate({
          where: {
            listingId: claim.listing.id,
            status: { in: ["APPROVED", "PICKED_UP"] },
          },
          _sum: { quantityClaimed: true },
        });

        const claimedTotal = totalApproved._sum.quantityClaimed ?? 0;
        if (claimedTotal >= claim.listing.quantity) {
          await tx.surplusListing.update({
            where: { id: claim.listing.id },
            data: { status: "CLAIMED" },
          });
        }
      }

      return updated;
    });

    // Send notification outside transaction
    try {
      if (action === "APPROVE") {
        await notifyClaimApproved(result.shelter.id, result.listing.title, result.id);
      } else {
        await notifyClaimRejected(result.shelter.id, result.listing.title, result.id);
      }
    } catch (notifError) {
      console.error("[Notification Error]", notifError);
    }

    return apiSuccess(result);
  } catch (error: any) {
    if (error.message === "NOT_FOUND") return apiError("Claim not found", 404);
    if (error.message === "FORBIDDEN") return apiError("Not your listing", 403);
    if (error.message === "INVALID_STATUS") {
      return apiError("Can only respond to PENDING claims", 400);
    }
    console.error("[PATCH /api/claims/:id/respond]", error);
    return apiError("Failed to respond to claim", 500);
  }
}
