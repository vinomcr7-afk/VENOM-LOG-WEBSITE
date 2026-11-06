"use strict";
const express = require("express");
const session = require("express-session");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "1565783855846269169";
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
const BOT_API_URL = (process.env.BOT_API_URL || "https://venom-log.onrender.com").replace(/\/$/, "");
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined });

app.set("trust proxy", 1);
app.use(express.json({ limit: "100kb" }));
app.use(session({ name: "venom.sid", secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false, cookie: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 } }));
app.use(express.static(path.join(__dirname, "public")));

async function botRequest(route, options = {}) {
  if (!INTERNAL_API_SECRET) throw new Error("INTERNAL_API_SECRET is missing");
  const response = await fetch(`${BOT_API_URL}${route}`, { ...options, headers: { "Content-Type": "application/json", "x-venom-secret": INTERNAL_API_SECRET, ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Bot API returned ${response.status}`);
  return data;
}
function loggedIn(req, res, next) {
  if (!req.session.user || !req.session.accessToken) return res.status(401).json({ error: "Please login with Discord." });
  next();
}
async function getManageableGuilds(req) {
  const response = await fetch("https://discord.com/api/users/@me/guilds", { headers: { Authorization: `${req.session.tokenType} ${req.session.accessToken}` } });
  if (!response.ok) throw new Error(response.status === 401 ? "Discord login expired. Please login again." : "Could not read Discord servers.");
  const guilds = await response.json();
  return guilds.filter(g => {
    const p = BigInt(g.permissions || "0");
    return g.owner || (p & 0x8n) === 0x8n || (p & 0x20n) === 0x20n;
  });
}
app.get("/auth/discord", (req, res) => {
  if (!CLIENT_SECRET || !REDIRECT_URI || !process.env.SESSION_SECRET) return res.status(503).send("Discord OAuth or SESSION_SECRET settings are missing.");
  const params = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: "code", scope: "identify guilds" });
  res.redirect("https://discord.com/oauth2/authorize?" + params);
});
app.get("/auth/discord/callback", async (req, res) => {
  try {
    if (!CLIENT_SECRET || !REDIRECT_URI || !req.query.code) return res.redirect("/?login=setup");
    const body = new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: "authorization_code", code: req.query.code, redirect_uri: REDIRECT_URI });
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    if (!tokenResponse.ok) throw new Error("Discord token exchange failed");
    const token = await tokenResponse.json();
    const userResponse = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: `${token.token_type} ${token.access_token}` } });
    if (!userResponse.ok) throw new Error("Discord profile request failed");
    const user = await userResponse.json();
    req.session.regenerate(err => {
      if (err) return res.redirect("/?login=error");
      req.session.user = user;
      req.session.accessToken = token.access_token;
      req.session.tokenType = token.token_type || "Bearer";
      req.session.tokenExpiresAt = Date.now() + (token.expires_in || 604800) * 1000;
      req.session.refreshToken = token.refresh_token;
      req.session.save(saveErr => saveErr ? res.redirect("/?login=error") : res.redirect("/dashboard.html"));
    });
  } catch (error) { console.error(error); res.redirect("/?login=error"); }
});
app.get("/api/me", (req, res) => {
  if (!req.session.user) return res.status(401).json({ loggedIn: false });
  const u = req.session.user;
  res.json({ loggedIn: true, user: { id: u.id, username: u.global_name || u.username, avatar: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128` : null } });
});
app.get("/api/guilds", loggedIn, async (req, res) => {
  try {
    const [mine, botGuilds] = await Promise.all([getManageableGuilds(req), botRequest("/internal/guilds")]);
    const botIds = new Set((botGuilds.guilds || []).map(g => g.id));
    const guilds = mine.map(g => ({ id: g.id, name: g.name, icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null, owner: !!g.owner, botAdded: botIds.has(g.id) }));
    res.json({ guilds });
  } catch (e) { res.status(502).json({ error: e.message || "Could not load servers." }); }
});
app.get("/api/guilds/:guildId/channels", loggedIn, async (req, res) => {
  try {
    const guilds = await getManageableGuilds(req);
    if (!guilds.some(g => g.id === req.params.guildId)) return res.status(403).json({ error: "You do not have Manage Server permission for this server." });
    const data = await botRequest(`/internal/guilds/${encodeURIComponent(req.params.guildId)}/channels`);
    res.json(data);
  } catch (e) { res.status(502).json({ error: e.message || "Could not load channels." }); }
});
app.get("/api/guilds/:guildId/config", loggedIn, async (req, res) => {
  try {
    const guilds = await getManageableGuilds(req);
    if (!guilds.some(g => g.id === req.params.guildId)) return res.status(403).json({ error: "You do not have permission to manage this server." });
    res.json(await botRequest(`/internal/guilds/${encodeURIComponent(req.params.guildId)}/config`));
  } catch (e) { res.status(502).json({ error: e.message || "Could not load settings." }); }
});
app.put("/api/guilds/:guildId/config", loggedIn, async (req, res) => {
  try {
    const guilds = await getManageableGuilds(req);
    if (!guilds.some(g => g.id === req.params.guildId)) return res.status(403).json({ error: "You do not have permission to manage this server." });
    const data = await botRequest(`/internal/guilds/${encodeURIComponent(req.params.guildId)}/config`, { method: "PUT", body: JSON.stringify({ config: req.body.config }) });
    res.json(data);
  } catch (e) { res.status(400).json({ error: e.message || "Could not save settings." }); }
});
app.post("/auth/logout", (req, res) => req.session.destroy(() => { res.clearCookie("venom.sid"); res.redirect("/"); }));
app.get("/health", async (_req, res) => { try { await pool.query("SELECT 1"); res.send("VENOM LOG website online"); } catch { res.status(503).send("Database unavailable"); } });
app.listen(PORT, () => console.log(`VENOM LOG website running on ${PORT}`));
