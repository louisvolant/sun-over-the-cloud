// src/app/api/delete_my_account/route.ts
import { NextResponse } from 'next/server';
import { getSessionUser, clearSession } from '@/lib/session';
import { UsersModel, UserFavoritesModel } from '@/lib/models';
import connectToDatabase from '@/lib/mongoose';

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized - Please log in first' }, { status: 401 });
  }

  try {
    await connectToDatabase();
    await UserFavoritesModel.deleteMany({ user_id: user.id });
    await UsersModel.findByIdAndDelete(user.id);
    await clearSession();

    return NextResponse.json({
      success: true,
      message: 'Account and all associated data successfully deleted',
    });
  } catch (err: any) {
    console.error('Account deletion failed:', err);
    return NextResponse.json({ success: false, error: 'Failed to delete account' }, { status: 500 });
  }
}
