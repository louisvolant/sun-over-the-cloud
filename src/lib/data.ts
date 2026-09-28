// src/lib/data.ts
//
// Data-access layer for the app's durable data, backed by Cloudflare D1
// (SQLite). Every function grabs the binding for the current request through
// `getEnv()`, so there is no connection to open, pool or time out: queries are
// plain SQL executed at the edge.
import { getEnv } from './cloudflare';

export interface DbUser {
  _id: string;
  username: string;
  email: string;
  hashed_password: string;
  created_at: number;
}

export interface DbFavorite {
  _id: string;
  user_id: string;
  location_name: string;
  longitude: number;
  latitude: number;
  country_code: string;
  order: number;
}

export interface DbResetToken {
  _id: string;
  user_id: string;
  token: string;
  created_at: number;
  expires_at: number;
}

const USER_COLUMNS = 'id AS _id, username, email, hashed_password, created_at';
const FAVORITE_COLUMNS =
  'id AS _id, user_id, location_name, longitude, latitude, country_code, sort_order AS "order"';

// --- Users -----------------------------------------------------------------

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  return getEnv()
    .DB.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ? COLLATE NOCASE LIMIT 1`)
    .bind(email)
    .first<DbUser>();
}

export async function findUserByUsername(username: string): Promise<DbUser | null> {
  return getEnv()
    .DB.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE username = ? COLLATE NOCASE LIMIT 1`)
    .bind(username)
    .first<DbUser>();
}

/** Finds a user whose username or email matches (case-insensitive). */
export async function findUserByUsernameOrEmail(
  username: string,
  email: string
): Promise<DbUser | null> {
  return getEnv()
    .DB.prepare(
      `SELECT ${USER_COLUMNS} FROM users
       WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE LIMIT 1`
    )
    .bind(username, email)
    .first<DbUser>();
}

export async function createUser(input: {
  username: string;
  email: string;
  hashedPassword: string;
}): Promise<DbUser> {
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  await getEnv()
    .DB.prepare(
      'INSERT INTO users (id, username, email, hashed_password, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(id, input.username, input.email, input.hashedPassword, createdAt)
    .run();
  return {
    _id: id,
    username: input.username,
    email: input.email,
    hashed_password: input.hashedPassword,
    created_at: createdAt,
  };
}

/** Returns true when a user row was updated. */
export async function updateUserPassword(id: string, hashedPassword: string): Promise<boolean> {
  const result = await getEnv()
    .DB.prepare('UPDATE users SET hashed_password = ? WHERE id = ?')
    .bind(hashedPassword, id)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function deleteUser(id: string): Promise<void> {
  await getEnv().DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
}

// --- Favorites -------------------------------------------------------------

export async function listFavorites(userId: string): Promise<DbFavorite[]> {
  const { results } = await getEnv()
    .DB.prepare(
      `SELECT ${FAVORITE_COLUMNS} FROM user_favorites WHERE user_id = ? ORDER BY sort_order ASC`
    )
    .bind(userId)
    .all<DbFavorite>();
  return results ?? [];
}

export async function findFavorite(input: {
  userId: string;
  locationName: string;
  latitude: number;
  longitude: number;
  countryCode: string;
}): Promise<DbFavorite | null> {
  return getEnv()
    .DB.prepare(
      `SELECT ${FAVORITE_COLUMNS} FROM user_favorites
       WHERE user_id = ? AND location_name = ? AND latitude = ? AND longitude = ? AND country_code = ?
       LIMIT 1`
    )
    .bind(input.userId, input.locationName, input.latitude, input.longitude, input.countryCode)
    .first<DbFavorite>();
}

export async function findHighestOrderFavorite(userId: string): Promise<DbFavorite | null> {
  return getEnv()
    .DB.prepare(
      `SELECT ${FAVORITE_COLUMNS} FROM user_favorites WHERE user_id = ? ORDER BY sort_order DESC LIMIT 1`
    )
    .bind(userId)
    .first<DbFavorite>();
}

export async function insertFavorite(input: {
  userId: string;
  locationName: string;
  latitude: number;
  longitude: number;
  countryCode: string;
  order: number;
}): Promise<DbFavorite> {
  const id = crypto.randomUUID();
  await getEnv()
    .DB.prepare(
      `INSERT INTO user_favorites
        (id, user_id, location_name, longitude, latitude, country_code, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.userId,
      input.locationName,
      input.longitude,
      input.latitude,
      input.countryCode,
      input.order
    )
    .run();
  return {
    _id: id,
    user_id: input.userId,
    location_name: input.locationName,
    longitude: input.longitude,
    latitude: input.latitude,
    country_code: input.countryCode,
    order: input.order,
  };
}

/** Returns true when the favorite existed and was removed. */
export async function deleteFavorite(id: string, userId: string): Promise<boolean> {
  const result = await getEnv()
    .DB.prepare('DELETE FROM user_favorites WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function deleteFavoritesForUser(userId: string): Promise<void> {
  await getEnv().DB.prepare('DELETE FROM user_favorites WHERE user_id = ?').bind(userId).run();
}

/** Compact the sort_order values back to a dense 0..n-1 sequence. */
export async function renumberFavorites(userId: string): Promise<void> {
  const favorites = await listFavorites(userId);
  const statements = favorites
    .map((favorite, index) =>
      favorite.order === index
        ? null
        : getEnv()
            .DB.prepare('UPDATE user_favorites SET sort_order = ? WHERE id = ?')
            .bind(index, favorite._id)
    )
    .filter((statement): statement is NonNullable<typeof statement> => statement !== null);

  if (statements.length > 0) {
    await getEnv().DB.batch(statements);
  }
}

/** Apply a full ordering in a single batched transaction. */
export async function reorderFavorites(userId: string, orderedIds: string[]): Promise<void> {
  const statements = orderedIds.map((id, index) =>
    getEnv()
      .DB.prepare('UPDATE user_favorites SET sort_order = ? WHERE id = ? AND user_id = ?')
      .bind(index, id, userId)
  );

  if (statements.length > 0) {
    await getEnv().DB.batch(statements);
  }
}

/** Distinct locations saved by at least one user (used by the cron scheduler). */
export async function listDistinctFavoriteLocations(): Promise<
  { latitude: number; longitude: number; location_name: string }[]
> {
  const { results } = await getEnv()
    .DB.prepare(
      'SELECT DISTINCT latitude, longitude, location_name FROM user_favorites'
    )
    .all<{ latitude: number; longitude: number; location_name: string }>();
  return results ?? [];
}

/** Global "popular locations": most-saved places, in first-added order. */
export async function listPopularFavorites(
  limit: number
): Promise<{ location_name: string; latitude: number; longitude: number; country_code: string }[]> {
  const { results } = await getEnv()
    .DB.prepare(
      `SELECT location_name, latitude, longitude, country_code, MIN(sort_order) AS min_order
       FROM user_favorites
       GROUP BY location_name, latitude, longitude, country_code
       ORDER BY min_order ASC
       LIMIT ?`
    )
    .bind(limit)
    .all<{ location_name: string; latitude: number; longitude: number; country_code: string }>();
  return results ?? [];
}

// --- Password reset tokens -------------------------------------------------

export async function createResetToken(input: {
  userId: string;
  token: string;
  expiresAt: number;
}): Promise<void> {
  await getEnv()
    .DB.prepare(
      `INSERT INTO password_reset_tokens (id, user_id, token, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), input.userId, input.token, Date.now(), input.expiresAt)
    .run();
}

export async function getResetToken(token: string): Promise<DbResetToken | null> {
  return getEnv()
    .DB.prepare(
      `SELECT id AS _id, user_id, token, created_at, expires_at
       FROM password_reset_tokens WHERE token = ? LIMIT 1`
    )
    .bind(token)
    .first<DbResetToken>();
}

export async function deleteResetToken(id: string): Promise<void> {
  await getEnv().DB.prepare('DELETE FROM password_reset_tokens WHERE id = ?').bind(id).run();
}
