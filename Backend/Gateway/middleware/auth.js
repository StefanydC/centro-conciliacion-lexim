const jwt = require('jsonwebtoken');

// ─────────────────────────────────────────────────────────────────────────────
// Middleware de autenticación y autorización centralizado en el API Gateway.
// Los microservicios internos reciben los headers X-User-* ya verificados y
// NO necesitan re-validar el JWT por su cuenta.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifica el JWT del header Authorization.
 * Si es válido, adjunta el payload a req.user y continúa.
 * Siempre permite el paso de peticiones OPTIONS (preflight CORS).
 */
function requireAuth(req, res, next) {
  // Preflight CORS → no tiene JWT, dejar pasar
  if (req.method === 'OPTIONS') return next();

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'No autorizado',
      detalle: 'Se requiere un token JWT en el header Authorization: Bearer <token>'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    const mensaje = err.name === 'TokenExpiredError'
      ? 'Token expirado, inicia sesión de nuevo'
      : 'Token inválido';

    return res.status(401).json({ error: 'No autorizado', detalle: mensaje });
  }
}

/**
 * Fabrica de middleware para control de acceso por rol.
 * Uso: requireRole('administrador')
 *      requireRole('administrador', 'judicante')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    // Primero verifica el token
    requireAuth(req, res, () => {
      if (req.method === 'OPTIONS') return next();

      if (!roles.includes(req.user.tipo_usuario)) {
        return res.status(403).json({
          error: 'Acceso denegado',
          detalle: `Tu rol (${req.user.tipo_usuario}) no tiene permiso para este recurso. Roles permitidos: ${roles.join(', ')}`
        });
      }
      next();
    });
  };
}

// Acceso para cualquier usuario autenticado (administrador o judicante)
const requireJudicante = requireRole('administrador', 'judicante');

// Acceso exclusivo para administradores
const requireAdmin = requireRole('administrador');

module.exports = { requireAuth, requireRole, requireJudicante, requireAdmin };
