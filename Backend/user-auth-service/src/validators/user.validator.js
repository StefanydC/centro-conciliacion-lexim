const { body } = require("express-validator");

/**
 * Validadores para autenticación
 */
const loginValidator = [
  body("email")
    .trim()
    .notEmpty().withMessage("El correo es obligatorio")
    .isEmail().withMessage("Correo no válido"),
  body("password")
    .notEmpty().withMessage("La contraseña es obligatoria")
    .isLength({ min: 6 }).withMessage("La contraseña debe tener al menos 6 caracteres")
];

/**
 * Validadores para creación/actualización de usuarios
 */
const createUserValidator = [
  body("nombre")
    .trim()
    .notEmpty().withMessage("El nombre es obligatorio"),
  body("email")
    .trim()
    .notEmpty().withMessage("El correo es obligatorio")
    .isEmail().withMessage("Correo no válido"),
  body("password")
    .notEmpty().withMessage("La contraseña es obligatoria")
    .isLength({ min: 6 }).withMessage("La contraseña debe tener al menos 6 caracteres"),
  body("rol")
    .optional()
    .isIn(["admin", "conciliador", "usuario", "administrador", "judicante"])
    .withMessage("Rol no válido")
];

/**
 * Validadores para actualización de usuarios
 */
const updateUserValidator = [
  body("nombre")
    .optional()
    .trim()
    .notEmpty().withMessage("El nombre no puede estar vacío"),
  body("email")
    .optional()
    .trim()
    .isEmail().withMessage("Correo no válido"),
  body("rol")
    .optional()
    .isIn(["admin", "conciliador", "usuario", "administrador", "judicante"])
    .withMessage("Rol no válido")
];

module.exports = {
  loginValidator,
  createUserValidator,
  updateUserValidator
};
