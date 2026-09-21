# Sonaris on Windows Server (production guide)

This guide takes you from a clean Windows Server to a music bot that runs 24/7 in the background, restarts itself after
crashes and comes back online after every reboot, with **no terminal window left open**.

It works on Windows Server 2016, 2019, 2022 and 2025 and on Windows 10/11.

## How it works

```text
                Windows Server
  ┌──────────────────────────────────────────────────────┐
  │  Service "MusicBot-Lavalink"  (starts first)         │
  │    powershell -> lavalink\start-lavalink.ps1 -> java │
  │    listens on 127.0.0.1:2333 only                    │
  │                     ▲                                │
  │                     │ localhost                      │
  │  Service "MusicBot"  (depends on the Lavalink one)   │
  │    node dist\index.js  (compiled production build)   │
  └──────────────────────────────────────────────────────┘
        │ outbound HTTPS / voice UDP only
        ▼
     Discord, YouTube, SoundCloud, Spotify
```

- Both are real **Windows services** created with [WinSW](https://github.com/winsw/winsw) (a small, widely used
  service wrapper). They start automatically at boot, run without any user logged in, and Windows restarts them
  after a failure (after 10 s, then 30 s, then 60 s).
- The bot **waits for Lavalink**: the service dependency starts Lavalink first, and the bot also retries with
  backoff if Lavalink needs a few more seconds (or restarts later). It never gives up permanently.
- Nothing is exposed to the internet. Lavalink is bound to `127.0.0.1`, so **no firewall rule is needed**.

## 1. Required software

| Software | Version | Why |
|----------|---------|-----|
| Windows PowerShell | 5.1 (already installed) | The management scripts |
| Node.js | **22.13 or newer** (22 LTS or 24 LTS) | Runs the bot (uses the built-in SQLite, no compiler needed) |
| Java (JRE) | **17 or newer** (21 recommended) | Runs Lavalink |
| Internet access (outbound) | | Discord, YouTube, SoundCloud, Spotify, plugin downloads |

Git is **optional** (only needed if you want `update-bot.ps1` to `git pull`).

Open **PowerShell as Administrator** for everything below (right-click the Start button, *Windows PowerShell (Admin)*).

## 2. Install Node.js

Download the **LTS Windows Installer (.msi)** from <https://nodejs.org/en/download> and run it with the defaults.
On Windows Server 2025 / Windows 11 you can also use winget:

```powershell
winget install --id OpenJS.NodeJS.LTS -e
```

Close and reopen PowerShell, then check:

```powershell
node --version    # v22.13.0 or higher
npm --version
```

## 3. Install Java

Download **Eclipse Temurin 21 (JRE), Windows x64, .msi** from
<https://adoptium.net/temurin/releases/?os=windows&package=jre> and, in the installer, enable
**"Set JAVA_HOME variable"** and **"Add to PATH"**. Or with winget:

```powershell
winget install --id EclipseAdoptium.Temurin.21.JRE -e
```

Reopen PowerShell and check:

```powershell
java -version     # openjdk version "21..." (17 or higher is fine)
```

## 4. Put the bot on the server

Copy the whole project folder to a simple path **outside** any user profile or OneDrive folder, for example
`C:\Sonaris`. (You can leave out `node_modules`, `dist`, `data` and `logs`; they are recreated.)

```powershell
cd C:\Sonaris
```

> **Do not move the folder after installing the services.** The services remember the path. If you must move it, run
> `.\scripts\uninstall-services.ps1`, move the folder and run `.\scripts\install-services.ps1` again.

Allow the scripts to run in this PowerShell window only (nothing is changed permanently):

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
```

From **Command Prompt** you can use the same scripts like this:

```bat
cd C:\Sonaris
powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1
```

## 5. Discord credentials

1. Go to <https://discord.com/developers/applications> and click **New Application**. Name it and accept the terms.
2. **General Information**: copy the **Application ID**. This is `DISCORD_CLIENT_ID`.
3. **Bot** tab: click **Reset Token**, copy the token. This is `DISCORD_TOKEN`. Treat it like a password.
4. **Bot** tab, *Privileged Gateway Intents*: leave all three **off**. (Only turn on **Message Content Intent** if you
   plan to use message-based song requests and set `MESSAGE_REQUESTS_ENABLED=true`.)
5. Optional: upload `branding\logo.png` as the bot avatar and `branding\banner.png` as the banner.
6. Invite the bot to your server with this link (replace `YOUR_APPLICATION_ID`):

   ```text
   https://discord.com/oauth2/authorize?client_id=YOUR_APPLICATION_ID&scope=bot%20applications.commands&permissions=3238912
   ```

   The permission set is: View Channels, Send Messages, Embed Links, Read Message History, Manage Messages
   (only used to keep a request channel tidy), Connect and Speak.

## 6. Prepare the project

Run the setup script. It checks Node and Java, creates the folders, creates `.env`, generates a strong Lavalink
password, installs dependencies, builds the production version, removes development-only packages and downloads a
checksum-verified Lavalink:

```powershell
.\scripts\setup-windows.ps1
```

It never installs software silently. If something is missing it tells you exactly what to install. (Add
`-InstallPrerequisites` if you want it to offer to install Node.js and Java through winget, after a confirmation
prompt.)

Then open the configuration file and fill in the two Discord values:

```powershell
notepad .env
```

```ini
DISCORD_TOKEN=paste-your-token-here
DISCORD_CLIENT_ID=paste-your-application-id-here
```

Everything else has a working default. `LAVALINK_PASSWORD` was generated for you. Run the script again to validate
(it is safe to repeat):

```powershell
.\scripts\setup-windows.ps1
```

You should see `Setup complete. Configuration is valid.`

### Optional: Spotify links

Spotify links work by reading the track's metadata from Spotify and playing the matching song from YouTube or
SoundCloud. Without credentials, Spotify links are politely refused.

1. Open <https://developer.spotify.com/dashboard>, create an app (any name, redirect URI `http://127.0.0.1`).
2. Copy the **Client ID** and **Client secret** into `.env`:

   ```ini
   SPOTIFY_ENABLED=true
   SPOTIFY_CLIENT_ID=...
   SPOTIFY_CLIENT_SECRET=...
   ```

3. Restart the services (section 10). Check with `npm run smoke`, which lists the Spotify test when enabled.

## 7. Install and start the services

```powershell
.\scripts\install-services.ps1
```

This downloads and verifies WinSW, generates the service definitions in `services\`, installs
**MusicBot-Lavalink** and **MusicBot**, starts Lavalink, waits until it answers (the first start downloads the
YouTube and Spotify plugins, which can take a minute), then starts the bot and prints the status.

Want to review what will be installed first? Run `.\scripts\install-services.ps1 -GenerateOnly`. It creates the
files in `services\` and installs nothing.

## 8. Check that everything works

```powershell
.\scripts\status.ps1
```

Example of a healthy result:

```text
Discord Bot Service:    Running
Lavalink Service:       Running
Lavalink connectivity:  reachable at http://127.0.0.1:2333, v4.2.2, password accepted
Lavalink plugins:       lavasrc-plugin@4.8.3, youtube-plugin@1.18.2
Bot process:            PID 4321, 96 MB, running for 2m 10s
Discord connection:     connected (since 2026-09-21T16:44:43.654Z)
Recent errors: none
Everything looks healthy.
```

The script exits with code 0 when healthy and 1 when something needs attention, so you can also call it from a
monitoring tool. Then test in Discord: join a voice channel and run `/play query: Arctic Monkeys Do I Wanna Know`.
For a backend-only check without Discord, run `npm run smoke`.

**Prove the reboot behavior once:** `Restart-Computer`, wait a few minutes, sign in and run `.\scripts\status.ps1`.
Both services should be `Running` without you having done anything.

## 9. Where the logs are

| File | Content |
|------|---------|
| `logs\bot.log` | Everything the bot logs (JSON lines, one event per line). Rotates at 10 MB, keeps 10 files. |
| `logs\error.log` | Only errors and fatal problems from the bot. Same rotation. **Start here when something is wrong.** |
| `logs\lavalink.out.log`, `logs\lavalink.err.log` | Console output of the Lavalink service (rotated by the service wrapper). |
| `lavalink\logs\` | Lavalink's own detailed log (rotated, 7 days). |
| `logs\service.out.log`, `logs\service.err.log` | Raw console output of the bot process. Catches crashes that happen before the logger starts. |
| `logs\*.wrapper.log` | Service wrapper events (start, stop, restart after failure). |

Read the last lines or follow a log live:

```powershell
Get-Content .\logs\error.log -Tail 30
Get-Content .\logs\bot.log -Wait -Tail 20      # Ctrl+C stops following
```

Secrets (the Discord token and the Lavalink password) are removed from every log line before it is written.

## 10. Day-to-day commands

Run them from `C:\Sonaris` in an elevated PowerShell:

| Task | Command |
|------|---------|
| Status and health | `.\scripts\status.ps1` |
| Start everything (Lavalink first) | `.\scripts\start-services.ps1` |
| Stop everything (bot first) | `.\scripts\stop-services.ps1` |
| Restart everything | `.\scripts\restart-services.ps1` |
| Restart only the bot | `.\scripts\restart-services.ps1 -BotOnly` |
| Backend self-test (no Discord needed) | `npm run smoke` |
| Validate `.env` | `npm run check:env` |

After you edit `.env`, restart both services so both processes read the new values:
`.\scripts\restart-services.ps1`.

You can also use the standard Windows tools: `services.msc`, `Get-Service MusicBot*`, or Task Manager, Services tab.

## 11. Updating the bot

Copy the new project files over the old ones (keep your `.env`, `data\` and `logs\`), or `git pull` if the folder is a
Git checkout, then run:

```powershell
.\scripts\update-bot.ps1
```

It stops the bot, pulls from Git when possible (`-SkipGit` to skip), installs dependencies, builds, removes
development packages, starts the bot and **waits for the bot to confirm the Discord connection**. If the build fails
the previous build is restored and started again, so a bad update does not leave you offline.

Changed `lavalink\application.yml` or a plugin version? Add `-RestartLavalink`:

```powershell
.\scripts\update-bot.ps1 -RestartLavalink
```

Slash commands are re-registered automatically on startup, but only when their definitions actually changed.

## 12. Removing the services

```powershell
.\scripts\uninstall-services.ps1
```

Stops and removes both services. Your `.env`, `data\` (database) and `logs\` stay. Add `-RemoveTools` to delete the
`services\` folder as well.

## 13. Security notes

- **No inbound firewall rules are needed.** Lavalink listens on `127.0.0.1` only. Do not change `LAVALINK_HOST`
  or `LAVALINK_BIND_ADDRESS` to a public address. If your outbound firewall is restrictive, allow outbound TCP 443 and
  outbound UDP (Discord voice uses high UDP ports, roughly 50000-65535).
- Protect the secrets file so only administrators can read it:

  ```powershell
  icacls .\.env /inheritance:r /grant:r "Administrators:F" "SYSTEM:F"
  ```

- Downloads (Lavalink, WinSW) are verified against pinned SHA-256 hashes; a mismatch aborts and deletes the file.
- The services run as the built-in `LocalSystem` account so they work without a logged-in user. Keep the server patched
  and do not run other public-facing software from the same account.
- Back up `.env` and `data\sonaris.db` (your server settings). Everything else can be recreated.

## 14. Troubleshooting

| Symptom | What to do |
|---------|------------|
| `running scripts is disabled on this system` | Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force` first, or start scripts with `powershell -ExecutionPolicy Bypass -File ...`. |
| Setup says Node.js or Java is missing right after installing | Close **all** PowerShell windows and open a new one so the updated PATH is loaded. |
| `.env` errors such as `DISCORD_TOKEN: must be at least 50 characters` | The value still holds the placeholder. Paste the real token (no quotes needed). |
| Bot service starts, then stops within seconds | Read `logs\error.log`. `An invalid token was provided` means a wrong `DISCORD_TOKEN`. The wrapper retries after 10, 30 and 60 seconds and keeps trying, so fix `.env` and run `.\scripts\restart-services.ps1`. |
| Status says `NOT reachable` for Lavalink | Check `logs\lavalink.err.log` and `lavalink\logs\`. Typical causes: Java missing (`java -version`), port 2333 used by another program (change `LAVALINK_PORT` in `.env`), or the first-run plugin download is still in progress. |
| Status says `PASSWORD IS REJECTED` | Lavalink was started with an older `LAVALINK_PASSWORD`. Run `.\scripts\restart-services.ps1`. |
| `Missing Access` / bot cannot post the panel | Give the bot **View Channel, Send Messages, Embed Links** in that channel. |
| Slash commands do not appear | Global commands can take up to an hour on the first deploy. Set `DISCORD_GUILD_ID` for instant per-server commands while testing, then restart. Run `npm run deploy:commands` to force a re-registration. |
| YouTube says "sign in to confirm you're not a bot" | See `docs\TROUBLESHOOTING.md`, section *YouTube asks to sign in*. |
| A service does not start after reboot | Run `Get-WinEvent -LogName System -MaxEvents 30 | Where-Object ProviderName -eq 'Service Control Manager'`, and read `logs\*.wrapper.log`. |

More general problems (playback quality, permissions, DJ mode) are covered in [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
