const { google } = require("googleapis");
const jwt         = require("jsonwebtoken");
const User        = require("../models/user.model");
const { env }     = require("../config/env");

function getOAuthClient() {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
}

/**
 * GET /auth/google/connect?token=<jwt>
 */
const connect = (req, res) => {
  const token = req.query.token;
  if (!token) return res.redirect("/api/login.html");

  let userId;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    userId = payload.sub;
  } catch {
    return res.redirect("/api/login.html");
  }

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return res
      .status(500)
      .send("Google OAuth no configurado. Revisa GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el .env");
  }

  const state = jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: "10m" });

  const authUrl = getOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt:      "consent",
    // Bug 1 fix: se necesita userinfo.email para llamar userinfo.get() en el callback
    scope: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/userinfo.email"
    ],
    state
  });

  res.redirect(authUrl);
};

/**
 * GET /auth/google/callback
 */
const callback = async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    console.warn("[GOOGLE] OAuth rechazado:", error);
    return res.redirect(`/api/agenda.html?gcal=error&msg=${encodeURIComponent(error)}`);
  }

  try {
    const { sub: userId } = jwt.verify(state, env.JWT_SECRET);

    const oauth2Client = getOAuthClient();
    const { tokens }   = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new Error("Google no devolvió access_token");
    }

    // Bug 2 fix: guardar tokens PRIMERO — el email es info de display, no bloquea el flujo
    const update = {
      google_connected:    true,
      google_access_token: tokens.access_token,
      google_token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null
    };
    if (tokens.refresh_token) {
      update.google_refresh_token = tokens.refresh_token;
    }

    // Email: intento opcional — si falla, la conexión igual queda guardada
    try {
      oauth2Client.setCredentials(tokens);
      const oauth2Api  = google.oauth2({ version: "v2", auth: oauth2Client });
      const { data }   = await oauth2Api.userinfo.get();
      update.google_email = data.email || null;
    } catch (emailErr) {
      console.warn("[GOOGLE] No se pudo obtener email (no crítico):", emailErr.message);
    }

    await User.findByIdAndUpdate(userId, update);
    console.log(
      `✅ [GOOGLE] Calendario conectado: usuario=${userId}` +
      ` email=${update.google_email || "sin email"}` +
      ` refresh_token=${tokens.refresh_token ? "recibido" : "no recibido"}`
    );

    res.redirect("/api/agenda.html?gcal=ok");
  } catch (err) {
    console.error("[GOOGLE] Error en callback:", err.message);
    res.redirect(`/api/agenda.html?gcal=error&msg=${encodeURIComponent(err.message)}`);
  }
};

module.exports = { connect, callback };
