const mongoose = require("mongoose");
const { env } = require("./env");

const connectDB = async () => {
  await mongoose.connect(env.MONGO_URI, { 
    dbName: env.MONGO_DB_NAME 
  });
  console.log(`✅ MongoDB connected (db: ${env.MONGO_DB_NAME})`);
};

module.exports = { connectDB };
