const notFoundHandler = (req, res) => {
  return res.status(404).json({
    mensaje: "Ruta no encontrada",
    code: "NOT_FOUND"
  });
};

const errorHandler = (error, req, res, next) => {
  console.error("Unhandled backend error:", error);

  return res.status(500).json({
    mensaje: "Error interno del servidor",
    code: "INTERNAL_SERVER_ERROR"
  });
};

module.exports = { notFoundHandler, errorHandler };
