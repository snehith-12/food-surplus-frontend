import { prisma } from "@/lib/prisma";
import { requireRole, requireAuth } from "@/lib/session";
import { createListingSchema, listingQuerySchema } from "@/lib/validators";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { eventEmitter } from "@/lib/events";

/**
 * GET /api/listings
 * Browse available surplus listings with filtering, sorting, and pagination.
 * Public for browsing AVAILABLE listings; auth'd users see more detail.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams);
    const parsed = listingQuerySchema.safeParse(params);

    if (!parsed.success) {
      return apiError(
        parsed.error.issues.map((i) => i.message).join(", "),
        400
      );
    }

    const { category, city, status, dietary, sort, page, limit } = parsed.data;

    // Build where clause - only show currently active, unexpired listings from restaurants
    const where: any = {
      status: status || "AVAILABLE",
      expiryDate: { gt: new Date() },
      donor: { role: "RESTAURANT" },
    };

    if (category) where.category = category;
    if (city) where.donor = { ...where.donor, city: { contains: city } };
    if (dietary) {
      where.dietaryInfo = { contains: dietary };
    }

    // Build orderBy
    let orderBy: any = { createdAt: "desc" };
    if (sort === "expiring_soon") orderBy = { expiryDate: "asc" };
    if (sort === "quantity") orderBy = { quantity: "desc" };

    // Execute with pagination
    const [listings, total] = await Promise.all([
      prisma.surplusListing.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          donor: {
            select: {
              id: true,
              orgName: true,
              city: true,
              state: true,
              phone: true,
            },
          },
          _count: {
            select: { claims: true },
          },
        },
      }),
      prisma.surplusListing.count({ where }),
    ]);

    return NextResponse.json({
      data: listings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("[GET /api/listings]", error);
    return apiError("Failed to fetch listings", 500);
  }
}

/**
 * POST /api/listings
 * Create a new surplus food listing (RESTAURANT only).
 */
export async function POST(req: Request) {
  const { session, error } = await requireRole("RESTAURANT");
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = createListingSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        parsed.error.issues.map((i) => i.message).join(", "),
        400
      );
    }

    // Fallback coordinates to the donor's coordinates if not provided
    const donor = await prisma.user.findUnique({ where: { id: session.user.id } });
    const pickupLat = parsed.data.pickupLatitude ?? donor?.latitude;
    const pickupLon = parsed.data.pickupLongitude ?? donor?.longitude;

    const listing = await prisma.surplusListing.create({
      data: {
        donorId: session.user.id,
        title: parsed.data.title,
        description: parsed.data.description,
        category: parsed.data.category,
        quantity: parsed.data.quantity,
        unit: parsed.data.unit,
        pickupAddress: parsed.data.pickupAddress,
        pickupLatitude: pickupLat,
        pickupLongitude: pickupLon,
        pickupWindowStart: new Date(parsed.data.pickupWindowStart),
        pickupWindowEnd: new Date(parsed.data.pickupWindowEnd),
        expiryDate: new Date(parsed.data.expiryDate),
        dietaryInfo: parsed.data.dietaryInfo.join(","),
        allergens: parsed.data.allergens.join(","),
        imageUrl: parsed.data.imageUrl,
      },
      include: {
        donor: {
          select: { id: true, orgName: true, city: true, latitude: true, longitude: true },
        },
      },
    });

    // Fire event for WebSocket/SSE connected clients
    eventEmitter.emit("new_listing", listing);

    return apiSuccess(listing, 201);
  } catch (error: any) {
    console.error("[POST /api/listings]", error);
    return apiError("Failed to create listing", 500);
  }
}
