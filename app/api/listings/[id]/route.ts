import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { updateListingSchema } from "@/lib/validators";
import { apiError, apiSuccess } from "@/lib/api-utils";

interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/listings/:id
 * Get a single listing by ID with donor info and claims.
 */
export async function GET(
  req: Request,
  { params }: RouteContext
) {
  try {
    const listing = await prisma.surplusListing.findUnique({
      where: { id: params.id },
      include: {
        donor: {
          select: {
            id: true,
            orgName: true,
            contactName: true,
            phone: true,
            city: true,
            state: true,
          },
        },
        claims: {
          select: {
            id: true,
            shelterId: true,
            status: true,
            quantityClaimed: true,
            pickupEta: true,
            createdAt: true,
            shelter: {
              select: {
                id: true,
                orgName: true,
                contactName: true,
                phone: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!listing) {
      return apiError("Listing not found", 404);
    }

    return apiSuccess(listing);
  } catch (error: any) {
    console.error("[GET /api/listings/:id]", error);
    return apiError("Failed to fetch listing", 500);
  }
}

/**
 * PUT /api/listings/:id
 * Update a listing (RESTAURANT owner only, must still be AVAILABLE).
 */
export async function PUT(
  req: Request,
  { params }: RouteContext
) {
  const { session, error } = await requireRole("RESTAURANT");
  if (error) return error;

  try {
    // Verify ownership and status
    const existing = await prisma.surplusListing.findUnique({
      where: { id: params.id },
      select: { donorId: true, status: true },
    });

    if (!existing) return apiError("Listing not found", 404);
    if (existing.donorId !== session.user.id) return apiError("Not your listing", 403);
    if (existing.status !== "AVAILABLE") {
      return apiError("Can only edit AVAILABLE listings", 400);
    }

    const body = await req.json();
    const parsed = updateListingSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        parsed.error.issues.map((i) => i.message).join(", "),
        400
      );
    }

    const updateData: any = { ...parsed.data };
    if (updateData.pickupWindowStart) updateData.pickupWindowStart = new Date(updateData.pickupWindowStart);
    if (updateData.pickupWindowEnd) updateData.pickupWindowEnd = new Date(updateData.pickupWindowEnd);
    if (updateData.expiryDate) updateData.expiryDate = new Date(updateData.expiryDate);
    if (updateData.dietaryInfo) updateData.dietaryInfo = updateData.dietaryInfo.join(",");
    if (updateData.allergens) updateData.allergens = updateData.allergens.join(",");

    const listing = await prisma.surplusListing.update({
      where: { id: params.id },
      data: updateData,
    });

    return apiSuccess(listing);
  } catch (error: any) {
    console.error("[PUT /api/listings/:id]", error);
    return apiError("Failed to update listing", 500);
  }
}
