// src/app/api/favorites/route.ts
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { UserFavoritesModel } from '@/lib/models';
import connectToDatabase, { withDbRetry } from '@/lib/mongoose';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await withDbRetry(() => connectToDatabase());
    // Every database operation is time-bounded and retried: on Cloudflare
    // Workers a Mongo socket that stays pending can make the runtime cancel
    // the whole request ("Worker's code had hung"), which used to leave the UI
    // with stale favorites and made freshly added locations invisible.
    const favorites = await withDbRetry(() =>
      UserFavoritesModel.find({ user_id: user.id }).sort({ order: 1 }),
    );
    return NextResponse.json(favorites);
  } catch (err: any) {
    console.error('Error fetching favorites:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
