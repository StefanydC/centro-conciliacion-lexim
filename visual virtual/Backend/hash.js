const bcrypt = require("bcrypt");

async function generar() {
  try {
    const hash = await bcrypt.hash("123456", 10);
    console.log("HASH GENERADO:");
    console.log(hash);
  } catch (error) {
    console.error("ERROR:", error);
  }
}

generar();