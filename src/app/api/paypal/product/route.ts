import { NextResponse } from "next/server";
import { createPayPalProduct } from "@/lib/paypal";

export async function POST() {
    try {
        const product = await createPayPalProduct();

        return NextResponse.json({
            success: true,
            product,
        });
    } catch (error) {
        console.error(error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to create PayPal product",
            },
            { status: 500 }
        );
    }
}
