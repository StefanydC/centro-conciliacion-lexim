const app = require("./app");
const { connectDB } = require("./config/db");
const { env } = require("./config/env");

const startServer = async () => {
  try {
    // Conectar a MongoDB
    await connectDB();

    // Iniciar servidor en 0.0.0.0 (obligatorio para Docker)
    app.listen(env.PORT, "0.0.0.0", () => {
      console.log(`✅ user-auth-service corriendo en puerto ${env.PORT}`);
      console.log(`📊 Ambiente: ${env.NODE_ENV}`);
      console.log(`📦 Base de datos: ${env.MONGO_DB_NAME}`);
    });
  } catch (err) {
    console.error("❌ Error al iniciar:", err.message);
    process.exit(1);
  }
};

startServer();
