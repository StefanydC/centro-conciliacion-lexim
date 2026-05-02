const jwt = require('jsonwebtoken');
const env = require('../config/env');

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    req.user = jwt.verify(authHeader.split(' ')[1], env.JWT_SECRET);
    if (req.user) {
      const rolToken = req.user.tipo_usuario || req.user.tipoUsuario || req.user.rol || '';
      req.user.rol = String(rolToken).trim().toLowerCase();
    }
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = { verifyToken };
