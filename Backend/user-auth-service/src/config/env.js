const dotenv = require("dotenv");

dotenv.config();

const requiredEnvs = ["MONGO_URI", "JWT_SECRET"];

for (const key of requiredEnvs) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT) || 3001,
  MONGO_URI: process.env.MONGO_URI,
  MONGO_DB_NAME: process.env.MONGO_DB_NAME || "Lexim_db",
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "1h",
  GOOGLE_CLIENT_ID:     process.env.GOOGLE_CLIENT_ID     || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  GOOGLE_REDIRECT_URI:  process.env.GOOGLE_REDIRECT_URI  || "http://localhost/auth/google/callback"
};

module.exports = { env };
