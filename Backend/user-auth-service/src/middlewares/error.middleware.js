const { ApiError } = require("../utils/apiError");

/**
 * Middleware 404 - Ruta no encontrada
 */
const notFoundHandler = (req, res) => {
  return res.status(404).json({
    mensaje: "Ruta no encontrada",
    code: "NOT_FOUND"
  });
};

/**
 * Middleware de manejo de errores global
 */
const errorHandler = (error, req, res, next) => {
  // Errores de negocio (ApiError)
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      mensaje: error.message,
      code: "BUSINESS_ERROR"
    });
  }

  // Error de email duplicado en MongoDB
  if (error.name === "MongoServerError" && error.code === 11000) {
    return res.status(409).json({
      mensaje: "El correo ya está registrado",
      code: "DUPLICATE_RESOURCE"
    });
  }

  // Error de validación de Mongoose
  if (error.name === "ValidationError") {
    const messages = Object.values(error.errors).map(err => err.message);
    return res.status(400).json({
      mensaje: "Error de validación",
      code: "VALIDATION_ERROR",
      errores: messages
    });
  }

  // Error de casteo de ID inválido
  if (error.name === "CastError") {
    return res.status(400).json({
      mensaje: "ID inválido",
      code: "INVALID_ID"
    });
  }

  // Errores no previstos
  console.error("❌ Unhandled error:", error);

  return res.status(500).json({
    mensaje: "Error interno del servidor",
    code: "INTERNAL_SERVER_ERROR"
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};
