// ARCHIVO: backend/user-auth-service/src/controllers/user.controller.js
const userService = require("../services/user.service");
const AuditLog = require("../models/auditLog.model");
const { ApiError } = require("../utils/apiError");

/**
 * GET /usuarios
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
 * GET /usuarios/:id
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
 * POST /usuarios
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
 * PATCH /usuarios/:id
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
 * POST /usuarios/:id/change-password
 */
const changePassword = async (req, res, next) => {
  try {
    const isAdmin = req.user?.tipo_usuario === "administrador" || req.user?.rol === "admin";
    const isSelf  = req.user?.sub === req.params.id;

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
 * DELETE /usuarios/:id
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
 * POST /usuarios/:id/activate
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
 * DELETE /usuarios/:id/permanent
 */
const deleteUser = async (req, res, next) => {
  try {
    const result = await userService.deleteUser(req.params.id);
    return res.status(200).json({ mensaje: result.mensaje });
  } catch (error) {
    return next(error);
  }
};

// ─── Derechos ARCO — Ley 1581 Art. 8 ─────────────────────────────────────────

/**
 * GET /usuarios/mis-datos
 * Ley 1581 Art. 8 lit. a — Acceso a los propios datos personales.
 */
const getMisDatos = async (req, res, next) => {
  try {
    const result = await userService.getMisDatos(req.user.sub);
    return res.status(200).json({
      mensaje: "Datos personales obtenidos correctamente",
      data: result
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /usuarios/solicitar-eliminacion
 * Ley 1581 Art. 8 lit. c — Solicitud de cancelación/supresión de datos.
 */
const solicitarEliminacion = async (req, res, next) => {
  try {
    const result = await userService.solicitarEliminacion(req.user.sub);
    return res.status(200).json({
      mensaje: result.mensaje,
      data: { fecha_solicitud: result.fecha_solicitud }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /usuarios/rectificar
 * Ley 1581 Art. 8 lit. b — Rectificación de datos propios.
 */
const rectificarDatos = async (req, res, next) => {
  try {
    const { nombre, apellido, email, telefono } = req.body;
    const result = await userService.rectificarDatos(req.user.sub, { nombre, apellido, email, telefono });
    return res.status(200).json({
      mensaje: "Datos rectificados correctamente",
      data: result
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /usuarios/audit
 * Ley 1581 Art. 17 lit. d — Consulta de log de auditoría (solo administrador).
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const { usuario_id, accion, fechaDesde, fechaHasta, limit = 100, skip = 0 } = req.query;

    const filtro = {};
    if (usuario_id) filtro.usuario_id = usuario_id;
    if (accion)     filtro.accion = accion;
    if (fechaDesde || fechaHasta) {
      filtro.fecha = {};
      if (fechaDesde) filtro.fecha.$gte = new Date(fechaDesde);
      if (fechaHasta) filtro.fecha.$lte = new Date(fechaHasta);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filtro)
        .sort({ fecha: -1 })
        .limit(Number(limit))
        .skip(Number(skip)),
      AuditLog.countDocuments(filtro)
    ]);

    return res.status(200).json({
      mensaje: "Logs de auditoría obtenidos correctamente",
      data: logs,
      total
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
  deleteUser,
  getMisDatos,
  solicitarEliminacion,
  rectificarDatos,
  getAuditLogs
};
