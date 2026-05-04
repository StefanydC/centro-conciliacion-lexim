const Notification = require("../models/notification.model");

const crear = async (payload) => {
  return Notification.create(payload);
};

const listarPorUsuario = async ({ destinatario, soloNoLeidas = false, limit = 20 }) => {
  const filtro = { destinatario };
  if (soloNoLeidas) {
    filtro.leida = false;
  }

  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));

  const [data, unreadCount] = await Promise.all([
    Notification.find(filtro).sort({ createdAt: -1 }).limit(safeLimit),
    Notification.countDocuments({ destinatario, leida: false })
  ]);

  return { data, unreadCount };
};

const marcarLeida = async ({ id, destinatario }) => {
  return Notification.findOneAndDelete({ _id: id, destinatario });
};

const marcarTodasLeidas = async ({ destinatario }) => {
  return Notification.deleteMany({ destinatario });
};

module.exports = {
  crear,
  listarPorUsuario,
  marcarLeida,
  marcarTodasLeidas
};