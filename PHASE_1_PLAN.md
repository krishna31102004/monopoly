# Phase 1 Build Plan: Static Local Board UI

## Source of truth

This plan follows `PROJECT_SPEC.md`. Phase 1 is limited to the static local board UI.

Phase 1 must not include:

* Multiplayer
* Database
* Redis
* Socket.IO
* Accounts
* Full game rules
* Dice rolling
* Turn logic
* Buying, auctions, rent payment, jail resolution, bankruptcy, houses, hotels, mortgages, or trades

The goal is to build a polished static board that displays the 40-space city-themed Monopoly-style layout, sample local players, player tokens, player panels, and clickable property cards for cities, airports, and utilities.

## Recommended folder structure

Use a Next.js app with TypeScript and Tailwind CSS.

```text
src/
  app/
    page.tsx
    layout.tsx
    globals.css
  components/
    board/
      GameBoard.tsx
      BoardSpace.tsx
      CornerSpace.tsx
      CitySpace.tsx
      AirportSpace.tsx
      UtilitySpace.tsx
      SpecialSpace.tsx
      TokenStack.tsx
    players/
      PlayerPanel.tsx
      PlayerPanelList.tsx
    properties/
      PropertyCardModal.tsx
      CityPropertyCard.tsx
      AirportPropertyCard.tsx
      UtilityPropertyCard.tsx
    layout/
      GameShell.tsx
      BoardCenter.tsx
  data/
    board.ts
    players.ts
  types/
    board.ts
    player.ts
```

Keep Phase 1 data static. Later phases can move the same types and data into reducer-driven game state.

## Components needed

### `GameShell`

Owns the desktop and mobile page layout.

Responsibilities:

* Render the board area.
* Render the player panel area.
* Hold selected property state for the modal.
* Pass click handlers into board spaces.

### `GameBoard`

Renders all 40 spaces in their correct board positions.

Responsibilities:

* Accept the full `boardSpaces` array.
* Accept local players for token placement.
* Convert board indexes to CSS Grid positions.
* Render the center area.
* Render each board space using the correct specialized component.

### `BoardSpace`

Dispatches each space to the right visual component based on `space.kind`.

Responsibilities:

* Normalize shared layout, borders, labels, and click behavior.
* Make city, airport, and utility spaces clickable.
* Keep non-ownable spaces static.

### `CornerSpace`

Renders GO, Jail / Just Visiting, Free Parking, and Go To Jail.

Responsibilities:

* Larger square corner treatment.
* Clear labels and icon/visual treatment.
* Token stack support.

### `CitySpace`

Renders colored city property spaces.

Responsibilities:

* Display color bar.
* Display city name.
* Display price.
* Display owner state as "Unowned" in Phase 1.
* Render tokens currently on the space.

### `AirportSpace`

Renders airport spaces.

Responsibilities:

* Display airport icon or symbol.
* Display airport name.
* Display price `$200`.
* Render tokens currently on the space.

### `UtilitySpace`

Renders Electric Company and Water Works.

Responsibilities:

* Display utility icon or symbol.
* Display utility name.
* Display price.
* Render tokens currently on the space.

### `SpecialSpace`

Renders Chance, Community Chest, Income Tax, and Luxury Tax.

Responsibilities:

* Display special-space label.
* Display a compact icon or visual marker.
* Render tokens currently on the space.

### `TokenStack`

Displays up to 6 player tokens in a space.

Responsibilities:

* Accept players currently at a board index.
* Render compact circular tokens using player color and token symbol.
* Use a stable mini-grid so tokens never resize a space.
* Support overlap-free display for 1 to 6 tokens.

### `PlayerPanelList`

Renders all local player panels.

Responsibilities:

* Accept static sample players for Phase 1.
* Use a responsive grid/list.
* Keep panels readable on desktop and mobile.

### `PlayerPanel`

Displays one player's static summary.

Responsibilities:

* Name
* Token
* Cash
* Position
* Owned cities
* Owned airports
* Owned utilities
* Jail status
* Bankruptcy status

### `PropertyCardModal`

Displays details when clicking a city, airport, or utility.

Responsibilities:

* Open only for ownable spaces.
* Route content to `CityPropertyCard`, `AirportPropertyCard`, or `UtilityPropertyCard`.
* Close on overlay click, close button, or Escape.
* Use accessible dialog semantics.

## TypeScript types needed

Create board types around a discriminated union.

```ts
export type BoardSpaceKind =
  | "go"
  | "city"
  | "airport"
  | "utility"
  | "tax"
  | "chance"
  | "community-chest"
  | "jail"
  | "free-parking"
  | "go-to-jail";

export type CityColorGroup =
  | "brown"
  | "light-blue"
  | "pink"
  | "orange"
  | "red"
  | "yellow"
  | "green"
  | "dark-blue";

export type BaseBoardSpace = {
  index: number;
  name: string;
  kind: BoardSpaceKind;
};

export type CitySpace = BaseBoardSpace & {
  kind: "city";
  country: string;
  colorGroup: CityColorGroup;
  price: number;
  rent: number[];
  mortgageValue: number;
  houseCost: number;
};

export type AirportSpace = BaseBoardSpace & {
  kind: "airport";
  price: 200;
  rentByOwnedCount: [25, 50, 100, 200];
  mortgageValue: 100;
};

export type UtilitySpace = BaseBoardSpace & {
  kind: "utility";
  price: number;
  mortgageValue: number;
};

export type TaxSpace = BaseBoardSpace & {
  kind: "tax";
  amount: number;
};

export type SpecialSpace = BaseBoardSpace & {
  kind:
    | "go"
    | "chance"
    | "community-chest"
    | "jail"
    | "free-parking"
    | "go-to-jail";
};

export type BoardSpace =
  | CitySpace
  | AirportSpace
  | UtilitySpace
  | TaxSpace
  | SpecialSpace;
```

Create player types that match the future game model but stay static in Phase 1.

```ts
export type PlayerToken =
  | "car"
  | "hat"
  | "ship"
  | "shoe"
  | "dog"
  | "cat";

export type Player = {
  id: string;
  name: string;
  token: PlayerToken;
  tokenLabel: string;
  color: string;
  cash: number;
  position: number;
  ownedCityIds: number[];
  ownedAirportIds: number[];
  ownedUtilityIds: number[];
  isInJail: boolean;
  getOutOfJailFreeCards: number;
  isBankrupt: boolean;
};
```

## Static board data file structure

Create `src/data/board.ts` with one exported `boardSpaces` array in exact board order from `PROJECT_SPEC.md`.

Each object should include:

* `index`
* `name`
* `kind`
* Ownable-space values where relevant
* Visual metadata through typed fields, not ad hoc component strings

Example structure:

```ts
export const boardSpaces: BoardSpace[] = [
  { index: 0, name: "GO", kind: "go" },
  {
    index: 1,
    name: "Guadalajara",
    kind: "city",
    country: "Mexico",
    colorGroup: "brown",
    price: 60,
    rent: [2, 10, 30, 90, 160, 250],
    mortgageValue: 30,
    houseCost: 50,
  },
  { index: 2, name: "Community Chest", kind: "community-chest" },
];
```

For Phase 1, prices and rents should follow standard Monopoly-style property values in their equivalent board slots. The exact values should be encoded once in `board.ts` and read by UI components.

Create `src/data/players.ts` with static sample players:

* 2 to 6 sample players
* Starting cash `$1,500`
* Different positions so token stacking can be tested
* A few mock owned asset IDs so player panels and property modal owner display can be visually tested

## UI layout plan for desktop

Desktop should prioritize the board as the main object.

Layout:

* Full viewport app shell.
* Board on the left or center, constrained to a square.
* Player panels in a right sidebar.
* Optional compact top bar with game title only.
* Property modal overlays the app when opened.

Recommended desktop sizing:

* `GameShell`: `min-h-screen`, responsive grid.
* Main board region: square, `min(78vw, calc(100vh - 48px))`.
* Sidebar: fixed comfortable width around `320px` to `380px`.
* Board center: show game title, phase label, and static placeholder area for future controls without implementing controls yet.

Desktop behavior:

* Board spaces should remain readable at common laptop widths.
* Player panels should scroll independently if vertical space is limited.
* Modal should be centered with max width around `420px` to `520px`.

## UI layout plan for mobile

Mobile should keep the board usable first, then show player information below.

Layout:

* Single-column page.
* Board at top with horizontal-safe scaling.
* Player panels below the board in a compact list.
* Modal uses a bottom sheet or near-full-screen panel.

Recommended mobile behavior:

* Board width: `min(100vw - 16px, 680px)`.
* Board remains square.
* Space labels use smaller text and wrap carefully.
* Tokens remain visible even if labels are compact.
* Player panels use one-column cards.
* Property modal should be tap-friendly with large close button and scrollable content.

Phase 1 does not need advanced mobile controls, dice controls, or turn actions.

## Rendering the 40-space board using CSS Grid

Render the board as an 11 by 11 CSS Grid:

* Four corners are 1 by 1 grid cells.
* Each side has 9 non-corner spaces.
* The center occupies the inner 9 by 9 area.

Use board indexes in classic order:

* Bottom row: indexes `0` through `10`
* Left column: indexes `11` through `20`
* Top row: indexes `21` through `30`
* Right column: indexes `31` through `39`

Because CSS Grid coordinates start at top-left, map board indexes explicitly:

```ts
export type GridPlacement = {
  gridColumn: string;
  gridRow: string;
};

export function getBoardGridPlacement(index: number): GridPlacement {
  if (index >= 0 && index <= 10) {
    return {
      gridColumn: `${11 - index}`,
      gridRow: "11",
    };
  }

  if (index >= 11 && index <= 20) {
    return {
      gridColumn: "1",
      gridRow: `${21 - index}`,
    };
  }

  if (index >= 21 && index <= 30) {
    return {
      gridColumn: `${index - 19}`,
      gridRow: "1",
    };
  }

  return {
    gridColumn: "11",
    gridRow: `${index - 29}`,
  };
}
```

This places:

* `0 GO` at bottom-right.
* `10 Jail / Just Visiting` at bottom-left.
* `20 Free Parking` at top-left.
* `30 Go To Jail` at top-right.

Board component structure:

```tsx
<div className="grid aspect-square grid-cols-11 grid-rows-11">
  <BoardCenter className="col-start-2 col-span-9 row-start-2 row-span-9" />
  {boardSpaces.map((space) => (
    <BoardSpace
      key={space.index}
      space={space}
      players={playersByPosition[space.index] ?? []}
      style={getBoardGridPlacement(space.index)}
    />
  ))}
</div>
```

Use CSS classes for orientation:

* Bottom row text can be upright or rotated slightly if needed.
* Left and right side spaces can use vertical writing only if still readable.
* Prefer compact upright labels over heavy rotation for mobile readability.

## Displaying each space type

### City spaces

Show:

* City name
* Country theme through color group
* Color bar matching the property group
* Price
* Owner label, defaulting to `Unowned`
* Token stack

Click behavior:

* Opens city property card modal.

### Airports

Show:

* Airport name
* Airport icon or short visual marker
* Price `$200`
* Owner label, defaulting to `Unowned`
* Token stack

Click behavior:

* Opens airport property card modal.

### Utilities

Show:

* Electric Company or Water Works
* Utility icon or short visual marker
* Price
* Owner label, defaulting to `Unowned`
* Token stack

Click behavior:

* Opens utility property card modal.

### Taxes

Show:

* Income Tax or Luxury Tax
* Tax amount
* Token stack

Click behavior:

* No modal in Phase 1 unless a simple static info modal is later desired.

### Chance

Show:

* Chance label
* `?` or card-style marker
* Token stack

Click behavior:

* No card draw in Phase 1.

### Community Chest

Show:

* Community Chest label
* chest/card-style marker
* Token stack

Click behavior:

* No card draw in Phase 1.

### Jail / Just Visiting

Show:

* Jail / Just Visiting label
* Clear corner-space treatment
* Token stack

Click behavior:

* No jail rules in Phase 1.

### Free Parking

Show:

* Free Parking label
* Clear corner-space treatment
* Token stack

Click behavior:

* Static only.

### Go To Jail

Show:

* Go To Jail label
* Clear corner-space treatment
* Token stack

Click behavior:

* Static only.

### GO

Show:

* GO label
* `$200` pass/land note
* Clear directional treatment
* Token stack

Click behavior:

* Static only.

## Showing up to 6 local player tokens on the board

For Phase 1, use static player data and place tokens by `player.position`.

Implementation approach:

1. Build `playersByPosition` from static players.
2. Pass only players on a space into `BoardSpace`.
3. Render them through `TokenStack`.

Token display:

* Each player token is a small circle.
* Use player color as background.
* Use `tokenLabel` as text or use an icon component later.
* Use a fixed 3 by 2 mini-grid for up to 6 players.
* Keep token size responsive with a min/max clamp.

Example token stack layout:

```tsx
<div className="grid grid-cols-3 gap-0.5">
  {players.map((player) => (
    <span key={player.id} title={player.name}>
      {player.tokenLabel}
    </span>
  ))}
</div>
```

Do not implement movement animation in Phase 1.

## Showing player panels

Player panels should use static `samplePlayers`.

Each panel should show:

* Player name
* Token marker
* Cash
* Current board position name
* Owned cities count and names
* Owned airports count and names
* Owned utilities count and names
* Jail status
* Get Out of Jail Free card count
* Bankruptcy status

Desktop:

* Sidebar list.
* Cards with compact spacing.
* Current-player highlighting can be static or omitted in Phase 1.

Mobile:

* Single-column list below the board.
* Use compact text and collapsible sections only if needed.

No player editing, turn order, or state mutation is required in Phase 1.

## Property card modal behavior

Open a modal when clicking:

* City
* Airport
* Utility

Do not open modal for:

* GO
* Chance
* Community Chest
* Taxes
* Jail
* Free Parking
* Go To Jail

City modal should show:

* City name
* Country
* Color group
* Price
* Base rent
* Full rent ladder if encoded
* House cost
* Mortgage value
* Owner, defaulting to `Unowned`

Airport modal should show:

* Airport name
* Price `$200`
* Rent by number of airports owned
* Mortgage value `$100`
* Owner, defaulting to `Unowned`

Utility modal should show:

* Utility name
* Price
* Utility rent explanation placeholder
* Mortgage value
* Owner, defaulting to `Unowned`

Accessibility requirements:

* Use a semantic dialog or accessible modal component.
* Focus close button when opened if practical.
* Close on Escape.
* Buttons must have readable labels.

## Phase 1 task checklist

1. Confirm app scaffold or create a new Next.js + TypeScript + Tailwind project.
2. Add the TypeScript board and player types.
3. Add static `boardSpaces` data for all 40 spaces from `PROJECT_SPEC.md`.
4. Add static `samplePlayers` data for 2 to 6 players.
5. Implement `getBoardGridPlacement(index)`.
6. Build `GameShell`.
7. Build `GameBoard`.
8. Build `BoardCenter`.
9. Build `BoardSpace` dispatcher.
10. Build `CornerSpace`.
11. Build `CitySpace`.
12. Build `AirportSpace`.
13. Build `UtilitySpace`.
14. Build `SpecialSpace`.
15. Build `TokenStack`.
16. Build `PlayerPanelList`.
17. Build `PlayerPanel`.
18. Build `PropertyCardModal`.
19. Build `CityPropertyCard`.
20. Build `AirportPropertyCard`.
21. Build `UtilityPropertyCard`.
22. Wire static board data into the board UI.
23. Wire static players into token stacks and player panels.
24. Add responsive desktop layout.
25. Add responsive mobile layout.
26. Verify all 40 spaces render in the correct order.
27. Verify city, airport, and utility clicks open the correct modal.
28. Verify non-ownable spaces do not trigger property-card modals.
29. Verify up to 6 tokens render cleanly on one board space.
30. Run lint/build checks.
31. Open the local app in the browser and visually verify desktop and mobile layouts.

## Exact next coding task after this plan is approved

Read `PROJECT_SPEC.md` and `PHASE_1_PLAN.md`, then scaffold the Next.js + TypeScript + Tailwind app if it does not already exist. After scaffolding, implement only the Phase 1 foundation: board/player TypeScript types, the static 40-space `boardSpaces` data file, static sample players, and the `getBoardGridPlacement` helper. Do not build game rules or multiplayer.

## Implementation Status

Completed for Phase 1:

* Created the Next.js + TypeScript + Tailwind CSS app structure.
* Added typed board, city, airport, utility, tax, special-space, and player models.
* Added the static 40-space board data from `PROJECT_SPEC.md`.
* Mapped city prices and rents to the equivalent US standard Monopoly board slots.
* Added airport pricing, mortgage value, and railroad-style rent structure.
* Added static sample local players with cash, token, position, owned assets, jail status, and bankruptcy status.
* Implemented square CSS Grid board rendering with correct perimeter order.
* Implemented city, airport, utility, tax, Chance, Community Chest, corner, and GO space display.
* Implemented grouped player tokens on board spaces.
* Implemented player panels.
* Implemented property card modal for cities, airports, and utilities.
* Verified `npm run typecheck`, `npm run lint`, and `npm run build` pass.
* Verified the app runs with `npm run dev` at `http://localhost:3000`.
* Verified the board renders on desktop and at a 390px mobile viewport without horizontal overflow.

Still intentionally not implemented:

* Dice rolling
* Turn order
* Buying
* Rent payment
* Auctions
* Chance or Community Chest card actions
* Jail rules
* Bankruptcy rules
* Houses, hotels, mortgages, unmortgages, or trades
* Multiplayer
* Database
* Redis
* Socket.IO
* Authentication
