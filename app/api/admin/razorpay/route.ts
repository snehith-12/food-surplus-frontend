import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { apiError, apiSuccess } from "@/lib/api-utils";

export async function GET(req: Request) {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const webhookStatus = url.searchParams.get("webhookStatus");

    const where: any = {};
    if (status && status !== "ALL") {
      where.status = status;
    }
    if (webhookStatus && webhookStatus !== "ALL") {
      where.webhookStatus = webhookStatus;
    }

    const [transactions, statsCaptured, statsFailed, statsRefunded] = await Promise.all([
      prisma.razorpayTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, orgName: true, email: true },
          },
          listing: {
            select: { id: true, title: true, quantity: true },
          },
        },
      }),
      prisma.razorpayTransaction.aggregate({
        where: { status: "CAPTURED" },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.razorpayTransaction.count({
        where: { status: "FAILED" },
      }),
      prisma.razorpayTransaction.count({
        where: { webhookStatus: "FAILED_WEBHOOK" },
      }),
    ]);

    const totalRevenueInr = statsCaptured._sum.amount || 0;
    const capturedCount = statsCaptured._count.id || 0;

    return apiSuccess({
      ledger: transactions,
      analytics: {
        totalRevenueInr,
        capturedCount,
        failedCount: statsFailed,
        failedWebhooksCount: statsRefunded,
        currency: "INR",
      },
    });
  } catch (err: any) {
    console.error("[GET /api/admin/razorpay]", err);
    return apiError("Failed to fetch Razorpay ledger", 500);
  }
}
