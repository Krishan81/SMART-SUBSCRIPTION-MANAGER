
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function demoModeEnabled() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.PAYPAL_DEMO_MODE === "true"
  );
}

// GET: Load payment history for a user's demo subscriptions
export async function GET(request: NextRequest) {
  if (!demoModeEnabled()) {
    return NextResponse.json(
      { success: false, message: "Demo payments are disabled" },
      { status: 403 }
    );
  }

  try {
    const email = request.nextUrl.searchParams
      .get("email")
      ?.trim();

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email address is required" },
        { status: 400 }
      );
    }

    // Find the user without depending on email letter casing.
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    });

    console.log("Payment history diagnostic:", {
      userFound: Boolean(user),
    });

    if (!user) {
      return NextResponse.json({
        success: true,
        payments: [],
        diagnostic: {
          userFound: false,
          demoSubscriptionCount: 0,
          paymentCount: 0,
        },
      });
    }

    // Find demo payments directly through their subscription relation.
    const [demoSubscriptionCount, payments] = await Promise.all([
      prisma.subscription.count({
        where: {
          userId: user.id,
          paypalSubscriptionId: {
            startsWith: "DEMO-",
          },
        },
      }),

      prisma.payment.findMany({
        where: {
          subscription: {
            userId: user.id,
            paypalSubscriptionId: {
              startsWith: "DEMO-",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          paypalPaymentId: true,
          amount: true,
          currency: true,
          status: true,
          paidAt: true,
          createdAt: true,
          subscription: {
            select: {
              paypalSubscriptionId: true,
            },
          },
        },
      }),
    ]);

    console.log("Payment history results:", {
      demoSubscriptionCount,
      paymentCount: payments.length,
    });

    return NextResponse.json({
      success: true,
      payments: payments.map((payment) => ({
        id: payment.id,
        paymentId: payment.paypalPaymentId,
        amount: payment.amount.toString(),
        currency: payment.currency,
        status: payment.status,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
        subscriptionId: payment.subscription.paypalSubscriptionId,
        simulated: payment.paypalPaymentId.startsWith("DEMO-PAY-"),
      })),
      diagnostic: {
        userFound: true,
        demoSubscriptionCount,
        paymentCount: payments.length,
      },
    });
  } catch (error) {
    console.error("Unable to load demo payment history:", error);

    return NextResponse.json(
      { success: false, message: "Unable to load payment history" },
      { status: 500 }
    );
  }
}

// POST: Simulate a successful or failed demo payment
export async function POST(request: NextRequest) {
  if (!demoModeEnabled()) {
    return NextResponse.json(
      { success: false, message: "Demo payments are disabled" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    const subscriptionId =
      typeof body.subscriptionId === "string"
        ? body.subscriptionId.trim()
        : "";

    const outcome = body.outcome;
    const amountString = String(body.amount ?? "10.00");

    if (!subscriptionId.startsWith("DEMO-")) {
      return NextResponse.json(
        { success: false, message: "A valid demo subscription is required" },
        { status: 400 }
      );
    }

    if (outcome !== "SUCCESS" && outcome !== "FAILED") {
      return NextResponse.json(
        { success: false, message: "Outcome must be SUCCESS or FAILED" },
        { status: 400 }
      );
    }

    if (
      !/^\d{1,7}(\.\d{1,2})?$/.test(amountString) ||
      Number(amountString) <= 0
    ) {
      return NextResponse.json(
        { success: false, message: "Enter a valid positive amount" },
        { status: 400 }
      );
    }

    const subscription = await prisma.subscription.findUnique({
      where: {
        paypalSubscriptionId: subscriptionId,
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, message: "Demo subscription not found" },
        { status: 404 }
      );
    }

    const isSuccessful = outcome === "SUCCESS";

    const payment = await prisma.payment.create({
      data: {
        paypalPaymentId: `DEMO-PAY-${randomUUID()}`,
        amount: amountString,
        currency: "USD",
        status: isSuccessful ? "COMPLETED" : "FAILED",
        paidAt: isSuccessful ? new Date() : null,
        subscriptionId: subscription.id,
      },
    });

    return NextResponse.json(
      {
        success: true,
        simulated: true,
        message: isSuccessful
          ? "Demo successful payment saved"
          : "Demo failed payment saved",
        payment: {
          id: payment.id,
          paymentId: payment.paypalPaymentId,
          amount: payment.amount.toString(),
          currency: payment.currency,
          status: payment.status,
          paidAt: payment.paidAt,
          subscriptionId: subscription.paypalSubscriptionId,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Demo payment simulation failed:", error);

    return NextResponse.json(
      { success: false, message: "Could not save demo payment" },
      { status: 500 }
    );
  }
}
