const { body } = require("express-validator");

const registerValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("El nombre es obligatorio")
    .isLength({ min: 2, max: 100 })
    .withMessage("El nombre debe tener entre 2 y 100 caracteres"),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("El correo es obligatorio")
    .isEmail()
    .withMessage("El correo no es valido")
    .normalizeEmail(),
  body("password")
    .notEmpty()
    .withMessage("La contrasena es obligatoria")
    .isLength({ min: 8 })
    .withMessage("La contrasena debe tener al menos 8 caracteres")
];

const loginValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("El correo es obligatorio")
    .isEmail()
    .withMessage("El correo no es valido")
    .normalizeEmail(),
  body("password")
    .notEmpty()
    .withMessage("La contrasena es obligatoria")
];

module.exports = {
  registerValidator,
  loginValidator
};
