const Task = require("../models/task.model");
const User = require("../models/user.model");

const POPULATE_USER = "nombre Nombre apellido Apellido email Email";

// ─── helpers ─────────────────────────────────────────────────────────────────

async function _poblar(id) {
  return Task.findById(id)
    .populate("creado_por", POPULATE_USER)
    .populate("asignado_a", POPULATE_USER);
}

// ─── listar ──────────────────────────────────────────────────────────────────

const listar = async (req, res, next) => {
  try {
    const filtro = req.user.tipo_usuario === "administrador"
      ? {}
      : { asignado_a: req.user.sub };

    const tareas = await Task.find(filtro)
      .populate("creado_por", POPULATE_USER)
      .populate("asignado_a", POPULATE_USER)
      .sort({ createdAt: -1 });

    res.json({ data: tareas });
  } catch (err) { next(err); }
};

// ─── crear ───────────────────────────────────────────────────────────────────

const crear = async (req, res, next) => {
  try {
    const { descripcion, prioridad, fecha_limite, observaciones, asignado_a, documento_admin } = req.body;
    const obsAdmin = observaciones?.trim() || null;

    const docAdmin = documento_admin?.driveFileId
      ? { driveFileId: documento_admin.driveFileId, nombre: documento_admin.nombre || "Documento", mimeType: documento_admin.mimeType || "" }
      : undefined;

    const tarea = await Task.create({
      descripcion,
      prioridad: prioridad || "media",
      fecha_limite,
      observaciones: obsAdmin,
      observaciones_admin: obsAdmin,
      asignado_a,
      creado_por:     req.user.sub,
      estado:         "pendiente",
      documento_admin: docAdmin
    });

    res.status(201).json({ data: await _poblar(tarea._id) });
  } catch (err) { next(err); }
};

// ─── actualizarEstado ─────────────────────────────────────────────────────────

const actualizarEstado = async (req, res, next) => {
  try {
    const { estado, motivo_rechazo } = req.body;
    const esAdmin  = req.user.tipo_usuario === "administrador";
    const userId   = req.user.sub;

    const tarea = await Task.findById(req.params.id);
    if (!tarea) return res.status(404).json({ mensaje: "Tarea no encontrada" });

    const estadoActual = tarea.estado;

    // ── Validar transiciones ─────────────────────────────────────────────────
    const TRANS_JUDICANTE = { pendiente: ["en_proceso"], en_proceso: ["revision"] };
    const TRANS_ADMIN = {
      pendiente:  ["en_proceso", "cancelado"],
      en_proceso: ["revision", "cancelado"],
      revision:   ["completado", "en_proceso", "cancelado"],
      completado: [], cancelado: []
    };

    if (!esAdmin) {
      if (String(tarea.asignado_a) !== String(userId)) {
        return res.status(403).json({ mensaje: "No tienes permiso sobre esta tarea" });
      }
      if (!(TRANS_JUDICANTE[estadoActual] || []).includes(estado)) {
        return res.status(400).json({ mensaje: `Transición no permitida: ${estadoActual} → ${estado}` });
      }
      const tieneObsJudicante = !!(
        tarea.observaciones_judicante?.trim() ||
        (!tarea.observaciones_admin && tarea.observaciones?.trim())
      );
      if (estado === "revision" && !tarea.documento_judicante?.driveFileId && !tieneObsJudicante) {
        return res.status(400).json({ mensaje: "Debes subir un documento o agregar observaciones antes de enviar a revisión" });
      }
    } else {
      if (!(TRANS_ADMIN[estadoActual] || []).includes(estado)) {
        return res.status(400).json({ mensaje: `Transición no permitida: ${estadoActual} → ${estado}` });
      }
    }

    // ── Construir update ─────────────────────────────────────────────────────
    const update = { estado };

    if (estado === "en_proceso" && !tarea.fecha_inicio) update.fecha_inicio    = new Date();
    if (estado === "revision")                          update.fecha_revision  = new Date();
    if (estado === "completado")                        update.fecha_completado = new Date();

    // Admin rechaza (revision → en_proceso): guardar motivo
    if (esAdmin && estadoActual === "revision" && estado === "en_proceso") {
      update.motivo_rechazo = motivo_rechazo?.trim() || null;
    }
    // Judicante envía a revisión: limpiar motivo previo
    if (estado === "revision") {
      update.motivo_rechazo = null;
    }

    const actualizada = await Task.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate("creado_por", POPULATE_USER)
      .populate("asignado_a", POPULATE_USER);

    res.json({ data: actualizada });
  } catch (err) { next(err); }
};

// ─── asociarDocumento ─────────────────────────────────────────────────────────

const asociarDocumento = async (req, res, next) => {
  try {
    const { documento_id, tipo, nombre, mimeType } = req.body;
    if (!documento_id) return res.status(400).json({ mensaje: "documento_id es requerido" });

    const esAdmin = req.user.tipo_usuario === "administrador";
    const tarea   = await Task.findById(req.params.id);
    if (!tarea) return res.status(404).json({ mensaje: "Tarea no encontrada" });

    // Admin puede asociar de cualquier tipo; judicante solo el suyo
    if (!esAdmin && String(tarea.asignado_a) !== String(req.user.sub)) {
      return res.status(403).json({ mensaje: "No tienes permiso sobre esta tarea" });
    }
    if (!esAdmin && tipo === "admin") {
      return res.status(403).json({ mensaje: "Solo el administrador puede adjuntar documentos de referencia" });
    }

    const campo = tipo === "admin" ? "documento_admin" : "documento_judicante";
    const docData = { driveFileId: documento_id, nombre: nombre || "Documento", mimeType: mimeType || "" };

    const actualizada = await Task.findByIdAndUpdate(
      req.params.id,
      { [campo]: docData },
      { new: true }
    )
      .populate("creado_por", POPULATE_USER)
      .populate("asignado_a", POPULATE_USER);

    res.json({ data: actualizada });
  } catch (err) { next(err); }
};

// ─── actualizarObservaciones ──────────────────────────────────────────────────

const actualizarObservaciones = async (req, res, next) => {
  try {
    const { observaciones } = req.body;
    const obs = observaciones?.trim() || null;
    const esAdmin = req.user.tipo_usuario === "administrador";
    const tarea   = await Task.findById(req.params.id);
    if (!tarea) return res.status(404).json({ mensaje: "Tarea no encontrada" });

    if (!esAdmin && String(tarea.asignado_a) !== String(req.user.sub)) {
      return res.status(403).json({ mensaje: "No tienes permiso sobre esta tarea" });
    }

    const update = esAdmin
      ? { observaciones: obs, observaciones_admin: obs }
      : { observaciones_judicante: obs };

    const actualizada = await Task.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    )
      .populate("creado_por", POPULATE_USER)
      .populate("asignado_a", POPULATE_USER);

    res.json({ data: actualizada });
  } catch (err) { next(err); }
};

// ─── eliminar ─────────────────────────────────────────────────────────────────

const eliminar = async (req, res, next) => {
  try {
    const esAdmin = req.user.tipo_usuario === "administrador";
    const tarea   = await Task.findById(req.params.id);
    if (!tarea) return res.status(404).json({ mensaje: "Tarea no encontrada" });

    if (esAdmin) {
      await Task.findByIdAndDelete(req.params.id);
      return res.json({ mensaje: "Tarea eliminada" });
    }

    const esPropia = String(tarea.asignado_a) === String(req.user.sub);
    if (!esPropia)             return res.status(403).json({ mensaje: "No tienes permiso sobre esta tarea" });
    if (tarea.estado !== "completado") return res.status(400).json({ mensaje: "Solo puedes eliminar tareas completadas" });

    await Task.findByIdAndDelete(req.params.id);
    res.json({ mensaje: "Tarea eliminada" });
  } catch (err) { next(err); }
};

// ─── listarJudicantes ─────────────────────────────────────────────────────────

const listarJudicantes = async (req, res, next) => {
  try {
    const judicantes = await User.find({ tipo_usuario: "judicante" })
      .select("nombre Nombre apellido Apellido email Email")
      .sort({ nombre: 1, Nombre: 1 });
    res.json({ data: judicantes });
  } catch (err) { next(err); }
};

module.exports = { listar, crear, actualizarEstado, actualizarObservaciones, asociarDocumento, eliminar, listarJudicantes };
