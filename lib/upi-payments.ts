import QRCode from "qrcode";

export const PLATFORM_FEE_INR = Number(process.env.PLATFORM_FEE_INR || 20);
export const PLATFORM_FEE_PAISE = Math.round(PLATFORM_FEE_INR * 100); // 2000 paise for ₹20

/**
 * Returns the platform UPI VPA / ID securely from environment
 * No raw phone number or UPI is hardcoded anywhere in the codebase.
 */
export function getPlatformUpiId(): string {
  if (process.env.PLATFORM_UPI_ID) {
    return process.env.PLATFORM_UPI_ID.trim();
  }
  if (process.env.PLATFORM_UPI_NUMBER) {
    return `${process.env.PLATFORM_UPI_NUMBER.trim()}@upi`;
  }
  return "";
}

export function getPlatformPayeeName(): string {
  return process.env.PLATFORM_PAYEE_NAME || "Food Surplus Router";
}

/**
 * Generates an NPCI-compliant UPI deep link intent URI.
 * Locks the amount strictly to 20.00 INR and attaches order tracking reference.
 */
export function generateUpiIntentUrl(orderId: string, note?: string): string {
  const upiId = getPlatformUpiId();
  const payeeName = getPlatformPayeeName();
  const amountStr = Number(PLATFORM_FEE_INR).toFixed(2);
  const transactionNote = note || `Platform Fee for Order ${orderId.slice(-6)}`;

  // NPCI standard UPI URI format
  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName,
    am: amountStr,
    cu: "INR",
    tn: transactionNote,
    tr: orderId,
  });

  return `upi://pay?${params.toString()}`;
}

/**
 * Generates a high-resolution base64 PNG data URL for scanning via any UPI app.
 */
export async function generateUpiQrDataUrl(upiIntentUrl: string): Promise<string> {
  return QRCode.toDataURL(upiIntentUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 280,
    color: {
      dark: "#0f172a", // Slate 900
      light: "#ffffff",
    },
  });
}
