"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";

interface Claim {
  id: string;
  status: string;
  quantityClaimed: number;
  shelter: {
    orgName: string;
  };
}

interface Listing {
  id: string;
  title: string;
  category: string;
  quantity: number;
  unit: string;
  pickupAddress: string;
  pickupWindowStart: string;
  pickupWindowEnd: string;
  expiryDate: string;
  status: string;
  createdAt: string;
  _count: {
    claims: number;
  };
  claims: Claim[];
}

export default function MyListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [liveAlert, setLiveAlert] = useState<string | null>(null);

  const fetchListings = async () => {
    try {
      const res = await fetch("/api/listings/my");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch listings");
      setListings(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();

    // Real-time synchronization: listen for new listings broadcast
    const eventSource = new EventSource("/api/events");

    eventSource.onmessage = (event) => {
      try {
        const newListing = JSON.parse(event.data);
        // Refresh catalog immediately so newly posted food appears without manual reload
        fetchListings();
        setLiveAlert(`⚡ Listing "${newListing.title}" has been posted and broadcast to all local shelters!`);
      } catch (err) {
        // Ignore heartbeat/ping
      }
    };

    return () => eventSource.close();
  }, []);

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this listing? All pending claims will be rejected.")) {
      return;
    }

    try {
      setCancellingId(id);
      const res = await fetch(`/api/listings/${id}/cancel`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel listing");
      await fetchListings();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "AVAILABLE":
        return <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-600/20">Available</span>;
      case "CLAIMED":
        return <span className="inline-flex items-center rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-yellow-800 ring-1 ring-inset ring-yellow-600/20">Fully Claimed</span>;
      case "PICKED_UP":
        return <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 ring-1 ring-inset ring-purple-700/20">Picked Up</span>;
      case "CANCELLED":
        return <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 ring-1 ring-inset ring-gray-500/20">Cancelled</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard" className="text-sm font-medium text-gray-500 hover:text-gray-700">
                &larr; Dashboard
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mt-1">My Surplus Listings</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage your food donations, track shelter claims, and monitor distribution in real time.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/claims/incoming"
              className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Review Claims
            </Link>
            <Link
              href="/dashboard/listings/new"
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500"
            >
              + Post New Surplus
            </Link>
          </div>
        </div>

        {/* Live sync alert banner */}
        {liveAlert && (
          <div className="mb-6 rounded-xl bg-green-50 border border-green-200 p-4 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-3">
              <span className="text-xl">✅</span>
              <p className="text-sm font-bold text-green-900">{liveAlert}</p>
            </div>
            <button
              onClick={() => setLiveAlert(null)}
              className="rounded-md bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 hover:bg-green-200"
            >
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-green-600 border-r-transparent"></div>
            <p className="mt-3 text-sm text-gray-500">Loading your listings...</p>
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5">
            <div className="text-4xl mb-3">📦</div>
            <h3 className="text-lg font-semibold text-gray-900">No surplus listings yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              You haven't posted any food surplus listings yet.
            </p>
            <div className="mt-6">
              <Link
                href="/dashboard/listings/new"
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500"
              >
                Create Your First Listing
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-6 transition-all hover:shadow-md"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-lg font-bold text-gray-900">{listing.title}</h3>
                      {getStatusBadge(listing.status)}
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                        {listing.category}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-600">
                      <div>
                        <span className="font-medium text-gray-900">Quantity:</span> {listing.quantity} {listing.unit}
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">Expires:</span> {format(new Date(listing.expiryDate), "MMM d, h:mm a")}
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">Pickup Window:</span> {format(new Date(listing.pickupWindowStart), "h:mm a")} - {format(new Date(listing.pickupWindowEnd), "h:mm a")}
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">Claims:</span> {listing._count.claims} shelter(s)
                      </div>
                    </div>

                    {listing.claims && listing.claims.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Claimed by:</p>
                        <div className="flex flex-wrap gap-2">
                          {listing.claims.map((claim) => (
                            <span
                              key={claim.id}
                              className="inline-flex items-center gap-1.5 rounded-md bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200"
                            >
                              <span>{claim.shelter.orgName}</span>
                              <span className="text-gray-400">({claim.quantityClaimed} {listing.unit})</span>
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                claim.status === "APPROVED" ? "bg-green-100 text-green-800" :
                                claim.status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                                claim.status === "PICKED_UP" ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-800"
                              }`}>
                                {claim.status}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex sm:flex-col lg:flex-row items-center gap-2 pt-4 lg:pt-0 border-t lg:border-t-0 border-gray-100">
                    <Link
                      href="/dashboard/claims/incoming"
                      className="flex-1 sm:w-full text-center rounded-md bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-600/20 hover:bg-green-100"
                    >
                      Review Claims
                    </Link>
                    {(listing.status === "AVAILABLE" || listing.status === "CLAIMED") && (
                      <button
                        onClick={() => handleCancel(listing.id)}
                        disabled={cancellingId === listing.id}
                        className="flex-1 sm:w-full rounded-md bg-white px-3 py-2 text-xs font-semibold text-red-600 ring-1 ring-inset ring-red-300 hover:bg-red-50 disabled:opacity-50"
                      >
                        {cancellingId === listing.id ? "Cancelling..." : "Cancel Listing"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
