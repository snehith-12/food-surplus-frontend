import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { createNotification } from "@/lib/notifications";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  // Rate limiting defense: max 10 registrations per minute per IP
  const ip = getClientIp(req);
  const { success } = checkRateLimit(`register_${ip}`, 10, 60 * 1000);
  if (!success) {
    return apiError("Too many registration attempts. Please wait a moment.", 429);
  }

  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        parsed.error.issues.map((i) => i.message).join(", "),
        400
      );
    }

    const { email, password, role, orgName, contactName, phone, address, city, state, zipCode } = parsed.data;

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return apiError("An account with this email already exists", 409);
    }

    // Hash password with strong cost factor
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        role,
        orgName,
        contactName,
        phone,
        address,
        city,
        state,
        zipCode,
      },
      select: {
        id: true,
        email: true,
        role: true,
        orgName: true,
        contactName: true,
        createdAt: true,
      },
    });

    // Send welcome notification
    await createNotification({
      userId: user.id,
      type: "WELCOME",
      title: "Welcome to Food Surplus Router!",
      message: `Thanks for joining as a ${role.toLowerCase()}. ${role === "RESTAURANT" ? "Start posting your surplus food to help those in need." : "Browse available listings and claim food for your shelter."}`,
    });

    return apiSuccess(user, 201);
  } catch (error: any) {
    console.error("[Register Error]", error);
    return apiError("Registration failed. Please try again.", 500);
  }
}
