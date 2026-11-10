import { NextRequest, NextResponse } from "next/server";
import { createPayPalPlan } from "@/lib/paypal";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const productId = body.productId;

        if (!productId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "productId is required",
                },
                { status: 400 }
            );
        }

        const plan = await createPayPalPlan(productId);

        return NextResponse.json({
            success: true,
            plan,
        });
    } catch (error) {
        console.error(error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to create PayPal plan",
            },
            { status: 500 }
        );
    }
}