# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Report them privately through GitHub's
"Report a vulnerability" button on the repository's *Security* tab, or by email to the maintainer listed on the
repository profile. Include what you found, how to reproduce it and what you think the impact is.
You should receive a response within a few days.

## What is protected

- **Secrets** live only in `.env` (bot token, Lavalink password, optional Spotify credentials). `.env` is git-ignored
  and never printed. The logger redacts known secret values from every log line before it is written.
- **Lavalink is private.** It binds to `127.0.0.1` by default, is protected by a password of at least 12 characters and
  needs no firewall rule. Never expose port 2333 to the internet.
- **User input is untrusted.** Queries are length-limited and classified before use, unsupported schemes are rejected
  and links that point at loopback, private or link-local addresses are blocked so users cannot make Lavalink call
  internal services. No user input is ever passed to a shell.
- **Downloads are verified.** The Windows setup scripts pin SHA-256 hashes for Lavalink and WinSW and delete any download
  that does not match.
- **Least Discord privilege.** The bot needs no privileged intent by default. The optional Message Content intent is
  opt-in (`MESSAGE_REQUESTS_ENABLED=true`).

## Hardening checklist for operators

1. Keep `.env` readable only by administrators (`icacls .env /inheritance:r /grant:r "Administrators:F" "SYSTEM:F"`).
2. Regenerate the Discord token immediately if it is ever exposed (Developer Portal, Bot, Reset Token).
3. Keep Node.js, Java and the dependencies up to date (`npm audit`, and re-run `scripts\update-bot.ps1`).
4. Do not change `LAVALINK_BIND_ADDRESS` or `LAVALINK_HOST` to a public address.
5. Run the services with the built-in wrapper (no interactive login is needed) and avoid running the bot from an
   administrator's desktop session.

## Supported versions

Only the latest release receives security fixes.
