// ARCHIVO: backend/task-service/src/middlewares/error.middleware.js
const { ApiError } = require("../utils/apiError");

const notFoundHandler = (req, res) => {
  return res.status(404).json({
    mensaje: "Ruta no encontrada",
    code: "NOT_FOUND"
  });
};

const errorHandler = (error, req, res, next) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      mensaje: error.message,
      code: "BUSINESS_ERROR"
    });
  }

  if (error.name === "MongoServerError" && error.code === 11000) {
    return res.status(409).json({
      mensaje: "Registro duplicado",
      code: "DUPLICATE_RESOURCE"
    });
  }

  if (error.name === "ValidationError") {
    const messages = Object.values(error.errors).map(e => e.message);
    return res.status(400).json({
      mensaje: "Error de validación",
      code: "VALIDATION_ERROR",
      errores: messages
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      mensaje: "ID inválido",
      code: "INVALID_ID"
    });
  }

  console.error("❌ Unhandled error:", error);
  return res.status(500).json({
    mensaje: "Error interno del servidor",
    code: "INTERNAL_SERVER_ERROR"
  });
};

module.exports = { notFoundHandler, errorHandler };
