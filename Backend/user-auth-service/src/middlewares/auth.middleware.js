const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const { ApiError } = require("../utils/apiError");

/**
 * Verifica la identidad del usuario.
 * Acepta headers X-User-* inyectados por el API Gateway (ya validados)
 * o un JWT en Authorization: Bearer como fallback.
 */
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

module.exports = { verifyToken };
