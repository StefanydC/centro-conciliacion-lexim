const Finanza = require("../models/finanzas.model");

const listar = async (req, res, next) => {
  try {
    const { tipo } = req.query;

    if (!tipo || !["ingreso", "egreso"].includes(tipo)) {
      return res.status(400).json({ error: "Parámetro tipo requerido: ingreso o egreso" });
    }

    const registros = await Finanza.find({ tipo })
      .sort({ fecha: -1 })
      .populate("registrado_por", "nombre Nombre apellido Apellido email Email")
      .exec();

    res.json({ data: registros, total: registros.length });
  } catch (error) {
    next(error);
  }
};

const resumen = async (req, res, next) => {
  try {
    const ingresos = await Finanza.aggregate([
      { $match: { tipo: "ingreso" } },
      { $group: { _id: null, total: { $sum: "$monto" } } }
    ]);

    const egresos = await Finanza.aggregate([
      { $match: { tipo: "egreso" } },
      { $group: { _id: null, total: { $sum: "$monto" } } }
    ]);

    const totalIngresos = ingresos[0]?.total || 0;
    const totalEgresos = egresos[0]?.total || 0;
    const balance = totalIngresos - totalEgresos;

    res.json({ totalIngresos, totalEgresos, balance });
  } catch (error) {
    next(error);
  }
};

const grafica = async (req, res, next) => {
  try {
    const porMes = await Finanza.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$fecha" },
            month: { $month: "$fecha" },
            tipo: "$tipo"
          },
          total: { $sum: "$monto" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const meses = {};
    porMes.forEach(({ _id, total }) => {
      const mesKey = `${_id.year}-${String(_id.month).padStart(2, "0")}`;
      if (!meses[mesKey]) meses[mesKey] = { mes: mesKey, ingresos: 0, egresos: 0 };
      if (_id.tipo === "ingreso") meses[mesKey].ingresos = total;
      else meses[mesKey].egresos = total;
    });

    const dataPorMes = Object.values(meses);

    const porCategoria = await Finanza.aggregate([
      {
        $group: {
          _id: { categoria: "$categoria", tipo: "$tipo" },
          total: { $sum: "$monto" }
        }
      },
      { $sort: { "_id.categoria": 1 } }
    ]);

    res.json({ porMes: dataPorMes, porCategoria });
  } catch (error) {
    next(error);
  }
};

const crear = async (req, res, next) => {
  try {
    const { tipo, monto, descripcion, categoria, fecha } = req.body;

    if (!tipo || !["ingreso", "egreso"].includes(tipo)) {
      return res.status(400).json({ error: "tipo requerido: ingreso o egreso" });
    }
    if (!monto || monto <= 0) {
      return res.status(400).json({ error: "monto requerido y debe ser > 0" });
    }
    if (!descripcion?.trim()) {
      return res.status(400).json({ error: "descripcion requerida" });
    }
    if (!categoria?.trim()) {
      return res.status(400).json({ error: "categoria requerida" });
    }
    if (!fecha) {
      return res.status(400).json({ error: "fecha requerida" });
    }

    const fechaParsed = new Date(fecha);
    if (Number.isNaN(fechaParsed.getTime())) {
      return res.status(400).json({ error: "fecha inválida" });
    }
    if (fechaParsed > new Date()) {
      return res.status(400).json({ error: "la fecha no puede ser en el futuro" });
    }

    const nuevoRegistro = new Finanza({
      tipo,
      monto: parseFloat(monto),
      descripcion: descripcion.trim(),
      categoria: categoria.trim(),
      fecha: fechaParsed,
      registrado_por: req.user.sub
    });

    await nuevoRegistro.save();
    await nuevoRegistro.populate("registrado_por", "nombre Nombre apellido Apellido email Email");

    res.status(201).json({ data: nuevoRegistro });
  } catch (error) {
    next(error);
  }
};

const eliminar = async (req, res, next) => {
  try {
    const { id } = req.params;

    const registro = await Finanza.findByIdAndDelete(id);
    if (!registro) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    res.json({ mensaje: "Registro eliminado correctamente" });
  } catch (error) {
    next(error);
  }
};

module.exports = { listar, resumen, grafica, crear, eliminar };