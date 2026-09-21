# Contributing to Sonaris

Thanks for helping to improve the bot. This guide keeps changes easy to review.

## Getting started

```powershell
git clone <your fork>
cd sonaris
npm install
copy .env.example .env      # fill in a development bot token and set DISCORD_GUILD_ID for instant commands
npm run dev                 # needs Lavalink running, see lavalink/README.md
```

Requirements: Node.js 22.13 or newer, Java 17 or newer (for Lavalink).

## Before you open a pull request

Run all checks. CI-style, in this order:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run verify
```

## Guidelines

- **TypeScript strict mode.** No `any`, no unchecked indexing, no unused code.
- **Keep Discord and logic separate.** Put anything testable without Discord (parsing, formatting, queue arithmetic) in
  a pure module and add tests in `tests/`.
- **One place for playback behavior.** Slash commands, buttons and menus all call `src/music/actions.ts`; do not
  duplicate checks in handlers. Voice and DJ rules live in `src/music/guards.ts`.
- **Errors for users vs. logs.** Throw `UserError` with a friendly message for expected problems. Everything else is
  logged with context and shown as a generic message.
- **No spam.** Prefer editing the existing panel (`PanelService`) and ephemeral replies over new channel messages.
- **English only.** All user-facing text, docs and comments are in English.
- **Comments explain why, not what.**
- **Secrets never appear in code, logs, tests or screenshots.**

## Adding a command

1. Create `src/commands/<category>/<name>.ts` exporting a default `SlashCommand`.
2. Register it in `src/commands/index.ts`.
3. Add it to the command table in `README.md`.
4. `npm test` verifies names, descriptions and Discord limits automatically.

## Commit style

Short imperative subject ("Add seek modal"), details in the body when needed. One logical change per commit.

## Reporting bugs

Open an issue with what you expected, what happened, the relevant lines from `logs/error.log` (remove secrets) and
your Node.js, Java and Lavalink versions. Security problems go through `SECURITY.md` instead.
