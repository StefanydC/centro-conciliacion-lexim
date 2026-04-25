const express = require("express");
const cors    = require("cors");
const authRoutes = require("./routes/auth.routes");
const taskRoutes = require("./routes/task.routes");
const finanzasRoutes = require("./routes/finanzas.routes");
const { notFoundHandler, errorHandler } = require("./middlewares/error.middleware");

const app = express();

app.use(cors({
  origin:  "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

app.use("/auth",     authRoutes);
app.use("/tasks",    taskRoutes);
app.use("/finanzas", finanzasRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "auth-service" });
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;