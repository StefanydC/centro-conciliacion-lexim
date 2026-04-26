const express = require("express");
const authController = require("../controllers/auth.controller");
const { validateRequest } = require("../middlewares/validate.middleware");
const { loginValidator } = require("../validators/user.validator");

const router = express.Router();

/**
 * POST /auth/login
 * Inicio de sesión
 * Body: { email, password }
 */
router.post(
  "/login",
  loginValidator,
  validateRequest,
  authController.login
);

module.exports = router;
