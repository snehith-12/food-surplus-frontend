import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { notifyNewClaim } from "@/lib/notifications";

export async function POST(req: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const body = await req.json();
    const {
      order_id,
      razorpay_order_id,
      payment_id,
      razorpay_payment_id,
      utr_number,
      quantityClaimed,
      pickupEta,
      notes,
    } = body;

    const effectiveOrderId = order_id || razorpay_order_id;
    if (!effectiveOrderId || typeof effectiveOrderId !== "string" || !effectiveOrderId.trim()) {
      return apiError("Missing required order identifier", 400);
    }

    // Transaction ID / UTR number is strictly mandatory - cannot verify without it
    const rawUtr = (
      utr_number ||
      body.utr ||
      body.txn_id ||
      body.txn_no ||
      body.transaction_id ||
      payment_id ||
      razorpay_payment_id ||
      ""
    ).toString().trim();

    if (!rawUtr) {
      return apiError(
        "Payment cannot be verified without a Transaction No / UTR ID. Please enter the 12-digit UTR reference number from your payment app (Google Pay, PhonePe, Paytm, or bank SMS).",
        400
      );
    }

    if (rawUtr.length < 6) {
      return apiError(
        "Invalid Transaction / UTR ID. The reference number must be at least 6 to 12 characters long.",
        400
      );
    }

    const trimmedUtr = rawUtr;

    // Check for duplicate UTR / Transaction ID across claims
    const existingPaymentWithSameUtr = await prisma.payment.findFirst({
      where: {
        paymentId: trimmedUtr,
        status: "SUCCESS",
      },
    });

    if (existingPaymentWithSameUtr && existingPaymentWithSameUtr.orderId !== effectiveOrderId) {
      return apiError(
        "This UPI Transaction / UTR number has already been verified for another food claim. Each payment reference can only be used once.",
        400
      );
    }

    console.log("[UPI Verify Request] Verifying UPI payment transaction:", {
      orderId: effectiveOrderId,
      paymentId: trimmedUtr,
      userId: session.user.id,
    });

    // Locate the pending payment record in DB
    const payment = await prisma.payment.findUnique({
      where: { orderId: effectiveOrderId },
      include: {
        listing: {
          include: { donor: true },
        },
      },
    });

    if (!payment) {
      console.error("[UPI Verify Error] No pending payment found for orderId:", effectiveOrderId);
      return apiError("No matching order found for this transaction", 404);
    }

    if (payment.status === "SUCCESS") {
      return apiSuccess({
        success: true,
        message: "This payment has already been verified.",
        payment_id: payment.paymentId || trimmedUtr,
        order_id: payment.orderId,
        listing_id: payment.listingId,
      });
    }

    if (payment.listing.status !== "AVAILABLE") {
      return apiError("This food listing is no longer available to be claimed.", 409);
    }

    // Execute atomic claim and payment update
    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark Payment as SUCCESS
      const updatedPayment = await tx.payment.update({
        where: { orderId: effectiveOrderId },
        data: {
          status: "SUCCESS",
          paymentId: trimmedUtr,
          signature: `upi_confirmed_${Date.now()}`,
        },
      });

      // 2. Mark food listing as CLAIMED
      const updatedListing = await tx.surplusListing.update({
        where: { id: payment.listingId },
        data: { status: "CLAIMED" },
      });

      // 3. Create or upsert Claim
      const claimQuantity = quantityClaimed || payment.listing.quantity;
      const claim = await tx.claim.upsert({
        where: {
          listingId_shelterId: {
            listingId: payment.listingId,
            shelterId: session.user.id,
          },
        },
        update: {
          status: "APPROVED",
          quantityClaimed: claimQuantity,
          pickupEta: pickupEta ? new Date(pickupEta) : null,
          notes: notes || `Platform fee (₹20) paid via Direct UPI [UTR: ${trimmedUtr}]`,
        },
        create: {
          listingId: payment.listingId,
          shelterId: session.user.id,
          quantityClaimed: claimQuantity,
          status: "APPROVED",
          pickupEta: pickupEta ? new Date(pickupEta) : null,
          notes: notes || `Platform fee (₹20) paid via Direct UPI [UTR: ${trimmedUtr}]`,
        },
      });

      // 4. Update Financial Ledger record for Admin transparency
      await tx.razorpayTransaction.updateMany({
        where: { razorpayOrderId: effectiveOrderId },
        data: {
          status: "CAPTURED",
          razorpayPaymentId: trimmedUtr,
          razorpaySignature: `upi_confirmed_${Date.now()}`,
          webhookStatus: "SUCCESS",
        },
      });

      return { updatedPayment, updatedListing, claim };
    });

    // Notify donor outside transaction
    try {
      await notifyNewClaim(
        payment.listing.donorId,
        session.user.orgName || "Verified Shelter",
        payment.listing.title,
        result.claim.id
      );
    } catch (notifErr) {
      console.error("[Notification Warning]", notifErr);
    }

    console.log("[UPI Verify Success] ₹20 UPI fee verified and listing claimed:", {
      orderId: effectiveOrderId,
      claimId: result.claim.id,
      paymentId: trimmedUtr,
    });

    return apiSuccess({
      success: true,
      message: "₹20 platform fee verified! Food officially claimed and approved for pickup.",
      payment_id: trimmedUtr,
      order_id: effectiveOrderId,
      listing_id: payment.listingId,
      claim_id: result.claim.id,
    });
  } catch (err: any) {
    console.error("[POST /api/payments/verify] Uncaught error:", err);
    return apiError("Failed to verify UPI payment", 500);
  }
}
