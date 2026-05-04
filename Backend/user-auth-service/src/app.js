const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes = require("./routes/auth.routes");
const taskRoutes = require("./routes/task.routes");
const notificationRoutes = require("./routes/notification.routes");
const finanzasRoutes = require("./routes/finanzas.routes");
const userRoutes = require("./routes/user.routes");
const { notFoundHandler, errorHandler } = require("./middlewares/error.middleware");

const app = express();

// ─── Middlewares globales ─────────────────────────────────────────────────────
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(morgan("combined"));
app.use(express.json());

// ─── Rutas ────────────────────────────────────────────────────────────────────
app.use("/auth", authRoutes);
app.use("/tasks", taskRoutes);
app.use("/notifications", notificationRoutes);
app.use("/finanzas", finanzasRoutes);
app.use("/usuarios", userRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    service: "user-auth-service",
    timestamp: new Date().toISOString()
  });
});

// ─── Manejo de errores ────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
