// ARCHIVO: backend/user-auth-service/src/models/auditLog.model.js
// Ley 1581 Art. 17 literal d — trazabilidad obligatoria de operaciones sobre datos personales
const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    usuario_id: {
      type: String,
      index: true,
      default: "anonimo"
    },
    usuario_email: {
      type: String,
      default: ""
    },
    accion: {
      type: String,
      required: true,
      enum: [
        // Autenticación
        "LOGIN", "LOGOUT",
        // Datos personales (ARCO)
        "ACCESO_MIS_DATOS", "SOLICITUD_ELIMINACION", "RECTIFICACION",
        // CRUD estándar
        "CREAR", "LEER", "ACTUALIZAR", "ELIMINAR",
        // Administrativo
        "ACTIVAR_USUARIO", "DESACTIVAR_USUARIO", "CAMBIO_PASSWORD",
        // Auditoría
        "CONSULTA_AUDIT_LOG"
      ],
      index: true
    },
    recurso: {
      type: String,
      required: true
    },
    ip: {
      type: String,
      default: "desconocida"
    },
    fecha: {
      type: Date,
      default: Date.now,
      index: true
    },
    datos_anteriores: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      select: false
    },
    datos_nuevos: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      select: false
    },
    resultado: {
      type: String,
      enum: ["exitoso", "fallido"],
      default: "exitoso"
    },
    detalle: {
      type: String,
      default: ""
    },
    // Retención: logs de auditoría 5 años (Ley 1581 Art. 17)
    fecha_retencion_hasta: {
      type: Date,
      default: () => {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 5);
        return d;
      }
    }
  },
  {
    timestamps: false,
    strict: true
  }
);

auditLogSchema.index({ usuario_id: 1, fecha: -1 });
auditLogSchema.index({ accion: 1, fecha: -1 });

module.exports = mongoose.models.AuditLog ||
  mongoose.model("AuditLog", auditLogSchema, "audit_logs");
