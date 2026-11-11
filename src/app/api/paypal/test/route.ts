import { NextResponse, connection } from "next/server";
import { getPayPalAccessToken } from "@/lib/paypal";

export async function GET() {
  await connection();

  try {
    const accessToken = await getPayPalAccessToken();

    return NextResponse.json({
      success: true,
      message: "PayPal authentication successful",
      hasAccessToken: !!accessToken,
    });
  } catch (error) {
    console.error("PayPal authentication test failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "PayPal authentication failed",
      },
      { status: 500 }
    );
  }
}
