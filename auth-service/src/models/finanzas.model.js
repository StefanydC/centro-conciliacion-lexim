const mongoose = require('mongoose');

const finanzasSchema = new mongoose.Schema(
  {
    tipo: {
      type: String,
      enum: ['ingreso', 'egreso'],
      required: true,
    },
    monto: {
      type: Number,
      required: true,
      validate: { validator: (v) => v > 0, message: 'El monto debe ser mayor a 0' },
    },
    descripcion: {
      type: String,
      required: true,
      trim: true,
    },
    categoria: {
      type: String,
      required: true,
      trim: true,
    },
    fecha: {
      type: Date,
      required: true,
      validate: { validator: (v) => v <= new Date(), message: 'La fecha no puede ser en el futuro' },
    },
    registrado_por: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Índices para queries rápidas
finanzasSchema.index({ tipo: 1, fecha: -1 });
finanzasSchema.index({ registrado_por: 1 });
finanzasSchema.index({ fecha: 1 });

module.exports = mongoose.model('Finanza', finanzasSchema, 'finanzas');
