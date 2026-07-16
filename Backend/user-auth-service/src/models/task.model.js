const mongoose = require("mongoose");

const docSubSchema = new mongoose.Schema({
  documento_id: { type: String, default: null },
  nombre:       { type: String, default: null },
  mimeType:     { type: String, default: null },
  fecha:        { type: Date, default: Date.now },
  // Ronda de la tarea en la que se subió el documento (1 = envío inicial,
  // 2+ = reenvío del judicante tras un rechazo del admin). Permite
  // diferenciar en el frontend los archivos "viejos" de los nuevos sin
  // borrar ninguno.
  ronda:       { type: Number, default: 1 } 
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
    observaciones_admin: { type: String, default: null },
    observaciones_judicante: { type: String, default: null },
    motivo_rechazo:      { type: String, default: null },
    // Ronda actual de la tarea. Empieza en 1 y se incrementa cada vez que
    // el admin rechaza una tarea en revisión (revision → en_proceso). Los
    // documentos nuevos que el judicante suba a partir de ahí quedan
    // marcados con este número, para poder mostrarlos separados de los
    // de rondas anteriores.
    ronda_actual:        { type: Number, default: 1 },
    documento_admin:     { type: [docSubSchema], default: () => [] },
    documento_judicante: { type: [docSubSchema], default: () => [] },
    documento_id:        { type: String, default: null }  // campo legacy, no usar en flujo nuevo
  },
  { timestamps: true, collection: "tareas" }
);

module.exports = mongoose.models.Task || mongoose.model("Task", taskSchema);
