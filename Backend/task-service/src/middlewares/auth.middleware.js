// ARCHIVO: backend/task-service/src/middlewares/auth.middleware.js
const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const { ApiError } = require("../utils/apiError");

const verifyToken = (req, res, next) => {
  const userId   = req.headers["x-user-id"];
  const userRole = req.headers["x-user-role"];

  if (userId && userRole) {
    req.user = {
      sub:          userId,
      tipo_usuario: userRole,
      rol:          userRole,
      email:        req.headers["x-user-email"] || ""
    };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new ApiError("Token no proporcionado", 401));
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    next(new ApiError("Token inválido o expirado", 401));
  }
};

const requireAdmin = (req, res, next) => {
  const role = req.user?.tipo_usuario || req.user?.rol;
  if (role !== "administrador" && role !== "admin") {
    return next(new ApiError("Acceso restringido a administradores", 403));
  }
  next();
};

module.exports = { verifyToken, requireAdmin };
