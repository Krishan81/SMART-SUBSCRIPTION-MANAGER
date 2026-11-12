import { NextRequest, NextResponse } from 'next/server';
import { createAction, getActions } from '@/lib/db';
import { isAllowedActionType } from '@/types/database';
import { createAdminClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    // Check admin authorization
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

    const actions = await getActions();
    return NextResponse.json({ actions });
  } catch (error) {
    console.error('Failed to fetch actions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recovery actions.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check admin authorization
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

    const body: unknown = await req.json();

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Invalid request body.' },
        { status: 400 }
      );
    }

    const {
      subscriber_id,
      action_type,
      email_content,
    } = body as Record<string, unknown>;

    if (
      typeof subscriber_id !== 'string' ||
      !subscriber_id.trim()
    ) {
      return NextResponse.json(
        { error: 'A valid subscriber_id is required.' },
        { status: 400 }
      );
    }

    if (typeof action_type !== 'string' || !isAllowedActionType(action_type)) {
      return NextResponse.json(
        { error: 'Invalid recovery action type.' },
        { status: 400 }
      );
    }

    if (
      typeof email_content !== 'string' ||
      !email_content.trim() ||
      email_content.length > 10000
    ) {
      return NextResponse.json(
        { error: 'Valid email_content is required (maximum 10000 characters).' },
        { status: 400 }
      );
    }

    const action = await createAction({
      subscriber_id: subscriber_id.trim(),
      action_type,
      status: 'PENDING',
      email_content: email_content.trim(),
    });

    return NextResponse.json({ action }, { status: 201 });
  } catch (error) {
    console.error('Failed to create recovery action:', error);
    return NextResponse.json(
      { error: 'Failed to create recovery action.' },
      { status: 500 }
    );
  }
}