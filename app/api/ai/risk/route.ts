
import { NextResponse } from "next/server";
import {
  analyzeChurn,
  type SubscriberInput,
} from "@/lib/gemini";



function isValidSubscriber(value: unknown): value is SubscriberInput {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const input = value as Record<string, unknown>;

  return (
    typeof input.name === "string" &&
    input.name.trim().length > 0 &&
    typeof input.plan === "string" &&
    input.plan.trim().length > 0 &&
    typeof input.tenure_months === "number" &&
    Number.isFinite(input.tenure_months) &&
    input.tenure_months >= 0 &&
    typeof input.successful_payments === "number" &&
    Number.isInteger(input.successful_payments) &&
    input.successful_payments >= 0 &&
    typeof input.failed_payments === "number" &&
    Number.isInteger(input.failed_payments) &&
    input.failed_payments >= 0 &&
    Array.isArray(input.recent_events) &&
    input.recent_events.length <= 50 &&
    input.recent_events.every(
      (event) =>
        typeof event === "string" &&
        event.length <= 100
    )
  );
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (!isValidSubscriber(body)) {
      return NextResponse.json(
        { error: "Invalid subscriber information." },
        { status: 400 }
      );
    }

    const result = await analyzeChurn(body);

    return NextResponse.json(result);
  
} catch (error) {
  console.error("Risk analysis failed:", error);

  const message =
    error instanceof Error ? error.message : "Unknown error";

  return NextResponse.json(
    { error: "Unable to analyze churn risk.", details: message },
    { status: 500 }
  );
}

}

