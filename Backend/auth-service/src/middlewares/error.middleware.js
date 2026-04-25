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
      mensaje: "El correo ya esta registrado",
      code: "DUPLICATE_RESOURCE"
    });
  }

  console.error("Unhandled error:", error);

  return res.status(500).json({
    mensaje: "Error interno del servidor",
    code: "INTERNAL_SERVER_ERROR"
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};
