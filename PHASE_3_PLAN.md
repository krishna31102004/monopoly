# Phase 3A: Houses, Hotels, and Mortgages

## Status: COMPLETE

## What was implemented

### New GameActions (src/types/game.ts)
- `BUY_HOUSE { spaceIndex: number }`
- `SELL_HOUSE { spaceIndex: number }`
- `BUY_HOTEL { spaceIndex: number }`
- `SELL_HOTEL { spaceIndex: number }`
- `MORTGAGE_PROPERTY { spaceIndex: number }`
- `UNMORTGAGE_PROPERTY { spaceIndex: number }`

### New helper module: src/lib/game/propertyDevelopment.ts
Pure precondition functions (accept `{ ownerships }` so they work in both reducer and UI):
- `canBuyHouse` — full color group, no mortgage in group, even-building rule, <4 houses, no hotel, cash check
- `canSellHouse` — owns property, has ≥1 house, no hotel, even-selling rule (can only sell from the property with the most houses)
- `canBuyHotel` — full color group, no mortgage in group, exactly 4 houses, no hotel already, cash check
- `canSellHotel` — owns property, has hotel; reverts to 4 houses
- `canMortgageProperty` — owns it, not already mortgaged, no houses/hotel on property, no improvements anywhere in group
- `canUnmortgageProperty` — owns it, is mortgaged, cash ≥ Math.ceil(mortgageValue * 1.1)

Also exported utilities: `getColorGroupSpaces`, `ownsFullColorGroup`, `groupHasMortgage`, `groupHasImprovements`

### Reducer cases (src/lib/game/gameReducer.ts)
Six new cases added at the end of the reducer, all guarded by `phase !== "gameOver"`:
- `BUY_HOUSE` — deducts houseCost, increments houses, logs
- `SELL_HOUSE` — returns Math.floor(houseCost/2), decrements houses, logs
- `BUY_HOTEL` — deducts houseCost, sets houses=0 hasHotel=true, logs
- `SELL_HOTEL` — returns Math.floor(houseCost/2), sets hasHotel=false houses=4, logs
- `MORTGAGE_PROPERTY` — adds mortgageValue to cash, sets isMortgaged=true, logs
- `UNMORTGAGE_PROPERTY` — deducts Math.ceil(mortgageValue*1.1), sets isMortgaged=false, logs

### Rent integration
No changes were needed to `src/lib/game/rent.ts`. It already reads `houses`, `hasHotel`, and `isMortgaged` from `PropertyOwnership` and applies correct rent at all stages. Verified by existing rent unit tests and new mortgage integration tests.

### UI (src/components/PropertyCardModal.tsx + src/components/GameLayout.tsx)
- `PropertyCardModal` accepts optional `currentPlayer?: Player` and `dispatch?: (action: GameAction) => void` props
- When current player owns the selected city, a "Manage Property" panel is shown with:
  - Buy House / Sell House / Buy Hotel / Sell Hotel / Mortgage / Unmortgage buttons
  - Each button disabled (with tooltip showing reason) when its precondition fails
  - Status badges showing current house count, hotel status, mortgaged status
- `GameLayout` updated to pass `currentPlayer` and `dispatch` to the modal

### Limitations
- Only city properties support houses/hotels. Airports and utilities do not have improvements. **Airport and utility mortgaging was wired in Phase 3A.1** (see below).
- The UI "Manage Property" panel only appears when the current player owns the property AND the modal has `dispatch` wired. It is correctly hidden for non-owners.
- No trade UI yet (Phase 3B).
- No official bankruptcy asset transfer (Phase 3B).
- Hotel sells revert to 4 houses regardless of house supply — simplification accepted for MVP.
- Even-building and even-selling rules are enforced per-property (most/fewest houses in group), not per bank supply.

## Tests added

| File | Tests | Coverage |
|------|-------|----------|
| `src/__tests__/propertyDevelopment.test.ts` | 21 | House buy/sell (preconditions, even-building, even-selling), hotel buy/sell, full color group requirement, mortgage checks, all `canX` functions |
| `src/__tests__/mortgage.test.ts` | 12 | Mortgage/unmortgage rules, 10% interest cost, rent=0 on mortgaged property, cannot mortgage with improvements, insufficient cash guard |

## Commands run (Node 20)

```bash
npm run typecheck   # ✅ pass
npm run lint        # ✅ pass
npm run build       # ✅ pass
npm test            # ✅ 251/251 tests, 13 files
```

## Test counts

| Phase | Tests | Files |
|-------|-------|-------|
| Before Phase 3A | 218 | 11 |
| After Phase 3A  | 251 | 13 |

All 218 pre-existing tests continue to pass unchanged.

## Next recommended task

**Phase 3B: Trades and official bankruptcy asset transfer**

Features to add:
- Player-to-player property trades (offer/accept/reject UI)
- Bankruptcy: force selling of houses/hotels at half price before properties are available to creditors
- Creditor receives mortgaged and unmortgaged properties when a player goes bankrupt
- Game log entries for all bankruptcy asset transfers

## Phase 3A.1 Mortgage Support Completion Status

### What was fixed

The `MORTGAGE_PROPERTY` and `UNMORTGAGE_PROPERTY` reducer cases previously guarded to `space.kind === "city"` and returned state unchanged for airports and utilities. This has been corrected.

### Airport mortgage support
- `canMortgageProperty` now accepts airports (index 5, 15, 25, 35; mortgageValue $100 each)
- `MORTGAGE_PROPERTY` adds $100 to player cash and sets `isMortgaged=true`
- `UNMORTGAGE_PROPERTY` deducts $100 + $10 interest = $110, sets `isMortgaged=false`
- Mortgaged airport correctly returns $0 rent (already handled by `rent.ts`)
- No improvement restrictions apply (airports have no houses/hotels)

### Utility mortgage support
- `canMortgageProperty` now accepts utilities (index 12 Electric Company, 28 Water Works; mortgageValue $75 each)
- `MORTGAGE_PROPERTY` adds $75 to player cash and sets `isMortgaged=true`
- `UNMORTGAGE_PROPERTY` deducts $75 + $8 interest = $83, sets `isMortgaged=false`
  - `ceil(75 / 10) = 8` (10% rounded up)
- Mortgaged utility correctly returns $0 rent (already handled by `rent.ts`)
- No improvement restrictions apply (utilities have no houses/hotels)

### City mortgage rules preserved
- All 6 existing city mortgage tests still pass unchanged
- City-specific restrictions remain: no houses/hotel, no group improvements

### Floating-point bug fixed
Using `Math.ceil(mortgageValue * 1.1)` produced `Math.ceil(110.00000000000001) = 111` for the $100 airport due to JavaScript floating-point arithmetic. Fixed by using integer arithmetic: `mortgageValue + Math.ceil(mortgageValue / 10)` everywhere (reducer, precondition helper, UI label). All three space kinds now produce correct results: 30→33, 75→83, 100→110.

### UI updated
- `PropertyCardModal.tsx`: airport and utility sections now show a "Manage Property" panel with Mortgage/Unmortgage buttons when the current player owns the property
- House/Hotel buttons are NOT shown for airports or utilities (cities only)
- Mortgage status badge shown for all three space kinds when mortgaged
- Button labels show correct cost (`mortgageValue + ceil(mortgageValue/10)`)

### Tests added
12 new tests added to `src/__tests__/mortgage.test.ts`:
- Airport: mortgage (ok, unowned, already mortgaged), unmortgage (ok, insufficient cash), rent=0
- Utility: mortgage (ok, unowned, already mortgaged), unmortgage (ok, insufficient cash), rent=0

### Commands run (Node 20)

```bash
npm run typecheck   # ✅ pass
npm run lint        # ✅ pass
npm run build       # ✅ pass
npm test            # ✅ 263/263 tests, 13 files
```

### Test counts

| Phase | Tests | Files |
|-------|-------|-------|
| Before Phase 3A.1 | 251 | 13 |
| After Phase 3A.1  | 263 | 13 |

### Known limitations

- Player-to-player trades still not implemented (Phase 3B)
- Official bankruptcy asset transfer still not implemented (Phase 3B)

## Phase 3B: Player-to-Player Trades

### Status: COMPLETE

### What was implemented

#### New types (src/types/game.ts)
- `TradeOffer { cash, propertySpaceIndices, getOutOfJailFreeCards }`
- `TradeState { initiatorPlayerId, recipientPlayerId, offerFromInitiator, offerFromRecipient }`
- `trade: TradeState | null` added to `GameState`
- 4 new `GameAction` variants: `PROPOSE_TRADE`, `ACCEPT_TRADE`, `DECLINE_TRADE`, `CANCEL_TRADE`

#### New helper module: src/lib/game/trade.ts
- `canTradeProperty(spaceIndex, offeringPlayerId, ownerships)` — verifies ownership, checks for improvements on city and its color group
- `validateTrade(state, initiatorId, recipientId, offerFromInitiator, offerFromRecipient)` — validates both sides: player existence, bankruptcy status, cash limits, GOJF limits, property ownership + improvement check, no property appearing on both sides

#### Reducer cases (src/lib/game/gameReducer.ts)
- `PROPOSE_TRADE` — validates with `validateTrade`, sets `state.trade`
- `ACCEPT_TRADE` — re-validates (cancels if stale), then executes: transfers cash/properties/GOJF for both players, logs the trade summary, clears `state.trade`
- `DECLINE_TRADE` — clears `state.trade`, logs decline message
- `CANCEL_TRADE` — clears `state.trade`, no log

#### Initial state (src/lib/game/createInitialGameState.ts)
`trade: null` added to both `createSetupGameState()` and `createInitialGameState()`.

#### UI (src/components/TradePanel.tsx + src/components/GameLayout.tsx)
- `TradePanel` added to sidebar, positioned between `LandingActionPanel` and `GameLog`
- **No trade pending**: shows "Propose Trade" button; when clicked opens a form with:
  - From/To player selectors (all non-bankrupt players)
  - Cash inputs with max bounds
  - GOJF card count input (shown only if player has cards)
  - Property checkboxes (checkboxes for each owned property)
  - Live validation message from `validateTrade`
  - "Send Offer" button (disabled when invalid), "Cancel" button
- **Trade pending**: shows initiator/recipient offers, Accept/Decline/Cancel buttons

### Validation rules enforced
- Cannot trade with yourself
- Cannot trade in `gameOver` phase
- Cash must be ≥ 0 and ≤ player's current cash
- GOJF count must be ≥ 0 and ≤ player's current cards
- Property must be owned by the offering player
- City properties: must have no houses/hotel, and no sibling in color group may have improvements
- Airport and utility: no improvement restrictions
- Same property index cannot appear on both sides

### Execution (on ACCEPT_TRADE)
- Both players' cash updated atomically (initiator gives offerFromInitiator.cash, receives offerFromRecipient.cash; vice versa for recipient)
- Properties transferred in `ownerships` array and in player `ownedCityIds`/`ownedAirportIds`/`ownedUtilityIds` arrays
- GOJF cards swapped
- `state.trade` cleared
- Log entry records what was traded

### Tests added (src/__tests__/trade.test.ts)
28 tests covering:
- `canTradeProperty`: non-ownable space, not owned, valid city, city with houses, city with sibling improvements, valid airport
- `validateTrade`: self-trade, gameOver, cash overcommit (initiator), cash overcommit (recipient), GOJF overcommit, GOJF ok, property on both sides, valid empty, valid cash-for-cash, valid property swap, unowned property offered, bankrupt initiator, bankrupt recipient
- `PROPOSE_TRADE`: valid proposal sets trade, invalid proposal no-ops, gameOver no-ops
- `CANCEL_TRADE`: clears trade, no-op when none pending
- `DECLINE_TRADE`: clears trade + logs, no-op when none pending
- `ACCEPT_TRADE`: no-op when none pending, cash transfer both ways, property initiator→recipient, property recipient→initiator, bidirectional property swap, GOJF transfer, stale trade cancelled at accept time, third player unaffected

### Commands run (Node 20)

```bash
npm run typecheck   # ✅ pass
npm run lint        # ✅ pass
npm run build       # ✅ pass
npm test            # ✅ 291/291 tests, 14 files
```

### Test counts

| Phase | Tests | Files |
|-------|-------|-------|
| Before Phase 3B | 263 | 13 |
| After Phase 3B  | 291 | 14 |

### Known limitations
- No mortgage restrictions: mortgaged properties can be traded (the recipient inherits the mortgage)
- No official bankruptcy asset transfer (creditor does not receive properties when a player goes bankrupt)

### Next recommended task

**Phase 3C: Trades and official bankruptcy asset transfer**

---

## Phase 3C: Official Bankruptcy Asset Transfer ✅

### What was implemented

1. **`BankruptcyCreditor` + `BankruptcyState` types** — added to `src/types/game.ts`
2. **`"bankruptcyPending"` GamePhase** — added to the union; `assertValidGameState` updated
3. **`checkBankruptcy` rewritten** — now creates a `bankruptcyPending` state instead of immediately marking players bankrupt; stores debtor, creditor, amount, reason, and `phaseBeforeBankruptcy`
4. **`DECLARE_BANKRUPTCY` action** — transfers properties/cash/GOJF to creditor player (bank: resets to unowned, clears improvements); marks debtor bankrupt; advances turn; checks winner
5. **`RESOLVE_BANKRUPTCY_IF_SOLVENT` action** — clears pending state and restores `phaseBeforeBankruptcy` when debtor's cash ≥ 0
6. **Creditor tracking** — `creditorFromLandingAction()` helper; `cards.ts` passes explicit creditor per payment type
7. **Guards** — `BUY_HOUSE`, `BUY_HOTEL`, `UNMORTGAGE_PROPERTY`, `PROPOSE_TRADE` blocked during `bankruptcyPending`; `SELL_HOUSE`, `SELL_HOTEL`, `MORTGAGE_PROPERTY` allowed
8. **`BankruptcyPanel` component** — shows during `bankruptcyPending`; Resolve and Declare Bankruptcy buttons
9. **`GameControls`** — status message for `bankruptcyPending` phase
10. **`GameLayout`** — renders `BankruptcyPanel`

### Test files updated / created

- `src/__tests__/bankruptcy.test.ts` — updated to reflect pending behavior
- `src/__tests__/gameFlow.integration.test.ts` — Flow 9 updated; 3 tests rewritten for two-step bankruptcy
- `src/__tests__/bankruptcyResolution.test.ts` — **new file**, 38 tests covering all Phase 3C scenarios

### Commands run (Node 20)

```bash
npm run typecheck   # ✅ pass
npm run lint        # ✅ pass
npm run build       # ✅ pass
npm test            # ✅ 335/335 src tests, 19 files
```

### Test counts

| Phase | Tests | Files |
|-------|-------|-------|
| Before Phase 3B | 263 | 13 |
| After Phase 3B  | 291 | 14 |
| After Phase 3C  | 335 | 15 |

---

## Phase 3D: Final Local MVP Hardening ✅

### What was implemented

#### 1. Local save/resume (`src/lib/game/persistence.ts`)
- `SAVE_VERSION = 1` + `SAVE_KEY` constant for future migrations
- `serializeGame(state)` / `deserializeGame(json)` — pure, testable round-trip functions
- `validateGameShape(data)` — shape validator: checks phase, players, positions, currentPlayerIndex bounds, ownerId/winnerId/auction/trade/bankruptcy cross-references
- `saveGame(state)` / `loadGame()` / `clearSave()` — localStorage-backed, safe on SSR (try/catch)
- `exportGameJson(state)` / `importGameJson(json)` — for export/import flow; importGameJson returns `{ ok, state }` or `{ ok: false, error }`

#### 2. `RESET_GAME` + `LOAD_GAME` reducer actions
- `RESET_GAME` → returns `createSetupGameState()` (clean slate, no stale trade/auction/bankruptcy)
- `LOAD_GAME { state }` → replaces entire state (used for resume and import)

#### 3. Auto-save + auto-resume (`src/components/GameLayout.tsx`)
- `useEffect` on mount: calls `loadGame()`, dispatches `LOAD_GAME` if found
- `useEffect` on state change: calls `saveGame(state)` when phase ≠ `"setup"`

#### 4. New Game / Export / Import UI (`src/components/GameSaveControls.tsx`)
- **New Game**: confirmation prompt before dispatching `RESET_GAME` + `clearSave()`
- **Export Save**: triggers JSON file download named with current date
- **Import Save**: file picker + textarea; validates with `importGameJson`; shows inline error message on failure

### Test files created

- `src/__tests__/persistence.test.ts` (36 tests) — serialize/deserialize round-trip, field preservation (players/ownerships/decks/trade/bankruptcy/drawnCard/winnerId), invalid JSON, incompatible version, corrupted player refs, localStorage mock tests (save/load/clear/errors)
- `src/__tests__/finalStateSafety.test.ts` (16 tests) — `validateGameShape` for every field: invalid phase, out-of-bounds positions, out-of-bounds currentPlayerIndex, ownership/auction/trade/bankruptcy cross-references, corrupt saves don't crash, RESET_GAME/LOAD_GAME correctness

### Commands run (Node 20)

```bash
npm run typecheck   # ✅ pass
npm run lint        # ✅ pass
npm run build       # ✅ pass
npm test            # ✅ 387/387 src tests, 17 files
```

### Test counts

| Phase | Tests | Files |
|-------|-------|-------|
| Before Phase 3D | 335 | 15 |
| After Phase 3D  | 387 | 17 |

### Known limitations
- localStorage is cleared on browser data clear / private mode (expected)
- No save migration path yet (save version 1 only) — `SAVE_VERSION` constant is in place for future migrations
- Import validates shape but does not re-shuffle decks or re-validate game logic consistency (e.g., a tampered save with invalid cash values would load fine)

### Next recommended task

**Phase 4A: Multiplayer architecture planning**
