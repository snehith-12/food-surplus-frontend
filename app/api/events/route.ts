import { eventEmitter } from "@/lib/events";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  
  const customReadable = new ReadableStream({
    start(controller) {
      // Listener that pushes new listings to the client
      const listener = (listing: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(listing)}\n\n`));
      };
      
      eventEmitter.on("new_listing", listener);
      
      // Keep-alive heartbeat every 15 seconds to prevent timeout
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 15000);

      // Clean up when the client disconnects
      req.signal.addEventListener("abort", () => {
        eventEmitter.off("new_listing", listener);
        clearInterval(keepAlive);
        controller.close();
      });
    },
  });
  
  return new NextResponse(customReadable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
