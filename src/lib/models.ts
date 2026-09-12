// src/lib/models.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

// --- Users Model ---
export interface IUser extends Document {
  username: string;
  email: string;
  hashed_password: string;
  created_at: Date;
}

const usersSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  hashed_password: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
});

export const UsersModel: Model<IUser> =
  mongoose.models.Users || mongoose.model<IUser>('Users', usersSchema, 'Users');

// --- User Password Reset Tokens Model ---
export interface IUserPasswordResetToken extends Document {
  user_id: mongoose.Types.ObjectId;
  token: string;
  created_at: Date;
  expires_at: Date;
}

const passwordResetTokensSchema = new Schema<IUserPasswordResetToken>({
  user_id: { type: Schema.Types.ObjectId, ref: 'Users', required: true },
  token: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  expires_at: { type: Date, required: true },
});

export const UserPasswordResetTokensModel: Model<IUserPasswordResetToken> =
  mongoose.models.UserPasswordResetTokens ||
  mongoose.model<IUserPasswordResetToken>('UserPasswordResetTokens', passwordResetTokensSchema, 'UserPasswordResetTokens');

// --- User Favorites Model ---
export interface IUserFavorite extends Document {
  user_id: mongoose.Types.ObjectId;
  location_name: string;
  longitude: number;
  latitude: number;
  country_code: string;
  order: number;
}

const userFavoritesSchema = new Schema<IUserFavorite>({
  user_id: { type: Schema.Types.ObjectId, ref: 'Users', required: true },
  location_name: { type: String, required: true },
  longitude: { type: Number, required: true },
  latitude: { type: Number, required: true },
  country_code: { type: String, required: true },
  order: { type: Number, default: 0 },
});

export const UserFavoritesModel: Model<IUserFavorite> =
  mongoose.models.UserFavorites || mongoose.model<IUserFavorite>('UserFavorites', userFavoritesSchema, 'UserFavorites');

// --- Location Search Model ---
export interface ILocationSearch extends Document {
  city: string;
  lang: string;
  data: any;
}

const locationSearchSchema = new Schema<ILocationSearch>({
  city: { type: String, required: true },
  lang: { type: String, required: true },
  data: { type: Schema.Types.Mixed, required: true },
});

export const LocationSearchModel: Model<ILocationSearch> =
  mongoose.models.LocationSearch || mongoose.model<ILocationSearch>('LocationSearch', locationSearchSchema, 'LocationSearch');

// --- Weather OnCall Day Summary Model ---
export interface IWeatherOnCallDaySummary extends Document {
  latitude: number;
  longitude: number;
  date: string;
  data: any;
}

const weatherOnCallDaySummarySchema = new Schema<IWeatherOnCallDaySummary>({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  date: { type: String, required: true },
  data: { type: Schema.Types.Mixed, required: true },
});

export const WeatherOnCallDaySummaryModel: Model<IWeatherOnCallDaySummary> =
  mongoose.models.WeatherOnCallDaySummary ||
  mongoose.model<IWeatherOnCallDaySummary>('WeatherOnCallDaySummary', weatherOnCallDaySummarySchema, 'WeatherOnCallDaySummary');

// --- Weather OnCall Model (with 1h TTL) ---
export interface IWeatherOnCall extends Document {
  latitude: number;
  longitude: number;
  units?: string;
  lang?: string;
  data: any;
  createdAt: Date;
}

const weatherOnCallSchema = new Schema<IWeatherOnCall>({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  units: String,
  lang: String,
  data: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now, expires: 3600 },
});

export const WeatherOnCallModel: Model<IWeatherOnCall> =
  mongoose.models.WeatherOnCall || mongoose.model<IWeatherOnCall>('WeatherOnCall', weatherOnCallSchema, 'WeatherOnCall');
