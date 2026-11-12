import { NextRequest, NextResponse } from 'next/server';
import { getActions, updateActionStatus } from '@/lib/db';
import { sendRetentionEmail } from '@/lib/email';
import { createAdminClient } from '@/lib/supabase-server';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Admin authorization check - only authenticated admins can execute
    const supabase = await createAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin authentication required.' },
        { status: 401 }
      );
    }

    const userRole = user.app_metadata?.role;
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin authorization required.' },
        { status: 403 }
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

    let emailId = null;

    try {
      const emailResult = await sendRetentionEmail({
        actionId: action.id,
        to: action.subscriber.email,
        subject,
        content: action.email_content,
      });
      emailId = emailResult.emailId;
    } catch (emailError) {
      console.error('Retention email failed:', emailError);
      // Do NOT update action status - leave as APPROVED for retry
      return NextResponse.json(
        { error: 'Retention email failed. Action remains approved for retry.' },
        { status: 500 }
      );
    }

    const updatedAction = await updateActionStatus(
      action.id,
      'EXECUTED'
    );

    if (!updatedAction) {
      // Email was accepted by provider, but status update failed.
      // This is a rare edge case; return success with warning.
      return NextResponse.json(
        {
          success: true,
          message: 'Email accepted by provider, but action status update failed.',
          emailId,
          emailAcceptionWarning: true,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email accepted by the email provider.',
      emailId,
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
