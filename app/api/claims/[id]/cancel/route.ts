import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { apiError, apiSuccess } from "@/lib/api-utils";

interface RouteContext {
  params: { id: string };
}

/**
 * PATCH /api/claims/:id/cancel
 * Cancel a claim. Shelter can cancel PENDING or APPROVED claims.
 * Donor can also cancel (force-cancel) an APPROVED claim.
 * If the listing was CLAIMED, re-opens it to AVAILABLE.
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
          listing: { select: { id: true, donorId: true, status: true } },
        },
      });

      if (!claim) throw new Error("NOT_FOUND");

      // Authorization: shelter or donor
      const isDonor = claim.listing.donorId === session.user.id;
      const isShelter = claim.shelterId === session.user.id;
      if (!isDonor && !isShelter) throw new Error("FORBIDDEN");

      // Validate status
      if (claim.status !== "PENDING" && claim.status !== "APPROVED") {
        throw new Error("INVALID_STATUS");
      }

      // Cancel the claim
      const updated = await tx.claim.update({
        where: { id: params.id },
        data: { status: "CANCELLED" },
      });

      // If the listing was CLAIMED, check if it should revert to AVAILABLE
      if (claim.listing.status === "CLAIMED") {
        const remainingActive = await tx.claim.count({
          where: {
            listingId: claim.listing.id,
            status: { in: ["PENDING", "APPROVED"] },
            id: { not: params.id },
          },
        });

        // Also check if there's any PICKED_UP claim
        const pickedUp = await tx.claim.count({
          where: {
            listingId: claim.listing.id,
            status: "PICKED_UP",
          },
        });

        // Re-open listing only if no active claims and no pickups
        if (remainingActive === 0 && pickedUp === 0) {
          await tx.surplusListing.update({
            where: { id: claim.listing.id },
            data: { status: "AVAILABLE" },
          });
        }
      }

      return updated;
    });

    return apiSuccess(result);
  } catch (error: any) {
    if (error.message === "NOT_FOUND") return apiError("Claim not found", 404);
    if (error.message === "FORBIDDEN") return apiError("Not authorized", 403);
    if (error.message === "INVALID_STATUS") {
      return apiError("Can only cancel PENDING or APPROVED claims", 400);
    }
    console.error("[PATCH /api/claims/:id/cancel]", error);
    return apiError("Failed to cancel claim", 500);
  }
}
