// ARCHIVO: backend/finance-service/src/controllers/finanza.controller.js
const Finanza = require("../models/finanza.model");
const { ApiError } = require("../utils/apiError");

/**
 * GET /finance
 * Lista ingresos y egresos con filtros opcionales:
 * ?tipo=ingreso|egreso  ?fechaDesde=ISO  ?fechaHasta=ISO  ?categoria=xxx
 * Admin ve todos; judicante ve solo los suyos.
 */
const listar = async (req, res, next) => {
  try {
    const { tipo, fechaDesde, fechaHasta, categoria, limit = 100, skip = 0 } = req.query;
    const esAdmin = req.user?.tipo_usuario === "administrador" || req.user?.rol === "admin";

    const filtro = {};
    if (!esAdmin) filtro.creadoPor = req.user.sub;
    if (tipo)      filtro.tipo = tipo;
    if (categoria) filtro.categoria = { $regex: categoria, $options: "i" };
    if (fechaDesde || fechaHasta) {
      filtro.fecha = {};
      if (fechaDesde) filtro.fecha.$gte = new Date(fechaDesde);
      if (fechaHasta) filtro.fecha.$lte = new Date(fechaHasta);
    }

    const [registros, total] = await Promise.all([
      Finanza.find(filtro).sort({ fecha: -1 }).limit(Number(limit)).skip(Number(skip)),
      Finanza.countDocuments(filtro)
    ]);

    return res.status(200).json({
      mensaje: "Registros financieros obtenidos correctamente",
      data: registros,
      total
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /finance/:id
 * Obtiene un registro por ID.
 */
const obtenerPorId = async (req, res, next) => {
  try {
    const registro = await Finanza.findById(req.params.id);
    if (!registro) throw new ApiError("Registro no encontrado", 404);

    const esAdmin = req.user?.tipo_usuario === "administrador" || req.user?.rol === "admin";
    if (!esAdmin && registro.creadoPor !== req.user.sub) {
      throw new ApiError("No tienes permiso para ver este registro", 403);
    }

    return res.status(200).json({
      mensaje: "Registro obtenido correctamente",
      data: registro
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /finance
 * Crea un nuevo ingreso o egreso.
 */
const crear = async (req, res, next) => {
  try {
    const { tipo, monto, concepto, categoria, fecha, descripcion } = req.body;
    const registro = await Finanza.create({
      tipo,
      monto,
      concepto,
      categoria,
      fecha: fecha ? new Date(fecha) : new Date(),
      descripcion,
      creadoPor: req.user.sub
    });

    return res.status(201).json({
      mensaje: `${tipo === "ingreso" ? "Ingreso" : "Egreso"} registrado correctamente`,
      data: registro
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /finance/:id
 * Actualiza un registro existente.
 */
const actualizar = async (req, res, next) => {
  try {
    const registro = await Finanza.findById(req.params.id);
    if (!registro) throw new ApiError("Registro no encontrado", 404);

    const esAdmin = req.user?.tipo_usuario === "administrador" || req.user?.rol === "admin";
    if (!esAdmin && registro.creadoPor !== req.user.sub) {
      throw new ApiError("No tienes permiso para modificar este registro", 403);
    }

    const camposPermitidos = ["monto", "concepto", "categoria", "fecha", "descripcion"];
    const actualizacion = {};
    for (const campo of camposPermitidos) {
      if (req.body[campo] !== undefined) actualizacion[campo] = req.body[campo];
    }

    const actualizado = await Finanza.findByIdAndUpdate(
      req.params.id,
      { $set: actualizacion },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      mensaje: "Registro actualizado correctamente",
      data: actualizado
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /finance/:id
 * Elimina un registro (solo admin o creador).
 */
const eliminar = async (req, res, next) => {
  try {
    const registro = await Finanza.findById(req.params.id);
    if (!registro) throw new ApiError("Registro no encontrado", 404);

    const esAdmin = req.user?.tipo_usuario === "administrador" || req.user?.rol === "admin";
    if (!esAdmin && registro.creadoPor !== req.user.sub) {
      throw new ApiError("No tienes permiso para eliminar este registro", 403);
    }

    await registro.deleteOne();
    return res.status(200).json({ mensaje: "Registro eliminado correctamente" });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /finance/resumen
 * Devuelve total de ingresos, total de egresos y saldo.
 * Admin ve todo el sistema; judicante ve solo los suyos.
 */
const resumen = async (req, res, next) => {
  try {
    const { fechaDesde, fechaHasta } = req.query;
    const esAdmin = req.user?.tipo_usuario === "administrador" || req.user?.rol === "admin";

    const matchBase = {};
    if (!esAdmin) matchBase.creadoPor = req.user.sub;
    if (fechaDesde || fechaHasta) {
      matchBase.fecha = {};
      if (fechaDesde) matchBase.fecha.$gte = new Date(fechaDesde);
      if (fechaHasta) matchBase.fecha.$lte = new Date(fechaHasta);
    }

    const resultado = await Finanza.aggregate([
      { $match: matchBase },
      {
        $group: {
          _id: "$tipo",
          total: { $sum: "$monto" },
          cantidad: { $sum: 1 }
        }
      }
    ]);

    const totalIngresos = resultado.find(r => r._id === "ingreso")?.total || 0;
    const totalEgresos  = resultado.find(r => r._id === "egreso")?.total  || 0;
    const cantIngresos  = resultado.find(r => r._id === "ingreso")?.cantidad || 0;
    const cantEgresos   = resultado.find(r => r._id === "egreso")?.cantidad  || 0;

    return res.status(200).json({
      mensaje: "Resumen financiero obtenido correctamente",
      data: {
        total_ingresos: totalIngresos,
        total_egresos:  totalEgresos,
        saldo:          totalIngresos - totalEgresos,
        cantidad_ingresos: cantIngresos,
        cantidad_egresos:  cantEgresos
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /finance/grafica
 * Agrupa ingresos y egresos por mes para gráficas.
 */
const grafica = async (req, res, next) => {
  try {
    const esAdmin = req.user?.tipo_usuario === "administrador" || req.user?.rol === "admin";
    const matchBase = {};
    if (!esAdmin) matchBase.creadoPor = req.user.sub;

    const resultado = await Finanza.aggregate([
      { $match: matchBase },
      {
        $group: {
          _id: {
            anio:  { $year: "$fecha" },
            mes:   { $month: "$fecha" },
            tipo:  "$tipo"
          },
          total: { $sum: "$monto" }
        }
      },
      { $sort: { "_id.anio": 1, "_id.mes": 1 } }
    ]);

    return res.status(200).json({
      mensaje: "Datos para gráfica obtenidos correctamente",
      data: resultado
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar, resumen, grafica };
