
import { NextRequest, NextResponse } from "next/server";
import { createPayPalSubscription } from "@/lib/paypal";
import { prisma } from "@/lib/prisma";


export async function GET(request: NextRequest) {
  try {
    // Allow this demo dashboard endpoint only in local development
    if (
      process.env.NODE_ENV !== "development" ||
      process.env.PAYPAL_DEMO_MODE !== "true"
    ) {
      return NextResponse.json(
        { success: false, message: "Not available" },
        { status: 404 }
      );
    }

    const email = new URL(request.url)
      .searchParams.get("email")
      ?.trim()
      .toLowerCase();

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        subscriptions: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            paypalSubscriptionId: true,
            paypalPlanId: true,
            status: true,
            startDate: true,
            nextBillingDate: true,
            createdAt: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      subscriptions: user?.subscriptions ?? [],
    });
  } catch (error) {
    console.error("Failed to fetch subscriptions:", error);

    return NextResponse.json(
      { success: false, message: "Failed to fetch subscriptions" },
      { status: 500 }
    );
  }
}


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const phone =
      typeof body.phone === "string"
        ? body.phone.trim()
        : "";

    const planId =
      typeof body.planId === "string"
        ? body.planId.trim()
        : "";

    // Validate email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        {
          success: false,
          message: "A valid email address is required",
        },
        { status: 400 }
      );
    }

    // Validate phone number
    if (!/^\+?[0-9\s().-]{7,20}$/.test(phone)) {
      return NextResponse.json(
        {
          success: false,
          message: "A valid phone number is required",
        },
        { status: 400 }
      );
    }

    // Validate PayPal plan ID
    if (!planId) {
      return NextResponse.json(
        {
          success: false,
          message: "planId is required",
        },
        { status: 400 }
      );
    }

    // Save or update the user in Neon
    const user = await prisma.user.upsert({
      where: { email },
      update: { phone },
      create: {
        email,
        phone,
      },
    });

    // Enable demo checkout only during local development
    const isDemoMode =
      process.env.NODE_ENV === "development" &&
      process.env.PAYPAL_DEMO_MODE === "true";

    if (isDemoMode) {
      const demoSubscriptionId = `DEMO-${crypto.randomUUID()}`;
      const now = new Date();

      // Calculate the next monthly billing date
      const nextBillingDate = new Date(now);
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

      const demoSubscription = await prisma.subscription.create({
        data: {
          paypalSubscriptionId: demoSubscriptionId,
          paypalPlanId: planId,
          status: "ACTIVE",
          startDate: now,
          nextBillingDate,
          userId: user.id,
        },
      });

      return NextResponse.json({
        success: true,
        demoMode: true,
        subscriptionId: demoSubscription.paypalSubscriptionId,
        status: demoSubscription.status,
        message:
          "Demo subscription activated successfully. No payment was collected.",
      });
    }

    // Real PayPal checkout remains unchanged
    const subscription = await createPayPalSubscription(planId);

    if (!subscription.id) {
      throw new Error("PayPal did not return a subscription ID");
    }

    const approvalLink = subscription.links?.find(
      (link: { rel: string; href: string }) =>
        link.rel === "approve"
    );

    if (!approvalLink?.href) {
      throw new Error("PayPal did not return an approval URL");
    }

    // Save the real PayPal subscription in Neon
    await prisma.subscription.create({
      data: {
        paypalSubscriptionId: subscription.id,
        paypalPlanId: planId,
        status: subscription.status ?? "PENDING",
        userId: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      demoMode: false,
      subscriptionId: subscription.id,
      approvalUrl: approvalLink.href,
    });
  } catch (error) {
    console.error("Subscription creation failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create subscription",
      },
      { status: 500 }
    );
  }
}
