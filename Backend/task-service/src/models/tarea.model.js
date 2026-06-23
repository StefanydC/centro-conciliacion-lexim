// ARCHIVO: backend/task-service/src/models/tarea.model.js
const mongoose = require("mongoose");

const tareaSchema = new mongoose.Schema(
  {
    titulo: {
      type: String,
      required: [true, "El título es obligatorio"],
      trim: true,
      maxlength: [150, "El título no puede superar 150 caracteres"]
    },
    descripcion: {
      type: String,
      trim: true,
      maxlength: [1000, "La descripción no puede superar 1000 caracteres"]
    },
    estado: {
      type: String,
      enum: {
        values: ["pendiente", "en_progreso", "completada"],
        message: "Estado inválido. Use: pendiente, en_progreso, completada"
      },
      default: "pendiente"
    },
    prioridad: {
      type: String,
      enum: {
        values: ["baja", "media", "alta"],
        message: "Prioridad inválida. Use: baja, media, alta"
      },
      default: "media"
    },
    asignadoA: {
      type: String,
      index: true
    },
    creadoPor: {
      type: String,
      required: [true, "El campo creadoPor es obligatorio"],
      index: true
    },
    fechaVencimiento: {
      type: Date
    },
// Ley 1581 Art. 4 — retención: tareas operativas 5 años
    fecha_retencion_hasta: {
      type: Date,
      default: () => {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 5);
        return d;
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // NUEVOS CAMPOS: DECLARADOS COMO ARREGLOS PARA ADMITIR MÚLTIPLES ARCHIVOS
    // ═══════════════════════════════════════════════════════════════════════
    documento_admin: [{
      documento_id: { type: String },
      nombre: { type: String },
      mimeType: { type: String },
      fecha: { type: Date, default: Date.now }
    }],
    documento_judicante: [{
      documento_id: { type: String },
      nombre: { type: String },
      mimeType: { type: String },
      fecha: { type: Date, default: Date.now }
    }]
  },
  {
    timestamps: true,
    strict: true
  }
);

tareaSchema.index({ estado: 1, creadoPor: 1 });
tareaSchema.index({ prioridad: 1, asignadoA: 1 });

module.exports = mongoose.models.Tarea || mongoose.model("Tarea", tareaSchema, "tareas_v2");
