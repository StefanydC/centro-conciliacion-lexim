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

// ═══════════════════════════════════════════════════════════════════════
// MIGRACIÓN AUTOMÁTICA: CORRECCIÓN DE TAREAS VIEJAS (EVITA CASTERROR)
// ═══════════════════════════════════════════════════════════════════════
mongoose.connection.once("open", async () => {
  try {
    const TareaModel = mongoose.models.Tarea || mongoose.model("Tarea", tareaSchema, "tareas_v2");
    
    // Buscamos tareas donde los documentos NO sean arreglos todavía
    const tareasViejas = await TareaModel.find({
      $or: [
        { documento_admin: { $not: { $type: "array" } } },
        { documento_judicante: { $not: { $type: "array" } } }
      ]
    });

    if (tareasViejas.length > 0) {
      console.log(`[Migración] Se encontraron ${tareasViejas.length} tareas viejas para corregir.`);
      
      for (const tarea of tareasViejas) {
        // Guardamos los valores viejos si existían como objetos
        const docAdminViejo = tarea.documento_admin;
        const docJudicanteViejo = tarea.documento_judicante;

        // Si era un objeto con datos, lo metemos dentro de un arreglo; si no, dejamos arreglo vacío
        tarea.documento_admin = (docAdminViejo && docAdminViejo.documento_id) ? [docAdminViejo] : [];
        tarea.documento_judicante = (docJudicanteViejo && docJudicanteViejo.documento_id) ? [docJudicanteViejo] : [];
        
        // Desactivamos temporalmente la validación estricta para guardar el cambio estructural
        tarea.markModified('documento_admin');
        tarea.markModified('documento_judicante');
        await tarea.save({ validateBeforeSave: false });
      }
      console.log("[Migración] ¡Todas las tareas viejas fueron actualizadas a arreglos con éxito!");
    }
  } catch (error) {
    console.error("[Migración Error] No se pudieron migrar las tareas viejas:", error);
  }
});



module.exports = mongoose.models.Tarea || mongoose.model("Tarea", tareaSchema, "tareas_v2");
