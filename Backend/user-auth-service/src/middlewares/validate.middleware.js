const { validationResult } = require("express-validator");

/**
 * Middleware para validar resultados de express-validator
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      mensaje: "Error de validación",
      code: "VALIDATION_ERROR",
      errores: errors.array()
    });
  }

  return next();
};

module.exports = { validateRequest };
