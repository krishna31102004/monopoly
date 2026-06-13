# Final Game Build Outline

## Final direction

We are building a private **Monopoly-style web game**, but the colored street properties are replaced with famous world cities.

The game is for private use with friends only. It is not intended for public release, commercial use, app store publishing, or distribution.

The board keeps the classic Monopoly-style structure and mechanics, but with custom city-themed properties and airports instead of railroads.

## What stays Monopoly-style

Keep these spaces and mechanics:

* GO
* Community Chest
* Chance
* Income Tax
* Jail / Just Visiting
* Free Parking
* Go To Jail
* Luxury Tax
* Electric Company
* Water Works
* Chance cards
* Community Chest cards
* Jail rules
* Taxes
* Rent
* Auctions
* Houses
* Hotels
* Mortgages
* Trades
* Bankruptcy
* Last remaining player wins

## What changes

Change only these parts:

* Colored street properties become famous world cities.
* Railroads become airports.
* Airport mechanics stay exactly like railroad mechanics.
* Airport price stays $200.
* Airport mortgage value stays $100.
* Airport rent follows the classic railroad rent structure:

  * 1 airport owned: $25
  * 2 airports owned: $50
  * 3 airports owned: $100
  * 4 airports owned: $200

## Core build strategy

Build in this order:

1. Build the local playable game first.
2. Make the rules work properly.
3. Polish the UI and mobile layout.
4. Add multiplayer only after the local game works.

Do not start with multiplayer, database, Redis, or accounts. First make the local game work.

## Local players

Version 1 should support:

**2 to 6 local players**

Each player has:

* Name
* Token
* Cash
* Position
* Owned cities
* Owned airports
* Owned utilities
* Jail status
* Get Out of Jail Free cards
* Bankruptcy status

For the first local version, all players can play on the same laptop or browser, like pass-and-play.

## Final city property groups

Each color group uses cities from the same country.

| Color group | Country theme | Cities                        |
| ----------- | ------------- | ----------------------------- |
| Brown       | Mexico        | Guadalajara, Cancún           |
| Light Blue  | India         | Mumbai, Delhi, Bengaluru      |
| Pink        | Germany       | Hamburg, Munich, Berlin       |
| Orange      | UAE           | Sharjah, Abu Dhabi, Dubai     |
| Red         | Italy         | Naples, Milan, Rome           |
| Yellow      | Australia     | Brisbane, Melbourne, Sydney   |
| Green       | England       | Manchester, Liverpool, London |
| Dark Blue   | USA           | San Francisco, New York       |

## Why these sets work

Brown is the cheapest set, so Mexico works well as the starting tier. Guadalajara and Cancún are recognizable but not final-tier luxury properties.

Light Blue is India, with Mumbai, Delhi, and Bengaluru. This is a strong early-game set with recognizable cities.

Pink is Germany, with Hamburg, Munich, and Berlin. Berlin is the premium city in that group.

Orange is UAE, with Sharjah, Abu Dhabi, and Dubai. Dubai is the strongest property in that group.

Red is Italy, with Naples, Milan, and Rome. Rome is the premium city in that group.

Yellow is Australia, with Brisbane, Melbourne, and Sydney. Sydney is the premium city in that group.

Green is England, with Manchester, Liverpool, and London. London is the premium city in that group.

Dark Blue is USA, with San Francisco and New York. These are the final expensive properties, high-risk and high-reward.

## Final board layout

The board has 40 spaces.

```text
0  GO
1  Guadalajara
2  Community Chest
3  Cancún
4  Income Tax
5  JFK Airport
6  Mumbai
7  Chance
8  Delhi
9  Bengaluru
10 Jail / Just Visiting
11 Hamburg
12 Electric Company
13 Munich
14 Berlin
15 Heathrow Airport
16 Sharjah
17 Community Chest
18 Abu Dhabi
19 Dubai
20 Free Parking
21 Naples
22 Chance
23 Milan
24 Rome
25 Dubai International Airport
26 Brisbane
27 Melbourne
28 Water Works
29 Sydney
30 Go To Jail
31 Manchester
32 Liverpool
33 Community Chest
34 London
35 Changi Airport
36 Chance
37 San Francisco
38 Luxury Tax
39 New York
```

## Airport mapping

Use airports instead of railroads:

| Original railroad slot | New airport                 |
| ---------------------- | --------------------------- |
| Reading Railroad       | JFK Airport                 |
| Pennsylvania Railroad  | Heathrow Airport            |
| B&O Railroad           | Dubai International Airport |
| Short Line             | Changi Airport              |

Airport rules are identical to railroad rules.

## Important rule direction

Use Monopoly-style rules:

* Players start with $1,500.
* Passing or landing on GO gives $200.
* Income Tax stays Income Tax.
* Luxury Tax stays Luxury Tax.
* Electric Company and Water Works stay utilities.
* Chance and Community Chest stay as card decks.
* Jail rules stay Monopoly-style.
* Free Parking does nothing by default.
* Declining to buy a property starts an auction.
* Owning a full color group doubles base rent on unimproved properties.
* Houses and hotels follow the normal even-building rule.
* Mortgaging and unmortgaging follow standard Monopoly-style behavior.
* Bankruptcy removes a player from the game.
* Last remaining player wins.

## Card wording changes

Because railroads are now airports, update card wording:

* "Advance to the nearest Railroad" becomes "Advance to the nearest Airport."
* "Take a trip to Reading Railroad" becomes "Take a trip to JFK Airport."

The mechanics stay the same.

## Updated build outline

### Phase 1: Static local board

Build the visual board first.

Features:

* 40-space board
* City names on colored properties
* Original Monopoly-style special spaces
* Airports instead of railroads
* Original utilities
* Up to 6 local player tokens
* Click a city to view its property card
* Click an airport to view its airport card
* Click a utility to view its utility card
* Show property price, rent, color group, owner, and mortgage value
* Show player panels with cash and owned assets

Goal of this phase:

Build the game board and make it look good before adding complex rules.

### Phase 2: Local game engine

Add the actual game rules.

Features:

* 2 to 6 local players
* Turn order
* Dice roll
* Player movement
* Passing GO gives $200
* Landing on a city
* Buy city
* Decline city
* Simple auction
* Pay rent
* Income Tax
* Luxury Tax
* Airports
* Electric Company
* Water Works
* Chance cards
* Community Chest cards
* Jail / Just Visiting
* Go To Jail
* Rolling doubles
* Rolling three doubles sends player to Jail
* Bankruptcy
* Winner detection

Goal of this phase:

Make the game fully playable locally.

### Phase 3: Deeper rules

Add the advanced systems after the basic game works.

Features:

* Houses
* Hotels
* Mortgage
* Unmortgage
* Trading
* Full auction UI
* Better card handling
* Game event log
* Player asset dashboard
* Optional house-rule toggles later

Goal of this phase:

Make the game feel like a complete Monopoly-style game.

### Phase 4: UI polish and mobile

Make it feel good on laptop and mobile.

Features:

* Responsive board
* Mobile bottom sheet
* Player dashboard
* Property card modals
* Dice animation
* Token movement animation
* Rent/payment popups
* Auction popup
* Chance / Community Chest card animation
* Jail status display
* Better game log
* Clean mobile controls
* Tap-friendly buttons

Goal of this phase:

Make the game enjoyable to play with friends.

### Phase 5: Multiplayer

Only after the local game works.

Features:

* Create room
* Join with code
* Choose token
* Real-time turns
* Server-side dice
* Server validates moves
* Server stores authoritative game state
* Reconnect after refresh
* Save/resume later
* Chat or reactions later

Goal of this phase:

Turn the local game into an online friends-only multiplayer game.

## Recommended tech stack

For the first local version:

* Next.js
* TypeScript
* Tailwind CSS
* Framer Motion
* Local React state or reducer-based game state

For multiplayer later:

* Node.js
* Socket.IO
* In-memory game state first
* Supabase/Postgres later for save/resume
* Redis only later if needed
* Vercel for frontend
* Render or Railway for the Socket.IO server

## The exact MVP we should build first

The first playable version should be:

**Local, 2 to 6 players, city-themed properties, airports instead of railroads, original utilities, original special spaces, dice, movement, buying, rent, simple auctions, Chance/Community Chest, Jail, bankruptcy, and winner detection.**

No multiplayer yet.

No database yet.

No Redis yet.

No accounts yet.

This gives us a working game fastest.

## MVP feature checklist

The MVP should include:

* Start screen
* Add 2 to 6 players
* Choose token for each player
* Start game
* Show full board
* Show player cash
* Show current player turn
* Roll dice
* Move token
* Collect $200 from GO
* Buy unowned city
* Decline city and trigger auction
* Buy airport
* Pay airport rent
* Buy utility
* Pay utility rent
* Pay city rent automatically
* Resolve Income Tax
* Resolve Luxury Tax
* Draw Chance card
* Draw Community Chest card
* Go to Jail
* Leave Jail by paying, card, or doubles
* Track owned cities
* Track owned airports
* Track owned utilities
* Track bankrupt players
* Declare winner
* Show game log

## Later feature checklist

After the MVP works, add:

* Houses
* Hotels
* Mortgages
* Unmortgages
* Trades
* Full auction flow
* Better card animations
* Better mobile layout
* Save/resume
* Multiplayer rooms
* Reconnect handling
* Chat/reactions
* Optional house rules

## Final vision

We are building a **private Monopoly-style city board game** where friends compete to buy famous cities grouped by country.

The game keeps the classic Monopoly-style board structure and rules, but the colored property spaces become:

**Mexico → India → Germany → UAE → Italy → Australia → England → USA**

The airport spaces become:

**JFK Airport → Heathrow Airport → Dubai International Airport → Changi Airport**

The smartest path is:

**Local game first, multiplayer second, polish third.**

That gives us a playable game quickly and avoids getting stuck on multiplayer bugs before the game itself works.

## Multiplayer model (clarification added after Phase 3D)

Multiplayer for this game is **private friends-only room-code multiplayer**, not public matchmaking.

Key requirements:
- Up to 6 players join from their own device (laptop, phone, or tablet — any mix)
- Players join using a private room code (e.g. `LONDON-4821`) or a shareable invite link
- A QR code is shown in the lobby so phone users can join by scanning
- No public lobby, no strangers, no random matchmaking
- Room code required to join; no public list of rooms
- Server is authoritative; dice are rolled server-side
- In-memory room state for the first multiplayer version; database added later if needed
- See `PHASE_4_PLAN.md` for the full architecture plan

## Instruction for future coding tasks

Before making any code changes in future prompts, always read `PROJECT_SPEC.md` first and follow it as the source of truth.

If the requested task conflicts with `PROJECT_SPEC.md`, pause and explain the conflict before changing code.
