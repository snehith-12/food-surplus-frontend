import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import LiveDashboardAlert from "./LiveDashboardAlert";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const { role, orgName, id: userId } = session.user;

  if (role === "ADMIN") {
    redirect("/admin");
  }

  let stats = {
    stat1Label: "",
    stat1Value: 0,
    stat2Label: "",
    stat2Value: 0,
    stat3Label: "",
    stat3Value: 0,
    pendingActionCount: 0,
  };

  if (role === "RESTAURANT") {
    const [totalListings, activeListings, pendingClaims, pickedUp] = await Promise.all([
      prisma.surplusListing.count({ where: { donorId: userId } }),
      prisma.surplusListing.count({ where: { donorId: userId, status: "AVAILABLE" } }),
      prisma.claim.count({
        where: {
          listing: { donorId: userId },
          status: "PENDING",
        },
      }),
      prisma.claim.aggregate({
        where: {
          listing: { donorId: userId },
          status: "PICKED_UP",
        },
        _sum: { quantityClaimed: true },
      }),
    ]);

    stats = {
      stat1Label: "Active Listings",
      stat1Value: activeListings,
      stat2Label: "Pending Claims",
      stat2Value: pendingClaims,
      stat3Label: "Total Servings Donated",
      stat3Value: pickedUp._sum.quantityClaimed || 0,
      pendingActionCount: pendingClaims,
    };
  } else {
    const [totalClaims, approvedClaims, pendingApproval, pickedUp] = await Promise.all([
      prisma.claim.count({ where: { shelterId: userId } }),
      prisma.claim.count({ where: { shelterId: userId, status: "APPROVED" } }),
      prisma.claim.count({ where: { shelterId: userId, status: "PENDING" } }),
      prisma.claim.aggregate({
        where: {
          shelterId: userId,
          status: "PICKED_UP",
        },
        _sum: { quantityClaimed: true },
      }),
    ]);

    stats = {
      stat1Label: "Approved (Ready for Pickup)",
      stat1Value: approvedClaims,
      stat2Label: "Pending Approval",
      stat2Value: pendingApproval,
      stat3Label: "Total Servings Received",
      stat3Value: pickedUp._sum.quantityClaimed || 0,
      pendingActionCount: approvedClaims,
    };
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <span className="inline-flex items-center rounded-md bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700 ring-1 ring-inset ring-green-600/20">
                {role}
              </span>
            </div>
            <p className="text-gray-600 mt-1">Welcome back, {orgName}!</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              Home
            </Link>
            <Link
              href="/api/auth/signout"
              className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Sign out
            </Link>
          </div>
        </header>

        {/* Real-time Listing Broadcast & New Food Alert */}
        <LiveDashboardAlert role={role as "RESTAURANT" | "SHELTER"} userId={userId} />

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm ring-1 ring-gray-900/5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{stats.stat1Label}</p>
            <p className="mt-2 text-3xl font-extrabold text-green-600">{stats.stat1Value}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm ring-1 ring-gray-900/5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{stats.stat2Label}</p>
            <p className="mt-2 text-3xl font-extrabold text-yellow-600">{stats.stat2Value}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm ring-1 ring-gray-900/5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{stats.stat3Label}</p>
            <p className="mt-2 text-3xl font-extrabold text-blue-600">{stats.stat3Value}</p>
          </div>
        </div>

        {/* Actions & Status Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Quick Actions Card */}
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 md:col-span-1">
            <div className="p-6">
              <h3 className="text-base font-bold text-gray-900">Quick Actions</h3>
              <div className="mt-5 flex flex-col gap-3">
                {role === "RESTAURANT" ? (
                  <>
                    <Link
                      href="/dashboard/listings/new"
                      className="flex items-center justify-between rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-700 hover:bg-green-100 transition-colors"
                    >
                      <span>+ Post New Surplus</span>
                      <span>&rarr;</span>
                    </Link>
                    <Link
                      href="/dashboard/listings"
                      className="flex items-center justify-between rounded-lg p-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 ring-1 ring-inset ring-gray-200 transition-colors"
                    >
                      <span>View My Listings</span>
                      <span>&rarr;</span>
                    </Link>
                    <Link
                      href="/dashboard/claims/incoming"
                      className="flex items-center justify-between rounded-lg p-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 ring-1 ring-inset ring-gray-200 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span>Review Incoming Claims</span>
                        {stats.pendingActionCount > 0 && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                            {stats.pendingActionCount}
                          </span>
                        )}
                      </div>
                      <span>&rarr;</span>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/listings"
                      className="flex items-center justify-between rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-700 hover:bg-green-100 transition-colors"
                    >
                      <span>Browse Shelter Feed</span>
                      <span>&rarr;</span>
                    </Link>
                    <Link
                      href="/dashboard/claims"
                      className="flex items-center justify-between rounded-lg p-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 ring-1 ring-inset ring-gray-200 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span>View My Claims</span>
                        {stats.pendingActionCount > 0 && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">
                            {stats.pendingActionCount} ready
                          </span>
                        )}
                      </div>
                      <span>&rarr;</span>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Activity / Overview Card */}
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 md:col-span-2">
            <div className="p-6">
              <h3 className="text-base font-bold text-gray-900">
                {role === "RESTAURANT" ? "Restaurant Overview" : "Shelter Overview"}
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                {role === "RESTAURANT"
                  ? "Manage and route your kitchen's excess inventory to local non-profits. When a shelter claims your food, review their request under Incoming Claims to approve and set up the pickup."
                  : "Discover fresh surplus food from nearby restaurants within a 10-mile radius. Live WebSocket streams deliver newly posted meals straight to your feed without refreshing."}
              </p>

              <div className="mt-6 border-t border-gray-100 pt-6">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Next Step</h4>
                <div className="mt-3 flex flex-wrap gap-3">
                  {role === "RESTAURANT" ? (
                    <>
                      <Link
                        href="/dashboard/listings/new"
                        className="rounded-md bg-green-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-green-500"
                      >
                        Post Surplus Food
                      </Link>
                      <Link
                        href="/dashboard/claims/incoming"
                        className="rounded-md bg-white px-4 py-2 text-xs font-bold text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                      >
                        Check Pending Claims ({stats.pendingActionCount})
                      </Link>
                    </>
                  ) : (
                    <Link
                      href="/listings"
                      className="rounded-md bg-green-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-green-500"
                    >
                      Find Food Near Me
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
