# Lavalink for Sonaris

Sonaris streams audio through [Lavalink](https://github.com/lavalink-devs/Lavalink) v4. This folder holds everything
Lavalink needs.

| File | Purpose |
|------|---------|
| `application.yml` | Complete configuration: sources, filters, plugins, logging. Contains **no secrets**. |
| `start-lavalink.ps1` | Windows launcher used by the `MusicBot-Lavalink` service. Loads `.env`, finds Java, starts the jar. |
| `Lavalink.jar` | **Not committed.** Downloaded (and SHA-256 verified) by `scripts\setup-windows.ps1`. |
| `plugins\` | Plugin jars, downloaded automatically by Lavalink on first start. |
| `logs\` | Lavalink's own rotating log. |

## What you need to install

Lavalink's defaults do **not** support every source Sonaris offers, so the configuration adds two plugins:

| Plugin | Version | Why it is needed |
|--------|---------|------------------|
| [`youtube-plugin`](https://github.com/lavalink-devs/youtube-source) | 1.18.2 | Maintained YouTube and YouTube Music source (search, playback, playlists, mixes for autoplay). Lavalink's built-in YouTube source is disabled in favor of it. |
| [`lavasrc-plugin`](https://github.com/topi314/LavaSrc) | 4.8.3 | Spotify tracks, albums and playlists (metadata is resolved and the audio is mirrored from YouTube / SoundCloud). |

Both are declared in `application.yml` under `lavalink.plugins`; Lavalink downloads them into `plugins\` the first
time it starts (internet access required, roughly 10-60 seconds). No manual installation.

Sources enabled out of the box: **YouTube, YouTube Music, SoundCloud, Bandcamp, Twitch, Vimeo, direct HTTP audio
URLs**, plus **Spotify** once you enable it. The `local` file source is disabled on purpose.

Filters enabled: volume, equalizer, karaoke, timescale, tremolo, vibrato, rotation, distortion, channelMix, lowPass.
Sonaris only shows the filters the connected node reports.

## Requirements

- **Java 17 or newer** (Java 21 recommended). Check with `java -version`.
- About 300-600 MB of RAM (`LAVALINK_MEMORY` in `.env` sets the maximum heap, default `1G`).

## Configuration through `.env`

`application.yml` reads these variables. On Windows the launcher forwards them from the project's `.env`, in Docker
they come from `docker-compose.yml`.

| Variable | Default | Meaning |
|----------|---------|---------|
| `LAVALINK_PASSWORD` | *(required)* | Shared secret between the bot and Lavalink. Lavalink refuses to start without it. |
| `LAVALINK_PORT` | `2333` | Listening port |
| `LAVALINK_BIND_ADDRESS` | `127.0.0.1` | Network interface. Keep it on localhost unless you run inside a private container network. |
| `SPOTIFY_ENABLED` | `false` | Enable Spotify links |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | empty | From <https://developer.spotify.com/dashboard> |
| `SPOTIFY_COUNTRY_CODE` | `US` | ISO country code for artist top tracks |
| `YOUTUBE_OAUTH_ENABLED` / `YOUTUBE_OAUTH_REFRESH_TOKEN` | `false` / empty | Optional YouTube sign-in workaround (see `docs/TROUBLESHOOTING.md`) |

## Running it by hand

```powershell
powershell -ExecutionPolicy Bypass -File .\lavalink\start-lavalink.ps1
```

On Linux/macOS:

```bash
set -a; . ./.env; set +a
cd lavalink && java -Xmx1G -jar Lavalink.jar
```

Successful start-up ends with `Lavalink is ready to accept connections.` Verify with:

```powershell
curl.exe -H "Authorization: YOUR_LAVALINK_PASSWORD" http://127.0.0.1:2333/v4/info
```

or run `npm run smoke` from the project root to test connection, plugins and searches through the bot's own client.

## Security

Lavalink can play arbitrary URLs for whoever holds the password, so keep it private:

- It listens on `127.0.0.1` only, no firewall rule or port forward is needed.
- The password lives only in `.env`, never in this folder.
- Do not publish port 2333 in Docker (the provided compose file does not).

## Upgrading

1. Pick new versions from the release pages of [Lavalink](https://github.com/lavalink-devs/Lavalink/releases),
   [youtube-source](https://github.com/lavalink-devs/youtube-source/releases) and
   [LavaSrc](https://github.com/topi314/LavaSrc/releases).
2. Plugin versions: edit the `dependency:` lines in `application.yml`, delete the matching old jar from `plugins\`,
   restart Lavalink.
3. Lavalink itself: replace `Lavalink.jar` (on Windows also update `LavalinkVersion` / `LavalinkSha256` in
   `scripts\lib\common.ps1` so the setup script keeps verifying the download).
4. Verify with `npm run smoke`.
