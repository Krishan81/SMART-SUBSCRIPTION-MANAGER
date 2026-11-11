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
        process.env.NEXT_PUBLIC_APP_URL || "http" + "://localhost:3000";

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

type PayPalVerificationHeaders = {
    "paypal-auth-algo"?: string;
    "paypal-cert-url"?: string;
    "paypal-transmission-id"?: string;
    "paypal-transmission-sig"?: string;
    "paypal-transmission-time"?: string;
};

export async function verifyPayPalWebhookSignature(
    headers: Record<string, string>,
    rawBody: string,
    webhookId: string
): Promise<boolean> {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const environment = process.env.PAYPAL_ENVIRONMENT || "sandbox";

    if (!clientId || !clientSecret || !webhookId) {
        throw new Error("PayPal server credentials are not configured.");
    }

    if (environment !== "sandbox" && environment !== "live") {
        throw new Error("Invalid PAYPAL_ENVIRONMENT configuration.");
    }

    let webhookEvent: unknown;

    try {
        webhookEvent = JSON.parse(rawBody);
    } catch {
        return false;
    }

    const paypalHeaders = headers as PayPalVerificationHeaders;

    const {
        "paypal-auth-algo": authAlgo,
        "paypal-cert-url": certUrl,
        "paypal-transmission-id": transmissionId,
        "paypal-transmission-sig": transmissionSig,
        "paypal-transmission-time": transmissionTime
    } = paypalHeaders;

    if (
        !authAlgo ||
        !certUrl ||
        !transmissionId ||
        !transmissionSig ||
        !transmissionTime
    ) {
        return false;
    }

    const baseUrl =
        environment === "live"
            ? "https" + "://api-m.paypal.com"
            : "https" + "://api-m.sandbox.paypal.com";

    const credentials = Buffer.from(
        `${clientId}:${clientSecret}`
    ).toString("base64");

    const tokenResponse = await fetch(
        `${baseUrl}/v1/oauth2/token`,
        {
            method: "POST",
            headers: {
                Authorization: `Basic ${credentials}`,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: "grant_type=client_credentials",
            cache: "no-store"
        }
    );

    if (!tokenResponse.ok) {
        throw new Error("PayPal OAuth authentication failed.");
    }

    const tokenData = await tokenResponse.json();

    if (typeof tokenData.access_token !== "string") {
        throw new Error("PayPal did not return a valid access token.");
    }

    const verificationResponse = await fetch(
        `${baseUrl}/v1/notifications/verify-webhook-signature`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                auth_algo: authAlgo,
                cert_url: certUrl,
                transmission_id: transmissionId,
                transmission_sig: transmissionSig,
                transmission_time: transmissionTime,
                webhook_id: webhookId,
                webhook_event: webhookEvent
            }),
            cache: "no-store"
        }
    );

    if (!verificationResponse.ok) {
        throw new Error("PayPal webhook verification request failed.");
    }

    const verification = await verificationResponse.json();

    return verification.verification_status === "SUCCESS";
}
