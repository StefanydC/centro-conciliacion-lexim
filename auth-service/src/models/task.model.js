const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  descripcion:      { type: String, required: true },
  estado:           { type: String, enum: ["pendiente","en_proceso","completado","cancelado"], default: "pendiente" },
  prioridad:        { type: String, enum: ["baja","media","alta","urgente"], default: "media" },
  creado_por:       { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  asignado_a:       { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  fecha_limite:     { type: Date },
  fecha_completado: { type: Date },
  observaciones:    { type: String }
}, { timestamps: true, collection: "tareas" });

module.exports = mongoose.model("Task", taskSchema);