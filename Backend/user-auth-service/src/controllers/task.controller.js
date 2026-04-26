const Task = require("../models/task.model");
const User = require("../models/user.model");

const listar = async (req, res, next) => {
  try {
    const filtro = req.user.tipo_usuario === "administrador"
      ? {}
      : { asignado_a: req.user.sub };

    const tareas = await Task.find(filtro)
      .populate("creado_por", "nombre Nombre apellido Apellido email Email")
      .populate("asignado_a", "nombre Nombre apellido Apellido email Email")
      .sort({ createdAt: -1 });

    res.json({ data: tareas });
  } catch (error) {
    next(error);
  }
};

const actualizarEstado = async (req, res, next) => {
  try {
    const { estado } = req.body;
    const tarea = await Task.findByIdAndUpdate(
      req.params.id,
      {
        estado,
        ...(estado === "completado" ? { fecha_completado: new Date() } : {})
      },
      { new: true }
    )
      .populate("creado_por", "nombre Nombre apellido Apellido")
      .populate("asignado_a", "nombre Nombre apellido Apellido");

    if (!tarea) return res.status(404).json({ mensaje: "Tarea no encontrada" });

    res.json({ data: tarea });
  } catch (error) {
    next(error);
  }
};

const crear = async (req, res, next) => {
  try {
    const tarea = await Task.create({
      ...req.body,
      creado_por: req.user.sub
    });

    const poblada = await Task.findById(tarea._id)
      .populate("creado_por", "nombre Nombre apellido Apellido email Email")
      .populate("asignado_a", "nombre Nombre apellido Apellido email Email");

    res.status(201).json({ data: poblada });
  } catch (error) {
    next(error);
  }
};

const listarJudicantes = async (req, res, next) => {
  try {
    const judicantes = await User.find({ tipo_usuario: "judicante" })
      .select("nombre Nombre apellido Apellido email Email")
      .sort({ nombre: 1, Nombre: 1 });

    res.json({ data: judicantes });
  } catch (error) {
    next(error);
  }
};

module.exports = { listar, actualizarEstado, crear, listarJudicantes };