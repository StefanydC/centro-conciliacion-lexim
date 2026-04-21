function requireAdmin(req, res, next) {
  if (req.user?.tipo_usuario !== 'administrador') {
    return res.status(403).json({
      error: 'Acceso denegado',
      detalle: 'Esta acción requiere rol de administrador',
    });
  }
  next();
}

function requireAuth(req, res, next) {
  const valid = ['administrador', 'judicante'];
  if (!valid.includes(req.user?.tipo_usuario)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
}

module.exports = { requireAdmin, requireAuth };
