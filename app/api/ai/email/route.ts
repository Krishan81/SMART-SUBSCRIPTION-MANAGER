
import { NextResponse } from "next/server";
import { generateEmail } from "@/lib/gemini";

const VALID_ACTIONS = [
  "fix_payment_nudge",
  "discount_30",
  "pause_offer",
  "none",
] as const;

function isValidEmailInput(
  value: unknown
): value is {
  name: string;
  plan: string;
  reason: string;
  recommended_action: string;
} {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const input = value as Record<string, unknown>;

  return (
    typeof input.name === "string" &&
    input.name.trim().length > 0 &&
    input.name.length <= 100 &&

    typeof input.plan === "string" &&
    input.plan.trim().length > 0 &&
    input.plan.length <= 80 &&

    typeof input.reason === "string" &&
    input.reason.trim().length > 0 &&
    input.reason.length <= 1200 &&

    typeof input.recommended_action === "string" &&
    VALID_ACTIONS.some(
      (action) => action === input.recommended_action
    )
  );
}

export async function POST(request: Request) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request." },
        { status: 400 }
      );
    }

    if (!isValidEmailInput(body)) {
      return NextResponse.json(
        { error: "Invalid email generation data." },
        { status: 400 }
      );
    }

    const email = await generateEmail({
      name: body.name.trim(),
      plan: body.plan.trim(),
      reason: body.reason.trim(),
      recommended_action: body.recommended_action,
    });

    return NextResponse.json({ email });
  } catch (error) {
    console.error("Email generation failed:", error);

    return NextResponse.json(
      { error: "Unable to generate email. Please try again." },
      { status: 500 }
    );
  }
}