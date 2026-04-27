const express = require("express");
const jwt = require("jsonwebtoken");
const authController = require("../controllers/auth.controller");
const { validateRequest } = require("../middlewares/validate.middleware");
const { loginValidator } = require("../validators/user.validator");
const { env } = require("../config/env");

const router = express.Router();

/**
 * POST /auth/login
 */
router.post("/login", loginValidator, validateRequest, authController.login);

/**
 * POST /auth/logout
 * Acepta token vía:
 *   1. Header:  Authorization: Bearer <token>   (logout normal)
 *   2. Body:    { token: "..." }                (sendBeacon al cerrar pestaña)
 */
router.post("/logout", (req, res, next) => {
  // Extraer token de header o de body (sendBeacon no puede poner headers)
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.body?.token) {
    token = req.body.token;
  }

  if (!token) {
    // Sin token: igual responder OK (no hay usuario que marcar)
    return res.json({ mensaje: "Sin sesión activa" });
  }

  try {
    req.user = jwt.verify(token, env.JWT_SECRET);
    next();
  } catch {
    // Token expirado o inválido: responder OK (ya no hay sesión)
    return res.json({ mensaje: "Sesión ya expirada" });
  }
}, authController.logout);

module.exports = router;
