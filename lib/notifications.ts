import { prisma } from "./prisma";

interface CreateNotificationParams {
  userId: string;
  type:
    | "NEW_CLAIM"
    | "CLAIM_APPROVED"
    | "CLAIM_REJECTED"
    | "PICKUP_CONFIRMED"
    | "LISTING_EXPIRING"
    | "WELCOME"
    | "KYC_APPROVED"
    | "KYC_REJECTED"
    | "ACCOUNT_SUSPENDED"
    | "ACCOUNT_REINSTATED";
  title: string;
  message: string;
  referenceId?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      referenceId: params.referenceId,
    },
  });
}

// ─── Convenience helpers ────────────────────────────────────────────────────

export async function notifyNewClaim(
  donorId: string,
  shelterName: string,
  listingTitle: string,
  claimId: string
) {
  return createNotification({
    userId: donorId,
    type: "NEW_CLAIM",
    title: "New Claim on Your Listing",
    message: `${shelterName} has claimed "${listingTitle}".`,
    referenceId: claimId,
  });
}

export async function notifyClaimApproved(
  shelterId: string,
  listingTitle: string,
  claimId: string
) {
  return createNotification({
    userId: shelterId,
    type: "CLAIM_APPROVED",
    title: "Claim Approved!",
    message: `Your claim on "${listingTitle}" has been approved. Please arrange pickup.`,
    referenceId: claimId,
  });
}

export async function notifyClaimRejected(
  shelterId: string,
  listingTitle: string,
  claimId: string
) {
  return createNotification({
    userId: shelterId,
    type: "CLAIM_REJECTED",
    title: "Claim Rejected",
    message: `Your claim on "${listingTitle}" was not approved.`,
    referenceId: claimId,
  });
}

export async function notifyPickupConfirmed(
  userId: string,
  listingTitle: string,
  claimId: string
) {
  return createNotification({
    userId,
    type: "PICKUP_CONFIRMED",
    title: "Pickup Confirmed",
    message: `Pickup for "${listingTitle}" has been confirmed. Thank you!`,
    referenceId: claimId,
  });
}
