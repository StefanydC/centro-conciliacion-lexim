// ARCHIVO: scripts/purge-expired-data.js
/**
 * Script de reporte de datos con retención vencida — Ley 1581 de 2012 Art. 11
 *
 * Propósito: LISTAR (sin eliminar) los registros que han superado su
 * fecha_retencion_hasta para revisión del administrador antes de proceder
 * con la eliminación definitiva.
 *
 * USO:
 *   node scripts/purge-expired-data.js
 *   node scripts/purge-expired-data.js --output ./reporte-retencion.json
 *
 * IMPORTANTE: Este script es de solo lectura. La eliminación real debe ser
 * aprobada por el responsable del tratamiento conforme al Art. 11 y Art. 17
 * de la Ley 1581 de 2012.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs       = require('fs');
const path     = require('path');

const MONGO_URI    = process.env.MONGO_URI;
const MONGO_DB     = process.env.MONGO_DB_NAME || 'Lexim_db';
const OUTPUT_FLAG  = process.argv.indexOf('--output');
const OUTPUT_FILE  = OUTPUT_FLAG !== -1 ? process.argv[OUTPUT_FLAG + 1] : null;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI no está definido en las variables de entorno.');
  process.exit(1);
}

// ─── Schemas (mínimos para la consulta) ──────────────────────────────────────

const userSchema = new mongoose.Schema(
  { nombre: String, email: String, tipo_usuario: String, ultimo_acceso: Date, fecha_retencion_hasta: Date, estado_cuenta: String },
  { strict: false, collection: 'usuarios' }
);

const conciliacionSchema = new mongoose.Schema(
  { nro_expediente: String, estado: String, creadoPor: String, fecha_retencion_hasta: Date, createdAt: Date },
  { strict: false, collection: 'conciliaciones' }
);

const finanzaSchema = new mongoose.Schema(
  { tipo: String, monto: Number, concepto: String, fecha: Date, creadoPor: String, fecha_retencion_hasta: Date },
  { strict: false, collection: 'finanzas' }
);

const agendaSchema = new mongoose.Schema(
  { titulo: String, fecha: String, creadoPor: String, fecha_retencion_hasta: Date, createdAt: Date },
  { strict: false, collection: 'agenda' }
);

const auditSchema = new mongoose.Schema(
  { accion: String, usuario_id: String, fecha: Date, fecha_retencion_hasta: Date },
  { strict: false, collection: 'audit_logs' }
);

const tareaSchema = new mongoose.Schema(
  { titulo: String, estado: String, creadoPor: String, fecha_retencion_hasta: Date, createdAt: Date },
  { strict: false, collection: 'tareas_v2' }
);

// ─── Función principal ────────────────────────────────────────────────────────

async function generarReporte() {
  console.log('🔌 Conectando a MongoDB...');
  await mongoose.connect(MONGO_URI, { dbName: MONGO_DB });
  console.log(`✅ Conectado a base de datos: ${MONGO_DB}\n`);

  const ahora   = new Date();
  const filtro  = {
    fecha_retencion_hasta: { $lt: ahora, $exists: true }
  };

  // Registros con campo fecha_retencion_hasta < hoy (expirados)
  const User         = mongoose.model('User_purge',         userSchema);
  const Conciliacion = mongoose.model('Conciliacion_purge', conciliacionSchema);
  const Finanza      = mongoose.model('Finanza_purge',      finanzaSchema);
  const Agenda       = mongoose.model('Agenda_purge',       agendaSchema);
  const AuditLog     = mongoose.model('AuditLog_purge',     auditSchema);
  const Tarea        = mongoose.model('Tarea_purge',        tareaSchema);

  const [usuarios, conciliaciones, finanzas, agenda, auditLogs, tareas] = await Promise.all([
    User.find(filtro).select('nombre email tipo_usuario ultimo_acceso fecha_retencion_hasta estado_cuenta').lean(),
    Conciliacion.find(filtro).select('nro_expediente estado creadoPor fecha_retencion_hasta createdAt').lean(),
    Finanza.find(filtro).select('tipo monto concepto fecha creadoPor fecha_retencion_hasta').lean(),
    Agenda.find(filtro).select('titulo fecha creadoPor fecha_retencion_hasta createdAt').lean(),
    AuditLog.find(filtro).select('accion usuario_id fecha fecha_retencion_hasta').lean(),
    Tarea.find(filtro).select('titulo estado creadoPor fecha_retencion_hasta createdAt').lean()
  ]);

  const reporte = {
    generado_en:    ahora.toISOString(),
    base_de_datos:  MONGO_DB,
    nota_legal:     'Reporte de datos con retención vencida — Ley 1581 de 2012 Art. 11. Este reporte es SOLO LECTURA. La eliminación definitiva requiere aprobación del responsable del tratamiento.',
    resumen: {
      total_registros_expirados: usuarios.length + conciliaciones.length + finanzas.length + agenda.length + auditLogs.length + tareas.length,
      por_coleccion: {
        usuarios:       usuarios.length,
        conciliaciones: conciliaciones.length,
        finanzas:       finanzas.length,
        agenda:         agenda.length,
        audit_logs:     auditLogs.length,
        tareas:         tareas.length
      }
    },
    detalle: {
      usuarios,
      conciliaciones,
      finanzas,
      agenda,
      audit_logs: auditLogs,
      tareas
    }
  };

  // ─── Mostrar resumen en consola ───────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  REPORTE DE DATOS CON RETENCIÓN VENCIDA — LEY 1581/2012  ');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Fecha del reporte: ${ahora.toLocaleString('es-CO')}`);
  console.log(`  Base de datos:     ${MONGO_DB}`);
  console.log('───────────────────────────────────────────────────────────');
  console.log('  RESUMEN POR COLECCIÓN:');
  console.log(`    👤 Usuarios:          ${usuarios.length} registros`);
  console.log(`    ⚖️  Conciliaciones:    ${conciliaciones.length} registros`);
  console.log(`    💰 Finanzas:          ${finanzas.length} registros`);
  console.log(`    📅 Agenda:            ${agenda.length} registros`);
  console.log(`    🔍 Logs de auditoría: ${auditLogs.length} registros`);
  console.log(`    ✅ Tareas:            ${tareas.length} registros`);
  console.log('───────────────────────────────────────────────────────────');
  console.log(`  TOTAL EXPIRADOS: ${reporte.resumen.total_registros_expirados} registros`);
  console.log('═══════════════════════════════════════════════════════════');

  if (reporte.resumen.total_registros_expirados === 0) {
    console.log('\n✅ No hay registros con retención vencida. No se requiere acción.\n');
  } else {
    console.log('\n⚠️  ACCIÓN REQUERIDA: Revisar los registros listados y aprobar su');
    console.log('   eliminación definitiva según el procedimiento establecido.\n');
  }

  // ─── Guardar en archivo si se especificó --output ─────────────────────────
  if (OUTPUT_FILE) {
    const outputPath = path.resolve(OUTPUT_FILE);
    fs.writeFileSync(outputPath, JSON.stringify(reporte, null, 2), 'utf8');
    console.log(`📄 Reporte guardado en: ${outputPath}\n`);
  } else {
    console.log('💡 Tip: use --output ./reporte.json para guardar el detalle completo.\n');
  }

  await mongoose.disconnect();
  console.log('🔌 Desconectado de MongoDB.');
}

generarReporte().catch(err => {
  console.error('❌ Error al generar el reporte:', err.message);
  mongoose.disconnect().catch(() => {});
  process.exit(1);
});
