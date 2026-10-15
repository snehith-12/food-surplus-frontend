import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { apiError, apiSuccess } from "@/lib/api-utils";
import {
  PLATFORM_FEE_INR,
  generateUpiIntentUrl,
  generateUpiQrDataUrl,
  getPlatformPayeeName,
} from "@/lib/upi-payments";

export async function POST(req: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const body = await req.json();
    const listingId = body.listing_id || body.listingId;

    if (!listingId) {
      return apiError("Listing ID is required", 400);
    }

    // Verify listing is active and available
    const listing = await prisma.surplusListing.findUnique({
      where: { id: listingId },
      include: { donor: true },
    });

    if (!listing) {
      return apiError("Food surplus listing not found", 404);
    }

    if (listing.status !== "AVAILABLE") {
      return apiError("This food listing has already been claimed or is unavailable", 409);
    }

    // Generate unique UPI order tracking identifier
    const upiOrderId = `upi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const note = `Platform Fee: ${listing.title.slice(0, 20)}`;

    // Build standard NPCI UPI Intent URI and QR Code
    const upiIntentUrl = generateUpiIntentUrl(upiOrderId, note);
    const qrDataUrl = await generateUpiQrDataUrl(upiIntentUrl);

    console.log("[UPI Payment] Created pending UPI payment order:", {
      orderId: upiOrderId,
      amount: PLATFORM_FEE_INR,
      listingId: listing.id,
      shelterId: session.user.id,
    });

    // Record pending transaction in payments table
    await prisma.payment.create({
      data: {
        orderId: upiOrderId,
        amount: PLATFORM_FEE_INR,
        currency: "INR",
        status: "PENDING",
        listingId: listing.id,
        userId: session.user.id,
      },
    });

    // Record in financial ledger for Admin visibility
    await prisma.razorpayTransaction.create({
      data: {
        razorpayOrderId: upiOrderId,
        amount: PLATFORM_FEE_INR,
        currency: "INR",
        status: "PENDING",
        feeType: "PLATFORM_FEE_UPI",
        webhookStatus: "UPI_DIRECT",
        userId: session.user.id,
        listingId: listing.id,
        shelterName: session.user.orgName,
        donorName: listing.donor.orgName,
      },
    });

    return apiSuccess({
      order_id: upiOrderId,
      amount: PLATFORM_FEE_INR,
      currency: "INR",
      upi_link: upiIntentUrl,
      qr_code: qrDataUrl,
      payee_name: getPlatformPayeeName(),
      listing: {
        id: listing.id,
        title: listing.title,
        quantity: listing.quantity,
        unit: listing.unit,
      },
    });
  } catch (err: any) {
    console.error("[POST /api/payments/create-order] Uncaught error:", err);
    return apiError("Failed to initiate UPI payment order", 500);
  }
}
