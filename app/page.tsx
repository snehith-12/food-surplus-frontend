import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🍲</span>
              <span className="text-xl font-bold text-gray-900">Food Surplus Router</span>
            </div>
            <div className="flex items-center gap-4">
              {session ? (
                <Link
                  href="/dashboard"
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/login" className="text-sm font-semibold text-gray-900 hover:text-green-600">
                    Log in
                  </Link>
                  <Link
                    href="/register"
                    className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Don't let good food <span className="text-green-600">go to waste.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600">
            A real-time routing platform connecting local restaurants and grocery stores with nearby shelters. 
            Reduce food waste, help your community, and streamline your surplus donations.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href="/register"
              className="rounded-md bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
            >
              Join as a Restaurant
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-white px-5 py-3 text-sm font-semibold text-green-600 shadow-sm ring-1 ring-inset ring-green-600 hover:bg-green-50"
            >
              Join as a Shelter
            </Link>
          </div>
        </div>

        {/* Feature grid */}
        <div className="mx-auto mt-24 max-w-5xl">
          <div className="grid grid-cols-1 gap-12 sm:grid-cols-3 text-center">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-2xl">📱</div>
              <h3 className="mt-6 text-lg font-semibold text-gray-900">Post in Seconds</h3>
              <p className="mt-2 text-sm text-gray-600">Restaurants can list excess food with just a few clicks from our streamlined dashboard.</p>
            </div>
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-2xl">⚡</div>
              <h3 className="mt-6 text-lg font-semibold text-gray-900">Live Alerts</h3>
              <p className="mt-2 text-sm text-gray-600">Local shelters are notified instantly via real-time WebSocket streams the moment food is posted.</p>
            </div>
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-2xl">🗺️</div>
              <h3 className="mt-6 text-lg font-semibold text-gray-900">Geospatial Routing</h3>
              <p className="mt-2 text-sm text-gray-600">Automatically filters and sorts donations so shelters only see food within a 10-mile pickup radius.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
