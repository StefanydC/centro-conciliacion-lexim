const express = require("express");
const userController = require("../controllers/user.controller");
const { verifyToken } = require("../middlewares/auth.middleware");
const { requireAdmin } = require("../middlewares/role.middleware");
const { validateRequest } = require("../middlewares/validate.middleware");
const { 
  createUserValidator, 
  updateUserValidator 
} = require("../validators/user.validator");

const router = express.Router();

/**
 * GET /usuarios
 * Obtener todos los usuarios (requiere autenticación)
 * Query: ?search=xxx&limit=100&skip=0
 */
router.get(
  "/",
  verifyToken,
  userController.getAllUsers
);

/**
 * GET /usuarios/:id
 * Obtener usuario por ID (requiere autenticación)
 */
router.get(
  "/:id",
  verifyToken,
  userController.getUserById
);

/**
 * POST /usuarios
 * Crear nuevo usuario (requiere autenticación y admin)
 * Body: { nombre, email, password, rol? }
 */
router.post(
  "/",
  verifyToken,
  requireAdmin,
  createUserValidator,
  validateRequest,
  userController.createUser
);

/**
 * PATCH /usuarios/:id
 * Actualizar usuario (requiere autenticación)
 * Body: { nombre?, apellido?, email?, rol? }
 */
router.patch(
  "/:id",
  verifyToken,
  updateUserValidator,
  validateRequest,
  userController.updateUser
);

/**
 * POST /usuarios/:id/change-password
 * Cambiar contraseña (requiere autenticación)
 * Body: { currentPassword, newPassword }
 */
router.post(
  "/:id/change-password",
  verifyToken,
  userController.changePassword
);

/**
 * DELETE /usuarios/:id
 * Desactivar usuario - baja lógica (requiere autenticación y admin)
 */
router.delete(
  "/:id",
  verifyToken,
  requireAdmin,
  userController.deactivateUser
);

/**
 * POST /usuarios/:id/activate
 * Activar usuario (requiere autenticación y admin)
 */
router.post(
  "/:id/activate",
  verifyToken,
  requireAdmin,
  userController.activateUser
);

/**
 * DELETE /usuarios/:id/permanent
 * Eliminar usuario de forma permanente (requiere autenticación y admin)
 */
router.delete(
  "/:id/permanent",
  verifyToken,
  requireAdmin,
  userController.deleteUser
);

module.exports = router;
