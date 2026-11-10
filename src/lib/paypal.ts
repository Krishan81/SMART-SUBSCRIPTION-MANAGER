const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL!;
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID!;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET!;

export async function getPayPalAccessToken() {
    const credentials = Buffer.from(
        `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
    ).toString("base64");

    const response = await fetch(
        `${PAYPAL_BASE_URL}/v1/oauth2/token`,
        {
            method: "POST",
            headers: {
                Authorization: `Basic ${credentials}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "grant_type=client_credentials",
        }
    );

    if (!response.ok) {
        const error = await response.text();

        throw new Error(
            `PayPal authentication failed: ${error}`
        );
    }

    const data = await response.json();

    return data.access_token;
}

export async function createPayPalProduct() {
    const accessToken = await getPayPalAccessToken();

    const response = await fetch(
        `${PAYPAL_BASE_URL}/v1/catalogs/products`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                Prefer: "return=representation",
                "PayPal-Request-Id": `product-${Date.now()}`,
            },
            body: JSON.stringify({
                name: "Smart Subscription Manager",
                description:
                    "Subscription plan for Smart Subscription Manager",
                type: "SERVICE",
                category: "SOFTWARE",
            }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        console.error(
            "PayPal product creation failed:",
            data
        );

        throw new Error(
            data.message || "Failed to create PayPal product"
        );
    }

    return data;
}

export async function createPayPalPlan(productId: string) {
    const accessToken = await getPayPalAccessToken();

    const response = await fetch(
        `${PAYPAL_BASE_URL}/v1/billing/plans`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                Accept: "application/json",
                Prefer: "return=representation",
                "PayPal-Request-Id": `plan-${Date.now()}`,
            },
            body: JSON.stringify({
                product_id: productId,
                name: "Smart Subscription Manager - Basic",
                description: "Basic monthly subscription",
                billing_cycles: [
                    {
                        frequency: {
                            interval_unit: "MONTH",
                            interval_count: 1,
                        },
                        tenure_type: "REGULAR",
                        sequence: 1,
                        total_cycles: 0,
                        pricing_scheme: {
                            fixed_price: {
                                value: "10.00",
                                currency_code: "USD",
                            },
                        },
                    },
                ],
                payment_preferences: {
                    auto_bill_outstanding: true,
                    payment_failure_threshold: 1,
                },
            }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        console.error(
            "PayPal plan creation failed:",
            data
        );

        throw new Error(
            data.message || "Failed to create PayPal plan"
        );
    }

    return data;
}


export async function createPayPalSubscription(planId: string) {
    const accessToken = await getPayPalAccessToken();

    const appUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const response = await fetch(
        `${PAYPAL_BASE_URL}/v1/billing/subscriptions`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                Accept: "application/json",
                Prefer: "return=representation",
                "PayPal-Request-Id": `subscription-${Date.now()}`,
            },
            body: JSON.stringify({
                plan_id: planId,
                application_context: {
                    brand_name: "Smart Subscription Manager",
                    user_action: "SUBSCRIBE_NOW",
                    shipping_preference: "NO_SHIPPING",
                    return_url: `${appUrl}/subscription/success`,
                    cancel_url: `${appUrl}/subscription/cancel`,
                },
            }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        console.error("PayPal subscription creation failed:", data);

        throw new Error(
            data.message || "Failed to create PayPal subscription"
        );
    }

    console.log("PayPal subscription response:", {
        id: data.id,
        status: data.status,
        plan_id: data.plan_id,
        links: data.links?.map((link: any) => ({
            rel: link.rel,
            method: link.method,
            host: new URL(link.href).host,
            pathname: new URL(link.href).pathname,
        })),
    });


    return data;
}
