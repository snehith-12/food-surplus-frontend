"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import ClaimButton from "./ClaimButton";
import { getDistanceMiles } from "@/lib/distance";

export default function LiveFeed({ 
  initialListings, 
  shelterLocation,
  isShelter
}: { 
  initialListings: any[],
  shelterLocation?: { lat: number, lon: number },
  isShelter: boolean
}) {
  const [listings, setListings] = useState(initialListings);
  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    // Connect to Server-Sent Events stream
    const eventSource = new EventSource("/api/events");
    
    eventSource.onmessage = (event) => {
      try {
        const newListing = JSON.parse(event.data);
        
        // Strict check: only accept actively listed, unexpired items from donors
        if (newListing.status !== "AVAILABLE") return;
        if (new Date(newListing.expiryDate) <= new Date()) return;

        let shouldAdd = true;
        let distance = null;

        // If the user is a shelter with coordinates, do geospatial filter
        if (shelterLocation) {
          const lat = newListing.pickupLatitude ?? newListing.donor?.latitude;
          const lon = newListing.pickupLongitude ?? newListing.donor?.longitude;
          
          if (lat && lon) {
            distance = getDistanceMiles(shelterLocation.lat, shelterLocation.lon, lat, lon);
            if (distance > 10) {
              shouldAdd = false; // Outside 10 mile radius
            }
          }
        }

        if (shouldAdd) {
          setListings((prev) => {
            // Avoid duplicate listings
            if (prev.some((item) => item.id === newListing.id)) return prev;

            const updated = [{ ...newListing, distance, remainingQuantity: newListing.quantity }, ...prev];
            // Sort by expiry time (soonest to expire first)
            return updated.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
          });
          setNewCount((prev) => prev + 1);
        }
      } catch (err) {
        // Ignore keepalive or parse errors
      }
    };
    
    return () => eventSource.close();
  }, [shelterLocation]);

  return (
    <>
      {newCount > 0 && (
        <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100 flex justify-between items-center animate-pulse">
          <p className="text-sm text-blue-700 font-medium">
            ⚡ {newCount} new surplus {newCount === 1 ? 'item has' : 'items have'} been listed by local restaurants!
          </p>
          <button 
            onClick={() => setNewCount(0)} 
            className="text-xs bg-blue-100 px-3 py-1.5 rounded-md font-semibold text-blue-800 hover:bg-blue-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {listings.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5">
          <div className="text-4xl mb-3">🍲</div>
          <h3 className="text-lg font-semibold text-gray-900">No surplus food currently listed</h3>
          <p className="mt-2 text-sm text-gray-500">
            Only active food items posted by restaurants and donors appear here. Check back when a local kitchen posts new surplus!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => {
            const availableQty = listing.remainingQuantity !== undefined ? listing.remainingQuantity : listing.quantity;

            return (
              <div key={listing.id} className="flex flex-col bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden transition-all hover:shadow-md border-t-4 border-t-green-500">
                <div className="p-6 flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                      {listing.category}
                    </span>
                    <span className="text-sm font-bold text-gray-900 bg-green-50 text-green-800 px-2.5 py-1 rounded-md border border-green-200">
                      {availableQty} {listing.unit} available
                    </span>
                  </div>
                  
                  <h3 className="text-lg font-bold text-gray-900 leading-tight">{listing.title}</h3>
                  <p className="mt-1 text-sm text-gray-500 font-semibold">
                    Donor: {listing.donor?.orgName || "Restaurant Donor"}
                  </p>
                  
                  {listing.distance !== undefined && listing.distance !== null && (
                    <p className="text-xs font-bold text-green-700 mt-1">📍 {listing.distance.toFixed(1)} miles away</p>
                  )}

                  {listing.description && (
                    <p className="mt-3 text-sm text-gray-600 line-clamp-2">{listing.description}</p>
                  )}

                  <div className="mt-4 space-y-2 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-900">Pickup Window:</span>
                      <span>{format(new Date(listing.pickupWindowStart), "h:mm a")} - {format(new Date(listing.pickupWindowEnd), "h:mm a")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-900">Address:</span>
                      <span className="truncate ml-4">{listing.pickupAddress}</span>
                    </div>
                    <div className="flex justify-between font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md mt-2">
                      <span>Expires:</span>
                      <span>{format(new Date(listing.expiryDate), "MMM d, h:mm a")}</span>
                    </div>
                  </div>

                  {(listing.dietaryInfo || listing.allergens) && (
                    <div className="mt-4 pt-4 border-t flex flex-wrap gap-1">
                      {listing.dietaryInfo && listing.dietaryInfo.split(",").filter(Boolean).map((d: string) => (
                        <span key={d} className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">{d}</span>
                      ))}
                      {listing.allergens && listing.allergens.split(",").filter(Boolean).map((a: string) => (
                        <span key={a} className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">Contains {a}</span>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="p-4 bg-gray-50 border-t">
                  {isShelter ? (
                    <ClaimButton listingId={listing.id} maxQuantity={availableQty} />
                  ) : (
                    <p className="text-center text-xs text-gray-500 py-2">
                      Log in as a Shelter to claim this food.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
