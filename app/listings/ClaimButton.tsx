"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ClaimButton({
  listingId,
  maxQuantity,
}: {
  listingId: string;
  maxQuantity: number;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [verifiedPaymentId, setVerifiedPaymentId] = useState("");

  // UPI payment screen state
  const [upiOrder, setUpiOrder] = useState<{
    orderId: string;
    amount: number;
    upiLink: string;
    qrCode: string;
    quantityClaimed: number;
    pickupEta: string;
    notes: string;
  } | null>(null);

  const [utrNumber, setUtrNumber] = useState("");

  const handleCreateUpiOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const quantityClaimed = parseInt(formData.get("quantity") as string, 10);
    const notes = formData.get("notes") as string;
    const pickupEta = formData.get("pickupEta") as string;

    try {
      console.log("[UPI Payment] Initiating order creation for listing:", listingId);

      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId }),
      });

      const json = await res.json();
      console.log("[UPI Payment] Create order response:", json);

      if (!res.ok || json.error) {
        throw new Error(json.error || "Failed to initiate UPI payment");
      }

      const orderData = json.data || json;
      const { order_id, amount, upi_link, qr_code } = orderData;

      if (!order_id || !upi_link) {
        throw new Error("Invalid UPI payment payload received from server");
      }

      setUpiOrder({
        orderId: order_id,
        amount: amount || 20,
        upiLink: upi_link,
        qrCode: qr_code,
        quantityClaimed,
        pickupEta,
        notes,
      });
    } catch (err: any) {
      console.error("[UPI Payment Error]", err);
      setError(err.message || "Failed to create UPI payment order");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmUpiPayment = async () => {
    if (!upiOrder) return;

    const trimmedUtr = utrNumber.trim();
    if (!trimmedUtr) {
      setError("Please enter the 12-digit UPI Transaction ID / UTR Number from your payment app before confirming.");
      return;
    }

    if (trimmedUtr.length < 6) {
      setError("Please enter a valid UPI Transaction / UTR number (at least 6-12 characters).");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("[UPI Payment] Verifying payment for order:", upiOrder.orderId, "with UTR:", trimmedUtr);

      const res = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: upiOrder.orderId,
          utr_number: trimmedUtr,
          quantityClaimed: upiOrder.quantityClaimed,
          pickupEta: upiOrder.pickupEta,
          notes: upiOrder.notes,
        }),
      });

      const json = await res.json();
      console.log("[UPI Payment] Verification response:", json);

      if (!res.ok || json.error) {
        throw new Error(json.error || "Payment verification failed");
      }

      const data = json.data || json;
      setVerifiedPaymentId(data.payment_id || trimmedUtr);
      setSuccess(true);

      setTimeout(() => {
        setUpiOrder(null);
        setIsOpen(false);
        router.refresh();
      }, 2500);
    } catch (err: any) {
      console.error("[UPI Verification Error]", err);
      setError(err.message || "Payment verification failed");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 transition-colors flex items-center justify-center gap-1.5"
      >
        <span>Claim & Pay ₹20 via UPI</span>
      </button>
    );
  }

  return (
    <div className="mt-4 p-4 border rounded-xl bg-gray-50 border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-gray-900">
          {upiOrder ? "Scan & Pay via UPI" : "Confirm Food Surplus Claim"}
        </h4>
        <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
          Fee: ₹20 (Direct UPI)
        </span>
      </div>

      {error && (
        <div className="mb-3 rounded-md bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {success ? (
        <div className="rounded-md bg-green-50 p-4 text-center border border-green-200">
          <p className="text-sm font-bold text-green-800">✓ ₹20 UPI Payment Verified & Food Claimed!</p>
          <p className="text-xs text-green-600 mt-1">
            Transaction Ref / UTR: <span className="font-mono font-bold">{verifiedPaymentId}</span>
          </p>
          <p className="text-xs text-gray-500 mt-2">Refreshing active listings feed...</p>
        </div>
      ) : upiOrder ? (
        /* ─── UPI QR & Payment Confirmation Screen ────────────────────────────── */
        <div className="space-y-4 text-center">
          <p className="text-xs text-gray-600">
            Scan QR code using any UPI App (Google Pay, PhonePe, Paytm, BHIM) to debit ₹20 and confirm your claim.
          </p>

          {/* Locked Amount Badge */}
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-4 py-1.5 rounded-full">
            <span className="text-xs text-emerald-800 font-semibold">Amount to Pay:</span>
            <span className="text-base font-extrabold text-emerald-900">₹{upiOrder.amount}.00</span>
            <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded font-bold">
              🔒 Fixed
            </span>
          </div>

          {/* UPI QR Code */}
          {upiOrder.qrCode && (
            <div className="flex flex-col items-center justify-center">
              <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-200 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={upiOrder.qrCode}
                  alt="UPI QR Code"
                  className="w-48 h-48 mx-auto"
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5">
                Scan with any UPI app on your phone
              </p>
            </div>
          )}

          {/* Direct Mobile Intent Link */}
          <div>
            <a
              href={upiOrder.upiLink}
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow hover:bg-emerald-500 transition-colors"
            >
              <span>⚡ Open in GPay / PhonePe / Paytm</span>
            </a>
          </div>

          {/* Mandatory UTR / Transaction No Input */}
          <div className="text-left bg-white p-3.5 rounded-lg border border-gray-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="utr-input" className="block text-xs font-bold text-gray-900">
                UPI Transaction ID / 12-Digit UTR Number <span className="text-red-500 font-extrabold">* Required</span>
              </label>
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Mandatory for Verification
              </span>
            </div>
            
            <input
              id="utr-input"
              type="text"
              value={utrNumber}
              onChange={(e) => {
                setUtrNumber(e.target.value);
                if (error) setError("");
              }}
              placeholder="e.g. 12-digit UTR from GPay, PhonePe, Paytm, or bank SMS"
              className={`block w-full rounded-md py-2 px-3 text-gray-900 sm:text-xs font-mono transition-colors ${
                !utrNumber.trim() && error
                  ? "ring-2 ring-red-500 border-red-500 bg-red-50/20"
                  : "ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-green-600 border-0"
              }`}
              required
            />
            
            <div className="bg-slate-50 p-2 rounded text-[11px] text-gray-600 border border-slate-200">
              <span className="font-semibold text-slate-800">📌 How to find your UTR:</span>
              <p className="mt-0.5">
                After paying ₹20, open your payment receipt in Google Pay, PhonePe, or Paytm and copy the <strong>12-digit UPI Transaction ID / UTR</strong> (or check your bank debit SMS notification).
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setUpiOrder(null);
                setError("");
              }}
              disabled={loading}
              className="flex-1 rounded-md bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleConfirmUpiPayment}
              disabled={loading || !utrNumber.trim()}
              className="flex-1 rounded-md bg-green-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition-colors"
              title={!utrNumber.trim() ? "Please enter the UTR number first" : ""}
            >
              {loading ? (
                <>
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-r-transparent"></span>
                  <span>Verifying UTR...</span>
                </>
              ) : (
                <span>✓ Verify UTR & Claim Food</span>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* ─── Claim Details Input Form ────────────────────────────────────────── */
        <form onSubmit={handleCreateUpiOrder} className="space-y-3 text-left">
          {/* Non-Editable Platform Fee Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-gray-700">Platform Convenience Fee</span>
                <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Non-Editable
                </span>
              </div>
              <div className="text-right">
                <span className="text-base font-extrabold text-emerald-700">₹20.00</span>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              Amount of ₹20 will be debited directly from your UPI account and credited to the platform settlement.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">
              Quantity to Claim (Max {maxQuantity})
            </label>
            <input
              type="number"
              name="quantity"
              required
              min="1"
              max={maxQuantity}
              defaultValue={maxQuantity}
              className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 sm:text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">
              Estimated Arrival Time
            </label>
            <input
              type="datetime-local"
              name="pickupEta"
              required
              className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 sm:text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">
              Pickup Notes (Optional)
            </label>
            <input
              type="text"
              name="notes"
              placeholder="e.g. Volunteer vehicle registration or arrival details"
              className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 sm:text-xs"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              disabled={loading}
              className="flex-1 rounded-md bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-md bg-green-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-green-500 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <>
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-r-transparent"></span>
                  <span>Generating UPI QR...</span>
                </>
              ) : (
                <span>Proceed to UPI Payment (₹20)</span>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
