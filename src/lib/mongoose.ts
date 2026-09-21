// src/lib/mongoose.ts
import mongoose from 'mongoose';
import { withTimeout, withDbTimeout } from './timeout';

const MONGODB_URI = `mongodb+srv://${process.env.MONGODB_ATLAS_USERNAME}:${process.env.MONGODB_ATLAS_PASSWORD}@${process.env.MONGODB_ATLAS_CLUSTER_URL}/${process.env.MONGODB_ATLAS_DB_NAME}?retryWrites=true&w=majority&appName=${process.env.MONGODB_ATLAS_APP_NAME}`;

// Keep the MongoDB connection attempt bounded. On Cloudflare Workers the Mongo
// driver cannot open TCP sockets (its `net`/`tls` calls never settle on
// workerd), so without a hard timeout `await connectToDatabase()` hangs forever
// and the runtime cancels the request with "Worker's code had hung".
const CONNECT_TIMEOUT_MS = 5_000;

interface GlobalMongoose {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: GlobalMongoose | undefined;
}

const cached: GlobalMongoose = global.mongooseCache || { conn: null, promise: null };
if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (!process.env.MONGODB_ATLAS_CLUSTER_URL || !process.env.MONGODB_ATLAS_USERNAME) {
    throw new Error('MongoDB Atlas environment variables are not configured');
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS,
      connectTimeoutMS: CONNECT_TIMEOUT_MS,
      // Cloudflare Workers' `node:tls` shim is unreliable over IPv6, and Atlas
      // SRV records resolve to both A and AAAA answers. Pinning the driver to
      // IPv4 avoids the driver picking an unreachable IPv6 shard, which used
      // to make database operations hang until the runtime canceled the
      // request ("Worker's code had hung", Cloudflare error 1101).
      family: 4,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => {
      console.log('MongoDB connected successfully');
      return m;
    });
  }

  try {
    cached.conn = await withTimeout(cached.promise, CONNECT_TIMEOUT_MS);
  } catch (err) {
    cached.promise = null;
    console.error('MongoDB connection error:', err);
    throw err;
  }

  return cached.conn;
}

/**
 * Run a MongoDB operation with a hard timeout, retrying once on failure.
 *
 * Workers isolates are stateless and the Mongo driver's TCP/TLS sockets are
 * flaky on workerd: a first attempt can fail to select a server (or reuse a
 * socket the runtime already closed) while a fresh attempt succeeds. Retrying
 * keeps the favorites API usable instead of surfacing a spurious 500, and the
 * timeout guarantees the request always settles.
 */
export async function withDbRetry<T>(operation: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await withDbTimeout(operation());
    } catch (err) {
      lastError = err;
      // Configuration problems (e.g. missing Atlas env vars) are not
      // transient: retrying only adds latency and log noise.
      if (err instanceof Error && err.message.includes('not configured')) {
        throw err;
      }
      console.error(`Database operation failed (attempt ${attempt}/${attempts}):`, err);
    }
  }
  throw lastError;
}

export default connectToDatabase;