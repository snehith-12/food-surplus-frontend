import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { notifyPickupConfirmed } from "@/lib/notifications";

interface RouteContext {
  params: { id: string };
}

/**
 * PATCH /api/claims/:id/pickup
 * Confirm that food has been picked up.
 * Either the restaurant (donor) or the shelter can confirm.
 * Uses a transaction to atomically update claim + listing.
 */
export async function PATCH(
  req: Request,
  { params }: RouteContext
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const claim = await tx.claim.findUnique({
        where: { id: params.id },
        include: {
          listing: { select: { id: true, donorId: true, title: true } },
          shelter: { select: { id: true, orgName: true } },
        },
      });

      if (!claim) throw new Error("NOT_FOUND");

      // Only donor or shelter can confirm
      const isDonor = claim.listing.donorId === session.user.id;
      const isShelter = claim.shelterId === session.user.id;
      if (!isDonor && !isShelter) throw new Error("FORBIDDEN");

      // Must be in APPROVED status
      if (claim.status !== "APPROVED") {
        throw new Error("INVALID_STATUS");
      }

      // Update claim
      const updated = await tx.claim.update({
        where: { id: params.id },
        data: {
          status: "PICKED_UP",
          pickedUpAt: new Date(),
        },
      });

      // Check if ALL claims for this listing are now picked up or terminal
      const activeClaims = await tx.claim.count({
        where: {
          listingId: claim.listing.id,
          status: { in: ["PENDING", "APPROVED"] },
        },
      });

      // If no more active claims, mark listing as PICKED_UP
      if (activeClaims === 0) {
        await tx.surplusListing.update({
          where: { id: claim.listing.id },
          data: { status: "PICKED_UP" },
        });
      }

      return { ...updated, listing: claim.listing, shelter: claim.shelter };
    });

    // Notify both parties
    try {
      await notifyPickupConfirmed(
        result.listing.donorId,
        result.listing.title,
        result.id
      );
      await notifyPickupConfirmed(
        result.shelter.id,
        result.listing.title,
        result.id
      );
    } catch (notifError) {
      console.error("[Notification Error]", notifError);
    }

    return apiSuccess(result);
  } catch (error: any) {
    if (error.message === "NOT_FOUND") return apiError("Claim not found", 404);
    if (error.message === "FORBIDDEN") return apiError("Not authorized", 403);
    if (error.message === "INVALID_STATUS") {
      return apiError("Can only confirm pickup for APPROVED claims", 400);
    }
    console.error("[PATCH /api/claims/:id/pickup]", error);
    return apiError("Failed to confirm pickup", 500);
  }
}
