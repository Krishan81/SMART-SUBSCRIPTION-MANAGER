import { GoogleGenAI } from '@google/genai';
import { Subscriber, SubscriberEvent, RiskAnalysisResult, AllowedActionType, RiskLevel, ALLOWED_ACTION_TYPES } from '@/types/database';

const apiKey = process.env.GEMINI_API_KEY || '';

export async function analyzeSubscriberRiskWithGemini(
  subscriber: Subscriber,
  events: SubscriberEvent[]
): Promise<RiskAnalysisResult> {
  // If API key is not configured or is placeholder, use intelligent heuristic analysis
  if (!apiKey || apiKey === 'your-gemini-api-key') {
    return calculateHeuristicRisk(subscriber, events);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
You are an expert AI risk analyst for a SaaS subscription business. Analyze the following subscriber profile and recent event history to determine payment risk, risk level, risk reason, recommended recovery action, and draft a personalized email.

SUBSCRIBER PROFILE:
- Name: ${subscriber.name}
- Email: ${subscriber.email}
- Plan: ${subscriber.plan}
- Status: ${subscriber.status}
- Account Age: ${subscriber.created_at}

RECENT EVENTS (${events.length} events):
${JSON.stringify(events.slice(0, 10), null, 2)}

STRICT RULES FOR RECOMMENDED ACTION:
You MUST choose the recommended_action from EXACTLY one of these four permitted values, and NO others:
1. "fix_payment_nudge" (Use when payment failed due to card issues or insufficient funds, prompting card update)
2. "discount_30" (Use when subscriber is churning or cancelled due to price sensitivity, offering 30% discount)
3. "pause_offer" (Use when subscriber paused or requested cancellation due to temporary break, offering plan pause)
4. "none" (Use when risk is low and subscriber is healthy)

OUTPUT FORMAT:
Return ONLY a valid JSON object with the following structure (no markdown fences, pure JSON):
{
  "risk_score": <integer between 0 and 100>,
  "risk_level": "<Low | Medium | High | Critical>",
  "risk_reason": "<concise professional summary of risk factors>",
  "recommended_action": "<fix_payment_nudge | discount_30 | pause_offer | none>",
  "email_content": "<personalized professional email draft to the subscriber regarding the recovery action>"
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text ? response.text.trim() : '';
    // Strip markdown code fences if present
    const cleanedText = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');

    const parsed = JSON.parse(cleanedText);

    // Validate and sanitize response
    let action: AllowedActionType = 'none';
    if (ALLOWED_ACTION_TYPES.includes(parsed.recommended_action)) {
      action = parsed.recommended_action;
    }

    let riskLevel: RiskLevel = 'Low';
    if (['Low', 'Medium', 'High', 'Critical'].includes(parsed.risk_level)) {
      riskLevel = parsed.risk_level;
    }

    const score = typeof parsed.risk_score === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.risk_score))) : 20;

    return {
      risk_score: score,
      risk_level: riskLevel,
      risk_reason: parsed.risk_reason || 'AI risk evaluation completed.',
      recommended_action: action,
      email_content: parsed.email_content || `Hi ${subscriber.name},\n\nWe are reaching out regarding your subscription status. Please contact our support team if you need assistance.\n\nBest regards,\nSubscription Team`,
    };
  } catch (error) {
    console.error('Gemini AI analysis error, falling back to heuristic engine:', error);
    return calculateHeuristicRisk(subscriber, events);
  }
}

function calculateHeuristicRisk(
  subscriber: Subscriber,
  events: SubscriberEvent[]
): RiskAnalysisResult {
  const failedEvents = events.filter(
    (e) => e.event_type.includes('FAILED') || e.event_type.includes('DENIED') || e.event_type.includes('SUSPENDED')
  );
  const cancelEvents = events.filter((e) => e.event_type.includes('CANCELLED'));

  let score = 15;
  let level: RiskLevel = 'Low';
  let reason = 'Normal billing cadence and active engagement.';
  let action: AllowedActionType = 'none';

  if (subscriber.status === 'PAYMENT_FAILED' || failedEvents.length > 0) {
    score = 75 + failedEvents.length * 5;
    score = Math.min(100, score);
    level = score >= 85 ? 'Critical' : 'High';
    reason = `${failedEvents.length} payment failure event(s) recorded. Card update required.`;
    action = 'fix_payment_nudge';
  } else if (subscriber.status === 'SUSPENDED') {
    score = 80;
    level = 'High';
    reason = 'Subscription suspended due to unresolved billing issues.';
    action = 'discount_30';
  } else if (subscriber.status === 'CANCELLED' || cancelEvents.length > 0) {
    score = 90;
    level = 'Critical';
    reason = 'Subscription cancellation request initiated by subscriber.';
    action = 'pause_offer';
  } else if (subscriber.plan.includes('Enterprise')) {
    score = 25;
    level = 'Low';
    reason = 'High-value enterprise subscriber with stable payment history.';
    action = 'none';
  }

  const emailTemplates: Record<AllowedActionType, string> = {
    fix_payment_nudge: `Hi ${subscriber.name},\n\nWe noticed a recent payment failure for your ${subscriber.plan} subscription. Please update your payment method in your PayPal account to ensure uninterrupted access.\n\nBest regards,\nCustomer Success`,
    discount_30: `Hi ${subscriber.name},\n\nWe noticed you might be considering canceling your ${subscriber.plan}. We value your partnership and are offering an exclusive 30% discount on your next 3 renewals.\n\nBest regards,\nRetention Team`,
    pause_offer: `Hi ${subscriber.name},\n\nNeed a break? Instead of canceling your ${subscriber.plan}, you can pause your subscription for up to 60 days while keeping your account data safe.\n\nBest regards,\nSupport Team`,
    none: `Hi ${subscriber.name},\n\nThank you for being a valued subscriber of ${subscriber.plan}! Your account is in good standing.\n\nBest regards,\nTeam`,
  };

  return {
    risk_score: score,
    risk_level: level,
    risk_reason: reason,
    recommended_action: action,
    email_content: emailTemplates[action],
  };
}
