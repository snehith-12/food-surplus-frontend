import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { apiError } from "@/lib/api-utils";
import { NextResponse } from "next/server";

/**
 * GET /api/listings/my
 * Get all listings owned by the authenticated restaurant.
 */
export async function GET() {
  const { session, error } = await requireRole("RESTAURANT");
  if (error) return error;

  try {
    const listings = await prisma.surplusListing.findMany({
      where: { donorId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { claims: true },
        },
        claims: {
          select: {
            id: true,
            status: true,
            quantityClaimed: true,
            shelter: {
              select: { orgName: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ data: listings });
  } catch (error: any) {
    console.error("[GET /api/listings/my]", error);
    return apiError("Failed to fetch your listings", 500);
  }
}
