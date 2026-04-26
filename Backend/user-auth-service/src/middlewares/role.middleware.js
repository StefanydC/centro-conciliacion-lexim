/**
 * Middleware para validar que el usuario sea administrador
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      mensaje: "Token requerido",
      code: "UNAUTHORIZED" 
    });
  }

  const isAdmin = req.user.tipo_usuario === "administrador" || req.user.rol === "admin";
  
  if (!isAdmin) {
    return res.status(403).json({ 
      mensaje: "Solo administradores pueden realizar esta acción",
      code: "FORBIDDEN" 
    });
  }

  next();
};

module.exports = { requireAdmin };
