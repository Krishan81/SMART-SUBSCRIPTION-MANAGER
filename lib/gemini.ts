
import { GoogleGenAI } from "@google/genai";

export type SubscriberInput = {
  name: string;
  plan: string;
  tenure_months: number;
  successful_payments: number;
  failed_payments: number;
  recent_events: string[];
};

export type ChurnAnalysis = {
  risk_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  reason: string;
  recommended_action:
    | "fix_payment_nudge"
    | "discount_30"
    | "pause_offer"
    | "none";
};

const apiKey = process.env.GEMINI_API_KEY;

function getAI() {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing from .env.local");
  }

  return new GoogleGenAI({ apiKey });
}


export async function analyzeChurn(
  subscriber: SubscriberInput
): Promise<ChurnAnalysis> {
  const ai = getAI();
console.log("Starting Gemini API request...");
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    config: {
      httpOptions: {
        retryOptions: {
          attempts: 1,
        },
      },
    },
    contents: `Analyze this subscriber's subscription churn risk.

Subscriber data:
${JSON.stringify(subscriber, null, 2)}

Return only a valid JSON object with these exact fields:
{
  "risk_score": 0,
  "risk_level": "LOW",
  "reason": "Brief explanation",
  "recommended_action": "none"
}

Rules:
- risk_score must be an integer from 0 to 100.
- risk_level must be LOW, MEDIUM, or HIGH.
- recommended_action must be one of: fix_payment_nudge, discount_30, pause_offer, none.
- Use failed payments and recent events as evidence.
- Do not claim certainty about future behavior.`,
  });
console.log("Gemini API request completed.");
  const text = response.text;

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  const jsonText = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  const parsed: unknown = JSON.parse(jsonText);

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Gemini returned invalid JSON.");
  }

  const result = parsed as Record<string, unknown>;

  const validActions = [
    "fix_payment_nudge",
    "discount_30",
    "pause_offer",
    "none",
  ];

  if (
    typeof result.risk_score !== "number" ||
    !Number.isInteger(result.risk_score) ||
    result.risk_score < 0 ||
    result.risk_score > 100 ||
    !["LOW", "MEDIUM", "HIGH"].includes(
      String(result.risk_level)
    ) ||
    typeof result.reason !== "string" ||
    !validActions.includes(String(result.recommended_action))
  ) {
    throw new Error("Gemini returned an invalid risk analysis.");
  }

  return result as ChurnAnalysis;
}
export async function generateEmail(input: {
  name: string;
  plan: string;
  reason: string;
  recommended_action: string;
}): Promise<string> {
  const ai = getAI();

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: `Write a short, friendly subscription retention email.

Customer name: ${input.name}
Subscription plan: ${input.plan}
Churn risk reason: ${input.reason}
Recommended action: ${input.recommended_action}

Requirements:
- Write a helpful and professional email.
- Include a subject line.
- Personalize it using the customer's name.
- Do not make promises or invent discounts.
- Return only the email text.`,
  });

  const text = response.text;

  if (!text) {
    throw new Error("Gemini returned an empty email.");
  }

  return text.trim();
}
