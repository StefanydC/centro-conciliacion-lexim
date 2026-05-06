// ARCHIVO: backend/user-auth-service/src/services/user.service.js
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
  if (!user) throw new ApiError("Usuario no encontrado", 404);
  return user;
};

/**
 * Crear nuevo usuario
 */
const createUser = async (userData) => {
  const { nombre, apellido, email, password, rol, tipo_usuario, documento, telefono, activo } = userData;

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) throw new ApiError("El correo ya está registrado", 409);

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

  const userResponse = user.toObject();
  delete userResponse.password;
  return userResponse;
};

/**
 * Actualizar usuario (sin cambiar contraseña)
 */
const updateUser = async (userId, updateData) => {
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

  if (dataToUpdate.email) {
    const existingUser = await User.findOne({
      email: dataToUpdate.email.toLowerCase(),
      _id: { $ne: userId }
    });
    if (existingUser) throw new ApiError("El correo ya está registrado", 409);
    dataToUpdate.email = dataToUpdate.email.toLowerCase();
  }

  const user = await User.findByIdAndUpdate(
    userId,
    pickDefined(dataToUpdate),
    { new: true, runValidators: true }
  ).select("-password");

  if (!user) throw new ApiError("Usuario no encontrado", 404);
  return user;
};

/**
 * Cambiar contraseña
 */
const changePassword = async (userId, { currentPassword, newPassword, password }, context = {}) => {
  const user = await User.findById(userId).select("+password +Password");
  if (!user) throw new ApiError("Usuario no encontrado", 404);

  const { isAdmin = false } = context;
  const targetPassword = newPassword || password;

  if (!targetPassword || targetPassword.length < 6) {
    throw new ApiError("La nueva contraseña debe tener al menos 6 caracteres", 400);
  }

  if (isAdmin && !currentPassword) {
    user.password = targetPassword;
    await user.save();
    return { mensaje: "Contraseña restablecida correctamente" };
  }

  let isPasswordValid = false;
  if (currentPassword) {
    isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid && user.Password) {
      isPasswordValid = await bcrypt.compare(currentPassword, user.Password);
    }
  }

  if (!isPasswordValid) throw new ApiError("Contraseña actual incorrecta", 401);

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

  if (!user) throw new ApiError("Usuario no encontrado", 404);
  return { mensaje: "Usuario desactivado correctamente", usuario: user };
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

  if (!user) throw new ApiError("Usuario no encontrado", 404);
  return { mensaje: "Usuario activado correctamente", usuario: user };
};

/**
 * Eliminar usuario de forma permanente (solo para admins)
 */
const deleteUser = async (userId) => {
  const user = await User.findByIdAndDelete(userId);
  if (!user) throw new ApiError("Usuario no encontrado", 404);
  return { mensaje: "Usuario eliminado correctamente" };
};

// ─── Derechos ARCO — Ley 1581 Art. 8 ─────────────────────────────────────────

/**
 * Ley 1581 Art. 8 lit. a — Derecho de Acceso
 * Devuelve todos los datos personales del usuario autenticado en formato descargable.
 */
const getMisDatos = async (userId) => {
  const user = await User.findById(userId).select("-password -Password -google_access_token -google_refresh_token");
  if (!user) throw new ApiError("Usuario no encontrado", 404);

  return {
    datos_personales: user.toObject(),
    exportado_en: new Date().toISOString(),
    nota_legal: "Datos exportados en ejercicio del derecho de acceso — Ley 1581 de 2012 Art. 8 literal a."
  };
};

/**
 * Ley 1581 Art. 8 lit. c — Derecho de Cancelación/Supresión
 * Marca la cuenta con estado "eliminacion_solicitada" para revisión del administrador.
 * No elimina directamente porque los datos pueden ser judicialmente relevantes.
 */
const solicitarEliminacion = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError("Usuario no encontrado", 404);

  if (user.estado_cuenta === "eliminacion_solicitada") {
    throw new ApiError("Ya existe una solicitud de eliminación pendiente de revisión", 409);
  }

  await User.findByIdAndUpdate(userId, {
    estado_cuenta: "eliminacion_solicitada",
    fecha_solicitud_eliminacion: new Date(),
    activo: false
  });

  return {
    mensaje: "Solicitud de eliminación registrada correctamente. Un administrador revisará su caso en los próximos 15 días hábiles.",
    fecha_solicitud: new Date().toISOString()
  };
};

/**
 * Ley 1581 Art. 8 lit. b — Derecho de Rectificación
 * Permite al usuario actualizar sus propios datos (nombre, apellido, email, teléfono).
 */
const rectificarDatos = async (userId, { nombre, apellido, email, telefono }) => {
  const actualizacion = {};

  if (nombre)    actualizacion.nombre   = nombre.trim();
  if (apellido)  actualizacion.apellido = apellido.trim();
  if (telefono)  actualizacion.telefono = telefono.trim();

  if (email) {
    const existingUser = await User.findOne({
      email: email.toLowerCase(),
      _id: { $ne: userId }
    });
    if (existingUser) throw new ApiError("El correo ya está registrado por otro usuario", 409);
    actualizacion.email = email.toLowerCase().trim();
  }

  if (Object.keys(actualizacion).length === 0) {
    throw new ApiError("No se proporcionaron campos a actualizar", 400);
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: actualizacion },
    { new: true, runValidators: true }
  ).select("-password -Password");

  if (!user) throw new ApiError("Usuario no encontrado", 404);

  return {
    usuario: user,
    campos_actualizados: Object.keys(actualizacion)
  };
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  changePassword,
  deactivateUser,
  activateUser,
  deleteUser,
  getMisDatos,
  solicitarEliminacion,
  rectificarDatos
};
