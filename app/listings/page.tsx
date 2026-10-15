import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import LiveFeed from "./LiveFeed";
import Link from "next/link";
import { getDistanceMiles } from "@/lib/distance";

export default async function ShelterFeed() {
  const session = await getServerSession(authOptions);
  const isShelter = session?.user?.role === "SHELTER";
  
  let shelter = null;
  if (isShelter) {
    shelter = await prisma.user.findUnique({ where: { id: session.user.id } });
  }

  // Fetch only actively listed, unexpired food listings from registered restaurants
  const now = new Date();
  const rawListings = await prisma.surplusListing.findMany({
    where: {
      status: "AVAILABLE",
      expiryDate: { gt: now },
      donor: {
        role: "RESTAURANT",
      },
    },
    include: {
      donor: true,
      claims: {
        where: {
          status: { notIn: ["CANCELLED", "REJECTED"] },
        },
      },
    },
    orderBy: { expiryDate: "asc" },
  });

  // Ensure only listings with remaining claimable portions are shown
  const activeUnclaimedListings = rawListings.filter((listing) => {
    const totalClaimed = listing.claims.reduce((acc, c) => acc + c.quantityClaimed, 0);
    const remaining = listing.quantity - totalClaimed;
    (listing as any).remainingQuantity = remaining;
    return remaining > 0;
  });

  // Geospatial filtering & sorting by expiry time
  const localListings = activeUnclaimedListings.filter((listing) => {
    if (!shelter?.latitude || !shelter?.longitude) return true; // Show available if shelter coordinates not set
    
    const lat = listing.pickupLatitude ?? listing.donor.latitude;
    const lon = listing.pickupLongitude ?? listing.donor.longitude;
    
    if (!lat || !lon) return false;
    
    const dist = getDistanceMiles(shelter.latitude, shelter.longitude, lat, lon);
    (listing as any).distance = dist;
    
    return dist <= 10;
  }).sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Shelter Feed</h1>
            <p className="mt-2 text-gray-600">
              {isShelter && shelter?.latitude 
                ? "Available surplus listings within 10 miles of your location."
                : "Active surplus food listings ready for pickup."}
            </p>
          </div>
          <Link href="/dashboard" className="text-sm font-medium text-green-600 hover:text-green-500 bg-white px-4 py-2 rounded-md shadow-sm border border-green-100">
            Back to Dashboard &rarr;
          </Link>
        </header>

        <LiveFeed 
          initialListings={localListings} 
          isShelter={isShelter}
          shelterLocation={shelter?.latitude && shelter?.longitude ? { lat: shelter.latitude, lon: shelter.longitude } : undefined}
        />
      </div>
    </div>
  );
}
