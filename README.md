# VENOM LOG website

Deploy as a Render **Web Service**.
Build command: `npm install`
Start command: `npm start`

In Discord Developer Portal → Application → OAuth2, add this redirect URL:
`https://YOUR-RENDER-SERVICE.onrender.com/auth/discord/callback`

Set Render environment variables:
- `DISCORD_CLIENT_ID` = application client ID
- `DISCORD_CLIENT_SECRET` = OAuth2 client secret (keep private)
- `DISCORD_REDIRECT_URI` = exact callback URL above
- `SESSION_SECRET` = long random secret
- `NODE_ENV` = `production`

The site includes the bot invite and community invite supplied in chat. Discord login is scaffolded; live log settings still need a shared persistent database/API between this website and the bot. Never put bot tokens or client secrets in frontend files or public chat.
