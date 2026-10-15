import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { NextResponse } from "next/server";

/**
 * GET /api/notifications
 * Get all notifications for the authenticated user.
 */
export async function GET(req: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get("unread") === "true";

    const where: any = { userId: session.user.id };
    if (unreadOnly) where.isRead = false;

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.notification.count({
        where: { userId: session.user.id, isRead: false },
      }),
    ]);

    return NextResponse.json({ data: notifications, unreadCount });
  } catch (error: any) {
    console.error("[GET /api/notifications]", error);
    return apiError("Failed to fetch notifications", 500);
  }
}

/**
 * PATCH /api/notifications
 * Mark notifications as read. Body: { ids: string[] } or { all: true }
 */
export async function PATCH(req: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const body = await req.json();

    if (body.all === true) {
      await prisma.notification.updateMany({
        where: { userId: session.user.id, isRead: false },
        data: { isRead: true },
      });
      return apiSuccess({ message: "All notifications marked as read" });
    }

    if (Array.isArray(body.ids) && body.ids.length > 0) {
      await prisma.notification.updateMany({
        where: {
          id: { in: body.ids },
          userId: session.user.id,
        },
        data: { isRead: true },
      });
      return apiSuccess({ message: `${body.ids.length} notification(s) marked as read` });
    }

    return apiError("Provide { ids: [...] } or { all: true }", 400);
  } catch (error: any) {
    console.error("[PATCH /api/notifications]", error);
    return apiError("Failed to update notifications", 500);
  }
}
