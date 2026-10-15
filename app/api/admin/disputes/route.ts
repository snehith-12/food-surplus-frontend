import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { apiError, apiSuccess } from "@/lib/api-utils";

export async function GET(req: Request) {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");

    const where: any = {};
    if (status && status !== "ALL") {
      where.status = status;
    }

    const disputes = await prisma.disputeTicket.findMany({
      where,
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" },
      ],
      include: {
        reportedBy: {
          select: { id: true, orgName: true, role: true, phone: true, email: true },
        },
        targetUser: {
          select: { id: true, orgName: true, role: true, phone: true, email: true, complianceScore: true },
        },
        listing: {
          select: { id: true, title: true, quantity: true, unit: true, status: true, pickupAddress: true },
        },
      },
    });

    return apiSuccess({ disputes });
  } catch (err: any) {
    console.error("[GET /api/admin/disputes]", err);
    return apiError("Failed to fetch dispute tickets", 500);
  }
}

export async function PATCH(req: Request) {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  try {
    const body = await req.json();
    const { ticketId, status, adminNotes, resolution, deductScorePoints } = body;

    if (!ticketId || !status) {
      return apiError("Ticket ID and status are required", 400);
    }

    const ticket = await prisma.disputeTicket.findUnique({
      where: { id: ticketId },
      include: { targetUser: true },
    });

    if (!ticket) {
      return apiError("Dispute ticket not found", 404);
    }

    const isResolved = status === "RESOLVED";
    const updated = await prisma.disputeTicket.update({
      where: { id: ticketId },
      data: {
        status,
        ...(adminNotes ? { adminNotes } : {}),
        ...(resolution ? { resolution } : {}),
        resolvedAt: isResolved ? new Date() : null,
      },
      include: {
        reportedBy: { select: { orgName: true } },
        targetUser: { select: { id: true, orgName: true, complianceScore: true } },
      },
    });

    // If score penalty requested and target user exists
    if (deductScorePoints && ticket.targetUserId && ticket.targetUser) {
      const newScore = Math.max(0, ticket.targetUser.complianceScore - deductScorePoints);
      await prisma.user.update({
        where: { id: ticket.targetUserId },
        data: { complianceScore: newScore },
      });
    }

    return apiSuccess(updated);
  } catch (err: any) {
    console.error("[PATCH /api/admin/disputes]", err);
    return apiError("Failed to update dispute ticket", 500);
  }
}
