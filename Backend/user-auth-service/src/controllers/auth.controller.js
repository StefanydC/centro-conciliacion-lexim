const authService = require("../services/auth.service");

/**
 * POST /auth/login
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

/**
 * POST /auth/logout
 * Marca al usuario como inactivo (activo=false).
 * Acepta el token vía header Authorization O vía body.token (para sendBeacon).
 */
const logout = async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    await authService.logout(userId);
    return res.json({ mensaje: "Sesión cerrada correctamente" });
  } catch (error) {
    return next(error);
  }
};

module.exports = { login, logout };
