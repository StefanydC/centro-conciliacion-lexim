const mongoose = require("mongoose");

// strict: false → no filtra campos que no estén en el schema
// collection: "usuarios" → apunta a la colección exacta en Atlas
const userSchema = new mongoose.Schema(
  {
    Nombre:        { type: String },
    Apellido:      { type: String },
    Email:         { type: String },
    Password:    { type: String },
    tipo_usuario:  { type: String, enum: ["administrador", "judicante"], default: "judicante" },
    fecha_ingreso: { type: String }
  },
  { strict: false, collection: "usuarios" }
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
