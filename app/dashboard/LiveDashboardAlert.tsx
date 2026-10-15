"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface LiveAlertProps {
  role: "RESTAURANT" | "SHELTER";
  userId: string;
}

export default function LiveDashboardAlert({ role, userId }: LiveAlertProps) {
  const [alertData, setAlertData] = useState<{
    id: string;
    title: string;
    quantity: number;
    unit: string;
    orgName: string;
    isOwnListing: boolean;
  } | null>(null);

  useEffect(() => {
    const eventSource = new EventSource("/api/events");

    eventSource.onmessage = (event) => {
      try {
        const listing = JSON.parse(event.data);
        if (!listing || !listing.id) return;

        const isOwn = listing.donorId === userId;

        setAlertData({
          id: listing.id,
          title: listing.title,
          quantity: listing.quantity,
          unit: listing.unit,
          orgName: listing.donor?.orgName || "Local Restaurant",
          isOwnListing: isOwn,
        });
      } catch (err) {
        // Ignore keepalive ping
      }
    };

    return () => eventSource.close();
  }, [userId]);

  if (!alertData) return null;

  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 p-4 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-bounce-once">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-xl">
          {alertData.isOwnListing ? "✅" : "🍲"}
        </span>
        <div>
          <p className="text-sm font-extrabold">
            {alertData.isOwnListing
              ? `Listing Broadcast Live: "${alertData.title}"`
              : `New Food Surplus Alert: "${alertData.title}" (${alertData.quantity} ${alertData.unit})`}
          </p>
          <p className="text-xs text-emerald-100 mt-0.5">
            {alertData.isOwnListing
              ? "Your food surplus item is now live and claimable across all nearby shelters."
              : `Just posted by ${alertData.orgName}. Claim it before other shelters reserve it!`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={alertData.isOwnListing ? "/dashboard/listings" : "/listings"}
          className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-emerald-800 shadow-sm hover:bg-emerald-50 transition-colors shrink-0"
        >
          {alertData.isOwnListing ? "View My Listings &rarr;" : "View & Claim Food &rarr;"}
        </Link>
        <button
          onClick={() => setAlertData(null)}
          className="rounded-xl bg-black/20 px-3 py-2 text-xs font-semibold text-white hover:bg-black/30"
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
