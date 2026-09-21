# Troubleshooting

Start with the logs: `logs/error.log` (errors only) and `logs/bot.log` (everything). On Windows, `.\scripts\status.ps1`
summarizes the state of both services and shows the latest errors. `npm run smoke` tests the audio backend without
needing Discord.

## The bot does not start

| Message in `error.log` / console | Cause and fix |
|----------------------------------|---------------|
| `Invalid environment configuration` | A value in `.env` is missing or still a placeholder. The message lists every problem. `npm run check:env` re-checks. |
| `An invalid token was provided` | Wrong `DISCORD_TOKEN`. Reset it in the Developer Portal (Bot tab) and paste the new one. |
| `Used disallowed intents` | `MESSAGE_REQUESTS_ENABLED=true` but the **Message Content Intent** is off. Turn it on (Developer Portal, Bot tab) or set the variable to `false`. |
| `Could not open the database` | `DATABASE_PATH` points to a folder the service account cannot write to. |
| `ExperimentalWarning: SQLite` | Harmless. The start scripts hide it with `--disable-warning=ExperimentalWarning`. |
| `Cannot find module` / `dist\index.js` missing | Run `npm run build` (or `scripts\setup-windows.ps1`). |

## No audio, or commands answer "backend unavailable"

- Is Lavalink running? Windows: `.\scripts\status.ps1`. Elsewhere: `curl -H "Authorization: <password>" http://127.0.0.1:2333/version`.
- The first start downloads the plugins and needs internet. Look in `lavalink/logs/` for `Lavalink is ready to accept connections`.
- `Unauthorized` / password rejected: `LAVALINK_PASSWORD` changed after Lavalink started. Restart Lavalink.
- The bot keeps retrying every few seconds, so it recovers by itself once Lavalink is up. There is no need to restart it.
- Java missing or too old: `java -version` must report 17 or newer.

## YouTube asks to sign in ("confirm you're not a bot") or tracks fail to load

YouTube periodically restricts data-center IPs. Options, from least to most invasive:

1. **Wait and retry.** Restrictions are often temporary. The plugin tries several clients automatically.
2. **Update the plugin.** Newer `youtube-plugin` versions adapt to YouTube changes. Change the version in
   `lavalink/application.yml`, then restart Lavalink (`.\scripts\update-bot.ps1 -RestartLavalink` on Windows).
3. **Use a residential/VPN egress or a route planner**, if your host's IP range is blocked.
4. **YouTube OAuth (last resort).** Use a *burner* Google account, never your main one: set
   `YOUTUBE_OAUTH_ENABLED=true` in `.env`, restart Lavalink, open `lavalink/logs`, follow the printed device-login
   instructions once, then copy the printed refresh token into `YOUTUBE_OAUTH_REFRESH_TOKEN` and restart again.
   This carries a risk to the account and may still be rate-limited.

SoundCloud, Bandcamp, Twitch, Vimeo and direct audio links are not affected by YouTube restrictions.

## Spotify

- "Spotify links aren't enabled": set `SPOTIFY_ENABLED=true`, `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`, then
  restart Lavalink. `npm run smoke` shows a Spotify check when it is on.
- Spotify tracks are **played from YouTube/SoundCloud** (Spotify does not provide audio). If the mirror source is
  restricted, Spotify links fail for the same reason YouTube does.
- Very large playlists are cut off at 500 tracks (`LIMITS.maxPlaylistTracks`) and by LavaSrc's page limits
  (`playlistLoadLimit` in `lavalink/application.yml`).

## The bot cannot join or speak

The error message names the missing permission. The bot needs **View Channel, Connect and Speak** in the voice
channel and **View Channel, Send Messages, Embed Links** in the text channel. Full channels (user limit reached) and Stage
channels are not supported.

## "You need the DJ role"

A DJ role is set (`/settings dj`). Members with that role, members with **Manage Server**, or a lone listener can use
restricted actions: stop, leave, clear, remove, move, shuffle, volume, seek, loop, autoplay and filters. Everyone in the
voice channel can still play, search, pause, resume, skip, go back and view the queue. Clear the role with
`/settings dj` and no role to turn DJ mode off.

## The control panel does not update or was deleted

- The panel is one message that the bot edits (at most about once every 1.5 seconds). If it was deleted, the next track
  posts a new one. A permanent controller can be recreated with `/setup controller`.
- If you see "Missing permission to post the control panel" in the log, grant Send Messages, Embed Links and
  Read Message History in that channel.

## Slash commands are missing

- Commands are registered at startup when they changed. Global commands can take up to an hour to appear the first time.
- While developing, set `DISCORD_GUILD_ID` for instant per-server registration. When you later switch to global
  commands, set `DISCORD_GUILD_ID` one last time and run `npm run deploy:commands -- --clear-guild` to remove the
  duplicates, then empty the variable.
- Force a re-registration: `npm run deploy:commands`.
- Make sure the invite link contained the `applications.commands` scope.

## Audio stutters

- Check CPU and memory on the host. Lavalink itself needs little, but transcoding filters (nightcore, bass boost) cost
  more.
- Raise `LAVALINK_MEMORY` (for example `2G`) for many simultaneous servers.
- Lower `resamplingQuality` or `opusEncodingQuality` in `lavalink/application.yml` on very small machines.

## Lyrics not found

Lyrics come from LRCLIB and lyrics.ovh, matched on title and artist. Live videos and remixes often do not match.
Use `/lyrics query:<artist - title>` to search by hand.

## Still stuck?

Open an issue with your Node.js version, Java version, Lavalink version (from `/about`) and the relevant lines of
`logs/error.log` with secrets removed.
