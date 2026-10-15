"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";

interface IncomingClaim {
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
    status: string;
    pickupWindowStart: string;
    pickupWindowEnd: string;
  };
  shelter: {
    id: string;
    orgName: string;
    contactName: string;
    phone: string;
    city: string;
  };
}

export default function IncomingClaimsPage() {
  const [claims, setClaims] = useState<IncomingClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");

  const fetchClaims = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/claims/incoming");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch incoming claims");
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

  const handleRespond = async (claimId: string, action: "APPROVE" | "REJECT") => {
    const confirmMsg = action === "APPROVE"
      ? "Approve this shelter's claim for food surplus?"
      : "Reject this claim?";
    if (!confirm(confirmMsg)) return;

    try {
      setProcessingId(claimId);
      const res = await fetch(`/api/claims/${claimId}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action.toLowerCase()} claim`);
      await fetchClaims();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmPickup = async (claimId: string) => {
    if (!confirm("Confirm that this shelter has picked up the food?")) return;

    try {
      setProcessingId(claimId);
      const res = await fetch(`/api/claims/${claimId}/pickup`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to confirm pickup");
      await fetchClaims();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredClaims = claims.filter((claim) => {
    if (filter === "ALL") return true;
    return claim.status === filter;
  });

  const pendingCount = claims.filter((c) => c.status === "PENDING").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <span className="inline-flex items-center rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-bold text-yellow-800 ring-1 ring-inset ring-yellow-600/20">Pending Review</span>;
      case "APPROVED":
        return <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700 ring-1 ring-inset ring-green-600/20">Approved (Ready for Pickup)</span>;
      case "PICKED_UP":
        return <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-700 ring-1 ring-inset ring-purple-700/20">Picked Up</span>;
      case "REJECTED":
        return <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 ring-1 ring-inset ring-red-600/20">Rejected</span>;
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
            <h1 className="text-3xl font-bold text-gray-900 mt-1">Review Incoming Claims</h1>
            <p className="mt-1 text-sm text-gray-600">
              Shelters requesting food surplus from your kitchen. Review, approve, and confirm pickups.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/listings"
              className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              My Listings
            </Link>
            <Link
              href="/dashboard/listings/new"
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500"
            >
              + Post New Surplus
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Filter pills */}
        <div className="mb-6 flex flex-wrap gap-2">
          {["ALL", "PENDING", "APPROVED", "PICKED_UP", "REJECTED"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                filter === tab
                  ? "bg-green-600 text-white shadow-sm"
                  : "bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50"
              }`}
            >
              {tab === "ALL" && "All Claims"}
              {tab === "PENDING" && `Pending Review ${pendingCount > 0 ? `(${pendingCount})` : ""}`}
              {tab === "APPROVED" && "Approved"}
              {tab === "PICKED_UP" && "Completed Pickups"}
              {tab === "REJECTED" && "Rejected"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-green-600 border-r-transparent"></div>
            <p className="mt-3 text-sm text-gray-500">Loading incoming claims...</p>
          </div>
        ) : filteredClaims.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5">
            <div className="text-4xl mb-3">🤝</div>
            <h3 className="text-lg font-semibold text-gray-900">
              {filter === "ALL" ? "No incoming claims yet" : `No ${filter.toLowerCase()} claims found`}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              When local shelters claim your surplus food listings, they will appear right here for approval.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredClaims.map((claim) => (
              <div
                key={claim.id}
                className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-6 transition-all hover:shadow-md"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-base font-bold text-gray-900">
                        {claim.shelter.orgName}
                      </span>
                      {getStatusBadge(claim.status)}
                      <span className="text-xs text-gray-500">
                        Requested on {format(new Date(claim.createdAt), "MMM d, h:mm a")}
                      </span>
                    </div>

                    <div className="mt-4 rounded-lg bg-gray-50 p-4 ring-1 ring-inset ring-gray-100">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Listing Details
                      </div>
                      <div className="mt-1 text-sm font-bold text-gray-900">
                        {claim.listing.title}
                      </div>
                      <div className="mt-1 text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                        <span>
                          <strong className="text-gray-900">Claimed Quantity:</strong> {claim.quantityClaimed} {claim.listing.unit} (out of {claim.listing.quantity})
                        </span>
                        <span>
                          <strong className="text-gray-900">Pickup Window:</strong> {format(new Date(claim.listing.pickupWindowStart), "h:mm a")} - {format(new Date(claim.listing.pickupWindowEnd), "h:mm a")}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="font-medium text-gray-500">Contact Person:</span>
                        <p className="text-gray-900 font-semibold mt-0.5">{claim.shelter.contactName}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500">Phone Number:</span>
                        <p className="text-gray-900 font-semibold mt-0.5">{claim.shelter.phone}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500">Shelter ETA:</span>
                        <p className="text-gray-900 font-semibold mt-0.5">
                          {claim.pickupEta ? format(new Date(claim.pickupEta), "MMM d, h:mm a") : "Not specified"}
                        </p>
                      </div>
                    </div>

                    {claim.notes && (
                      <div className="mt-3 text-xs bg-blue-50/60 p-3 rounded-md border border-blue-100">
                        <strong className="text-blue-900">Shelter Note:</strong>{" "}
                        <span className="text-blue-800">{claim.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions column */}
                  <div className="flex lg:flex-col gap-2 min-w-[160px] pt-4 lg:pt-0 border-t lg:border-t-0 border-gray-100">
                    {claim.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => handleRespond(claim.id, "APPROVE")}
                          disabled={processingId === claim.id}
                          className="flex-1 rounded-md bg-green-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50"
                        >
                          {processingId === claim.id ? "Processing..." : "✓ Approve Claim"}
                        </button>
                        <button
                          onClick={() => handleRespond(claim.id, "REJECT")}
                          disabled={processingId === claim.id}
                          className="flex-1 rounded-md bg-white px-4 py-2.5 text-xs font-semibold text-red-600 ring-1 ring-inset ring-red-300 hover:bg-red-50 disabled:opacity-50"
                        >
                          ✕ Reject Claim
                        </button>
                      </>
                    )}

                    {claim.status === "APPROVED" && (
                      <button
                        onClick={() => handleConfirmPickup(claim.id)}
                        disabled={processingId === claim.id}
                        className="w-full rounded-md bg-purple-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-purple-500 disabled:opacity-50"
                      >
                        {processingId === claim.id ? "Updating..." : "📦 Confirm Pickup"}
                      </button>
                    )}

                    {claim.status === "PICKED_UP" && (
                      <span className="text-center text-xs text-gray-500 py-2">
                        Pickup completed
                      </span>
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
