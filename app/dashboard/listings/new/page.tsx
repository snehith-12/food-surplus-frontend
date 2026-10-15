"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewListingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Geolocation state
  const [address, setAddress] = useState("123 Main St, New York, NY 10001");
  const [lat, setLat] = useState<number | "">("");
  const [lon, setLon] = useState<number | "">("");
  const [isLocating, setIsLocating] = useState(false);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLat(latitude);
        setLon(longitude);
        
        try {
          // Free reverse geocoding via OpenStreetMap Nominatim
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          if (data && data.display_name) {
            setAddress(data.display_name);
          } else {
            setAddress(`Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
          }
        } catch (err) {
          setAddress(`Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
        }
        setIsLocating(false);
      },
      (err) => {
        alert("Unable to retrieve your location. Please check your browser permissions.");
        setIsLocating(false);
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    
    // Format dates for the API (convert to ISO string)
    const payload = {
      title: formData.get("title"),
      description: formData.get("description"),
      category: formData.get("category"),
      quantity: parseInt(formData.get("quantity") as string, 10),
      unit: formData.get("unit") || "servings",
      pickupAddress: formData.get("pickupAddress"),
      pickupLatitude: formData.get("pickupLatitude") ? parseFloat(formData.get("pickupLatitude") as string) : undefined,
      pickupLongitude: formData.get("pickupLongitude") ? parseFloat(formData.get("pickupLongitude") as string) : undefined,
      pickupWindowStart: new Date(formData.get("pickupWindowStart") as string).toISOString(),
      pickupWindowEnd: new Date(formData.get("pickupWindowEnd") as string).toISOString(),
      expiryDate: new Date(formData.get("expiryDate") as string).toISOString(),
      dietaryInfo: (formData.get("dietaryInfo") as string).split(",").map(s => s.trim()),
      allergens: (formData.get("allergens") as string).split(",").map(s => s.trim()),
    };

    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create listing");
      }

      router.push("/dashboard/listings");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Post Food Surplus</h1>
            <p className="mt-1 text-sm text-gray-500">Quickly list available food for shelters to claim.</p>
          </div>
          <Link href="/dashboard" className="text-sm font-medium text-gray-500 hover:text-gray-900">
            Cancel
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <input type="hidden" name="pickupLatitude" value={lat} />
          <input type="hidden" name="pickupLongitude" value={lon} />

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-900">What are you donating?</label>
              <input type="text" name="title" required placeholder="e.g., 20 Boxed Margherita Pizzas" className="mt-2 block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-green-600 sm:text-sm" />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-900">Description</label>
              <textarea name="description" rows={3} placeholder="Additional details about the food..." className="mt-2 block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-green-600 sm:text-sm"></textarea>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900">Category</label>
              <select name="category" required className="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-green-600 sm:text-sm">
                <option value="PREPARED">Prepared Meals</option>
                <option value="PRODUCE">Produce</option>
                <option value="BAKERY">Bakery</option>
                <option value="DAIRY">Dairy</option>
                <option value="CANNED">Canned Goods</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-900">Quantity</label>
                <input type="number" name="quantity" required min="1" className="mt-2 block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-green-600 sm:text-sm" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-900">Unit</label>
                <input type="text" name="unit" defaultValue="servings" required className="mt-2 block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-green-600 sm:text-sm" />
              </div>
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-900">Pickup Address</label>
                <button 
                  type="button" 
                  onClick={handleGetCurrentLocation}
                  disabled={isLocating}
                  className="text-sm font-semibold text-green-600 hover:text-green-500 disabled:opacity-50 flex items-center gap-1"
                >
                  {isLocating ? "📍 Locating..." : "📍 Use Current Location"}
                </button>
              </div>
              <input 
                type="text" 
                name="pickupAddress" 
                required 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-2 block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-green-600 sm:text-sm" 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900">Pickup Window Start</label>
              <input type="datetime-local" name="pickupWindowStart" required className="mt-2 block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-green-600 sm:text-sm" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900">Pickup Window End</label>
              <input type="datetime-local" name="pickupWindowEnd" required className="mt-2 block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-green-600 sm:text-sm" />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-900">Food Safe Until (Expiry)</label>
              <input type="datetime-local" name="expiryDate" required className="mt-2 block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-green-600 sm:text-sm" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900">Dietary Info (comma separated)</label>
              <input type="text" name="dietaryInfo" placeholder="vegetarian, vegan" className="mt-2 block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-green-600 sm:text-sm" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900">Allergens (comma separated)</label>
              <input type="text" name="allergens" placeholder="nuts, dairy" className="mt-2 block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-green-600 sm:text-sm" />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-green-600 px-3 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50"
            >
              {loading ? "Posting..." : "Post Surplus Listing"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
