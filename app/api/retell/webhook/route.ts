import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("📞 Retell webhook received:", JSON.stringify(body, null, 2));

    // Handle different event types
    const eventType = body.event_type || body.event;
    console.log("Event type:", eventType);

    // Always return 200 so Retell knows we received it
    return NextResponse.json({
      received: true,
      event: eventType,
    }, { status: 200 });

  } catch (error: any) {
    console.error("Retell webhook error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 200 } // Return 200 even on error so Retell doesn't retry
    );
  }
}

// Handle GET requests (for webhook verification)
export async function GET(request: NextRequest) {
  return NextResponse.json({ status: "VoceEats Retell webhook active" });
}
