
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    // Allow cancellation only in development demo mode.
    if (
      process.env.NODE_ENV !== "development" ||
      process.env.PAYPAL_DEMO_MODE !== "true"
    ) {
      return NextResponse.json(
        { success: false, message: "Demo mode is disabled." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const email =
      typeof body.email === "string" ? body.email.trim() : "";
    const subscriptionId =
      typeof body.subscriptionId === "string"
        ? body.subscriptionId.trim()
        : "";

    if (!email || !subscriptionId) {
      return NextResponse.json(
        { success: false, message: "Email and subscription ID are required." },
        { status: 400 }
      );
    }

    // Find the subscription belonging to this email.
    const subscription = await prisma.subscription.findFirst({
      where: {
        paypalSubscriptionId: subscriptionId,
        user: { email },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, message: "Subscription not found." },
        { status: 404 }
      );
    }

    // Never use this demo endpoint to cancel real PayPal subscriptions.
    if (!subscription.paypalSubscriptionId.startsWith("DEMO-")) {
      return NextResponse.json(
        {
          success: false,
          message: "Only demo subscriptions can be cancelled here.",
        },
        { status: 403 }
      );
    }

    if (subscription.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          message: "Only active demo subscriptions can be cancelled.",
        },
        { status: 400 }
      );
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({
      success: true,
      message: "Demo subscription cancelled successfully.",
    });
  } catch (error) {
    console.error("Demo cancellation error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to cancel the subscription." },
      { status: 500 }
    );
  }
}
