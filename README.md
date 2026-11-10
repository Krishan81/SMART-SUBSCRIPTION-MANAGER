# SMART-SUBSCRIPTION-MANAGER

AI-powered subscription retention manager using PayPal.

## Project Overview

SMART-SUBSCRIPTION-MANAGER is an AI-powered subscription risk management system designed to identify subscribers at risk of cancellation and recommend appropriate retention actions.

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- PayPal
- Google Gemini

## Team Responsibilities

- Student 1 — Frontend / Dashboard
- Student 2 — PayPal Integration
- Student 3 — AI / Gemini
- Student 4 — Database / Integration

## Branches

- `main`
- `feature/frontend`
- `feature/paypal`
- `feature/ai`
- `feature/database`

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root and configure the required Supabase, PayPal and Gemini credentials.

Never commit your `.env.local` file or expose API keys.

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for production

```bash
npm run build
```

## Project Structure

```text
subscription-risk-dashboard/
├── src/
│   ├── app/
│   │   └── api/
│   ├── components/
│   ├── lib/
│   └── types/
├── supabase/
│   └── schema.sql
├── public/
├── package.json
└── README.md
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [PayPal Developer Documentation](https://developer.paypal.com/)
- [Google AI Documentation](https://ai.google.dev/)