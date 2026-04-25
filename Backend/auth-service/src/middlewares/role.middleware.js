/**
 * Middleware para validar que el usuario sea administrador
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  if (req.user.tipo_usuario !== 'administrador') {
    return res.status(403).json({ error: 'Solo administradores pueden realizar esta acción' });
  }

  next();
};

module.exports = { requireAdmin };
