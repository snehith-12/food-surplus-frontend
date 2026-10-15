import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { apiError, apiSuccess } from "@/lib/api-utils";

export async function GET(req: Request) {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const tier = url.searchParams.get("tier");

    const where: any = { role: "RESTAURANT" };
    if (tier && tier !== "ALL") {
      where.donorTier = tier;
    }

    const donors = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        orgName: true,
        contactName: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        isVerified: true,
        donorTier: true,
        donorEstDailyVolume: true,
        complianceScore: true,
        isBanned: true,
        banReason: true,
        createdAt: true,
        _count: {
          select: {
            listings: true,
          },
        },
      },
    });

    return apiSuccess({ donors });
  } catch (err: any) {
    console.error("[GET /api/admin/donors]", err);
    return apiError("Failed to fetch donor profiles", 500);
  }
}

export async function PATCH(req: Request) {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  try {
    const body = await req.json();
    const { donorId, donorTier, donorEstDailyVolume, complianceScore } = body;

    if (!donorId) {
      return apiError("Donor ID is required", 400);
    }

    const validTiers = ["ENTERPRISE", "COMMERCIAL_CHAIN", "LOCAL_CAFE_BAKERY"];
    if (donorTier && !validTiers.includes(donorTier)) {
      return apiError(`Invalid tier. Must be one of: ${validTiers.join(", ")}`, 400);
    }

    const updated = await prisma.user.update({
      where: { id: donorId },
      data: {
        ...(donorTier ? { donorTier } : {}),
        ...(typeof donorEstDailyVolume === "number" ? { donorEstDailyVolume } : {}),
        ...(typeof complianceScore === "number" ? { complianceScore } : {}),
      },
      select: {
        id: true,
        orgName: true,
        donorTier: true,
        donorEstDailyVolume: true,
        complianceScore: true,
      },
    });

    return apiSuccess(updated);
  } catch (err: any) {
    console.error("[PATCH /api/admin/donors]", err);
    return apiError("Failed to update donor tier profile", 500);
  }
}
