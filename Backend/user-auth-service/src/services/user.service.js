const User = require("../models/user.model");
const { ApiError } = require("../utils/apiError");

/**
 * Obtener todos los usuarios activos
 */
const getAllUsers = async (options = {}) => {
  const query = { activo: true };
  
  if (options.search) {
    query.$or = [
      { nombre: { $regex: options.search, $options: "i" } },
      { email: { $regex: options.search, $options: "i" } }
    ];
  }

  return await User.find(query)
    .select("-password")
    .sort({ createdAt: -1 })
    .limit(options.limit || 100)
    .skip(options.skip || 0);
};

/**
 * Obtener usuario por ID
 */
const getUserById = async (userId) => {
  const user = await User.findById(userId).select("-password");
  
  if (!user) {
    throw new ApiError("Usuario no encontrado", 404);
  }

  return user;
};

/**
 * Crear nuevo usuario
 */
const createUser = async (userData) => {
  const { nombre, email, password, rol } = userData;

  // Validar que el email sea único
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new ApiError("El correo ya está registrado", 409);
  }

  const user = await User.create({
    nombre,
    email: email.toLowerCase(),
    password,
    rol: rol || "usuario"
  });

  // No devolver la contraseña
  const userResponse = user.toObject();
  delete userResponse.password;

  return userResponse;
};

/**
 * Actualizar usuario (sin cambiar contraseña)
 */
const updateUser = async (userId, updateData) => {
  // Nunca permitir actualizar password por esta ruta
  const { password, ...dataToUpdate } = updateData;

  // Si se intenta cambiar el email, verificar que sea único
  if (dataToUpdate.email) {
    const existingUser = await User.findOne({
      email: dataToUpdate.email.toLowerCase(),
      _id: { $ne: userId }
    });
    if (existingUser) {
      throw new ApiError("El correo ya está registrado", 409);
    }
    dataToUpdate.email = dataToUpdate.email.toLowerCase();
  }

  const user = await User.findByIdAndUpdate(
    userId,
    dataToUpdate,
    { new: true, runValidators: true }
  ).select("-password");

  if (!user) {
    throw new ApiError("Usuario no encontrado", 404);
  }

  return user;
};

/**
 * Cambiar contraseña
 */
const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId).select("+password");

  if (!user) {
    throw new ApiError("Usuario no encontrado", 404);
  }

  // Verificar contraseña actual
  const isPasswordValid = await user.comparePassword(currentPassword);
  if (!isPasswordValid) {
    throw new ApiError("Contraseña actual incorrecta", 401);
  }

  // Actualizar contraseña
  user.password = newPassword;
  await user.save();

  return { mensaje: "Contraseña actualizada correctamente" };
};

/**
 * Desactivar usuario (baja lógica)
 */
const deactivateUser = async (userId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { activo: false },
    { new: true }
  ).select("-password");

  if (!user) {
    throw new ApiError("Usuario no encontrado", 404);
  }

  return { 
    mensaje: "Usuario desactivado correctamente", 
    usuario: user 
  };
};

/**
 * Activar usuario
 */
const activateUser = async (userId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { activo: true },
    { new: true }
  ).select("-password");

  if (!user) {
    throw new ApiError("Usuario no encontrado", 404);
  }

  return { 
    mensaje: "Usuario activado correctamente", 
    usuario: user 
  };
};

/**
 * Eliminar usuario de forma permanente (solo para admins)
 */
const deleteUser = async (userId) => {
  const user = await User.findByIdAndDelete(userId);

  if (!user) {
    throw new ApiError("Usuario no encontrado", 404);
  }

  return { mensaje: "Usuario eliminado correctamente" };
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
