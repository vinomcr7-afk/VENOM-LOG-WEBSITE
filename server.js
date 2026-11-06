const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "1565783855846269169";
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

app.set("trust proxy", 1);

app.use(session({
name: "venom.sid",
secret: process.env.SESSION_SECRET,
resave: false,
saveUninitialized: false,
cookie: {
httpOnly: true,
secure: process.env.NODE_ENV === "production",
sameSite: "lax",
maxAge: 7 * 24 * 60 * 60 * 1000
}
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/auth/discord", (req, res) => {
if (!CLIENT_SECRET || !REDIRECT_URI) {
return res.status(503).send("Discord OAuth settings are missing.");
}

const params = new URLSearchParams({
client_id: CLIENT_ID,
redirect_uri: REDIRECT_URI,
response_type: "code",
scope: "identify guilds"
});

res.redirect("https://discord.com/oauth2/authorize?" + params);
});

app.get("/auth/discord/callback", async (req, res) => {
try {
if (!CLIENT_SECRET || !REDIRECT_URI || !req.query.code) {
return res.redirect("/?login=setup");
}

const body = new URLSearchParams({
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  grant_type: "authorization_code",
  code: req.query.code,
  redirect_uri: REDIRECT_URI
});

const tokenResponse = await fetch(
  "https://discord.com/api/oauth2/token",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  }
);

if (!tokenResponse.ok) {
  throw new Error("Discord token exchange failed");
}

const token = await tokenResponse.json();

const userResponse = await fetch(
  "https://discord.com/api/users/@me",
  {
    headers: {
      Authorization: `${token.token_type} ${token.access_token}`
    }
  }
);

if (!userResponse.ok) {
  throw new Error("Discord profile request failed");
}

const user = await userResponse.json();

req.session.regenerate((error) => {
  if (error) {
    console.error(error);
    return res.redirect("/?login=error");
  }

  req.session.user = user;

  req.session.save((saveError) => {
    if (saveError) {
      console.error(saveError);
      return res.redirect("/?login=error");
    }

    res.redirect("/dashboard.html");
  });
});

} catch (error) {
console.error(error);
res.redirect("/?login=error");
}
});

app.get("/api/me", (req, res) => {
if (!req.session.user) {
return res.status(401).json({ loggedIn: false });
}

res.json({
loggedIn: true,
user: {
id: req.session.user.id,
username: req.session.user.global_name || req.session.user.username,
avatar: req.session.user.avatar
}
});
});

app.post("/auth/logout", (req, res) => {
req.session.destroy(() => {
res.clearCookie("venom.sid");
res.redirect("/");
});
});

app.get("/health", (req, res) => {
res.send("VENOM LOG website online");
});

app.listen(PORT, () => {
console.log("VENOM LOG website running on port " + PORT);
});