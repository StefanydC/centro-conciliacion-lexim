const Task = require("../models/task.model");
const User = require("../models/user.model");

const listar = async (req, res, next) => {
  try {
    const filtro = req.user.tipo_usuario === "administrador"
      ? {}
      : { asignado_a: req.user.sub };

    const tareas = await Task.find(filtro)
      .populate("creado_por",  "Nombre Apellido Email")
      .populate("asignado_a", "Nombre Apellido Email")
      .sort({ createdAt: -1 });

    res.json({ data: tareas });
  } catch (e) { next(e); }
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
    ).populate("creado_por", "Nombre Apellido")
     .populate("asignado_a", "Nombre Apellido");

    if (!tarea) return res.status(404).json({ mensaje: "Tarea no encontrada" });
    res.json({ data: tarea });
  } catch (e) { next(e); }
};

const crear = async (req, res, next) => {
  try {
    const tarea = await Task.create({
      ...req.body,
      creado_por: req.user.sub
    });
    const poblada = await Task.findById(tarea._id)
      .populate("creado_por", "Nombre Apellido Email")
      .populate("asignado_a", "Nombre Apellido Email");
    res.status(201).json({ data: poblada });
  } catch (e) { next(e); }
};

const listarJudicantes = async (req, res, next) => {
  try {
    const judicantes = await User.find({ tipo_usuario: "judicante" })
      .select("Nombre Apellido Email")
      .sort({ Nombre: 1 });
    res.json({ data: judicantes });
  } catch (e) { next(e); }
};

module.exports = { listar, actualizarEstado, crear, listarJudicantes };