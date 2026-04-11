const authService = require("../services/auth.service");

const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    return res.status(201).json({
      mensaje: "Usuario registrado exitosamente",
      data: result
    });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    return res.status(200).json({
      mensaje: "Inicio de sesion exitoso",
      data: result
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  register,
  login
};
