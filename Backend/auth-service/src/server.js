const app = require("./app");
const { connectDB } = require("./config/db");
const { env }       = require("./config/env");

const startServer = async () => {
  await connectDB(env.MONGO_URI);

  // 0.0.0.0 es obligatorio para que Docker exponga el puerto
  app.listen(env.PORT, "0.0.0.0", () => {
    console.log(`✅ auth-service corriendo en puerto ${env.PORT}`);
  });
};

startServer().catch((err) => {
  console.error("❌ Error al iniciar:", err.message);
  process.exit(1);
});