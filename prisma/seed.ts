import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // ─── Create Users ───────────────────────────────────────────────────────

  const passwordHash = await bcrypt.hash("password123", 12);

  const restaurant1 = await prisma.user.upsert({
    where: { email: "mario@bestpizza.com" },
    update: {},
    create: {
      email: "mario@bestpizza.com",
      passwordHash,
      role: "RESTAURANT",
      orgName: "Mario's Best Pizza",
      contactName: "Mario Rossi",
      phone: "555-0101",
      address: "123 Main St",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      latitude: 40.7484,
      longitude: -73.9967,
      isVerified: true,
    },
  });
  console.log(`  ✅ Restaurant: ${restaurant1.orgName} (${restaurant1.email})`);

  const restaurant2 = await prisma.user.upsert({
    where: { email: "chef@greenplate.com" },
    update: {},
    create: {
      email: "chef@greenplate.com",
      passwordHash,
      role: "RESTAURANT",
      orgName: "Green Plate Café",
      contactName: "Sarah Chen",
      phone: "555-0102",
      address: "456 Oak Ave",
      city: "New York",
      state: "NY",
      zipCode: "10002",
      latitude: 40.7282,
      longitude: -73.9942,
      isVerified: true,
    },
  });
  console.log(`  ✅ Restaurant: ${restaurant2.orgName} (${restaurant2.email})`);

  const shelter1 = await prisma.user.upsert({
    where: { email: "admin@hopehouse.org" },
    update: {},
    create: {
      email: "admin@hopehouse.org",
      passwordHash,
      role: "SHELTER",
      orgName: "Hope House Shelter",
      contactName: "David Williams",
      phone: "555-0201",
      address: "789 Elm St",
      city: "New York",
      state: "NY",
      zipCode: "10003",
      latitude: 40.7322,
      longitude: -73.9874,
      isVerified: true,
    },
  });
  console.log(`  ✅ Shelter: ${shelter1.orgName} (${shelter1.email})`);

  const shelter2 = await prisma.user.upsert({
    where: { email: "contact@warmmeals.org" },
    update: {},
    create: {
      email: "contact@warmmeals.org",
      passwordHash,
      role: "SHELTER",
      orgName: "Warm Meals Foundation",
      contactName: "Lisa Park",
      phone: "555-0202",
      address: "321 Pine Rd",
      city: "New York",
      state: "NY",
      zipCode: "10004",
      latitude: 40.6992,
      longitude: -74.0402,
      isVerified: true,
    },
  });
  console.log(`  ✅ Shelter: ${shelter2.orgName} (${shelter2.email})`);

  // ─── Create Surplus Listings ────────────────────────────────────────────

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in2Days = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  const listing1 = await prisma.surplusListing.create({
    data: {
      donorId: restaurant1.id,
      title: "20 Boxed Margherita Pizzas",
      description:
        "Freshly made margherita pizzas, individually boxed. Made today.",
      category: "PREPARED",
      quantity: 20,
      unit: "boxes",
      pickupAddress: "123 Main St, New York, NY 10001",
      pickupLatitude: 40.7484,
      pickupLongitude: -73.9967,
      pickupWindowStart: now,
      pickupWindowEnd: tomorrow,
      expiryDate: in2Days,
      dietaryInfo: "vegetarian",
      allergens: "gluten,dairy",
    },
  });
  console.log(`  📦 Listing: ${listing1.title}`);

  const listing2 = await prisma.surplusListing.create({
    data: {
      donorId: restaurant1.id,
      title: "15 Containers of Pasta Salad",
      description: "Mediterranean pasta salad, sealed containers. Refrigerate.",
      category: "PREPARED",
      quantity: 15,
      unit: "containers",
      pickupAddress: "123 Main St, New York, NY 10001",
      pickupLatitude: 40.7484,
      pickupLongitude: -73.9967,
      pickupWindowStart: now,
      pickupWindowEnd: tomorrow,
      expiryDate: tomorrow,
      dietaryInfo: "vegetarian",
      allergens: "gluten",
    },
  });
  console.log(`  📦 Listing: ${listing2.title}`);

  const listing3 = await prisma.surplusListing.create({
    data: {
      donorId: restaurant2.id,
      title: "30 lbs Fresh Mixed Vegetables",
      description:
        "Assorted fresh veggies: carrots, broccoli, bell peppers, zucchini. From today's prep.",
      category: "PRODUCE",
      quantity: 30,
      unit: "lbs",
      pickupAddress: "456 Oak Ave, New York, NY 10002",
      pickupLatitude: 40.7282,
      pickupLongitude: -73.9942,
      pickupWindowStart: now,
      pickupWindowEnd: tomorrow,
      expiryDate: in2Days,
      dietaryInfo: "vegan,gluten-free",
      allergens: "",
    },
  });
  console.log(`  📦 Listing: ${listing3.title}`);

  const listing4 = await prisma.surplusListing.create({
    data: {
      donorId: restaurant2.id,
      title: "50 Dinner Rolls",
      description: "Fresh-baked dinner rolls from this evening's service.",
      category: "BAKERY",
      quantity: 50,
      unit: "rolls",
      pickupAddress: "456 Oak Ave, New York, NY 10002",
      pickupLatitude: 40.7282,
      pickupLongitude: -73.9942,
      pickupWindowStart: now,
      pickupWindowEnd: tomorrow,
      expiryDate: tomorrow,
      dietaryInfo: "vegetarian",
      allergens: "gluten,eggs",
    },
  });
  console.log(`  📦 Listing: ${listing4.title}`);

  // ─── Create a Sample Claim ─────────────────────────────────────────────

  const claim1 = await prisma.claim.create({
    data: {
      listingId: listing1.id,
      shelterId: shelter1.id,
      quantityClaimed: 10,
      status: "APPROVED",
      notes: "We can pick up by 6 PM. Thank you!",
      donorNotes: "Approved! Come to the back entrance.",
      pickupEta: new Date(now.getTime() + 4 * 60 * 60 * 1000),
    },
  });
  console.log(`  🤝 Claim: ${shelter1.orgName} → ${listing1.title} (${claim1.status})`);

  // ─── Welcome Notifications ─────────────────────────────────────────────

  for (const user of [restaurant1, restaurant2, shelter1, shelter2]) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "WELCOME",
        title: "Welcome to Food Surplus Router!",
        message: `Thanks for joining, ${user.orgName}!`,
      },
    });
  }
  console.log("  🔔 Welcome notifications sent");

  console.log("\n✨ Seeding complete!\n");
  console.log("Demo credentials (all use password: password123):");
  console.log("  Restaurant: mario@bestpizza.com");
  console.log("  Restaurant: chef@greenplate.com");
  console.log("  Shelter:    admin@hopehouse.org");
  console.log("  Shelter:    contact@warmmeals.org");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
