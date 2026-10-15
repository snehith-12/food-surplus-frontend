import { z } from "zod";

// ─── Auth ───────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(150),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100),
  role: z.enum(["RESTAURANT", "SHELTER"]),
  orgName: z.string().trim().min(2, "Organization name is required").max(150),
  contactName: z.string().trim().min(2, "Contact name is required").max(100),
  phone: z
    .string()
    .trim()
    .min(7, "Phone number is required")
    .max(20),
  address: z.string().trim().min(5, "Address is required").max(255),
  city: z.string().trim().min(2, "City is required").max(100),
  state: z.string().trim().min(2, "State is required").max(50),
  zipCode: z.string().trim().min(3, "Zip code is required").max(10),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(150),
  password: z.string().min(1, "Password is required").max(100),
});

// ─── Listings ───────────────────────────────────────────────────────────────

const baseListingSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(150),
  description: z.string().trim().max(1500).optional(),
  category: z.enum([
    "PREPARED",
    "PRODUCE",
    "BAKERY",
    "DAIRY",
    "CANNED",
    "FROZEN",
    "BEVERAGES",
    "OTHER",
  ]),
  quantity: z.number().int().positive("Quantity must be a positive integer").max(100000),
  unit: z.string().trim().max(30).default("servings"),
  pickupAddress: z.string().trim().min(5, "Pickup address is required").max(300),
  pickupLatitude: z.number().min(-90).max(90).optional(),
  pickupLongitude: z.number().min(-180).max(180).optional(),
  pickupWindowStart: z.string().datetime({ message: "Invalid start time" }),
  pickupWindowEnd: z.string().datetime({ message: "Invalid end time" }),
  expiryDate: z.string().datetime({ message: "Invalid expiry date" }),
  dietaryInfo: z.array(z.string().trim().max(50)).max(20).default([]),
  allergens: z.array(z.string().trim().max(50)).max(20).default([]),
  imageUrl: z.string().url().max(500).optional(),
});

export const createListingSchema = baseListingSchema.refine(
  (data) => new Date(data.pickupWindowEnd) > new Date(data.pickupWindowStart),
  { message: "Pickup window end must be after start", path: ["pickupWindowEnd"] }
).refine(
  (data) => new Date(data.expiryDate) > new Date(),
  { message: "Expiry date must be in the future", path: ["expiryDate"] }
);

export const updateListingSchema = baseListingSchema.partial();

export const listingQuerySchema = z.object({
  category: z
    .enum([
      "PREPARED", "PRODUCE", "BAKERY", "DAIRY",
      "CANNED", "FROZEN", "BEVERAGES", "OTHER",
    ])
    .optional(),
  city: z.string().trim().max(100).optional(),
  status: z.enum(["AVAILABLE", "CLAIMED", "PICKED_UP", "EXPIRED", "CANCELLED"]).optional(),
  dietary: z.string().trim().max(100).optional(),
  sort: z.enum(["newest", "expiring_soon", "quantity"]).default("newest"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(12),
});

// ─── Claims ─────────────────────────────────────────────────────────────────

export const createClaimSchema = z.object({
  listingId: z.string().uuid("Invalid listing ID"),
  quantityClaimed: z.number().int().positive("Quantity must be positive").max(100000),
  pickupEta: z.string().datetime().optional(),
  notes: z.string().trim().max(500).optional(),
});

export const respondClaimSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  donorNotes: z.string().trim().max(500).optional(),
});

// ─── Types ──────────────────────────────────────────────────────────────────

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateListingInput = z.infer<typeof createListingSchema>;
export type ListingQuery = z.infer<typeof listingQuerySchema>;
export type CreateClaimInput = z.infer<typeof createClaimSchema>;
export type RespondClaimInput = z.infer<typeof respondClaimSchema>;
