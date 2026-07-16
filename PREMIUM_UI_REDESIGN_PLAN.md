# Premium UI Redesign Plan

All premium UI redesign work is developed on the `changes` branch. The `main` branch must remain unchanged until the complete redesign is manually reviewed and explicitly approved for merging.

## Required order and checkpoints

1. Complete Phase 1 before Phase 2.
2. Review Phase 2 before Phase 3.
3. Review Phase 3 before Phase 4.
4. Keep Phase 4 stable before Phase 5.

Every phase has its own implementation prompt, focused tests, desktop QA, mobile QA, accessibility QA, commit, push to `changes`, and manual review checkpoint.

## Phase 1 — Shared Premium Design System

Create one visual language: midnight-navy application shell, warm ivory physical board surfaces, muted metallic-gold primary actions, property colours only for asset identity, emerald success, rose debt/danger, slate inactive states, shared typography/spacing scales, button hierarchy, card/panel styles, focus states, shadows, borders, SVG icons, tabular cash/timer numbers, and reduced-motion support.

Constraints: no gameplay or server changes, no dependency changes unless essential, no neon/casino styling, and no emojis as core UI icons.

**Status: implemented on `changes` and awaiting local manual review.** The Phase 1 showcase is available only in development at `/dev/design-system`; it is not linked from gameplay or exposed in production navigation.

## Phase 2 — Entry and Multiplayer Lobby Experience

Redesign home, local play, private-room creation/join, token and game-mode selection, room code, invite link/optional QR code, player manifest, host controls, ready/connection/reconnect states, and Start Game. Use a luxury world-travel club/private departure-lounge direction with boarding-pass room codes and SVG token medallions. Cover responsive desktop and mobile layouts while reducing empty desktop space.

**Status: implemented on `changes` and awaiting local manual review.** Phase 2 uses the shared entry shell, premium token medallions, boarding-pass room identity, factual connection states, and the existing host-authoritative start flow. It adds no Ready system or room protocol changes.

Phase 2 correction: non-hosts now see an explicitly non-authoritative waiting summary while the host selects pending rules locally; local setup now uses the shared native-radio token medallions and dark rules panel.

## Phase 3 — Desktop Game Shell

Preserve the warm physical board while redesigning the dark command dock, current-turn panel, dice and landing controls, action toolbar, trade/mortgage/property-management access, timeline, compact roster, expandable player details, board frame, and ownership/mortgage/house/hotel indicators. Improve board-centre events without obstructing the board. Do not redesign auction/trade logic or board positions/rules.

**Status: implemented on `changes` and awaiting local manual review.** Desktop uses a warm framed board stage beside a dark command dock at the existing `xl` breakpoint; mobile structure and gameplay conditions remain unchanged.

## Phase 4 — Mobile Information Architecture

Make play board-first with a sticky current-turn bar and contextual action dock. Provide Board, Actions, Players and Log navigation; compact player rows; player/property detail sheets; compact asset cards; responsive auction/trade integration; safe-area handling; no horizontal overflow; and 44px minimum touch targets. Reduce mobile player-panel height substantially so actions are never buried below long cards.

## Phase 5 — Premium Motion, Sound and World-Travel Identity

After structure is stable, add restrained token movement, property/rent/auction/trade/jail/bankruptcy presentations, completed-country passport stamps, travel route lines, airport network visualization, optional muted sound effects, a premium game-start sequence, and an end-game world-empire summary. Respect `prefers-reduced-motion`; no default confetti, continuous music, excessive animation, or gameplay delays.

## BRANCH POLICY

1. Always begin by switching to `changes`.
2. Pull the latest `origin/changes`.
3. Never implement premium redesign work directly on `main`.
4. Never merge into `main` unless the user explicitly requests it.
5. Push every redesign commit to `origin/changes`.
6. Keep commits separated by phase.
7. Do not force-push.
8. Do not delete either branch.
9. Run typecheck, lint, build, and tests before every push.
10. The user will run the `changes` branch locally before approving a merge.

### Standard start

`cd /Users/kb4086/Desktop/monopoly && nvm use 20 && git switch changes && git pull --ff-only origin changes && git status --short`

### Standard final checks

`rm -rf .next && npm run typecheck && npm run lint && npm run build && npm test`
