import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Smart Subscription Manager",
    description: "AI-powered PayPal subscription retention manager",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}