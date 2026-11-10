import { NextRequest, NextResponse } from 'next/server';
import { updateActionStatus } from '@/lib/db';

/**
 * PATCH /api/actions/:id - Update action status (requires admin approval)
 */
export async function PATCH(
  request: NextRequest,
  { params }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    const allowedStatuses = ['APPROVED', 'EXECUTED', 'REJECTED'];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const updatedAction = await updateActionStatus(id, status as 'APPROVED' | 'EXECUTED' | 'REJECTED');
    if (!updatedAction) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    return NextResponse.json({ action: updatedAction });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}