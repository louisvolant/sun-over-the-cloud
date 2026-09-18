// src/lib/mongoose.ts
import mongoose from 'mongoose';
import { withTimeout } from './timeout';

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

export default connectToDatabase;