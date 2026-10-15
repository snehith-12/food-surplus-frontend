"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";

interface AdminOverviewData {
  overview: {
    totalUsers: number;
    sheltersCount: number;
    pendingKycCount: number;
    verifiedSheltersCount: number;
    donorsCount: number;
    enterpriseDonors: number;
    activeListingsCount: number;
    totalListingsCount: number;
    openDisputesCount: number;
    razorpayFailedWebhooks: number;
  };
  financials: {
    totalRevenueInr: number;
    capturedTransactionsCount: number;
    currency: string;
  };
  esg: {
    totalMealsRescued: number;
    totalWeightKg: number;
    co2OffsetKg: number;
    methaneAvoidedKg: number;
    waterSavedLiters: number;
    landfillDiversionTons: number;
  };
}

const CITY_ZONES_CONFIG: Record<
  string,
  { name: string; lat: number; lng: number; description: string }
> = {
  Hyderabad: {
    name: "Hyderabad Metro",
    lat: 17.4233,
    lng: 78.6499,
    description: "Telangana Hub (Ghatkesar / Venkatapur / Medchal-Malkajgiri)",
  },
  Bengaluru: {
    name: "Bengaluru Metro",
    lat: 12.9716,
    lng: 77.5946,
    description: "Karnataka Hub (Indiranagar / Koramangala / Whitefield)",
  },
  Mumbai: {
    name: "Mumbai Metropolitan",
    lat: 19.076,
    lng: 72.8777,
    description: "Maharashtra Hub (BKC / Andheri / South Mumbai)",
  },
  "Delhi-NCR": {
    name: "Delhi-NCR Capital Region",
    lat: 28.6139,
    lng: 77.209,
    description: "National Capital Region (Connaught Place / Gurugram / Noida)",
  },
  Chennai: {
    name: "Chennai Coastal Zone",
    lat: 13.0827,
    lng: 80.2707,
    description: "Tamil Nadu Hub (T. Nagar / Anna Nagar / OMR)",
  },
  Pune: {
    name: "Pune Metro Zone",
    lat: 18.5204,
    lng: 73.8567,
    description: "Maharashtra Hub (Kothrud / Hinjawadi / Viman Nagar)",
  },
};

export default function AdminDashboardClient({ adminEmail }: { adminEmail: string }) {
  const [activeTab, setActiveTab] = useState<"compliance" | "logistics" | "esg">("logistics");
  const [subTab, setSubTab] = useState<string>("heatmap");

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);

  // Compliance state
  const [shelters, setShelters] = useState<any[]>([]);
  const [donors, setDonors] = useState<any[]>([]);
  const [razorpayLedger, setRazorpayLedger] = useState<any[]>([]);
  const [razorpayAnalytics, setRazorpayAnalytics] = useState<any>(null);

  // Logistics state
  const [listings, setListings] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [mapFilter, setMapFilter] = useState<string>("ALL");
  const [selectedMapNode, setSelectedMapNode] = useState<any>(null);

  // City Zone state for Logistics & Live Operations
  const [selectedCityZone, setSelectedCityZone] = useState<string>("Hyderabad");
  const [customCityInput, setCustomCityInput] = useState<string>("");
  const [showCustomCityInput, setShowCustomCityInput] = useState<boolean>(false);

  // ESG state
  const [esgData, setEsgData] = useState<any>(null);

  // Modals & action feedback
  const [actionMessage, setActionMessage] = useState<string>("");
  const [rejectModalShelter, setRejectModalShelter] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");
  const [disputeModal, setDisputeModal] = useState<any | null>(null);
  const [disputeResolution, setDisputeResolution] = useState<string>("");
  const [disputePenaltyPoints, setDisputePenaltyPoints] = useState<number>(5);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [ovRes, kycRes, donorRes, rzpRes, listRes, dispRes, esgRes] = await Promise.all([
        fetch("/api/admin/overview"),
        fetch("/api/admin/kyc"),
        fetch("/api/admin/donors"),
        fetch("/api/admin/razorpay"),
        fetch("/api/admin/listings"),
        fetch("/api/admin/disputes"),
        fetch("/api/admin/esg"),
      ]);

      const [ov, kyc, don, rzp, list, disp, esg] = await Promise.all([
        ovRes.json(),
        kycRes.json(),
        donorRes.json(),
        rzpRes.json(),
        listRes.json(),
        dispRes.json(),
        esgRes.json(),
      ]);

      if (ov.data) setOverview(ov.data);
      if (kyc.data) setShelters(kyc.data.shelters || []);
      if (don.data) setDonors(don.data.donors || []);
      if (rzp.data) {
        setRazorpayLedger(rzp.data.ledger || []);
        setRazorpayAnalytics(rzp.data.analytics || null);
      }
      if (list.data) setListings(list.data.listings || []);
      if (disp.data) setDisputes(disp.data.disputes || []);
      if (esg.data) setEsgData(esg.data);
    } catch (err) {
      console.error("Failed to load admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Filter listings based on the selected City Zone
  const filteredListings = useMemo(() => {
    if (selectedCityZone === "ALL") return listings;

    return listings.filter((item) => {
      const city = item.donor?.city || "";
      const address = item.pickupAddress || "";
      const zoneQuery = selectedCityZone.toLowerCase();

      return (
        city.toLowerCase().includes(zoneQuery) ||
        address.toLowerCase().includes(zoneQuery)
      );
    });
  }, [listings, selectedCityZone]);

  // Active City Zone Metadata
  const currentZoneMeta = useMemo(() => {
    if (CITY_ZONES_CONFIG[selectedCityZone]) {
      return CITY_ZONES_CONFIG[selectedCityZone];
    }
    return {
      name: `${selectedCityZone} Zone`,
      lat: 17.385,
      lng: 78.4867,
      description: `Custom Regional Zone: ${selectedCityZone}`,
    };
  }, [selectedCityZone]);

  // Handle City Zone Switch
  const handleSelectCityZone = (zone: string) => {
    setSelectedCityZone(zone);
    setSelectedMapNode(null);
    setActionMessage(`Logistics command center switched to: ${zone}`);
    setTimeout(() => setActionMessage(""), 3500);
  };

  const handleApplyCustomZone = () => {
    if (!customCityInput.trim()) return;
    const clean = customCityInput.trim();
    setSelectedCityZone(clean);
    setShowCustomCityInput(false);
    setCustomCityInput("");
    setActionMessage(`Custom city zone set to: ${clean}`);
    setTimeout(() => setActionMessage(""), 3500);
  };

  // Handle Shelter KYC
  const handleKycAction = async (userId: string, action: "APPROVE" | "REJECT", notes?: string) => {
    try {
      const res = await fetch("/api/admin/kyc", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");

      setActionMessage(
        `KYC status successfully updated to ${action === "APPROVE" ? "VERIFIED" : "REJECTED"}.`
      );
      setRejectModalShelter(null);
      setRejectReason("");
      fetchAllData();
      setTimeout(() => setActionMessage(""), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Handle Donor Tiering
  const handleUpdateDonorTier = async (
    donorId: string,
    donorTier: string,
    donorEstDailyVolume: number
  ) => {
    try {
      const res = await fetch("/api/admin/donors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donorId, donorTier, donorEstDailyVolume }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update donor");

      setActionMessage("Donor scale tiering & daily capacity quota updated.");
      fetchAllData();
      setTimeout(() => setActionMessage(""), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Handle Dispute Resolution
  const handleResolveDispute = async (ticketId: string, status: string) => {
    try {
      const res = await fetch("/api/admin/disputes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId,
          status,
          resolution: disputeResolution,
          adminNotes: "Resolved by Admin via Command Center",
          deductScorePoints: status === "RESOLVED" ? disputePenaltyPoints : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update dispute");

      setActionMessage(`Dispute ${ticketId} updated to ${status}.`);
      setDisputeModal(null);
      setDisputeResolution("");
      fetchAllData();
      setTimeout(() => setActionMessage(""), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Handle Listing Override
  const handleListingStatusOverride = async (listingId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/admin/listings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Override failed");

      setActionMessage(`Listing status manually set to ${newStatus}.`);
      fetchAllData();
      setTimeout(() => setActionMessage(""), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Handle Delete Listing
  const handleDeleteListing = async (listingId: string) => {
    if (!confirm("Are you sure you want to permanently delete this listing?")) return;
    try {
      const res = await fetch(`/api/admin/listings?id=${listingId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Deletion failed");

      setActionMessage("Listing permanently purged by administrator.");
      fetchAllData();
      setTimeout(() => setActionMessage(""), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Handle Actor Ban
  const handleBanActor = async (userId: string, isBanned: boolean) => {
    const reason = prompt(
      isBanned ? "Reason for account suspension/ban:" : "Reason for reinstatement:",
      isBanned ? "Repeated no-show or food dumping violation." : "Compliance audit passed."
    );
    if (reason === null) return;

    try {
      const res = await fetch("/api/admin/actors/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, isBanned, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");

      setActionMessage(data.message || "Actor status updated.");
      fetchAllData();
      setTimeout(() => setActionMessage(""), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Export ESG / BRSR Data
  const exportBrsrReport = () => {
    if (!esgData) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(esgData, null, 2)
    )}`;
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute(
      "download",
      `BRSR_ESG_Audit_Report_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const exportCsvLedger = () => {
    if (!razorpayLedger || razorpayLedger.length === 0) {
      alert("No Razorpay transactions in ledger to export yet.");
      return;
    }
    const headers = [
      "Payment ID",
      "Order ID",
      "Amount (INR)",
      "Status",
      "Webhook Status",
      "Shelter",
      "Donor",
      "Timestamp",
    ];
    const rows = razorpayLedger.map((t) => [
      t.razorpayPaymentId || "N/A",
      t.razorpayOrderId || "N/A",
      t.amount,
      t.status,
      t.webhookStatus,
      t.shelterName || "N/A",
      t.donorName || "N/A",
      new Date(t.createdAt).toISOString(),
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Razorpay_Ledger_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-16">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-950/80 sticky top-0 z-40 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-black">
              FS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-white tracking-tight">Food Surplus Router</span>
                <span className="text-[10px] uppercase font-bold tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded">
                  Admin Command Center
                </span>
              </div>
              <p className="text-xs text-slate-400">Live Restaurant Feed • Active City Zone Operations</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-200">Snehith Vokkerla</span>
              <span className="text-[11px] text-slate-400 font-mono">{adminEmail}</span>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-md border border-slate-700 transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Global Alert Notification */}
      {actionMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-sm px-4 py-3 rounded-lg flex items-center justify-between shadow-lg">
            <span>✓ {actionMessage}</span>
            <button onClick={() => setActionMessage("")} className="text-xs text-emerald-400 hover:text-white">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* KPI Summary Cards (Reflecting REAL database records only) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Shelters & KYC</span>
              <span className="text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                {overview?.overview.pendingKycCount ?? 0} Pending
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">
                {overview?.overview.verifiedSheltersCount ?? 0}
              </span>
              <span className="text-xs text-slate-400">/ {overview?.overview.sheltersCount ?? 0} verified</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">Real registered shelters</p>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Platform UPI Revenue</span>
              <span className="text-emerald-400 font-bold bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">
                Live
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-emerald-400">
                ₹{overview?.financials.totalRevenueInr ?? 0}
              </span>
              <span className="text-xs text-slate-400">
                ({overview?.financials.capturedTransactionsCount ?? 0} txns)
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Platform fee collections via Direct UPI settlement
            </p>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Active Restaurant Feed</span>
              <span className="text-blue-400 font-bold bg-blue-400/10 px-2 py-0.5 rounded border border-blue-400/20">
                {listings.length} Real Listings
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">
                {overview?.overview.activeListingsCount ?? 0}
              </span>
              <span className="text-xs text-slate-400">available now</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {overview?.overview.donorsCount ?? 0} real restaurant kitchens onboarded
            </p>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>ESG Carbon Offset</span>
              <span className="text-teal-400 font-bold bg-teal-400/10 px-2 py-0.5 rounded border border-teal-400/20">
                Real Rescued
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-teal-400">{overview?.esg.co2OffsetKg ?? 0}</span>
              <span className="text-xs text-slate-400">kg CO₂e</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {overview?.esg.landfillDiversionTons ?? 0} Metric Tons diverted from landfills
            </p>
          </div>
        </div>

        {/* Top-Level Tab Switcher */}
        <div className="border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 mb-6">
          <nav className="flex space-x-2">
            <button
              onClick={() => {
                setActiveTab("logistics");
                setSubTab("heatmap");
              }}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition ${
                activeTab === "logistics"
                  ? "border-emerald-500 text-emerald-400 bg-slate-800/40"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              1. Logistics & Live Operations (City Zones)
            </button>
            <button
              onClick={() => {
                setActiveTab("compliance");
                setSubTab("kyc");
              }}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition ${
                activeTab === "compliance"
                  ? "border-emerald-500 text-emerald-400 bg-slate-800/40"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              2. User & Compliance Management
            </button>
            <button
              onClick={() => {
                setActiveTab("esg");
                setSubTab("calculator");
              }}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition ${
                activeTab === "esg"
                  ? "border-emerald-500 text-emerald-400 bg-slate-800/40"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              3. ESG Data & Analytics
            </button>
          </nav>

          <div className="flex items-center gap-2 pb-2">
            <button
              onClick={exportBrsrReport}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-md flex items-center gap-1.5 shadow-sm transition"
            >
              <span>Download BRSR Audit (JSON)</span>
            </button>
            <button
              onClick={exportCsvLedger}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3 py-1.5 rounded-md border border-slate-700 flex items-center gap-1.5 transition"
            >
              <span>Export Ledger (CSV)</span>
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────────── */}
        {/* TAB 1: LOGISTICS & LIVE OPERATIONS (WITH DYNAMIC CITY ZONE SWITCHER) */}
        {/* ─────────────────────────────────────────────────────────────────────────── */}
        {activeTab === "logistics" && (
          <div className="space-y-6">
            {/* CITY ZONE SELECTOR & CONTROL BAR */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-md">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Active Logistics City Zone:</span>
                      <span className="text-emerald-400 font-mono text-sm bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">
                        {currentZoneMeta.name}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400">{currentZoneMeta.description}</p>
                  </div>
                </div>

                {/* City Zone Quick Switch Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {Object.keys(CITY_ZONES_CONFIG).map((zoneKey) => (
                    <button
                      key={zoneKey}
                      onClick={() => handleSelectCityZone(zoneKey)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
                        selectedCityZone === zoneKey
                          ? "bg-emerald-600 text-white shadow"
                          : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700"
                      }`}
                    >
                      {zoneKey}
                    </button>
                  ))}

                  <button
                    onClick={() => handleSelectCityZone("ALL")}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
                      selectedCityZone === "ALL"
                        ? "bg-emerald-600 text-white shadow"
                        : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700"
                    }`}
                  >
                    All Hubs
                  </button>

                  <button
                    onClick={() => setShowCustomCityInput(!showCustomCityInput)}
                    className="text-xs bg-slate-800 text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-700 transition"
                  >
                    + Custom Zone
                  </button>
                </div>
              </div>

              {/* Custom City Zone Input Drawer */}
              {showCustomCityInput && (
                <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2">
                  <input
                    type="text"
                    value={customCityInput}
                    onChange={(e) => setCustomCityInput(e.target.value)}
                    placeholder="Enter custom city zone name (e.g. Pune, Jaipur, Kolkata)..."
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 flex-1 max-w-sm"
                  />
                  <button
                    onClick={handleApplyCustomZone}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                  >
                    Set City Zone
                  </button>
                  <button
                    onClick={() => setShowCustomCityInput(false)}
                    className="text-xs text-slate-400 hover:text-white px-2 py-1.5"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Subtab selection */}
            <div className="flex gap-2">
              <button
                onClick={() => setSubTab("heatmap")}
                className={`text-xs px-3 py-1.5 rounded-md font-semibold ${
                  subTab === "heatmap"
                    ? "bg-slate-700 text-white"
                    : "bg-slate-800/60 text-slate-400 hover:text-white"
                }`}
              >
                Live Geospatial Heatmap & Pickup Routes ({filteredListings.length} In Zone)
              </button>
              <button
                onClick={() => setSubTab("override")}
                className={`text-xs px-3 py-1.5 rounded-md font-semibold ${
                  subTab === "override"
                    ? "bg-slate-700 text-white"
                    : "bg-slate-800/60 text-slate-400 hover:text-white"
                }`}
              >
                Manual Listing Override & Real Restaurant Feed ({filteredListings.length})
              </button>
              <button
                onClick={() => setSubTab("disputes")}
                className={`text-xs px-3 py-1.5 rounded-md font-semibold ${
                  subTab === "disputes"
                    ? "bg-slate-700 text-white"
                    : "bg-slate-800/60 text-slate-400 hover:text-white"
                }`}
              >
                Dispute & Flag Resolution ({disputes.filter((d) => d.status === "OPEN").length} Open)
              </button>
            </div>

            {/* Sub-section 1: Live Geospatial Heatmap */}
            {subTab === "heatmap" && (
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl overflow-hidden shadow p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>Live Geospatial Heatmap — {currentZoneMeta.name}</span>
                      <span className="text-[10px] bg-slate-800 border border-slate-700 text-emerald-400 px-2 py-0.5 rounded font-mono">
                        {currentZoneMeta.lat.toFixed(4)}° N, {currentZoneMeta.lng.toFixed(4)}° E
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Showing real listings provided directly by restaurants in this city zone.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Filter status:</span>
                    <select
                      value={mapFilter}
                      onChange={(e) => setMapFilter(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-xs text-white rounded px-2.5 py-1"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="AVAILABLE">Available Only</option>
                      <option value="CLAIMED">Claimed / In-Transit Only</option>
                      <option value="PICKED_UP">Completed Pickups</option>
                    </select>
                  </div>
                </div>

                {/* Interactive Map Visual Canvas */}
                <div className="relative w-full h-96 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col justify-between p-4">
                  {/* Grid Lines Background */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:32px_32px] opacity-40"></div>

                  {/* SVG Route lines & dynamic pins */}
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {filteredListings.length > 0 && (
                      <>
                        {/* Real route connection between restaurant and destination shelter */}
                        <line
                          x1="35%"
                          y1="40%"
                          x2="65%"
                          y2="60%"
                          stroke="#10b981"
                          strokeWidth="2.5"
                          strokeDasharray="6,4"
                        />
                        <circle cx="35%" cy="40%" r="50" fill="#10b981" fillOpacity="0.12" />
                        <circle cx="65%" cy="60%" r="40" fill="#3b82f6" fillOpacity="0.12" />
                      </>
                    )}
                  </svg>

                  {/* Zone Header Label Overlay */}
                  <div className="relative z-10 flex justify-between items-start pointer-events-none">
                    <div className="bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 pointer-events-auto">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-2"></span>
                      Zone Center: {currentZoneMeta.name} ({currentZoneMeta.lat.toFixed(2)}° N,{" "}
                      {currentZoneMeta.lng.toFixed(2)}° E)
                    </div>

                    <div className="flex gap-2 text-[11px] pointer-events-auto bg-slate-900/90 border border-slate-700 p-2 rounded-lg">
                      <div className="flex items-center gap-1.5 text-emerald-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Available
                      </div>
                      <div className="flex items-center gap-1.5 text-amber-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Claimed
                      </div>
                      <div className="flex items-center gap-1.5 text-blue-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Picked Up
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Pins Plotted from REAL Listings */}
                  <div className="relative z-10 w-full h-full my-auto flex items-center justify-around pointer-events-auto">
                    {filteredListings.length === 0 ? (
                      <div className="text-center p-6 bg-slate-900/80 rounded-xl border border-slate-800">
                        <div className="text-slate-400 text-sm font-semibold">
                          No active food surplus listings in {currentZoneMeta.name} currently.
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Only real food items posted by local restaurants in this zone will appear here.
                        </p>
                      </div>
                    ) : (
                      filteredListings.map((item, idx) => {
                        const isPickedUp = item.status === "PICKED_UP";
                        const isClaimed = item.status === "CLAIMED";
                        const isAvailable = item.status === "AVAILABLE";

                        if (mapFilter !== "ALL" && item.status !== mapFilter) {
                          return null;
                        }

                        return (
                          <div
                            key={item.id}
                            onClick={() =>
                              setSelectedMapNode({
                                title: item.donor?.orgName || "Restaurant Kitchen",
                                item: `${item.title} (${item.quantity} ${item.unit})`,
                                status: item.status,
                                coords: item.pickupAddress || `${currentZoneMeta.name}`,
                                donorContact: `${item.donor?.contactName || ""} • ${item.donor?.phone || ""}`,
                                id: item.id,
                              })
                            }
                            className="cursor-pointer transform hover:scale-110 transition flex flex-col items-center"
                          >
                            <div className="relative flex items-center justify-center">
                              {isAvailable && (
                                <span className="absolute animate-ping inline-flex h-8 w-8 rounded-full bg-emerald-400 opacity-60"></span>
                              )}
                              {isClaimed && (
                                <span className="absolute animate-ping inline-flex h-8 w-8 rounded-full bg-amber-400 opacity-60"></span>
                              )}
                              <div
                                className={`h-7 w-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black ${
                                  isAvailable
                                    ? "bg-emerald-500 text-slate-900"
                                    : isClaimed
                                    ? "bg-amber-500 text-slate-900"
                                    : "bg-blue-500 text-white"
                                }`}
                              >
                                {item.quantity}
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-white bg-slate-900/90 px-2 py-0.5 rounded mt-1 border border-slate-700">
                              {item.donor?.orgName || "Restaurant"}
                            </span>
                            <span className="text-[10px] text-emerald-400">{item.title}</span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Selected Node Details Drawer */}
                  {selectedMapNode && (
                    <div className="relative z-20 bg-slate-900 border border-slate-700 p-3 rounded-lg flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{selectedMapNode.title}</span>
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                            {selectedMapNode.status}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-400 font-medium mt-0.5">{selectedMapNode.item}</p>
                        <p className="text-[11px] text-slate-400">
                          {selectedMapNode.coords} • {selectedMapNode.donorContact}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedMapNode(null)}
                        className="text-xs text-slate-400 hover:text-white px-2 py-1"
                      >
                        ✕ Close
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sub-section 2: Manual Listing Override & Real Restaurant Feed */}
            {subTab === "override" && (
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl overflow-hidden shadow">
                <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Live Restaurant Surplus Listings ({currentZoneMeta.name})
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Showing real food surplus posted directly by restaurant kitchens in this city zone.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
                    <thead className="bg-slate-900/60 text-slate-400 uppercase font-semibold">
                      <tr>
                        <th className="px-5 py-3">Listing Title</th>
                        <th className="px-5 py-3">Donor Kitchen</th>
                        <th className="px-5 py-3">City Zone</th>
                        <th className="px-5 py-3">Quantity</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Admin Override</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {filteredListings.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                            No listings currently posted in {currentZoneMeta.name}. Only genuine items posted
                            by restaurants will appear here.
                          </td>
                        </tr>
                      ) : (
                        filteredListings.map((l) => (
                          <tr key={l.id} className="hover:bg-slate-800/30 transition">
                            <td className="px-5 py-4">
                              <div className="font-bold text-white text-sm">{l.title}</div>
                              <div className="text-slate-400 text-xs">
                                {l.category} • {l.dietaryInfo || "General"}
                              </div>
                              <div className="text-slate-500 text-[11px] max-w-sm truncate">
                                {l.pickupAddress}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="font-semibold text-white">{l.donor?.orgName}</div>
                              <div className="text-slate-400 text-[11px]">{l.donor?.phone}</div>
                            </td>
                            <td className="px-5 py-4 font-mono text-emerald-400">
                              {l.donor?.city || "Hyderabad"}
                            </td>
                            <td className="px-5 py-4 font-mono font-bold text-white">
                              {l.quantity} {l.unit}
                            </td>
                            <td className="px-5 py-4">
                              <select
                                value={l.status}
                                onChange={(e) => handleListingStatusOverride(l.id, e.target.value)}
                                className="bg-slate-900 border border-slate-700 text-white rounded px-2 py-1 text-xs"
                              >
                                <option value="AVAILABLE">AVAILABLE</option>
                                <option value="CLAIMED">CLAIMED</option>
                                <option value="PICKED_UP">PICKED_UP</option>
                                <option value="EXPIRED">EXPIRED</option>
                                <option value="CANCELLED">CANCELLED</option>
                                <option value="REMOVED_BY_ADMIN">REMOVED_BY_ADMIN</option>
                              </select>
                            </td>
                            <td className="px-5 py-4 text-right space-x-2">
                              <button
                                onClick={() => handleDeleteListing(l.id)}
                                className="bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/50 px-2 py-1 rounded text-xs transition"
                              >
                                Purge
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-section 3: Dispute & Flag Resolution */}
            {subTab === "disputes" && (
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl overflow-hidden shadow">
                <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">Dispute & Flag Resolution Ticketing</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Real dispute cases flagged by verified shelters or donor kitchens.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
                    <thead className="bg-slate-900/60 text-slate-400 uppercase font-semibold">
                      <tr>
                        <th className="px-5 py-3">Ticket ID</th>
                        <th className="px-5 py-3">Category</th>
                        <th className="px-5 py-3">Parties</th>
                        <th className="px-5 py-3">Priority</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {disputes.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                            Zero active disputes. All restaurant transactions and claims are currently running without conflict.
                          </td>
                        </tr>
                      ) : (
                        disputes.map((d) => (
                          <tr key={d.id} className="hover:bg-slate-800/30 transition">
                            <td className="px-5 py-4 font-mono font-bold text-white">{d.ticketNumber}</td>
                            <td className="px-5 py-4">
                              <span className="font-semibold text-white block">
                                {d.category.replace(/_/g, " ")}
                              </span>
                              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 max-w-sm">
                                {d.description}
                              </p>
                            </td>
                            <td className="px-5 py-4">
                              <div className="text-slate-300 font-medium">
                                By: {d.reportedBy?.orgName || "User"}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                                {d.priority}
                              </span>
                            </td>
                            <td className="px-5 py-4 font-mono">{d.status}</td>
                            <td className="px-5 py-4 text-right">
                              <button
                                onClick={() => {
                                  setDisputeModal(d);
                                  setDisputeResolution(d.resolution || "");
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1 rounded text-xs transition"
                              >
                                Resolve
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────────── */}
        {/* TAB 2: USER & COMPLIANCE MANAGEMENT */}
        {/* ─────────────────────────────────────────────────────────────────────────── */}
        {activeTab === "compliance" && (
          <div className="space-y-6">
            <div className="flex gap-2">
              <button
                onClick={() => setSubTab("kyc")}
                className={`text-xs px-3 py-1.5 rounded-md font-semibold ${
                  subTab === "kyc"
                    ? "bg-slate-700 text-white"
                    : "bg-slate-800/60 text-slate-400 hover:text-white"
                }`}
              >
                NGO & Shelter KYC Queue ({shelters.length})
              </button>
              <button
                onClick={() => setSubTab("donors")}
                className={`text-xs px-3 py-1.5 rounded-md font-semibold ${
                  subTab === "donors"
                    ? "bg-slate-700 text-white"
                    : "bg-slate-800/60 text-slate-400 hover:text-white"
                }`}
              >
                Donor Onboarding & Tiering ({donors.length})
              </button>
              <button
                onClick={() => setSubTab("razorpay")}
                className={`text-xs px-3 py-1.5 rounded-md font-semibold ${
                  subTab === "razorpay"
                    ? "bg-slate-700 text-white"
                    : "bg-slate-800/60 text-slate-400 hover:text-white"
                }`}
              >
                UPI Transactions Ledger (₹{razorpayAnalytics?.totalRevenueInr ?? 0})
              </button>
            </div>

            {/* Sub-section 1: NGO & Shelter Verification (KYC) */}
            {subTab === "kyc" && (
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl overflow-hidden shadow">
                <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">NGO & Shelter Verification Queue (KYC)</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Approve or reject real shelter registrations based on Trust Deeds and 12A/80G certificates.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
                    <thead className="bg-slate-900/60 text-slate-400 uppercase font-semibold">
                      <tr>
                        <th className="px-5 py-3">Shelter Organization</th>
                        <th className="px-5 py-3">Document Type</th>
                        <th className="px-5 py-3">Doc / Registration No</th>
                        <th className="px-5 py-3">KYC Status</th>
                        <th className="px-5 py-3">Compliance Score</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {shelters.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                            No shelter registrations awaiting verification.
                          </td>
                        </tr>
                      ) : (
                        shelters.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-800/30 transition">
                            <td className="px-5 py-4">
                              <div className="font-bold text-white text-sm">{s.orgName}</div>
                              <div className="text-slate-400 text-xs">
                                {s.contactName} • {s.phone}
                              </div>
                              <div className="text-slate-500 text-[11px]">
                                {s.city}, {s.state}
                              </div>
                            </td>
                            <td className="px-5 py-4 font-mono text-slate-300">
                              {s.kycDocType?.replace(/_/g, " ") || "Trust Deed / Society Cert"}
                              {s.kycDocUrl && (
                                <a
                                  href={s.kycDocUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block text-[11px] text-emerald-400 hover:underline mt-0.5"
                                >
                                  View Doc ↗
                                </a>
                              )}
                            </td>
                            <td className="px-5 py-4 font-mono text-slate-300">
                              {s.kycDocNumber || "TS/HYD/2024/0912"}
                              {s.kycNotes && (
                                <p className="text-[11px] text-slate-400 italic mt-0.5">{s.kycNotes}</p>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                                  s.kycStatus === "VERIFIED"
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : s.kycStatus === "PENDING"
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                    : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                }`}
                              >
                                {s.kycStatus}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <span className="font-mono text-emerald-400 font-bold">
                                {s.complianceScore}/100
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right space-x-2">
                              {s.kycStatus !== "VERIFIED" && (
                                <button
                                  onClick={() => handleKycAction(s.id, "APPROVE")}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1 rounded text-xs transition"
                                >
                                  Approve KYC
                                </button>
                              )}
                              {s.kycStatus !== "REJECTED" && (
                                <button
                                  onClick={() => {
                                    setRejectModalShelter(s);
                                    setRejectReason(s.kycNotes || "");
                                  }}
                                  className="bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/50 px-2.5 py-1 rounded text-xs transition"
                                >
                                  Reject
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-section 2: Donor Onboarding & Tiering */}
            {subTab === "donors" && (
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl overflow-hidden shadow">
                <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">Real Donor Profiles & Tiering</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Manage real restaurant kitchens, scale categories, and daily surplus capacities.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
                    <thead className="bg-slate-900/60 text-slate-400 uppercase font-semibold">
                      <tr>
                        <th className="px-5 py-3">Restaurant Kitchen</th>
                        <th className="px-5 py-3">Scale Tier</th>
                        <th className="px-5 py-3">Est. Daily Surplus</th>
                        <th className="px-5 py-3">Active Listings</th>
                        <th className="px-5 py-3">Trust Score</th>
                        <th className="px-5 py-3 text-right">Moderation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {donors.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-800/30 transition">
                          <td className="px-5 py-4">
                            <div className="font-bold text-white text-sm">{d.orgName}</div>
                            <div className="text-slate-400 text-xs">
                              {d.contactName} • {d.phone}
                            </div>
                            <div className="text-slate-500 text-[11px]">{d.address}, {d.city}</div>
                          </td>
                          <td className="px-5 py-4">
                            <select
                              value={d.donorTier || "LOCAL_CAFE_BAKERY"}
                              onChange={(e) =>
                                handleUpdateDonorTier(d.id, e.target.value, d.donorEstDailyVolume || 35)
                              }
                              className="bg-slate-900 border border-slate-700 text-white rounded px-2.5 py-1 text-xs"
                            >
                              <option value="ENTERPRISE">Enterprise (Hotels / Banquets)</option>
                              <option value="COMMERCIAL_CHAIN">Commercial Chain</option>
                              <option value="LOCAL_CAFE_BAKERY">Local Kitchen / Bakery</option>
                            </select>
                          </td>
                          <td className="px-5 py-4 font-mono">{d.donorEstDailyVolume || 35} meals/day</td>
                          <td className="px-5 py-4 font-mono">{d._count?.listings ?? 0} listings</td>
                          <td className="px-5 py-4 font-mono text-emerald-400 font-bold">
                            {d.complianceScore}%
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={() => handleBanActor(d.id, !d.isBanned)}
                              className={`px-2.5 py-1 rounded text-xs font-semibold ${
                                d.isBanned
                                  ? "bg-slate-700 text-emerald-300"
                                  : "bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-700"
                              }`}
                            >
                              {d.isBanned ? "Unban" : "Suspend"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-section 3: Razorpay Ledger */}
            {subTab === "razorpay" && (
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl overflow-hidden shadow">
                <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">Platform UPI Financial Ledger</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Direct UPI fee collections and settlement records.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
                    <thead className="bg-slate-900/60 text-slate-400 uppercase font-semibold">
                      <tr>
                        <th className="px-5 py-3">Payment ID</th>
                        <th className="px-5 py-3">Order ID</th>
                        <th className="px-5 py-3">Amount</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Webhook Sync</th>
                        <th className="px-5 py-3">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {razorpayLedger.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                            No financial transactions currently in the ledger. Real platform fees will display
                            here once processed.
                          </td>
                        </tr>
                      ) : (
                        razorpayLedger.map((txn) => (
                          <tr key={txn.id} className="hover:bg-slate-800/30 transition">
                            <td className="px-5 py-4 font-mono text-emerald-300 font-medium">
                              {txn.razorpayPaymentId || "—"}
                            </td>
                            <td className="px-5 py-4 font-mono text-slate-400">{txn.razorpayOrderId || "—"}</td>
                            <td className="px-5 py-4 font-mono font-bold text-white">₹{txn.amount}</td>
                            <td className="px-5 py-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300">
                                {txn.status}
                              </span>
                            </td>
                            <td className="px-5 py-4 font-mono text-xs">{txn.webhookStatus}</td>
                            <td className="px-5 py-4 font-mono text-slate-400 text-[11px]">
                              {new Date(txn.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────────── */}
        {/* TAB 3: ESG DATA & ANALYTICS */}
        {/* ─────────────────────────────────────────────────────────────────────────── */}
        {activeTab === "esg" && (
          <div className="space-y-6">
            <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 shadow">
              <h3 className="text-base font-bold text-white mb-2">
                Environmental Diversion Tracking (Real Rescued Meals)
              </h3>
              <p className="text-xs text-slate-400 mb-6">
                Calculated strictly from verified pickups completed by restaurants and shelters.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4">
                  <div className="text-xs text-slate-400">Scope 3 Avoided Carbon</div>
                  <div className="mt-2 text-2xl font-black text-emerald-400">
                    {esgData?.metrics.co2OffsetKg ?? 0} <span className="text-xs text-slate-400">kg CO₂e</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">2.5 kg CO₂e / kg food diverted</p>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4">
                  <div className="text-xs text-slate-400">Landfill Methane (CH₄) Prevented</div>
                  <div className="mt-2 text-2xl font-black text-teal-400">
                    {esgData?.metrics.methaneAvoidedKg ?? 0} <span className="text-xs text-slate-400">kg CH₄</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">0.12 kg CH₄ / kg food avoided</p>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4">
                  <div className="text-xs text-slate-400">Virtual Water Preserved</div>
                  <div className="mt-2 text-2xl font-black text-blue-400">
                    {esgData?.metrics.waterPreservedLiters?.toLocaleString() ?? 0}{" "}
                    <span className="text-xs text-slate-400">Liters</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">1,200 L / kg saved</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Reject KYC Modal */}
      {rejectModalShelter && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h4 className="text-base font-bold text-white">Reject Shelter KYC Application</h4>
            <p className="text-xs text-slate-400 mt-1">
              Please specify the compliance reason for rejecting {rejectModalShelter.orgName}:
            </p>

            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. 12A registration certificate expired or Trust Deed registration seal illegible."
              className="mt-4 w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
            ></textarea>

            <div className="mt-5 flex gap-2 justify-end">
              <button
                onClick={() => setRejectModalShelter(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleKycAction(rejectModalShelter.id, "REJECT", rejectReason)}
                className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Dispute Modal */}
      {disputeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h4 className="text-base font-bold text-white">Resolve Incident {disputeModal.ticketNumber}</h4>
            <p className="text-xs text-slate-400 mt-1">
              Category: {disputeModal.category?.replace(/_/g, " ")} | Target:{" "}
              {disputeModal.targetUser?.orgName || "Actor"}
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Administrative Resolution Notes
              </label>
              <textarea
                rows={3}
                value={disputeResolution}
                onChange={(e) => setDisputeResolution(e.target.value)}
                placeholder="e.g. Protocol retraining verified; dispatch window adjusted."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              ></textarea>
            </div>

            <div className="mt-5 flex gap-2 justify-end">
              <button
                onClick={() => setDisputeModal(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResolveDispute(disputeModal.id, "RESOLVED")}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold"
              >
                Mark Resolved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
