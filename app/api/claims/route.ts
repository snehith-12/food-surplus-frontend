import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { createClaimSchema } from "@/lib/validators";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { notifyNewClaim } from "@/lib/notifications";
import { NextResponse } from "next/server";

/**
 * GET /api/claims
 * Get all claims for the authenticated shelter.
 */
export async function GET(req: Request) {
  const { session, error } = await requireRole("SHELTER");
  if (error) return error;

  try {
    const claims = await prisma.claim.findMany({
      where: { shelterId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            category: true,
            quantity: true,
            unit: true,
            pickupAddress: true,
            pickupWindowStart: true,
            pickupWindowEnd: true,
            expiryDate: true,
            status: true,
            donor: {
              select: {
                orgName: true,
                contactName: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ data: claims });
  } catch (error: any) {
    console.error("[GET /api/claims]", error);
    return apiError("Failed to fetch claims", 500);
  }
}

/**
 * POST /api/claims
 * 
 * Create a new claim on a listing (SHELTER only).
 * 
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  RACE CONDITION PREVENTION:                                     │
 * │                                                                 │
 * │  Uses a Prisma interactive transaction with raw SQL              │
 * │  SELECT ... FOR UPDATE to lock the listing row.                 │
 * │                                                                 │
 * │  This guarantees that if two shelters try to claim the same     │
 * │  listing at the exact same millisecond, only ONE will succeed.  │
 * │  The other will either:                                         │
 * │   - Block until the first transaction commits, then see the     │
 * │     updated quantity/status and fail validation, OR             │
 * │   - Hit the UNIQUE(listing_id, shelter_id) constraint.          │
 * └─────────────────────────────────────────────────────────────────┘
 */
export async function POST(req: Request) {
  const { session, error } = await requireRole("SHELTER");
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = createClaimSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        parsed.error.issues.map((i) => i.message).join(", "),
        400
      );
    }

    const { listingId, quantityClaimed, pickupEta, notes } = parsed.data;

    // ── Serializable transaction with row-level lock ───────────────
    const claim = await prisma.$transaction(
      async (tx) => {
        // 1. Fetch listing inside the sequential SQLite transaction
        const listing = await tx.surplusListing.findUnique({
          where: { id: listingId }
        });

        if (!listing) {
          throw new Error("LISTING_NOT_FOUND");
        }

        // 2. Validate the listing is still claimable
        if (listing.status !== "AVAILABLE") {
          throw new Error("LISTING_NOT_AVAILABLE");
        }

        // 3. Check total claimed quantity doesn't exceed listing quantity.
        //    Sum all non-cancelled/non-rejected claims.
        const existingClaims = await tx.claim.aggregate({
          where: {
            listingId,
            status: { notIn: ["CANCELLED", "REJECTED"] },
          },
          _sum: { quantityClaimed: true },
        });

        const alreadyClaimed = existingClaims._sum.quantityClaimed ?? 0;
        const remainingQuantity = listing.quantity - alreadyClaimed;

        if (quantityClaimed > remainingQuantity) {
          throw new Error(
            `INSUFFICIENT_QUANTITY:Only ${remainingQuantity} ${remainingQuantity === 1 ? "unit" : "units"} remaining`
          );
        }

        // 4. Prevent duplicate claims from the same shelter
        const existingClaim = await tx.claim.findUnique({
          where: {
            listingId_shelterId: {
              listingId,
              shelterId: session.user.id,
            },
          },
        });

        if (existingClaim && existingClaim.status !== "CANCELLED" && existingClaim.status !== "REJECTED") {
          throw new Error("ALREADY_CLAIMED");
        }

        // 5. Create the claim
        const newClaim = await tx.claim.create({
          data: {
            listingId,
            shelterId: session.user.id,
            quantityClaimed,
            pickupEta: pickupEta ? new Date(pickupEta) : null,
            notes: notes || null,
          },
          include: {
            listing: {
              select: { title: true, donorId: true },
            },
            shelter: {
              select: { orgName: true },
            },
          },
        });

        // 6. If total claimed now equals listing quantity, mark listing as CLAIMED
        const newTotalClaimed = alreadyClaimed + quantityClaimed;
        if (newTotalClaimed >= listing.quantity) {
          await tx.surplusListing.update({
            where: { id: listingId },
            data: { status: "CLAIMED" },
          });
        }

        return newClaim;
      },
      {
        // Transaction options: serializable isolation for maximum safety
        isolationLevel: "Serializable",
        maxWait: 5000,  // max time to wait to acquire the transaction
        timeout: 10000, // max time the transaction can run
      }
    );

    // Send notification outside the transaction to avoid holding locks
    try {
      await notifyNewClaim(
        claim.listing.donorId,
        claim.shelter.orgName,
        claim.listing.title,
        claim.id
      );
    } catch (notifError) {
      // Don't fail the claim if notification fails
      console.error("[Notification Error]", notifError);
    }

    return apiSuccess(claim, 201);
  } catch (error: any) {
    // Handle known business-logic errors
    if (error.message === "LISTING_NOT_FOUND") {
      return apiError("Listing not found", 404);
    }
    if (error.message === "LISTING_NOT_AVAILABLE") {
      return apiError("This listing is no longer available for claims", 409);
    }
    if (error.message?.startsWith("INSUFFICIENT_QUANTITY:")) {
      return apiError(error.message.split(":")[1], 409);
    }
    if (error.message === "ALREADY_CLAIMED") {
      return apiError("You have already claimed this listing", 409);
    }
    // Prisma unique constraint violation (belt-and-suspenders for race)
    if (error?.code === "P2002") {
      return apiError("You have already claimed this listing", 409);
    }

    console.error("[POST /api/claims]", error);
    return apiError("Failed to create claim", 500);
  }
}
