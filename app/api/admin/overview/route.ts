import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { NextResponse } from "next/server";

export async function GET() {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  try {
    const [
      totalUsers,
      sheltersCount,
      pendingKycCount,
      verifiedSheltersCount,
      donorsCount,
      enterpriseDonors,
      activeListingsCount,
      totalListingsCount,
      pickedUpClaims,
      razorpayCaptured,
      razorpayFailedWebhooks,
      openDisputesCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "SHELTER" } }),
      prisma.user.count({ where: { role: "SHELTER", kycStatus: "PENDING" } }),
      prisma.user.count({ where: { role: "SHELTER", kycStatus: "VERIFIED" } }),
      prisma.user.count({ where: { role: "RESTAURANT" } }),
      prisma.user.count({ where: { role: "RESTAURANT", donorTier: "ENTERPRISE" } }),
      prisma.surplusListing.count({ where: { status: "AVAILABLE" } }),
      prisma.surplusListing.count(),
      prisma.claim.findMany({
        where: { status: "PICKED_UP" },
        include: { listing: true },
      }),
      prisma.razorpayTransaction.findMany({
        where: { status: "CAPTURED" },
        select: { amount: true },
      }),
      prisma.razorpayTransaction.count({
        where: { webhookStatus: "FAILED_WEBHOOK" },
      }),
      prisma.disputeTicket.count({
        where: { status: { in: ["OPEN", "INVESTIGATING"] } },
      }),
    ]);

    // Calculate total meals and weight rescued
    const totalMealsRescued = pickedUpClaims.reduce(
      (sum, c) => sum + c.quantityClaimed,
      0
    );
    const totalWeightKg = pickedUpClaims.reduce((sum, c) => {
      const weight = c.listing?.weightKg || c.quantityClaimed * 0.4;
      return sum + weight;
    }, 0);

    // ESG Conversion Factors:
    // 1 kg food waste diverted = 2.5 kg CO2e saved
    // 1 kg food waste rotting in landfill = 0.12 kg CH4 (Methane)
    // 1 kg food rescued = 1,200 Liters of fresh water preserved
    const co2OffsetKg = Number((totalWeightKg * 2.5).toFixed(2));
    const methaneAvoidedKg = Number((totalWeightKg * 0.12).toFixed(2));
    const waterSavedLiters = Math.round(totalWeightKg * 1200);

    // Financial totals
    const totalRevenueInr = razorpayCaptured.reduce((sum, t) => sum + t.amount, 0);

    return apiSuccess({
      overview: {
        totalUsers,
        sheltersCount,
        pendingKycCount,
        verifiedSheltersCount,
        donorsCount,
        enterpriseDonors,
        activeListingsCount,
        totalListingsCount,
        openDisputesCount,
        razorpayFailedWebhooks,
      },
      financials: {
        totalRevenueInr,
        capturedTransactionsCount: razorpayCaptured.length,
        currency: "INR",
      },
      esg: {
        totalMealsRescued,
        totalWeightKg: Number(totalWeightKg.toFixed(2)),
        co2OffsetKg,
        methaneAvoidedKg,
        waterSavedLiters,
        landfillDiversionTons: Number((totalWeightKg / 1000).toFixed(3)),
      },
    });
  } catch (err: any) {
    console.error("[GET /api/admin/overview]", err);
    return apiError("Failed to fetch admin overview", 500);
  }
}
