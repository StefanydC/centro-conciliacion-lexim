const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    destinatario: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tipo: {
      type: String,
      enum: [
        "asignacion_tarea",
        "tarea_recibida",
        "documento_en_revision",
        "documento_rechazado",
        "documento_aceptado"
      ],
      required: true,
      index: true
    },
    titulo: { type: String, required: true },
    mensaje: { type: String, required: true },
    actor_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actor_nombre: { type: String, default: null },
    tarea_id: { type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null },
    tarea_estado: { type: String, default: null },
    leida: { type: Boolean, default: false, index: true },
    leida_en: { type: Date, default: null }
  },
  {
    timestamps: true,
    collection: "notificaciones"
  }
);

module.exports = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);