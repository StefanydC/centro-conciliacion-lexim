// ARCHIVO: backend/user-auth-service/src/middlewares/audit.middleware.js
// Ley 1581 Art. 17 literal d — registro de trazabilidad de todas las operaciones de escritura
const AuditLog = require("../models/auditLog.model");

/**
 * Devuelve la IP real del cliente, considerando proxies y el gateway.
 */
function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "desconocida"
  );
}

/**
 * Mapea el método HTTP a una acción de auditoría.
 */
function metodToAccion(method, path) {
  const m = method.toUpperCase();
  if (m === "POST")   return "CREAR";
  if (m === "PUT" || m === "PATCH") return "ACTUALIZAR";
  if (m === "DELETE") return "ELIMINAR";
  return "LEER";
}

/**
 * Middleware de auditoría para rutas de escritura (POST, PUT, PATCH, DELETE).
 * Se aplica como middleware de ruta; registra la operación después de que el
 * controlador responda interceptando res.json.
 */
const auditWrite = (recurso) => (req, res, next) => {
  const metodosAuditados = ["POST", "PUT", "PATCH", "DELETE"];
  if (!metodosAuditados.includes(req.method.toUpperCase())) return next();

  const originalJson = res.json.bind(res);

  res.json = function (body) {
    // Registrar log de forma asíncrona sin bloquear la respuesta
    setImmediate(async () => {
      try {
        const exitoso = res.statusCode >= 200 && res.statusCode < 400;
        await AuditLog.create({
          usuario_id:    req.user?.sub          || "anonimo",
          usuario_email: req.user?.email        || "",
          accion:        metodToAccion(req.method, req.path),
          recurso:       `${recurso}:${req.path}`,
          ip:            getClientIp(req),
          fecha:         new Date(),
          datos_nuevos:  req.method !== "DELETE" ? sanitizeBody(req.body) : null,
          resultado:     exitoso ? "exitoso" : "fallido",
          detalle:       `${req.method} ${req.originalUrl} → ${res.statusCode}`
        });
      } catch (err) {
        // El fallo de auditoría nunca debe interrumpir la respuesta al cliente
        console.error("[AUDIT] Error al registrar log:", err.message);
      }
    });

    return originalJson(body);
  };

  next();
};

/**
 * Middleware de auditoría para acciones ARCO con datos anteriores y nuevos.
 */
const auditArco = (accion, recurso) => async (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    setImmediate(async () => {
      try {
        const exitoso = res.statusCode >= 200 && res.statusCode < 400;
        await AuditLog.create({
          usuario_id:    req.user?.sub   || "anonimo",
          usuario_email: req.user?.email || "",
          accion,
          recurso,
          ip:          getClientIp(req),
          fecha:       new Date(),
          datos_nuevos: req.method !== "DELETE" ? sanitizeBody(req.body) : null,
          resultado:   exitoso ? "exitoso" : "fallido",
          detalle:     `${req.method} ${req.originalUrl} → ${res.statusCode}`
        });
      } catch (err) {
        console.error("[AUDIT] Error al registrar log ARCO:", err.message);
      }
    });

    return originalJson(body);
  };

  next();
};

/**
 * Elimina campos sensibles del body antes de persistir en el log.
 */
function sanitizeBody(body) {
  if (!body || typeof body !== "object") return null;
  const sanitized = { ...body };
  delete sanitized.password;
  delete sanitized.Password;
  delete sanitized.currentPassword;
  delete sanitized.newPassword;
  delete sanitized.token;
  return sanitized;
}

module.exports = { auditWrite, auditArco, getClientIp };
