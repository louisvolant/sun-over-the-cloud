// server.js

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const mongoose = require('./config/mongoose');

const app = express();
app.set('trust proxy', 1); // Trust Vercel's proxy

const apicache = require('apicache');
const apiRoutes = require('./routes/api');
const scheduler = require('./cron/scheduler');

const cache = apicache.middleware('1 minute', (req, res) => req.method === 'GET');

app.use(express.json());
const allowedOrigins = [
  process.env.CORS_DEV_FRONTEND_URL_AND_PORT,
  'https://sunoverthe.cloud',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

const MONGO_URI = `mongodb+srv://${process.env.MONGODB_ATLAS_USERNAME}:${process.env.MONGODB_ATLAS_PASSWORD}@${process.env.MONGODB_ATLAS_CLUSTER_URL}/${process.env.MONGODB_ATLAS_DB_NAME}?retryWrites=true&w=majority&appName=${process.env.MONGODB_ATLAS_APP_NAME}`;

app.use(session({
  name: 'session',
  secret: process.env.SESSION_COOKIE_KEY,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGO_URI,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60,
    autoRemove: 'native',
  }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'PRODUCTION',
    sameSite: 'Lax',
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

app.use((req, res, next) => {
  console.log('Session config:', {
    secure: process.env.NODE_ENV === 'PRODUCTION',
    sessionId: req.sessionID,
    user: req.session.user,
  });
  next();
});

app.use('/api/', cache, apiRoutes);
app.use('/cron/', scheduler);

const PORT = process.env.PORT || 3001;

mongoose.connection.once('open', () => {
  console.log('MongoDB connected successfully');
  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});