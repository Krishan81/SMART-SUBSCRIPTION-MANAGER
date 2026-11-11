import { NextRequest, NextResponse } from 'next/server';
import { getActions, updateActionStatus } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body: unknown = await req.json();

    if (
      !body ||
      typeof body !== 'object' ||
      !('status' in body) ||
      typeof body.status !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Invalid request.' },
        { status: 400 }
      );
    }

    if (body.status !== 'APPROVED' && body.status !== 'REJECTED') {
      return NextResponse.json(
        { error: 'Execution requires successful email delivery.' },
        { status: 400 }
      );
    }

    const actions = await getActions();
    const action = actions.find((item) => item.id === id);

    if (!action) {
      return NextResponse.json(
        { error: 'Action not found.' },
        { status: 404 }
      );
    }

    if (action.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only pending actions can be approved or rejected.' },
        { status: 409 }
      );
    }

    const updated = await updateActionStatus(id, body.status);

    if (!updated) {
      return NextResponse.json(
        { error: 'Could not update action.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, action: updated });
  } catch (error) {
    console.error('Action update failed:', error);
    return NextResponse.json(
      { error: 'Action update failed.' },
      { status: 500 }
    );
  }
}
