// ARCHIVO: backend/task-service/src/server.js
const app = require("./app");
const { connectDB } = require("./config/db");
const { env } = require("./config/env");
const { registerService, deregisterService } = require("./utils/consulRegister");

const startServer = async () => {
  try {
    await connectDB();
    app.listen(env.PORT, "0.0.0.0", () => {
      console.log(`✅ task-service corriendo en puerto ${env.PORT}`);
      console.log(`📊 Ambiente: ${env.NODE_ENV}`);
      console.log(`📦 Base de datos: ${env.MONGO_DB_NAME}`);
      setTimeout(registerService, 3000);
    });
  } catch (err) {
    console.error("❌ Error al iniciar:", err.message);
    process.exit(1);
  }
};

process.on('SIGTERM', async () => { await deregisterService(); process.exit(0); });
process.on('SIGINT',  async () => { await deregisterService(); process.exit(0); });

startServer();
