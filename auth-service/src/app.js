const express = require("express");
const authRoutes = require("./routes/auth.routes");
const { notFoundHandler, errorHandler } = require("./middlewares/error.middleware");

const app = express();

app.use(express.json());

app.use("/auth", authRoutes);

app.get("/health", (req, res) => {
	res.json({ mensaje: "auth-service funcionando" });
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
