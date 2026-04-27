const userService = require("../services/user.service");

/**
 * GET /usuarios - Obtener todos los usuarios
 */
const getAllUsers = async (req, res, next) => {
  try {
    const { search, limit, skip, estado } = req.query;
    const users = await userService.getAllUsers({
      search,
      estado,
      limit: parseInt(limit) || 100,
      skip: parseInt(skip) || 0
    });
    return res.status(200).json({
      mensaje: "Usuarios obtenidos correctamente",
      data: users,
      total: users.length
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /usuarios/:id - Obtener usuario por ID
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);
    return res.status(200).json({
      mensaje: "Usuario obtenido correctamente",
      data: user
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /usuarios - Crear nuevo usuario
 */
const createUser = async (req, res, next) => {
  try {
    const user = await userService.createUser(req.body);
    return res.status(201).json({
      mensaje: "Usuario creado correctamente",
      data: user
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /usuarios/:id - Actualizar usuario
 */
const updateUser = async (req, res, next) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body);
    return res.status(200).json({
      mensaje: "Usuario actualizado correctamente",
      data: user
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /usuarios/:id/change-password - Cambiar contraseña
 */
const changePassword = async (req, res, next) => {
  try {
    const isAdmin = req.user?.tipo_usuario === "administrador" || req.user?.rol === "admin";
    const isSelf = req.user?.sub === req.params.id;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({
        mensaje: "No tienes permisos para cambiar la contraseña de otro usuario"
      });
    }

    const result = await userService.changePassword(req.params.id, req.body, { isAdmin });
    return res.status(200).json({
      mensaje: result.mensaje,
      data: result
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /usuarios/:id - Desactivar usuario (baja lógica)
 */
const deactivateUser = async (req, res, next) => {
  try {
    const result = await userService.deactivateUser(req.params.id);
    return res.status(200).json({
      mensaje: result.mensaje,
      data: result.usuario
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /usuarios/:id/activate - Activar usuario
 */
const activateUser = async (req, res, next) => {
  try {
    const result = await userService.activateUser(req.params.id);
    return res.status(200).json({
      mensaje: result.mensaje,
      data: result.usuario
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /usuarios/:id/permanent - Eliminar usuario permanentemente (solo admin)
 */
const deleteUser = async (req, res, next) => {
  try {
    const result = await userService.deleteUser(req.params.id);
    return res.status(200).json({
      mensaje: result.mensaje
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  changePassword,
  deactivateUser,
  activateUser,
  deleteUser
};
