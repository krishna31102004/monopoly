# TEST_PLAN.md — World Cities Monopoly

## Test Framework

- **Tool:** Vitest 4.1.8 (ESM mode, node environment)
- **Config:** `vitest.config.ts` (path alias `@/` → `./src`)
- **Run:** `nvm use 20 && npm test`
- **Watch:** `npm run test:watch`

## Test Files and Coverage

### `src/__tests__/board.test.ts` (board data)
- 40 spaces with indices 0–39
- Correct special spaces: GO(0), Jail(10), Free Parking(20), Go To Jail(30)
- Chance at 7, 22, 36 — Community Chest at 2, 17, 33
- Taxes at 4 (income) and 38 (luxury)
- Utilities at 12 and 28
- Airports at 5, 15, 25, 35 with correct rent structure
- All 8 city color groups with correct cities and countries
- Rent arrays have correct length (6: base + 4 houses + hotel)

### `src/__tests__/gameReducer.setup.test.ts` (game initialization)
- 2-player and 6-player game setup
- All players start at position 0 with $1500 cash
- `isInJail=false`, `jailTurns=0`, `getOutOfJailFreeCards=0`, `isBankrupt=false`
- All properties start unowned
- Both decks initialized and non-empty
- Game log has at least one entry
- All player IDs are unique
- Phase is `readyToRoll`, `winnerId` is null, `drawnCard` is null

### `src/__tests__/movement.test.ts` (board movement)
- `moveAroundBoard`: forward movement, wrapping past 40
- Landing exactly on GO → position 0
- `passedGo` flag set correctly when wrapping, not set when not wrapping
- No movement for 0 steps
- Staying at same position with 0 steps

### `src/__tests__/gameReducer.landing.test.ts` (ROLL_DICE, BUY_PROPERTY, END_TURN)
- **ROLL_DICE:** moves by dice total, GO salary (+$200), no salary without passing GO, landing on GO (+$200), income tax (-$200), luxury tax (-$100), doubles tracking, three doubles → jail, dice state stored
- **BUY_PROPERTY:** unowned city → purchase decision, buy deducts price + assigns owner, decline → auction, own property → no rent
- **END_TURN:** advances to next player, resets dice/doubles/hasRolled, ignored when not `turnComplete`, skips bankrupt players

### `src/__tests__/rent.test.ts` (rent calculation)
- **City rent:** base rent without full color group, doubled when full group owned, house rent by count, hotel rent, mortgaged = $0
- **Germany group:** 3-city full group doubles rent correctly
- **Airport rent:** 1 airport = $25, 2 = $50, 3 = $100, 4 = $200, mortgaged = $0
- **Utility rent:** 1 utility × 4 dice, 2 utilities × 10 dice, mortgaged = $0
- **Cash transfer via reducer:** payer loses, owner gains, log entry created

### `src/__tests__/auction.test.ts` (auction flow)
- Decline starts auction with all non-bankrupt players
- Bankrupt players excluded from auction
- Invalid bids (too low, negative) rejected
- Valid bid accepted, updates highBid + highBidder
- PASS_AUCTION removes bidder; everyone passes → property stays unowned
- Last remaining bidder wins, bid deducted from cash, ownership transferred
- Auction cleared after win, turn resumes, log entries created

### `src/__tests__/cards.test.ts` (card data and effects)
- **Deck data:** 16 chance cards, 17 community chest cards, required fields on each, GOJF in both decks, all IDs unique
- **nearestAirport/nearestUtility:** correct target from various positions including wrap-around
- **Advance to GO (chance-1):** position → 0, +$200 if not already at GO
- **Advance to specific space (chance-2):** correct position, GO salary if passing, no salary if not passing
- **Advance to nearest airport (chance-4):** correct from two positions
- **Advance to nearest utility (chance-6):** correct from two positions
- **Go Back 3 (chance-9):** -3 spaces, wraps past position 0
- **Go To Jail (chance-10):** position 10, `isInJail=true`, phase `turnComplete`
- **Collect from bank (chance-7):** cash +$50, card to deck bottom
- **Pay bank (chance-12):** cash -$15
- **Collect from each player (cc-7):** $50 from each other player, collector receives total
- **Pay each player (chance-14):** $50 to each other player, payer loses total
- **GOJF (chance-8):** increments `getOutOfJailFreeCards`, stays out of deck
- **Repair card (cc-15):** $0 with no buildings, $40/house
- **Phase behavior:** `drawnCard` set after draw, `turnComplete` after non-double, `readyToRoll` after double, no chain-draw on card space landing

### `src/__tests__/jail.test.ts` (jail mechanics)
- **Go To Jail space (30):** position → 10, `isInJail=true`
- **PAY_JAIL_FEE:** -$50, releases from jail, `jailTurns=0`, phase `readyToRoll`, log entry, ignored in wrong phase
- **USE_JAIL_CARD:** releases, decrements card count, phase `readyToRoll`, ignored if no card, card returned to deck, log entry
- **ROLL_IN_JAIL doubles:** releases, moves by total, `doublesCount=0` (no extra roll), `jailTurns=0`
- **ROLL_IN_JAIL non-doubles:** increments `jailTurns`, `turnComplete` (2 attempts); 3rd failure forces $50 fee + release + move
- **ROLL_IN_JAIL ignored** when phase is not `awaitingJailDecision`

### `src/__tests__/bankruptcy.test.ts` (bankruptcy and winner detection)
- **checkBankruptcy:** marks bankrupt at cash < 0, not at exactly $0, log entry, winner when 1 active remains, winner log, no trigger with multiple remaining, no re-bankrupt of already-bankrupt
- **Via reducer:** bankrupt player skipped in turn order, ROLL_DICE/END_TURN ignored in `gameOver`, `winnerId` set, properties remain orphaned
- **3-player scenarios:** game continues with 2 remaining, game over with 1 remaining

### `src/__tests__/regression.test.ts` (tooling and dependency integrity)
- `.nvmrc` starts with "20"
- No `^` or `~` in any `package.json` dependency
- `eslint-config-next` version matches `next` version
- `next@15.2.4`, `react@19.0.0`
- `vitest` in `devDependencies`, `test` script present
- Module load: `boardSpaces`, `gameReducer`, `createInitialGameState` all load without error

## Test Totals

| File | Tests |
|------|-------|
| board.test.ts | ~20 |
| gameReducer.setup.test.ts | 16 |
| movement.test.ts | 8 |
| gameReducer.landing.test.ts | 19 |
| rent.test.ts | 16 |
| auction.test.ts | 14 |
| cards.test.ts | 43 |
| jail.test.ts | ~20 |
| bankruptcy.test.ts | ~24 |
| regression.test.ts | 10 |
| gameFlow.integration.test.ts | 22 |
| propertyDevelopment.test.ts | 21 |
| mortgage.test.ts | 24 |
| trade.test.ts | 34 |
| bankruptcyResolution.test.ts | 38 |
| persistence.test.ts | 36 |
| finalStateSafety.test.ts | 16 |
| multiplayerRooms.test.ts | 28 |
| multiplayerActions.test.ts | 11 |
| multiplayerLanConfig.test.ts | 16 |
| multiplayerReconnect.test.ts | 18 |
| deploymentConfig.test.ts | 31 |
| **Total** | **491** |

## Integration / Playthrough Coverage (Phase 2H)

`src/__tests__/gameFlow.integration.test.ts` exercises 10 multi-step reducer flows end-to-end:

| Flow | Scenario |
|------|----------|
| 1 | Buy property → opponent lands → rent transfers |
| 2 | Decline property → auction → bid → pass → winner gains ownership |
| 3 | Luxury tax, income tax, bankruptcy-lite, gameOver blocked actions |
| 4 | Chance advance-to-GO card draws correctly, no chain-draw |
| 5 | Community Chest collect-bank and pay-bank cards via reducer |
| 6 | Go To Jail landing → END_TURN required → PAY_JAIL_FEE exit → normal roll |
| 7 | ROLL_IN_JAIL doubles → release, move, no extra roll |
| 8 | Third failed jail roll → forced $50, release, move |
| 9 | Winner detection via reducer and checkBankruptcy directly |
| 10 | 12-step sequence with assertValidGameState after each step; rolling loop |

### Invariant helpers

`assertValidGameState(state, label)` — validates currentPlayerIndex bounds, phase, all positions in [0,39], cash is finite, auction only exists during auction phase, all ownerIds point to real players.

## Phase 3A Property Development Coverage

`src/__tests__/propertyDevelopment.test.ts` (21 tests):
- `canBuyHouse`: no house without full group, yes with full group, deducts cash, increments houses, even-building rule, 4-house cap, mortgaged group blocked, insufficient cash blocked
- `canSellHouse`: adds half cost, decrements count, even-selling rule enforced
- `canBuyHotel`: requires exactly 4 houses, deducts cost, houses→0 hasHotel→true, mortgaged group blocked
- `canSellHotel`: returns half cost, hotel removed, reverts to 4 houses

`src/__tests__/mortgage.test.ts` (12 tests):
- Can mortgage owned unimproved city, mortgageValue added to cash
- Cannot mortgage: unowned, already mortgaged, has houses, has hotel, group has improvements elsewhere
- Can unmortgage, deducts ceil(mortgageValue × 1.1)
- Cannot unmortgage: unowned, not mortgaged, insufficient cash
- Rent = 0 on mortgaged property (via `calculateRent`)
- Rent increases correctly with houses and hotel

### `src/__tests__/multiplayerLanConfig.test.ts` (16 tests)
- `getSocketUrl()` uses `NEXT_PUBLIC_SOCKET_URL` when set
- `getSocketUrl()` returns localhost fallback in Node/SSR context
- `getSocketUrl()` derives URL from `window.location.hostname` (LAN IP)
- `getSocketUrl()` derives URL from `window.location.hostname` (localhost)
- `getSocketUrl()` respects `NEXT_PUBLIC_SOCKET_PORT` override
- Env var takes priority over window.location
- LAN CORS regex allows localhost, 127.0.0.1, 192.168.x.x, 10.x.x.x, 172.16-31.x.x
- LAN CORS regex blocks public IPs and unknown domains
- `package.json` has `dev:all` and `dev:lan` scripts; `dev:lan` binds to 0.0.0.0

### `src/__tests__/multiplayerReconnect.test.ts` (18 tests)
- Disconnected player can reconnect in lobby with saved playerId
- Reconnect restores correct player identity
- Unknown playerId falls through to new join
- Reconnect fails when room does not exist
- Reconnect after inactivity cleanup fails safely
- Disconnected player can rejoin a game in progress
- Game state still accessible after in-game reconnect
- New player cannot join an in-progress game
- Game state reflects latest action after apply (sync consistency)
- Invalid action does not mutate game state
- Reconnected current player can still act on their turn
- RoomPublicView includes per-player connected status
- RoomPublicView maxPlayers is 6
- Invite link can be constructed from roomCode
- takenTokens updated after each join
- Duplicate identity: second socket with same playerId replaces old socket

### `src/__tests__/deploymentConfig.test.ts` (31 tests)
- `isAllowedOrigin` dev mode: allows localhost, 127.0.0.1, 192.168.x.x, 10.x.x.x, blocks public IPs
- `isAllowedOrigin` production allowlist: accepts configured Vercel origin, rejects others, accepts multiple origins
- `parseAllowedOrigins`: returns null in dev, parses CLIENT_ORIGIN, parses comma-separated CLIENT_ORIGINS, priority, whitespace trim
- `getSocketUrl`: NEXT_PUBLIC_SOCKET_URL for production, localhost SSR fallback, LAN hostname derivation
- `render.yaml`: exists, specifies Node 20, references /health, sets NODE_ENV=production, CLIENT_ORIGIN marked manual
- No public room listing: RoomManager has no getAll/listRooms/getAllRooms method
- `package.json` has build, dev:all, dev:lan, server:dev scripts

## Intentionally Manual / Not Automated

- **UI rendering:** GameLayout, GameBoard, PlayerDashboard, CardPanel, JailActionPanel, PropertyCardModal management panel — require a browser
- **Full multiplayer / real-time:** not in scope (local pass-and-play only)
- **Visual regression:** not in scope
- **Airport/utility mortgaging:** fully wired as of Phase 3A.1
- **USE_JAIL_CARD integration flow:** covered by unit tests in `jail.test.ts`; not duplicated in integration tests

## Known Gaps

- Utility rent via reducer: dice values from `ROLL_IN_JAIL` path not tested end-to-end
- Auction tie-breaking (two bidders at same amount) not tested — current code accepts the last bid
- No 3–6 player integration flows; 3-player bankruptcy covered in `bankruptcy.test.ts`
- Mortgaged properties can be traded (recipient inherits the mortgage — no restriction)
- No official bankruptcy asset transfer (creditor does not receive properties)

## Commands

```bash
nvm use 20
npm run typecheck   # tsc --noEmit
npm run lint        # eslint src
npm run build       # next build
npm test            # vitest run (all 415 tests)
# Note: node_modules_broken_* must NOT exist inside the project directory.
# If present, Vitest will scan third-party test files and report false failures.
# Remove with: rm -rf node_modules_broken_*
npm run test:watch  # vitest (watch mode)
```
