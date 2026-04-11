const { body } = require("express-validator");

const loginValidator = [
  body("email")
    .trim()
    .notEmpty().withMessage("El correo es obligatorio")
    .isEmail().withMessage("Correo no valido"),
  body("password")
    .notEmpty().withMessage("La contrasena es obligatoria")
];

module.exports = { loginValidator };