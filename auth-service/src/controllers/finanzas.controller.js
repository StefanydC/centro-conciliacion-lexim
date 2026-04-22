const Finanza = require('../models/finanzas.model');

/**
 * GET /finanzas?tipo=ingreso|egreso
 * Lista registros de finanzas filtrados por tipo
 */
const listar = async (req, res) => {
  try {
    const { tipo } = req.query;

    if (!tipo || !['ingreso', 'egreso'].includes(tipo)) {
      return res.status(400).json({ error: 'Parámetro tipo requerido: ingreso o egreso' });
    }

    const registros = await Finanza.find({ tipo })
      .sort({ fecha: -1 })
      .populate('registrado_por', 'Nombre Apellido Email')
      .exec();

    console.log(`[Finanzas] Listado de ${tipo}: ${registros.length} registros`);
    res.json({ data: registros, total: registros.length });
  } catch (err) {
    console.error('[Finanzas] Error al listar:', err.message);
    res.status(500).json({ error: 'Error al listar registros', detalle: err.message });
  }
};

/**
 * GET /finanzas/resumen
 * Retorna totales: totalIngresos, totalEgresos, balance
 */
const resumen = async (req, res) => {
  try {
    const ingresos = await Finanza.aggregate([
      { $match: { tipo: 'ingreso' } },
      { $group: { _id: null, total: { $sum: '$monto' } } },
    ]);

    const egresos = await Finanza.aggregate([
      { $match: { tipo: 'egreso' } },
      { $group: { _id: null, total: { $sum: '$monto' } } },
    ]);

    const totalIngresos = ingresos[0]?.total || 0;
    const totalEgresos = egresos[0]?.total || 0;
    const balance = totalIngresos - totalEgresos;

    console.log(`[Finanzas] Resumen: Ingresos ${totalIngresos}, Egresos ${totalEgresos}, Balance ${balance}`);
    res.json({ totalIngresos, totalEgresos, balance });
  } catch (err) {
    console.error('[Finanzas] Error en resumen:', err.message);
    res.status(500).json({ error: 'Error al calcular resumen', detalle: err.message });
  }
};

/**
 * GET /finanzas/grafica
 * Agrupa por mes e por categoría para gráficas
 */
const grafica = async (req, res) => {
  try {
    // Agrupa por mes (últimos 12 meses)
    const porMes = await Finanza.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$fecha' },
            month: { $month: '$fecha' },
            tipo: '$tipo',
          },
          total: { $sum: '$monto' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Transforma el resultado a formato amigable
    const meses = {};
    porMes.forEach(({ _id, total }) => {
      const mesKey = `${_id.year}-${String(_id.month).padStart(2, '0')}`;
      if (!meses[mesKey]) meses[mesKey] = { mes: mesKey, ingresos: 0, egresos: 0 };
      if (_id.tipo === 'ingreso') meses[mesKey].ingresos = total;
      else meses[mesKey].egresos = total;
    });

    const dataPorMes = Object.values(meses);

    // Agrupa por categoría
    const porCategoria = await Finanza.aggregate([
      {
        $group: {
          _id: { categoria: '$categoria', tipo: '$tipo' },
          total: { $sum: '$monto' },
        },
      },
      { $sort: { '_id.categoria': 1 } },
    ]);

    console.log(`[Finanzas] Gráficas: ${dataPorMes.length} meses, ${porCategoria.length} categorías`);
    res.json({ porMes: dataPorMes, porCategoria });
  } catch (err) {
    console.error('[Finanzas] Error en gráficas:', err.message);
    res.status(500).json({ error: 'Error al generar gráficas', detalle: err.message });
  }
};

/**
 * POST /finanzas
 * Crea un nuevo registro de finanzas (solo admin)
 * Body: { tipo, monto, descripcion, categoria, fecha }
 */
const crear = async (req, res) => {
  try {
    const { tipo, monto, descripcion, categoria, fecha } = req.body;

    // Validaciones
    if (!tipo || !['ingreso', 'egreso'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo requerido: ingreso o egreso' });
    }
    if (!monto || monto <= 0) {
      return res.status(400).json({ error: 'monto requerido y debe ser > 0' });
    }
    if (!descripcion?.trim()) {
      return res.status(400).json({ error: 'descripcion requerida' });
    }
    if (!categoria?.trim()) {
      return res.status(400).json({ error: 'categoria requerida' });
    }
    if (!fecha) {
      return res.status(400).json({ error: 'fecha requerida' });
    }

    const fechaParsed = new Date(fecha);
    if (isNaN(fechaParsed.getTime())) {
      return res.status(400).json({ error: 'fecha inválida' });
    }
    if (fechaParsed > new Date()) {
      return res.status(400).json({ error: 'la fecha no puede ser en el futuro' });
    }

    const nuevoRegistro = new Finanza({
      tipo,
      monto: parseFloat(monto),
      descripcion: descripcion.trim(),
      categoria: categoria.trim(),
      fecha: fechaParsed,
      registrado_por: req.user.sub,
    });

    await nuevoRegistro.save();
    await nuevoRegistro.populate('registrado_por', 'Nombre Apellido Email');

    console.log(`[Finanzas] ${tipo.toUpperCase()} creado: $${monto} - "${descripcion}" por admin ${req.user.sub}`);
    res.status(201).json({ data: nuevoRegistro });
  } catch (err) {
    console.error('[Finanzas] Error al crear:', err.message);
    res.status(500).json({ error: 'Error al crear registro', detalle: err.message });
  }
};

/**
 * DELETE /finanzas/:id
 * Elimina un registro (solo admin)
 */
const eliminar = async (req, res) => {
  try {
    const { id } = req.params;

    const registro = await Finanza.findByIdAndDelete(id);
    if (!registro) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    console.log(`[Finanzas] Eliminado: ${id} (${registro.tipo} $${registro.monto}) por admin ${req.user.sub}`);
    res.json({ mensaje: 'Registro eliminado correctamente' });
  } catch (err) {
    console.error('[Finanzas] Error al eliminar:', err.message);
    res.status(500).json({ error: 'Error al eliminar registro', detalle: err.message });
  }
};

module.exports = { listar, resumen, grafica, crear, eliminar };
