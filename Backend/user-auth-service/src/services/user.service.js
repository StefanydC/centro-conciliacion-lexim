const User = require("../models/user.model");
const { ApiError } = require("../utils/apiError");
const bcrypt = require("bcryptjs");

const pickDefined = (obj) => Object.fromEntries(
  Object.entries(obj).filter(([, value]) => value !== undefined)
);

const normalizeRoleFields = (rol, tipoUsuario) => {
  const rawRole = String(rol || "").toLowerCase();
  const rawTipo = String(tipoUsuario || "").toLowerCase();

  if (rawRole === "admin" || rawRole === "administrador" || rawTipo === "administrador") {
    return { rol: "administrador", tipo_usuario: "administrador" };
  }

  return {
    rol: rawRole || "judicante",
    tipo_usuario: rawTipo || "judicante"
  };
};

const parseActivoValue = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "activo" || value.toLowerCase() === "true";
  return Boolean(value);
};

/**
 * Obtener todos los usuarios activos
 */
const getAllUsers = async (options = {}) => {
  const query = {};

  if (options.estado === "activo") query.activo = true;
  if (options.estado === "inactivo") query.activo = false;
  
  if (options.search) {
    query.$or = [
      { nombre: { $regex: options.search, $options: "i" } },
      { apellido: { $regex: options.search, $options: "i" } },
      { email: { $regex: options.search, $options: "i" } },
      { documento: { $regex: options.search, $options: "i" } },
      { telefono: { $regex: options.search, $options: "i" } }
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
  const { nombre, apellido, email, password, rol, tipo_usuario, documento, telefono, activo } = userData;

  // Validar que el email sea único
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new ApiError("El correo ya está registrado", 409);
  }

  const roleFields = normalizeRoleFields(rol, tipo_usuario);

  const user = await User.create({
    nombre,
    apellido,
    email: email.toLowerCase(),
    password,
    documento,
    telefono,
    activo: activo !== undefined ? parseActivoValue(activo) : true,
    ...roleFields
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
  const { password, estado, tipoUsuario, ...dataToUpdate } = updateData;

  if (estado !== undefined && dataToUpdate.activo === undefined) {
    dataToUpdate.activo = parseActivoValue(estado);
  }

  if (dataToUpdate.activo !== undefined) {
    dataToUpdate.activo = parseActivoValue(dataToUpdate.activo);
  }

  if (dataToUpdate.rol !== undefined || tipoUsuario !== undefined || dataToUpdate.tipo_usuario !== undefined) {
    Object.assign(dataToUpdate, normalizeRoleFields(dataToUpdate.rol, tipoUsuario || dataToUpdate.tipo_usuario));
  }

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
    pickDefined(dataToUpdate),
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
const changePassword = async (userId, { currentPassword, newPassword, password }, context = {}) => {
  const user = await User.findById(userId).select("+password +Password");

  if (!user) {
    throw new ApiError("Usuario no encontrado", 404);
  }

  const { isAdmin = false } = context;
  const targetPassword = newPassword || password;

  if (!targetPassword || targetPassword.length < 6) {
    throw new ApiError("La nueva contraseña debe tener al menos 6 caracteres", 400);
  }

  // El administrador puede restablecer contraseña sin la clave actual.
  if (isAdmin && !currentPassword) {
    user.password = targetPassword;
    await user.save();
    return { mensaje: "Contraseña restablecida correctamente" };
  }

  // Verificar contraseña actual
  let isPasswordValid = false;
  if (currentPassword) {
    isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid && user.Password) {
      isPasswordValid = await bcrypt.compare(currentPassword, user.Password);
    }
  }

  if (!isPasswordValid) {
    throw new ApiError("Contraseña actual incorrecta", 401);
  }

  // Actualizar contraseña
  user.password = targetPassword;
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
