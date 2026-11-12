import { NextRequest, NextResponse } from 'next/server';
import { isRetentionAuthorized } from '@/lib/retention-auth';
import { getActions, updateActionEmailAccepted } from '@/lib/db';
import { sendRetentionEmail } from '@/lib/email';


export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!process.env.RETENTION_EXECUTION_SECRET) {
      return NextResponse.json(
        { error: 'Retention execution authorization is not configured.' },
        { status: 503 }
      );
    }

    if (!isRetentionAuthorized(req)) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    if (!id || id.length > 200) {
      return NextResponse.json(
        { error: 'Invalid action ID.' },
        { status: 400 }
      );
    }

    const actions = await getActions();
    const action = actions.find((item) => item.id === id);

    if (!action) {
      return NextResponse.json(
        { error: 'Recovery action not found.' },
        { status: 404 }
      );
    }

    if (action.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Only approved actions can be executed.' },
        { status: 409 }
      );
    }

    if (
      action.action_type === 'none' ||
      !action.email_content?.trim() ||
      !action.subscriber?.email
    ) {
      return NextResponse.json(
        { error: 'Action is missing valid email details.' },
        { status: 400 }
      );
    }

    const subjectByAction: Record<string, string> = {
      fix_payment_nudge: 'An update about your subscription',
      discount_30: 'A special subscription offer',
      pause_offer: 'An option for your subscription',
    };

    const subject = subjectByAction[action.action_type];

    if (!subject) {
      return NextResponse.json(
        { error: 'Unsupported retention action.' },
        { status: 400 }
      );
    }

    if (req.nextUrl.searchParams.get("dryRun") === "true") {
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: "Validation passed. No email was sent and no database changes were made.",
        actionId: action.id,
        actionStatus: action.status,
        emailConfigured: Boolean(
          process.env.RESEND_API_KEY && process.env.RETENTION_EMAIL_FROM
        ),
      });
    }

    const emailResult = await sendRetentionEmail({
      actionId: action.id,
      to: action.subscriber.email,
      subject,
      content: action.email_content,
    });

    const updatedAction = await updateActionEmailAccepted(
      action.id,
      emailResult.emailId
    );

    if (!updatedAction) {
      console.error(
        'Email provider accepted the email, but action status update failed:',
        action.id,
        emailResult.emailId
      );

      return NextResponse.json(
        {
          error: 'Email accepted by provider, but action status update failed.',
          emailAccepted: true,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email accepted by the email provider.',
      emailId: emailResult.emailId,
      action: updatedAction,
    });
  } catch (error) {
    console.error('Retention execution failed:', error);

    return NextResponse.json(
      { error: 'Retention action execution failed.' },
      { status: 500 }
    );
  }
}
