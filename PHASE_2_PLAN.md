# Phase 2 Plan: Local Game Engine

## Tooling Fix Status

Local Next.js tooling was repaired before Phase 2C work began:

* `npm run dev` had been hanging after printing `next dev`, and the app was not reachable at `http://localhost:3000`.
* The cause was accidental home-level Node project files at `/Users/kb4086/package.json` and `/Users/kb4086/package-lock.json`, which confused Next.js workspace-root detection.
* Those files were safely moved to `/Users/kb4086/home-node-backup/package.json` and `/Users/kb4086/home-node-backup/package-lock.json`.
* Project dependencies were reinstalled inside `/Users/kb4086/Desktop/monopoly`.
* The local project was temporarily pinned to `next@15.2.4`, `react@19.0.0`, and `react-dom@19.0.0`.
* After that, `npm run dev` started successfully and the app loaded at `http://localhost:3000`.
* `next@15.2.4` shows a security warning, which is acceptable for local private development for now, but Next.js should be upgraded before any public deployment.

## Phase 2A Implementation Status

Completed:

* Preserved the Phase 1 board UI, property card modal, board data, airports, utilities, and responsive layout.
* Replaced mock static player usage in the main game with reducer-backed local game state.
* Added TypeScript types for `GameState`, `GamePhase`, `GameAction`, `DiceRoll`, and `GameLogEntry`.
* Added a setup screen for 2 to 6 local players.
* Added unique token selection during setup.
* Starts each player at GO with $1,500.
* Tracks current player index, dice result, rolled state, doubles count, landing message, game log, positions, cash, jail status, and bankruptcy status.
* Added dice rolling with two 1-6 dice, total, and doubles detection.
* Added token movement around the 40-space board with wrapping.
* Added $200 GO salary for normal dice movement that passes or lands on GO.
* Added turn ending after non-double rolls.
* Added doubles tracking and allows another roll after doubles.
* Added three-doubles foundation: player moves directly to Jail, `isInJail` is set, doubles count resets, and the turn advances.
* Added simple landing messages.
* Updated player panels to use live game state and show current-player status.
* Added a visible recent game log.

## Intentionally Not Implemented Yet

* Buying cities
* Declining cities
* Auctions
* Rent
* Taxes
* Chance card actions
* Community Chest card actions
* Full Jail exit logic
* Bankruptcy resolution
* Houses
* Hotels
* Mortgages
* Unmortgages
* Trades
* Multiplayer
* Socket.IO
* Database
* Redis
* Authentication

## Next Recommended Task

Implement Phase 2B: landing resolution for unowned ownable spaces and taxes. Add buy/skip decision state for cities, airports, and utilities, apply Income Tax and Luxury Tax payments, and keep auctions/rent/cards/jail exit logic deferred unless explicitly requested.

## Phase 2B Implementation Status

Completed:

* Added ownership state for all ownable spaces: cities, airports, Electric Company, and Water Works.
* Ownership records track `spaceIndex`, nullable `ownerId`, `isMortgaged`, `houses`, and `hasHotel`.
* Added landing resolution after dice movement.
* Added `readyToRoll`, `awaitingPurchaseDecision`, `turnComplete`, and `gameOver` phase names to support clearer local turn flow.
* Added a landing action panel for unowned ownable spaces.
* Added Buy and Decline actions for cities, airports, and utilities.
* Buying deducts the property price, assigns ownership, updates player-owned asset arrays, and logs the purchase.
* Declining logs that auctions will be added later and does not start an auction yet.
* Added owned-property landing messages without rent payment.
* Added own-property landing messages.
* Implemented Income Tax and Luxury Tax cash deductions.
* Added negative-cash tax logging note while bankruptcy remains deferred.
* Added basic special-space landing messages for GO, Jail / Just Visiting, Free Parking, Chance, and Community Chest.
* Implemented Go To Jail landing behavior by moving the player to position 10 and setting `isInJail`.
* Updated player panels to derive owned assets from ownership state.
* Updated property card modal owner display to use ownership state.

Intentionally not implemented yet:

* Auctions
* Rent payment
* Chance card effects
* Community Chest card effects
* Full Jail exit logic
* Bankruptcy resolution
* Houses
* Hotels
* Mortgages
* Unmortgages
* Trades
* Multiplayer
* Socket.IO
* Database
* Redis
* Authentication

Known limitations:

* Declining a property only logs the future auction behavior; no auction UI or transfer happens yet.
* Landing on owned property does not charge rent yet.
* Tax can make player cash negative; bankruptcy handling is intentionally deferred.
* Chance and Community Chest only show placeholder messages.
* Jail exit behavior is not implemented.

Next recommended task:

Implement Phase 2C: rent payment foundation for owned cities, airports, and utilities. Keep auctions, cards, full jail exit logic, houses, hotels, mortgages, trades, bankruptcy resolution, and multiplayer deferred unless explicitly requested.

## Phase 2C Implementation Status

Completed:

* Added pure rent calculation helpers in `src/lib/game/rent.ts`.
* Added city rent support for base rent, full-color-group doubled rent, houses, hotel, and mortgaged properties.
* Added airport rent support using classic railroad-style rent based on airports owned.
* Added utility rent support using dice total and utility ownership count.
* Updated landing resolution so rent is transferred automatically when landing on another player's owned city, airport, or utility.
* Added no-rent handling for mortgaged properties.
* Added no-rent handling when a player lands on their own property.
* Allows payer cash to go negative and logs that bankruptcy handling will be added later.
* Updated landing action UI to show rent amount, payer, owner, post-payment cash values, and deferred bankruptcy note when needed.
* Updated property card modals to show mortgage status.
* Preserved existing Buy / Decline, tax, Go To Jail, doubles, setup, board, player panel, and property modal behavior.

Intentionally not implemented yet:

* Auctions
* Chance card effects
* Community Chest card effects
* Full Jail exit logic
* Bankruptcy resolution
* Houses
* Hotels
* Mortgages
* Unmortgages
* Trades
* Multiplayer
* Socket.IO
* Database
* Redis
* Authentication

Known limitations:

* Rent logic supports houses, hotels, and mortgages from state, but there is still no UI/action to add houses, hotels, or mortgages.
* Bankruptcy is not resolved when rent pushes a player below zero.
* Rent payment is automatic after landing; there is no confirmation step.
* There is no auction fallback after declining a purchase yet.

Next recommended task:

Implement Phase 2D: auction foundation for declined unowned properties, keeping cards, full Jail exit logic, bankruptcy, houses, hotels, mortgages, trades, and multiplayer deferred.

## Phase 2D Implementation Status

Completed:

* Added `AuctionState`, `AuctionStatus` TypeScript types to `src/types/game.ts`.
* Added `auction: AuctionState | null` field to `GameState`.
* Added `"auction"` to `GamePhase` union.
* Added `PLACE_BID` and `PASS_AUCTION` actions to `GameAction`.
* Changed `DECLINE_PROPERTY` reducer case to start a local auction for all non-bankrupt players instead of logging a placeholder message.
* Implemented full pass-and-play auction bidding logic in `gameReducer.ts`:
  * Players cycle through in order, each can bid or pass.
  * Bid must exceed current high bid and not exceed bidder's cash.
  * Minimum next bid is current bid + $10.
  * Passing removes a player from the auction permanently.
  * When only the high bidder remains, the auction resolves immediately (winner pays, gets ownership).
  * When all players pass without any bid, property remains unowned.
  * After auction resolves, turn correctly resumes: `readyToRoll` if doubles were rolled, `turnComplete` otherwise.
* Added `resolveAuctionWin` helper that deducts winning bid, assigns ownership, and clears auction state.
* Created `src/components/AuctionPanel.tsx` showing:
  * Property name, type, list price.
  * Current high bid and high bidder.
  * Players still bidding vs. players who passed.
  * Current bidder's name and cash.
  * Quick-bid buttons (minimum, +$50, +$100, +$200 increments).
  * Custom bid input field.
  * Pass button.
* `AuctionPanel` is rendered in `GameLayout` between `GameControls` and `LandingActionPanel`.
* `GameControls` shows "Auction in progress" status and Roll Dice / End Turn remain disabled while auction phase is active.
* Game log entries added for: auction started, player bid, player passed, auction won, no-bid result.

Intentionally not implemented yet:

* Chance card effects
* Community Chest card effects
* Full Jail exit logic
* Bankruptcy resolution
* Houses
* Hotels
* Mortgages
* Unmortgages
* Trades
* Auction timers
* Multiplayer
* Socket.IO
* Database
* Redis
* Authentication

Known limitations:

* Bidding order starts at activeBidderIds[0] (first non-bankrupt player), not necessarily the player who declined. Classic Monopoly typically starts with the player to the left of the decliner — this is a known simplification.
* Bankruptcy is not enforced; a player at $0 can technically still participate in an auction (they cannot bid more than their cash, which is enforced, but negative cash from prior rent is not blocked).
* No visual indicator on board spaces for "auction in progress."

Next recommended task:

Implement Phase 2E: Jail exit logic — allow players in Jail to pay $50, use a Get Out of Jail Free card, or roll doubles to escape on their turn.


## UI Polish Sprint 1 Status

Completed visual improvements:

* **globals.css**: Refined diamond-pattern background, improved system font stack with antialiasing, CSS variable for board colors.
* **app/layout.tsx**: Updated page title to "World Cities — Private Board Game."
* **GameBoard**: Removed placeholder "Phase 2A" text from board center. Added country flag row and tagline. Improved board shadow and border.
* **BoardSpace**: Wider city color bands using `clamp()` for responsive sizing. Airport and utility accent bars. Emoji markers for special spaces (✈, ⚡, 💧, 👮, 🅿️, ?, 📦). Better text sizing throughout. Amber hover tint on ownable spaces.
* **PlayerToken**: Slightly larger tokens with stronger border and shadow for better visibility.
* **GameLayout**: Cleaner spacing, conditional AuctionPanel (only visible during auction phase), Live badge updated to pill style.
* **GameControls**: Player-color left border accent, large cash display, dice shown as visual squares, Roll Dice as primary full-width button, status messages with contextual colors (amber for decisions, blue for doubles, emerald for ready).
* **LandingActionPanel**: Color-coded by action type — blue for purchase, red for rent, neutral for messages. Green Buy button, secondary Decline button.
* **AuctionPanel**: Cleaner amber header, player status pills (amber = bidding, emerald = leading, gray strikethrough = passed), better bid controls.
* **PlayerPanel**: Player-color left accent border for current player, cash prominently displayed in header, minimal stats row, expandable asset section with "No properties owned" fallback. Jail status with emoji.
* **PropertyCardModal**: City cards get a full-color header band with white title and price. Airport/utility cards use clean header. Owner banner with 🏠/🏳️. Backdrop blur overlay. Better rent tables with rounded borders.
* **GameLog**: Divided list with dot indicator — green for latest, gray for older. Compact time stamp below each entry. Latest entry highlighted with bolder text.
* **GameSetup**: Redesigned as centered page with brand header and country flags. Per-player color accent border. Token labels include emoji. Better spacing and button styling.

Gameplay intentionally not changed:

* All reducer logic (dice, movement, buying, declining, auctions, rent, taxes, Go To Jail)
* All game state types
* All game log content
* Player setup flow and validation
* All board space data

Known UI limitations:

* No Framer Motion animations (not installed); transitions are CSS only.
* Board space text sizing uses `clamp()` inline styles; Tailwind JIT cannot purge these.
* No board space ownership color overlay on the board (property color is only shown in the modal).
* Mobile layout is functional but not fully optimized for small screens below 390px.

Next recommended task:

Phase 2E: local MVP rules completion, including Jail exit logic, Chance/Community Chest cards, bankruptcy-lite, and winner detection.

## Phase 2E Implementation Status

Completed:

**1. Full Jail exit logic**
* Players in Jail start their turn in `awaitingJailDecision` phase.
* `JailActionPanel` shows three options: Pay $50, Use Get Out of Jail Free card, Roll for Doubles.
* `PAY_JAIL_FEE` action deducts $50, releases player, sets phase to `readyToRoll` for a normal roll.
* `USE_JAIL_CARD` action decrements `getOutOfJailFreeCards`, releases player, returns card to bottom of chance deck.
* `ROLL_IN_JAIL` action:
  * Doubles: released, moved by dice total, landing resolved, no extra roll granted (Monopoly rule).
  * Non-doubles on attempt 1 or 2: `jailTurns` incremented, turn ends.
  * Non-doubles on attempt 3: forced $50 charge, released, moved by dice total, landing resolved.
* `withNextTurn` now sets phase to `awaitingJailDecision` if next player is in jail.
* All jail actions add game log entries.

**2. Chance and Community Chest card effects**
* `src/data/cards.ts` — all 16 Chance and 17 Community Chest cards defined.
* `src/lib/game/cards.ts` — `drawAndApplyCard` and `applyCardEffect` implement all card categories:
  advance-go, advance-to, advance-nearest-airport, advance-nearest-utility, go-back-3, go-to-jail,
  collect-bank, pay-bank, collect-each-player, pay-each-player, get-out-of-jail-free, repairs.
* Decks are shuffled on game start; normal cards return to bottom after use.
* Get Out of Jail Free cards stay out of deck while held; returned to bottom of chance deck when used.
* `gameReducer` calls `drawAndApplyCard` after landing on Chance or Community Chest.
* Card movement (advance-to, nearest airport/utility, go-back-3) resolves landing on destination; no chain draw if destination is another card space.
* `CardPanel` component shows drawn card text and resolved message.

**3. Bankruptcy-lite and winner detection**
* `src/lib/game/bankruptcy.ts` — `checkBankruptcy` marks any player with cash < 0 as bankrupt and detects winner.
* `checkBankruptcy` is called by the reducer after: every dice roll landing, jail roll, jail fee, auction win.
* Card handlers that cause cash loss also call `checkBankruptcy`.
* Bankrupt players are skipped in turn order, cannot buy, cannot bid above their cash.
* When only one non-bankrupt player remains, phase becomes `gameOver`, `winnerId` is set.
* Game-over banner shown in `GameLayout` with winner name.
* All buttons disabled when `gameOver`.
* Player panels show `Bankrupt` badge and reduced opacity.
* Bankruptcy and winner events are logged.

Intentionally simplified:

* Advance-nearest-airport cards charge normal airport rent, not the "double rent" stated on the classic card. Noted as a known simplification.
* Get Out of Jail Free card always returns to the chance deck regardless of which deck it was drawn from (no per-card deck tracking).
* No official asset liquidation, mortgage, property transfer, or auctioning of bankrupt player's assets.
* Bankrupt player's owned properties remain in their name (orphaned, uncollectable).
* Only one GOJF card per source deck can theoretically circulate; if drawn again it goes back in, no duplicate guard needed for MVP.

Known limitations:

* Advancing to the nearest airport or utility via card charges normal rent, not the doubled/multiplied rate stated on classic Monopoly cards.
* No animation for card draws or bankruptcy events.
* Mobile layout unchanged from UI Polish Sprint 1.

Next recommended task:

Phase 3A: houses, hotels, mortgages, trades, and official bankruptcy improvements (asset transfer on bankruptcy, auction of bankrupt assets, full property upgrade UI).

## Phase 2F Stabilization Status

### What was broken

* `npm run dev` failed with `TypeError: (0 , _env.loadEnvConfig) is not a function` — a known incompatibility between Node.js v22 and next@15.2.4.
* `node_modules` was in a corrupted/partially-deleted state with duplicate directories named with spaces (e.g., `@eslint 2`, `@typescript-eslint 2`). The `next` binary was missing from `node_modules/.bin`.
* `npm run lint` and `npm run build` were failing due to the Node 22 / toolchain mismatch, not source code errors.
* `rm -rf node_modules` failed to complete due to locked/extended-attribute files.

### Root cause identified

Node.js v22.21.1 is incompatible with next@15.2.4. Additionally, a prior partial install/delete left `node_modules` in a state with many duplicate directories and missing binaries. The `package.json` was using `^` (caret) version ranges, allowing `eslint-config-next@15.3.4` to be installed while `next` remained at `15.2.4`.

### Cleanup performed

1. Stopped all Next/TypeScript/ESLint processes.
2. `rm -rf node_modules` could not complete — renamed the corrupted directory to `node_modules_broken_<timestamp>` instead.
3. Removed `.next` and `package-lock.json`.
4. Ran `npm cache clean --force`.
5. Switched to Node.js v20.19.5 via `nvm use 20`.
6. Created `.nvmrc` file with `20` to pin the project to Node 20 going forward.
7. Pinned all `package.json` version strings to exact versions (removed `^` caret ranges) to prevent future drift. Key change: `eslint-config-next` aligned from `^15.3.4` to `15.2.4` to match `next@15.2.4`.
8. Ran `npm install` cleanly — 366 packages installed.
9. Queued async cleanup of the `node_modules_broken_*` directory.

### Node / npm / dependency versions confirmed

* Node: v20.19.5
* npm: v10.8.2
* `next@15.2.4` with `@next/env@15.2.4` (consistent — confirmed with `npm ls next @next/env`)
* `eslint-config-next@15.2.4` (now matches `next@15.2.4`)
* `@types/node@20.17.57` (aligned to Node 20 instead of 22)

### Checks run (all with Node 20)

* `npm run typecheck` — ✅ passes
* `npm run lint` — ✅ passes (was crashing under Node 22; now clean)
* `npm run build` — ✅ passes, production build succeeds, 4 static pages generated
* `npm run dev` — ✅ reached `Ready in 1064ms`

### Phase 2E source code

No Phase 2E game logic was changed during stabilization. Only `package.json` and `.nvmrc` were changed.

### Known remaining issues

* `next@15.2.4` has a known security vulnerability (CVE-2025-66478). Acceptable for local private dev. Upgrade before any public deployment.
* `node_modules_broken_<timestamp>` directory may still exist on disk; it is safe to delete manually with `rm -rf node_modules_broken_*` once the async cleanup finishes.

### How to run going forward

Always use Node 20 for this project. If your shell does not auto-load `.nvmrc`, run:

```bash
nvm use 20
npm run dev
```

## Phase 2G Automated Test Suite Status

### What was added

- **Test framework:** Vitest 4.1.8 (ESM, node environment), added to `devDependencies` with exact version pin
- **Config:** `vitest.config.ts` — sets `environment: "node"`, `globals: true`, resolves `@/` path alias to `./src`
- **Scripts:** `"test": "vitest run"` and `"test:watch": "vitest"` added to `package.json`

### Test files created

| File | Area | Tests |
|------|------|-------|
| `src/__tests__/helpers/factory.ts` | Test factories and helpers | (shared) |
| `src/__tests__/board.test.ts` | Board data integrity | ~20 |
| `src/__tests__/gameReducer.setup.test.ts` | Game initialization | 16 |
| `src/__tests__/movement.test.ts` | Board movement logic | 8 |
| `src/__tests__/gameReducer.landing.test.ts` | ROLL_DICE, BUY_PROPERTY, END_TURN | 19 |
| `src/__tests__/rent.test.ts` | Rent calculation (city/airport/utility) | 16 |
| `src/__tests__/auction.test.ts` | Auction flow | 14 |
| `src/__tests__/cards.test.ts` | Card data and all card effects | 43 |
| `src/__tests__/jail.test.ts` | Jail entry and all exit paths | ~20 |
| `src/__tests__/bankruptcy.test.ts` | Bankruptcy and winner detection | ~24 |
| `src/__tests__/regression.test.ts` | Tooling / dependency regression | 10 |
| **Total** | | **196** |

### Commands run (all on Node 20)

- `npm run typecheck` — ✅ passes
- `npm run lint` — ✅ passes
- `npm run build` — ✅ passes
- `npm test` — ✅ 196/196 tests pass, 10 test files

### Areas intentionally left as manual testing

- UI rendering (GameLayout, GameBoard, CardPanel, JailActionPanel, etc.)
- Visual layout and responsive design
- Mortgage / trade / house-buying (not yet implemented)

### Known gaps

- Utility rent via `ROLL_IN_JAIL` path not tested end-to-end
- Auction tie-breaking (same bid from two players) not tested

### See also

`TEST_PLAN.md` — full test plan with per-file breakdown, coverage notes, and known gaps.

## Phase 2H Automated QA Simulation Status

### Automated integration flows added

New file: `src/__tests__/gameFlow.integration.test.ts` — 23 tests across 10 flows.

| Flow | Description | Tests |
|------|-------------|-------|
| 1 | Buy property then collect rent (end-to-end) | 1 |
| 2 | Decline property and win at auction | 2 |
| 3 | Tax deduction (luxury, income) and bankruptcy-lite | 4 |
| 4 | Chance card movement via reducer | 2 |
| 5 | Community Chest money card via reducer | 2 |
| 6 | Go To Jail landing + PAY_JAIL_FEE exit + normal roll after | 3 |
| 7 | Roll doubles in jail to escape | 1 |
| 8 | Third failed jail roll forces $50 release | 2 |
| 9 | Winner detection via reducer and checkBankruptcy | 3 |
| 10 | State invariant stability across 12-step sequence + rolling loop | 2 |
| **Total** | | **22** |

### Invariant helpers added (inside test file)

- `assertValidGameState(state, label)` — checks currentPlayerIndex bounds, phase validity, all player positions in [0,39], cash is finite number, no auction outside auction phase, all ownership ownerIds point to real players

### Bugs found during Phase 2H

**One real behavior clarified (not a bug):** Landing on Go To Jail space does NOT auto-advance the turn. The player is jailed and phase becomes `turnComplete`; they must click END_TURN. Only triple-doubles jail auto-advances via `withNextTurn`. This is correct Monopoly behavior (the jailed player still "ends" their turn explicitly).

### Bugs fixed

None — the reducer was correct. The one failing test was an incorrect test assertion (expected turn auto-advance; corrected to match actual Monopoly-correct behavior).

### Tests added

- 22 new integration tests in `gameFlow.integration.test.ts`
- Total test count: **218** (was 196)

### Tests changed

None — no existing test assertions were weakened or changed.

### Commands run (all on Node 20)

- `npm run typecheck` — ✅ passes
- `npm run lint` — ✅ passes
- `npm run build` — ✅ passes
- `npm test` — ✅ 218/218 tests pass, 11 test files

### Remaining known limitations

- Auction bidding order always starts from activeBidderIds[0] (player 0), regardless of who declined. This is a UX quirk but not a bug.
- No end-to-end test for the USE_JAIL_CARD flow (covered by unit tests in jail.test.ts).
- No multi-player (3–6) integration flows; unit tests in bankruptcy.test.ts cover the 3-player case.
- UI rendering (GameLayout, JailActionPanel, CardPanel) remains untested — requires a browser.

### Next recommended task

`Phase 3A: Houses, hotels, mortgages, trades, and official bankruptcy asset transfer`
