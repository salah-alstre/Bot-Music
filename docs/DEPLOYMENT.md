# Deployment guide

| Target | Best for | Guide |
|--------|----------|-------|
| **Windows Server (native services)** | Production. The primary, best-supported path | [WINDOWS-SERVER.md](WINDOWS-SERVER.md) |
| Local Windows (development) | Trying the bot or developing | below |
| Linux VPS (systemd) | Production on Linux | below |
| Docker Compose | Optional, any host with Docker | below |

A persistent Discord music bot needs a long-running process and a WebSocket connection to Discord. Do **not** deploy
it to serverless or function platforms (Vercel, Netlify, Cloudflare Workers, AWS Lambda...): they cannot keep the
process, the voice connections and Lavalink alive.

## Local Windows (development)

Requirements: Node.js 22.13+, Java 17+.

PowerShell:

```powershell
git clone <your fork> sonaris; cd sonaris
npm install
Copy-Item .env.example .env
notepad .env                                   # DISCORD_TOKEN, DISCORD_CLIENT_ID, LAVALINK_PASSWORD (12+ chars)
Invoke-WebRequest https://github.com/lavalink-devs/Lavalink/releases/download/4.2.2/Lavalink.jar -OutFile lavalink\Lavalink.jar
# terminal 1: Lavalink
powershell -ExecutionPolicy Bypass -File .\lavalink\start-lavalink.ps1
# terminal 2: the bot with hot reload
npm run dev
```

Command Prompt:

```bat
git clone <your fork> sonaris && cd sonaris
npm install
copy .env.example .env
notepad .env
curl -L -o lavalink\Lavalink.jar https://github.com/lavalink-devs/Lavalink/releases/download/4.2.2/Lavalink.jar
start "Lavalink" powershell -ExecutionPolicy Bypass -File lavalink\start-lavalink.ps1
npm run dev
```

Do not run `scripts\setup-windows.ps1` on a development checkout: it prepares a *production* layout and removes the
development dependencies after building (run `npm install` again if you did).

Set `DISCORD_GUILD_ID` in `.env` to your test server so slash commands update instantly.

## Linux VPS (systemd)

Tested layout: Debian/Ubuntu, Node.js 22, Java 21, a dedicated `sonaris` user, project in `/opt/sonaris`.

```bash
# prerequisites
sudo apt update && sudo apt install -y openjdk-21-jre-headless curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs

# user and files
sudo useradd --system --create-home --home-dir /opt/sonaris --shell /usr/sbin/nologin sonaris
sudo -u sonaris git clone <your fork> /opt/sonaris    # or upload the folder
cd /opt/sonaris
sudo -u sonaris cp .env.example .env && sudo -u sonaris nano .env
sudo chmod 600 .env

# build
sudo -u sonaris npm ci
sudo -u sonaris npm run build
sudo -u sonaris npm prune --omit=dev
sudo -u sonaris curl -L -o lavalink/Lavalink.jar \
  https://github.com/lavalink-devs/Lavalink/releases/download/4.2.2/Lavalink.jar

# services
sudo cp deploy/linux/sonaris-lavalink.service deploy/linux/sonaris-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now sonaris-lavalink sonaris-bot

# check
systemctl status sonaris-lavalink sonaris-bot
sudo -u sonaris npm run smoke
journalctl -u sonaris-bot -f
```

Both units restart automatically (`Restart=always`) and start at boot. Lavalink binds to `127.0.0.1`; open no ports.
To update: `git pull && npm ci && npm run build && npm prune --omit=dev && sudo systemctl restart sonaris-bot`.

## Docker Compose (optional)

```bash
cp .env.example .env      # set DISCORD_TOKEN, DISCORD_CLIENT_ID and LAVALINK_PASSWORD
docker compose up -d --build
docker compose logs -f bot
```

- The compose file starts Lavalink 4.2.2 and the bot on a private network. Lavalink's port is **not** published.
- The bot connects to Lavalink through the hostname `lavalink`; `LAVALINK_HOST` in `.env` is overridden for the container.
- Data (`./data`) and logs (`./logs`) are bind-mounted. Plugins are cached in the `lavalink-plugins` volume.
- Update: `git pull && docker compose up -d --build`.

Docker on Windows Server requires the Linux container feature (WSL 2 / Docker Desktop) and is generally heavier than
the native services; prefer [WINDOWS-SERVER.md](WINDOWS-SERVER.md) there.
