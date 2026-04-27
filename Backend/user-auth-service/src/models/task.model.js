const mongoose = require("mongoose");

const docSubSchema = new mongoose.Schema({
  driveFileId: { type: String, default: null },
  nombre:      { type: String, default: null },
  mimeType:    { type: String, default: null }
}, { _id: false });

const taskSchema = new mongoose.Schema(
  {
    descripcion:         { type: String, required: true },
    estado:              { type: String, enum: ["pendiente", "en_proceso", "revision", "completado", "cancelado"], default: "pendiente" },
    prioridad:           { type: String, enum: ["baja", "media", "alta", "urgente"], default: "media" },
    creado_por:          { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    asignado_a:          { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    fecha_limite:        { type: Date },
    fecha_inicio:        { type: Date },
    fecha_revision:      { type: Date },
    fecha_completado:    { type: Date },
    observaciones:       { type: String },
    motivo_rechazo:      { type: String, default: null },
    documento_admin:     { type: docSubSchema, default: () => ({}) },
    documento_judicante: { type: docSubSchema, default: () => ({}) },
    documento_id:        { type: String, default: null }  // campo legacy, no usar en flujo nuevo
  },
  { timestamps: true, collection: "tareas" }
);

module.exports = mongoose.models.Task || mongoose.model("Task", taskSchema);
