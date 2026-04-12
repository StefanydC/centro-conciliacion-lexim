const mongoose = require("mongoose");
const { env } = require("./env");

const connectDB = async (mongoUri) => {
  await mongoose.connect(mongoUri, { dbName: env.MONGO_DB_NAME });
  console.log(`MongoDB connected (db: ${env.MONGO_DB_NAME})`);
};

module.exports = { connectDB };
