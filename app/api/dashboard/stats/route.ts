import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { apiError, apiSuccess } from "@/lib/api-utils";

/**
 * GET /api/dashboard/stats
 * Returns role-specific dashboard statistics.
 */
export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    if (session.user.role === "RESTAURANT") {
      const [totalListings, activeListings, pendingClaims, totalDonated] =
        await Promise.all([
          prisma.surplusListing.count({
            where: { donorId: session.user.id },
          }),
          prisma.surplusListing.count({
            where: { donorId: session.user.id, status: "AVAILABLE" },
          }),
          prisma.claim.count({
            where: {
              listing: { donorId: session.user.id },
              status: "PENDING",
            },
          }),
          prisma.claim.aggregate({
            where: {
              listing: { donorId: session.user.id },
              status: "PICKED_UP",
            },
            _sum: { quantityClaimed: true },
          }),
        ]);

      return apiSuccess({
        role: "RESTAURANT",
        totalListings,
        activeListings,
        pendingClaims,
        totalServingsDonated: totalDonated._sum.quantityClaimed ?? 0,
      });
    } else {
      // SHELTER
      const [totalClaims, approvedClaims, totalReceived, upcomingPickups] =
        await Promise.all([
          prisma.claim.count({
            where: { shelterId: session.user.id },
          }),
          prisma.claim.count({
            where: { shelterId: session.user.id, status: "APPROVED" },
          }),
          prisma.claim.aggregate({
            where: {
              shelterId: session.user.id,
              status: "PICKED_UP",
            },
            _sum: { quantityClaimed: true },
          }),
          prisma.claim.count({
            where: {
              shelterId: session.user.id,
              status: "APPROVED",
              listing: {
                pickupWindowEnd: { gte: new Date() },
              },
            },
          }),
        ]);

      return apiSuccess({
        role: "SHELTER",
        totalClaims,
        approvedClaims,
        totalServingsReceived: totalReceived._sum.quantityClaimed ?? 0,
        upcomingPickups,
      });
    }
  } catch (error: any) {
    console.error("[GET /api/dashboard/stats]", error);
    return apiError("Failed to fetch dashboard stats", 500);
  }
}
