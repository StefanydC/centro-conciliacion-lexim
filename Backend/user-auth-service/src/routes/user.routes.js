// ARCHIVO: backend/user-auth-service/src/routes/user.routes.js
const express = require("express");
const userController = require("../controllers/user.controller");
const { verifyToken } = require("../middlewares/auth.middleware");
const { requireAdmin } = require("../middlewares/role.middleware");
const { validateRequest } = require("../middlewares/validate.middleware");
const { auditWrite, auditArco } = require("../middlewares/audit.middleware");
const {
  createUserValidator,
  updateUserValidator
} = require("../validators/user.validator");

const router = express.Router();

// ─── Derechos ARCO (Ley 1581 Art. 8) ─────────────────────────────────────────
// IMPORTANTE: deben declararse ANTES de /:id para evitar colisión de rutas

/**
 * GET /usuarios/mis-datos
 * Devuelve todos los datos personales del usuario autenticado (Acceso).
 */
router.get(
  "/mis-datos",
  verifyToken,
  auditArco("ACCESO_MIS_DATOS", "usuarios/mis-datos"),
  userController.getMisDatos
);

/**
 * DELETE /usuarios/solicitar-eliminacion
 * Solicita la cancelación de la cuenta (Cancelación/Supresión).
 */
router.delete(
  "/solicitar-eliminacion",
  verifyToken,
  auditArco("SOLICITUD_ELIMINACION", "usuarios/solicitar-eliminacion"),
  userController.solicitarEliminacion
);

/**
 * PUT /usuarios/rectificar
 * Permite al usuario actualizar sus propios datos básicos (Rectificación).
 */
router.put(
  "/rectificar",
  verifyToken,
  auditArco("RECTIFICACION", "usuarios/rectificar"),
  userController.rectificarDatos
);

// ─── Log de auditoría — Ley 1581 Art. 17 lit. d ──────────────────────────────

/**
 * GET /usuarios/audit
 * Lista logs de auditoría con filtros por usuario, acción y rango de fechas.
 * Solo administrador.
 */
router.get(
  "/audit",
  verifyToken,
  requireAdmin,
  userController.getAuditLogs
);

// ─── CRUD de usuarios ─────────────────────────────────────────────────────────

/**
 * GET /usuarios
 */
router.get(
  "/",
  verifyToken,
  userController.getAllUsers
);

/**
 * GET /usuarios/:id
 */
router.get(
  "/:id",
  verifyToken,
  userController.getUserById
);

/**
 * POST /usuarios
 */
router.post(
  "/",
  verifyToken,
  requireAdmin,
  createUserValidator,
  validateRequest,
  auditWrite("usuarios"),
  userController.createUser
);

/**
 * PATCH /usuarios/:id
 */
router.patch(
  "/:id",
  verifyToken,
  updateUserValidator,
  validateRequest,
  auditWrite("usuarios"),
  userController.updateUser
);

/**
 * POST /usuarios/:id/change-password
 */
router.post(
  "/:id/change-password",
  verifyToken,
  auditWrite("usuarios/change-password"),
  userController.changePassword
);

/**
 * DELETE /usuarios/:id
 */
router.delete(
  "/:id",
  verifyToken,
  requireAdmin,
  auditWrite("usuarios"),
  userController.deactivateUser
);

/**
 * POST /usuarios/:id/activate
 */
router.post(
  "/:id/activate",
  verifyToken,
  requireAdmin,
  auditWrite("usuarios/activate"),
  userController.activateUser
);

/**
 * DELETE /usuarios/:id/permanent
 */
router.delete(
  "/:id/permanent",
  verifyToken,
  requireAdmin,
  auditWrite("usuarios/permanent"),
  userController.deleteUser
);

module.exports = router;
