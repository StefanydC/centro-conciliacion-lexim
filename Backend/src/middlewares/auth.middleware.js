const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      mensaje: "Token no proporcionado",
      code: "TOKEN_MISSING"
    });
  }

  const token = authHeader.slice("Bearer ".length).trim();

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({
      mensaje: "Token invalido o expirado",
      code: "TOKEN_INVALID"
    });
  }
};

module.exports = { authenticate };
