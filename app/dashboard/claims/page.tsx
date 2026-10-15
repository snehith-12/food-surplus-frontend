"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";

interface ShelterClaim {
  id: string;
  status: string;
  quantityClaimed: number;
  pickupEta: string | null;
  notes: string | null;
  donorNotes: string | null;
  createdAt: string;
  listing: {
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
    donor: {
      orgName: string;
      contactName: string;
      phone: string;
    };
  };
}

export default function MyClaimsPage() {
  const [claims, setClaims] = useState<ShelterClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchClaims = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/claims");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch claims");
      setClaims(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, []);

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this claim?")) return;

    try {
      setCancellingId(id);
      const res = await fetch(`/api/claims/${id}/cancel`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel claim");
      await fetchClaims();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <span className="inline-flex items-center rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-bold text-yellow-800 ring-1 ring-inset ring-yellow-600/20">Pending Restaurant Approval</span>;
      case "APPROVED":
        return <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700 ring-1 ring-inset ring-green-600/20">Approved (Ready for Pickup)</span>;
      case "PICKED_UP":
        return <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-700 ring-1 ring-inset ring-purple-700/20">Picked Up</span>;
      case "REJECTED":
        return <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 ring-1 ring-inset ring-red-600/20">Rejected by Restaurant</span>;
      case "CANCELLED":
        return <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600 ring-1 ring-inset ring-gray-500/20">Cancelled</span>;
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
            <h1 className="text-3xl font-bold text-gray-900 mt-1">My Food Claims</h1>
            <p className="mt-1 text-sm text-gray-600">
              Track the status of food surplus you have claimed for your shelter.
            </p>
          </div>
          <Link
            href="/listings"
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500"
          >
            Browse Shelter Feed &rarr;
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-green-600 border-r-transparent"></div>
            <p className="mt-3 text-sm text-gray-500">Loading your claims...</p>
          </div>
        ) : claims.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5">
            <div className="text-4xl mb-3">🍲</div>
            <h3 className="text-lg font-semibold text-gray-900">No claims yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Browse available surplus food nearby and claim meals for your shelter.
            </p>
            <div className="mt-6">
              <Link
                href="/listings"
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500"
              >
                Browse Available Surplus
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {claims.map((claim) => (
              <div
                key={claim.id}
                className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-6 transition-all hover:shadow-md"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-lg font-bold text-gray-900">{claim.listing.title}</h3>
                      {getStatusBadge(claim.status)}
                      <span className="text-xs text-gray-500">
                        Claimed {format(new Date(claim.createdAt), "MMM d, h:mm a")}
                      </span>
                    </div>

                    <p className="mt-1 text-sm font-semibold text-green-700">
                      Donor: {claim.listing.donor.orgName}
                    </p>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-600">
                      <div>
                        <span className="font-medium text-gray-900">Quantity:</span> {claim.quantityClaimed} {claim.listing.unit}
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">Pickup Address:</span> {claim.listing.pickupAddress}
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">Donor Phone:</span> {claim.listing.donor.phone}
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">Your ETA:</span> {claim.pickupEta ? format(new Date(claim.pickupEta), "MMM d, h:mm a") : "Not set"}
                      </div>
                    </div>

                    {claim.notes && (
                      <p className="mt-2 text-xs text-gray-500 italic">
                        Your note: "{claim.notes}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-4 lg:pt-0 border-t lg:border-t-0 border-gray-100">
                    {(claim.status === "PENDING" || claim.status === "APPROVED") && (
                      <button
                        onClick={() => handleCancel(claim.id)}
                        disabled={cancellingId === claim.id}
                        className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-red-600 ring-1 ring-inset ring-red-300 hover:bg-red-50 disabled:opacity-50"
                      >
                        {cancellingId === claim.id ? "Cancelling..." : "Cancel Claim"}
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
