import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { apiError } from "@/lib/api-utils";
import { NextResponse } from "next/server";

/**
 * GET /api/claims/incoming
 * Get all claims on listings owned by the authenticated restaurant.
 * Groups claims by listing for easy display.
 */
export async function GET() {
  const { session, error } = await requireRole("RESTAURANT");
  if (error) return error;

  try {
    const claims = await prisma.claim.findMany({
      where: {
        listing: {
          donorId: session.user.id,
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            category: true,
            quantity: true,
            unit: true,
            status: true,
            pickupWindowStart: true,
            pickupWindowEnd: true,
          },
        },
        shelter: {
          select: {
            id: true,
            orgName: true,
            contactName: true,
            phone: true,
            city: true,
          },
        },
      },
    });

    return NextResponse.json({ data: claims });
  } catch (error: any) {
    console.error("[GET /api/claims/incoming]", error);
    return apiError("Failed to fetch incoming claims", 500);
  }
}
