// ARCHIVO: backend/finance-service/src/models/finanza.model.js
const mongoose = require("mongoose");

const finanzaSchema = new mongoose.Schema(
  {
    tipo: {
      type: String,
      enum: ["ingreso", "egreso"],
      required: [true, "El tipo es obligatorio (ingreso o egreso)"]
    },
    monto: {
      type: Number,
      required: [true, "El monto es obligatorio"],
      min: [0, "El monto no puede ser negativo"]
    },
    concepto: {
      type: String,
      required: [true, "El concepto es obligatorio"],
      trim: true,
      maxlength: [200, "El concepto no puede superar 200 caracteres"]
    },
    categoria: {
      type: String,
      trim: true,
      maxlength: [100, "La categoría no puede superar 100 caracteres"],
      default: "General"
    },
    fecha: {
      type: Date,
      required: [true, "La fecha es obligatoria"],
      default: Date.now
    },
    creadoPor: {
      type: String,
      required: [true, "El campo creadoPor es obligatorio"],
      index: true
    },
    descripcion: {
      type: String,
      trim: true,
      maxlength: [500, "La descripción no puede superar 500 caracteres"]
    },
    // Ley 1581 Art. 4 — retención de datos financieros (10 años para registros contables)
    fecha_retencion_hasta: {
      type: Date,
      default: () => {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 10);
        return d;
      }
    }
  },
  {
    timestamps: true,
    strict: true
  }
);

finanzaSchema.index({ fecha: -1 });
finanzaSchema.index({ tipo: 1, creadoPor: 1 });

module.exports = mongoose.models.Finanza || mongoose.model("Finanza", finanzaSchema, "finanzas");
