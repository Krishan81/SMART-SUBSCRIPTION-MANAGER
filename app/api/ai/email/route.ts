import { NextResponse } from "next/server";
import { generateEmail } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { name, plan, reason, recommended_action } = body;

    if (
      typeof name !== "string" ||
      typeof plan !== "string" ||
      typeof reason !== "string" ||
      typeof recommended_action !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid request data." },
        { status: 400 }
      );
    }

    const email = await generateEmail({
      name,
      plan,
      reason,
      recommended_action,
    });

    return NextResponse.json({ email });
  } catch (error) {
    console.error("Email generation failed:", error);

    return NextResponse.json(
      { error: "Unable to generate email." },
      { status: 500 }
    );
  }
}