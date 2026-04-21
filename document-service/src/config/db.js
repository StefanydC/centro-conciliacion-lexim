const mongoose = require('mongoose');
const env = require('./env');

async function connectDB() {
  try {
    await mongoose.connect(env.MONGO_URI, { dbName: env.MONGO_DB_NAME });
    console.log(`[DB] Conectado a MongoDB Atlas → base: ${env.MONGO_DB_NAME}`);
  } catch (err) {
    console.error('[DB] Error de conexión:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
