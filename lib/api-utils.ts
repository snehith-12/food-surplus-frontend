import { NextResponse } from "next/server";

/**
 * Standard API error response.
 */
export function apiError(message: string, status: number = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/**
 * Standard API success response.
 */
export function apiSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

/**
 * Wraps an async API handler with try/catch to return consistent error shapes.
 */
export function withErrorHandler(
  handler: (req: Request, context?: any) => Promise<NextResponse>
) {
  return async (req: Request, context?: any) => {
    try {
      return await handler(req, context);
    } catch (error: any) {
      console.error("[API Error]", error);

      // Prisma known request error (e.g. unique constraint violation)
      if (error?.code === "P2002") {
        return apiError("A record with this data already exists.", 409);
      }
      if (error?.code === "P2025") {
        return apiError("Record not found.", 404);
      }

      return apiError(
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
        500
      );
    }
  };
}
