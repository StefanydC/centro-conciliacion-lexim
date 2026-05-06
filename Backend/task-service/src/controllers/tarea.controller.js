// ARCHIVO: backend/task-service/src/controllers/tarea.controller.js
const Tarea = require("../models/tarea.model");
const { ApiError } = require("../utils/apiError");

/**
 * GET /tasks2
 * Lista tareas con filtros opcionales:
 * ?estado=pendiente|en_progreso|completada
 * ?prioridad=baja|media|alta
 * ?asignadoA=userId
 * Admin ve todas; judicante ve las propias (creadas o asignadas).
 */
const listar = async (req, res, next) => {
  try {
    const { estado, prioridad, asignadoA, limit = 100, skip = 0 } = req.query;
    const esAdmin = req.user?.tipo_usuario === "administrador" || req.user?.rol === "admin";

    const filtro = {};

    if (!esAdmin) {
      filtro.$or = [
        { creadoPor: req.user.sub },
        { asignadoA: req.user.sub }
      ];
    } else if (asignadoA) {
      filtro.asignadoA = asignadoA;
    }

    if (estado)    filtro.estado    = estado;
    if (prioridad) filtro.prioridad = prioridad;

    const [tareas, total] = await Promise.all([
      Tarea.find(filtro).sort({ createdAt: -1 }).limit(Number(limit)).skip(Number(skip)),
      Tarea.countDocuments(filtro)
    ]);

    return res.status(200).json({
      mensaje: "Tareas obtenidas correctamente",
      data: tareas,
      total
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /tasks2/:id
 */
const obtenerPorId = async (req, res, next) => {
  try {
    const tarea = await Tarea.findById(req.params.id);
    if (!tarea) throw new ApiError("Tarea no encontrada", 404);

    const esAdmin = req.user?.tipo_usuario === "administrador" || req.user?.rol === "admin";
    const esPropietario = tarea.creadoPor === req.user.sub || tarea.asignadoA === req.user.sub;
    if (!esAdmin && !esPropietario) {
      throw new ApiError("No tienes permiso para ver esta tarea", 403);
    }

    return res.status(200).json({
      mensaje: "Tarea obtenida correctamente",
      data: tarea
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /tasks2
 */
const crear = async (req, res, next) => {
  try {
    const { titulo, descripcion, estado, prioridad, asignadoA, fechaVencimiento } = req.body;
    const tarea = await Tarea.create({
      titulo,
      descripcion,
      estado,
      prioridad,
      asignadoA,
      fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : undefined,
      creadoPor: req.user.sub
    });

    return res.status(201).json({
      mensaje: "Tarea creada correctamente",
      data: tarea
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /tasks2/:id
 * El creador o el asignado pueden actualizar. El admin siempre puede.
 */
const actualizar = async (req, res, next) => {
  try {
    const tarea = await Tarea.findById(req.params.id);
    if (!tarea) throw new ApiError("Tarea no encontrada", 404);

    const esAdmin = req.user?.tipo_usuario === "administrador" || req.user?.rol === "admin";
    const esPropietario = tarea.creadoPor === req.user.sub || tarea.asignadoA === req.user.sub;
    if (!esAdmin && !esPropietario) {
      throw new ApiError("No tienes permiso para modificar esta tarea", 403);
    }

    const camposPermitidos = ["titulo", "descripcion", "estado", "prioridad", "asignadoA", "fechaVencimiento"];
    const actualizacion = {};
    for (const campo of camposPermitidos) {
      if (req.body[campo] !== undefined) actualizacion[campo] = req.body[campo];
    }

    const actualizada = await Tarea.findByIdAndUpdate(
      req.params.id,
      { $set: actualizacion },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      mensaje: "Tarea actualizada correctamente",
      data: actualizada
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /tasks2/:id
 * Solo el creador o admin pueden eliminar.
 */
const eliminar = async (req, res, next) => {
  try {
    const tarea = await Tarea.findById(req.params.id);
    if (!tarea) throw new ApiError("Tarea no encontrada", 404);

    const esAdmin = req.user?.tipo_usuario === "administrador" || req.user?.rol === "admin";
    if (!esAdmin && tarea.creadoPor !== req.user.sub) {
      throw new ApiError("No tienes permiso para eliminar esta tarea", 403);
    }

    await tarea.deleteOne();
    return res.status(200).json({ mensaje: "Tarea eliminada correctamente" });
  } catch (error) {
    next(error);
  }
};

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
