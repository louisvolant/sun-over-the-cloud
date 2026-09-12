// src/lib/mongoose.ts
import mongoose from 'mongoose';

const MONGODB_URI = `mongodb+srv://${process.env.MONGODB_ATLAS_USERNAME}:${process.env.MONGODB_ATLAS_PASSWORD}@${process.env.MONGODB_ATLAS_CLUSTER_URL}/${process.env.MONGODB_ATLAS_DB_NAME}?retryWrites=true&w=majority&appName=${process.env.MONGODB_ATLAS_APP_NAME}`;

interface GlobalMongoose {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: GlobalMongoose | undefined;
}

let cached: GlobalMongoose = global.mongooseCache || { conn: null, promise: null };
if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => {
      console.log('MongoDB connected successfully');
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    console.error('MongoDB connection error:', err);
    throw err;
  }

  return cached.conn;
}

export default connectToDatabase;
