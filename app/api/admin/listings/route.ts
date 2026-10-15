import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { apiError, apiSuccess } from "@/lib/api-utils";

export async function GET(req: Request) {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const city = url.searchParams.get("city");

    const where: any = {};
    if (status && status !== "ALL") {
      where.status = status;
    }
    if (city && city !== "ALL") {
      where.OR = [
        { donor: { city: { contains: city } } },
        { pickupAddress: { contains: city } },
      ];
    }

    const [listings, distinctCities] = await Promise.all([
      prisma.surplusListing.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          donor: {
            select: {
              id: true,
              orgName: true,
              email: true,
              phone: true,
              donorTier: true,
              city: true,
              address: true,
            },
          },
          claims: {
            include: {
              shelter: {
                select: { id: true, orgName: true, phone: true, city: true, address: true },
              },
            },
          },
        },
      }),
      prisma.user.findMany({
        where: { role: "RESTAURANT" },
        select: { city: true },
        distinct: ["city"],
      }),
    ]);

    const activeCities = Array.from(
      new Set(distinctCities.map((d) => d.city).filter(Boolean))
    );

    return apiSuccess({
      listings,
      activeCities,
    });
  } catch (err: any) {
    console.error("[GET /api/admin/listings]", err);
    return apiError("Failed to fetch listings for admin override", 500);
  }
}

export async function PATCH(req: Request) {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  try {
    const body = await req.json();
    const { listingId, status, quantity, expiryDate, pickupAddress } = body;

    if (!listingId) {
      return apiError("Listing ID is required", 400);
    }

    const updated = await prisma.surplusListing.update({
      where: { id: listingId },
      data: {
        ...(status ? { status } : {}),
        ...(typeof quantity === "number" ? { quantity } : {}),
        ...(expiryDate ? { expiryDate: new Date(expiryDate) } : {}),
        ...(pickupAddress ? { pickupAddress } : {}),
      },
      include: {
        donor: true,
      },
    });

    return apiSuccess(updated);
  } catch (err: any) {
    console.error("[PATCH /api/admin/listings]", err);
    return apiError("Failed to update listing override", 500);
  }
}

export async function DELETE(req: Request) {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const listingId = url.searchParams.get("id");

    if (!listingId) {
      return apiError("Listing ID is required", 400);
    }

    // Delete listing
    await prisma.surplusListing.delete({
      where: { id: listingId },
    });

    return apiSuccess({ message: "Listing deleted successfully by administrator" });
  } catch (err: any) {
    console.error("[DELETE /api/admin/listings]", err);
    return apiError("Failed to delete listing", 500);
  }
}
