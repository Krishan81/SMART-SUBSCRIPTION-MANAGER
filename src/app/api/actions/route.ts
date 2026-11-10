import { NextRequest, NextResponse } from 'next/server';
import { createAction, getActions } from '@/lib/db';
import { isAllowedActionType } from '@/types/database';

/**
 * GET /api/actions - List all recovery actions
 */
export async function GET() {
  try {
    const actions = await getActions();
    return NextResponse.json({ actions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/actions - Create a new recovery action (STRICT validation)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subscriber_id, action_type, email_content, status } = body;

    // Validate action_type
    if (!isAllowedActionType(action_type)) {
      return NextResponse.json(
        {
          error: `Invalid action type: "${action_type}". Only permitted: fix_payment_nudge, discount_30, pause_offer, none`,
        },
        { status: 400 }
      );
    }

    // Validate subscriber_id
    if (!subscriber_id) {
      return NextResponse.json({ error: 'subscriber_id is required' }, { status: 400 });
    }

    // Validate email_content
    if (!email_content) {
      return NextResponse.json({ error: 'email_content is required' }, { status: 400 });
    }

    const action = await createAction({
      subscriber_id,
      action_type,
      status: status || 'PENDING',
      email_content,
    });

    return NextResponse.json({ action }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}