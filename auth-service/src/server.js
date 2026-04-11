const app = require("./app");
const { connectDB } = require("./config/db");
const { env } = require("./config/env");

const startServer = async () => {
  await connectDB(env.MONGO_URI);

  app.listen(env.PORT, () => {
    console.log(`auth-service running on port ${env.PORT}`);
  });
};

startServer().catch((error) => {
  console.error("Failed to start auth-service:", error.message);
  process.exit(1);
});
