# Sonaris brand guide

## Name selection

Ten original candidates were considered. All are short, audio-related and adult in tone.

| # | Name | Idea |
|---|------|------|
| 1 | **Sonaris** | *sonar* + *-is*: sound that travels and finds you |
| 2 | Aurix | *aural* + *-ix*: crisp, technical |
| 3 | Resonis | *resonance*, softened |
| 4 | Cadenzo | *cadenza*: the virtuoso passage in a piece |
| 5 | Lumivox | light + voice |
| 6 | Sonance | the quality of being sonorous |
| 7 | Oktava | *octave*, Slavic spelling |
| 8 | Auralis | *aural* + *aurora* |
| 9 | Hertzen | *hertz*: the unit of frequency |
| 10 | Echelon | tiers of a signal chain, and a nod to *echo* |

**Chosen: Sonaris.** It is easy to say and spell, evokes *sonar* (precision, listening, range), works as a
slash-command prefix in conversation ("ask Sonaris"), and has a natural visual: rings that radiate outward.
This is a naming exploration, not a trademark search. Check availability before commercial use.

## Identity

- **Tagline:** *Precision audio for every server.*
- **Personality:** calm, precise, quietly confident. Sonaris never shouts: clean typography, short sentences,
  no jokes in error messages, no emoji spam. Premium means restraint.
- **Voice in the UI:** plain English, actionable errors ("Join a voice channel first, then try again."), never raw
  technical detail.

## Palette

| Role | Hex | Use |
|------|-----|-----|
| Primary / embed color | `#7C5CFF` | Embeds, primary buttons, brand mark |
| Accent | `#22D3EE` | Gradients, highlights |
| Success | `#34D399` | Confirmation embeds |
| Warning | `#FBBF24` | Non-blocking warnings |
| Danger | `#F87171` | Errors, destructive buttons |
| Neutral / paused | `#2B2D3A` | Idle and paused player |
| Ink (background) | `#0B0B12` | Logo and banner background |

The same values live in `src/config/brand.ts` (`COLORS`), so the bot and the artwork never drift apart.

## Logo concept

A **sonar ring** around **five equalizer bars**. The ring says *precision and range*, the bars say *music*, and the
symmetrical silhouette survives at 16 px. The gradient runs violet to cyan, on a near-black background with a soft
inner glow and two faint outer "ping" rings. No text inside the avatar.

Files:

- `logo.svg` – master vector, 1024 x 1024
- `logo.png` – 1024 x 1024, use as the **Discord application and bot avatar**
- `logo-128.png` – small preview used in documentation

Keep the mark inside the central 70 % so Discord's circular crop never touches it.

## Banner concept

Dark, futuristic and quiet: the mark and the wordmark on the left, a single fading waveform on the right, and a wide
empty band between them so the composition can breathe. Soft violet glow behind the mark, faint cyan glow behind the
waveform.

Files:

- `banner.svg` – master vector, 1360 x 480
- `banner.png` – 1360 x 480 (17:6), use as the **Discord application banner** and README hero

## Recommended dimensions

| Asset | Size | Notes |
|-------|------|-------|
| Bot / application avatar | 1024 x 1024 px | PNG, square, mark inside the central 70 % |
| Application (bot profile) banner | 680 x 240 px minimum, 17:6 | `banner.png` is 2x that size and downscales cleanly |
| GitHub social preview | 1280 x 640 px | Crop `banner.png` to 2:1 around the wordmark |
| README hero | 1360 x 480 px | `banner.png` as is |
| Embed thumbnails | 128 x 128 px | `logo-128.png` |

## Regenerating or replacing the artwork

`logo.svg` and `banner.svg` are plain SVG and can be edited in any vector editor or text editor. To produce a
different look with an AI image generator, use the prompts in `logo-prompt.txt` and `banner-prompt.txt`, then keep
the same dimensions and palette.
