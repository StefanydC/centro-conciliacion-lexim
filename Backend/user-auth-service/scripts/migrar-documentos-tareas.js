require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const mongoose = require('mongoose');
async function migrar() {
  await mongoose.connect(process.env.MONGO_URI);
  const col = mongoose.connection.db.collection('tareas');

  const cursor = col.find({
    $or: [
      { documento_admin:     { $exists: true, $not: { $type: 'array' } } },
      { documento_judicante: { $exists: true, $not: { $type: 'array' } } }
    ]
  });

  let count = 0;
  for await (const tarea of cursor) {
    const a = tarea.documento_admin;
    const j = tarea.documento_judicante;

    const nuevoAdmin = (a && a.driveFileId)
      ? [{ documento_id: a.driveFileId, nombre: a.nombre || 'Documento', mimeType: a.mimeType || '', fecha: new Date() }]
      : [];
    const nuevoJud = (j && j.driveFileId)
      ? [{ documento_id: j.driveFileId, nombre: j.nombre || 'Documento', mimeType: j.mimeType || '', fecha: new Date() }]
      : [];

    await col.updateOne({ _id: tarea._id }, { $set: { documento_admin: nuevoAdmin, documento_judicante: nuevoJud } });
    count++;
  }

  console.log(`Migradas ${count} tareas.`);
  process.exit(0);
}

migrar().catch(err => { console.error(err); process.exit(1); });