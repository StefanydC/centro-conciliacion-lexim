const notificationService = require("../services/notification.service");

const listar = async (req, res, next) => {
  try {
    const soloNoLeidas = String(req.query.soloNoLeidas || "false").toLowerCase() === "true";
    const limit = req.query.limit || 20;
    const { data, unreadCount } = await notificationService.listarPorUsuario({
      destinatario: req.user.sub,
      soloNoLeidas,
      limit
    });

    return res.json({ data, unreadCount });
  } catch (error) {
    next(error);
  }
};

const marcarLeida = async (req, res, next) => {
  try {
    const notificacion = await notificationService.marcarLeida({
      id: req.params.id,
      destinatario: req.user.sub
    });

    if (!notificacion) {
      return res.status(404).json({ mensaje: "Notificación no encontrada" });
    }

    res.json({ mensaje: "Notificación eliminada", data: notificacion });
  } catch (error) {
    next(error);
  }
};

const marcarTodasLeidas = async (req, res, next) => {
  try {
    await notificationService.marcarTodasLeidas({ destinatario: req.user.sub });
    res.json({ mensaje: "Notificaciones eliminadas" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listar,
  marcarLeida,
  marcarTodasLeidas
};