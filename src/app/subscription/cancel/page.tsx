
export default function SubscriptionCancelPage() {
    return (
        <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
            <div className="bg-white rounded-xl shadow-md p-8 text-center max-w-md">
                <h1 className="text-3xl font-bold text-gray-800 mb-4">
                    Subscription Cancelled
                </h1>

                <p className="text-gray-600 mb-6">
                    You left the PayPal approval process.
                    No worries — you can try subscribing again whenever
                    you are ready.
                </p>

                <a
                    href="/"
                    className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                >
                    Return to Dashboard
                </a>
            </div>
        </main>
    );
}
