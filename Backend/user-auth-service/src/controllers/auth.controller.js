const authService = require("../services/auth.service");

/**
 * POST /auth/login - Inicio de sesión
 */
const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    return res.status(200).json({
      mensaje: "Inicio de sesión exitoso",
      data: result
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  login
};
