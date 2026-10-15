import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { apiError, apiSuccess } from "@/lib/api-utils";

interface RouteContext {
  params: { id: string };
}

/**
 * PATCH /api/listings/:id/cancel
 * Cancel a listing (RESTAURANT owner only).
 * Also rejects all pending claims on this listing.
 */
export async function PATCH(
  req: Request,
  { params }: RouteContext
) {
  const { session, error } = await requireRole("RESTAURANT");
  if (error) return error;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verify ownership
      const listing = await tx.surplusListing.findUnique({
        where: { id: params.id },
        select: { donorId: true, status: true },
      });

      if (!listing) throw new Error("NOT_FOUND");
      if (listing.donorId !== session.user.id) throw new Error("FORBIDDEN");
      if (listing.status !== "AVAILABLE" && listing.status !== "CLAIMED") {
        throw new Error("INVALID_STATUS");
      }

      // Reject all pending/approved claims
      await tx.claim.updateMany({
        where: {
          listingId: params.id,
          status: { in: ["PENDING", "APPROVED"] },
        },
        data: { status: "CANCELLED" },
      });

      // Cancel the listing
      return tx.surplusListing.update({
        where: { id: params.id },
        data: { status: "CANCELLED" },
      });
    });

    return apiSuccess(result);
  } catch (error: any) {
    if (error.message === "NOT_FOUND") return apiError("Listing not found", 404);
    if (error.message === "FORBIDDEN") return apiError("Not your listing", 403);
    if (error.message === "INVALID_STATUS") {
      return apiError("Listing cannot be cancelled in its current state", 400);
    }
    console.error("[PATCH /api/listings/:id/cancel]", error);
    return apiError("Failed to cancel listing", 500);
  }
}
