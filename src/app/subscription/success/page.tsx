
export default function SubscriptionSuccessPage() {
    return (
        <main className="min-h-screen flex flex-col items-center justify-center bg-green-50 p-6">
            <div className="bg-white rounded-xl shadow-md p-8 text-center max-w-md">
                <h1 className="text-3xl font-bold text-green-700 mb-4">
                    Subscription Approved!
                </h1>

                <p className="text-gray-600 mb-6">
                    Thank you for subscribing to Smart Subscription Manager.
                    Your subscription approval has been received.
                </p>

                <a
                    href="/"
                    className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
                >
                    Go to Dashboard
                </a>
            </div>
        </main>
    );
}
