import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { createNotification } from "@/lib/notifications";

export async function GET(req: Request) {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");

    const where: any = { role: "SHELTER" };
    if (status && status !== "ALL") {
      where.kycStatus = status;
    }

    const shelters = await prisma.user.findMany({
      where,
      orderBy: [
        { kycStatus: "asc" }, // PENDING first
        { createdAt: "desc" },
      ],
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
        kycStatus: true,
        kycDocType: true,
        kycDocNumber: true,
        kycDocUrl: true,
        kycNotes: true,
        complianceScore: true,
        isBanned: true,
        createdAt: true,
        _count: {
          select: { claims: true },
        },
      },
    });

    return apiSuccess({ shelters });
  } catch (err: any) {
    console.error("[GET /api/admin/kyc]", err);
    return apiError("Failed to fetch KYC queue", 500);
  }
}

export async function PATCH(req: Request) {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  try {
    const body = await req.json();
    const { userId, action, notes } = body;

    if (!userId || !action || !["APPROVE", "REJECT"].includes(action)) {
      return apiError("Invalid request. 'userId' and 'action' (APPROVE or REJECT) are required.", 400);
    }

    const shelter = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!shelter || shelter.role !== "SHELTER") {
      return apiError("Shelter user not found", 404);
    }

    const isApprove = action === "APPROVE";
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: isApprove ? "VERIFIED" : "REJECTED",
        isVerified: isApprove,
        kycNotes: notes || (isApprove ? "Verified by Platform Compliance Team" : "Rejected due to insufficient documentation"),
        complianceScore: isApprove ? Math.max(shelter.complianceScore, 90) : Math.min(shelter.complianceScore, 40),
      },
      select: {
        id: true,
        orgName: true,
        kycStatus: true,
        isVerified: true,
        kycNotes: true,
        complianceScore: true,
      },
    });

    // Notify shelter
    await createNotification({
      userId,
      type: isApprove ? "KYC_APPROVED" : "KYC_REJECTED",
      title: isApprove ? "KYC Verification Approved" : "KYC Verification Rejected",
      message: isApprove
        ? "Congratulations! Your shelter documentation (Trust Deed / 12A/80G) has been verified. You may now claim food surplus across all participating hubs."
        : `Your KYC verification was rejected: ${notes || "Please submit updated Trust Deed / 12A/80G registration certificates."}`,
    });

    return apiSuccess(updated);
  } catch (err: any) {
    console.error("[PATCH /api/admin/kyc]", err);
    return apiError("Failed to update shelter KYC status", 500);
  }
}
