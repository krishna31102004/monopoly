import type { CardDefinition } from "@/data/cards";
import type { Player } from "@/types/player";

export type GameRules = {
  doubleRentOnFullSet: boolean;
  freeParkingCash: boolean;
  auctions: boolean;
  noRentInJail: boolean;
  mortgages: boolean;
  evenBuild: boolean;
  exactGoBonus: boolean;
};

export const DEFAULT_RULES: GameRules = {
  doubleRentOnFullSet: true,
  freeParkingCash: true,
  auctions: true,
  noRentInJail: true,
  mortgages: true,
  evenBuild: true,
  exactGoBonus: true,
};

export type GamePhase =
  | "setup"
  | "readyToRoll"
  | "awaitingJailDecision"
  | "awaitingPurchaseDecision"
  | "auction"
  | "turnComplete"
  | "bankruptcyPending"
  | "gameOver";

export type DrawnCard = {
  card: CardDefinition;
  resolvedMessage: string;
};

export type AuctionState = {
  propertySpaceIndex: number;
  activePlayerIds: string[];
  passedPlayerIds: string[];
  currentBid: number;
  highestBidderId: string | null;
  currentBidderIndex: number;
  turnStartedAt: number;
  turnDeadlineAt: number;
  status: "active";
};

export type DiceRoll = {
  die1: number;
  die2: number;
  total: number;
  isDouble: boolean;
};

export type GameLogEntry = {
  id: string;
  message: string;
  createdAt: string;
};

export type PropertyOwnership = {
  spaceIndex: number;
  ownerId: string | null;
  isMortgaged: boolean;
  houses: number;
  hasHotel: boolean;
};

export type LandingAction =
  | {
      kind: "purchaseDecision";
      spaceIndex: number;
      message: string;
    }
  | {
      kind: "rentPayment";
      spaceIndex: number;
      message: string;
      payerId: string;
      ownerId: string;
      rentAmount: number;
      payerCashAfter: number;
      ownerCashAfter: number;
      bankruptcyDeferred: boolean;
    }
  | {
      kind: "message";
      spaceIndex: number;
      message: string;
    };

export type BankruptcyCreditor =
  | { type: "bank" }
  | { type: "player"; playerId: string };

export type BankruptcyState = {
  debtorPlayerId: string;
  creditor: BankruptcyCreditor;
  amountOwed: number;
  reason: string;
  status: "pending";
  phaseBeforeBankruptcy: GamePhase;
};

export type TradeOffer = {
  cash: number;
  propertySpaceIndices: number[];
  getOutOfJailFreeCards: number;
};

export type TradeState = {
  initiatorPlayerId: string;
  recipientPlayerId: string;
  offerFromInitiator: TradeOffer;
  offerFromRecipient: TradeOffer;
};

export type GameState = {
  players: Player[];
  ownerships: PropertyOwnership[];
  currentPlayerIndex: number;
  phase: GamePhase;
  diceRoll: DiceRoll | null;
  currentPlayerHasRolled: boolean;
  doublesCount: number;
  gameLog: GameLogEntry[];
  landingMessage: string | null;
  landingAction: LandingAction | null;
  auction: AuctionState | null;
  drawnCard: DrawnCard | null;
  winnerId: string | null;
  chanceDeck: string[];
  communityChestDeck: string[];
  trade: TradeState | null;
  bankruptcy: BankruptcyState | null;
  rules: GameRules;
  freeParkingPot: number;
  /** Property space indices queued for auction after a voluntary forfeit. */
  forfeitAuctionQueue: number[];
  /** Unix ms when the current turn expires (set on each new turn). */
  turnDeadlineAt: number | null;
};

export type StartGamePlayer = {
  id?: string;
  name: string;
  token: Player["token"];
  tokenLabel: string;
  color: string;
};

export type GameAction =
  | {
      type: "START_GAME";
      players: StartGamePlayer[];
      rules?: GameRules;
    }
  | {
      type: "ROLL_DICE";
      dice: DiceRoll;
    }
  | {
      type: "BUY_PROPERTY";
    }
  | {
      type: "DECLINE_PROPERTY";
    }
  | {
      type: "PLACE_BID";
      amount: number;
    }
  | {
      type: "PASS_AUCTION";
    }
  | {
      type: "END_TURN";
    }
  | {
      type: "PAY_JAIL_FEE";
    }
  | {
      type: "USE_JAIL_CARD";
    }
  | {
      type: "ROLL_IN_JAIL";
      dice: DiceRoll;
    }
  | {
      type: "BUY_HOUSE";
      spaceIndex: number;
    }
  | {
      type: "SELL_HOUSE";
      spaceIndex: number;
    }
  | {
      type: "BUY_HOTEL";
      spaceIndex: number;
    }
  | {
      type: "SELL_HOTEL";
      spaceIndex: number;
    }
  | {
      type: "MORTGAGE_PROPERTY";
      spaceIndex: number;
    }
  | {
      type: "UNMORTGAGE_PROPERTY";
      spaceIndex: number;
    }
  | {
      type: "PROPOSE_TRADE";
      actorPlayerId: string;
      initiatorId: string;
      recipientId: string;
      offerFromInitiator: TradeOffer;
      offerFromRecipient: TradeOffer;
    }
  | { type: "ACCEPT_TRADE"; actorPlayerId: string }
  | { type: "DECLINE_TRADE"; actorPlayerId: string }
  | { type: "CANCEL_TRADE"; actorPlayerId: string }
  | { type: "DECLARE_BANKRUPTCY" }
  | { type: "VOLUNTARY_BANKRUPTCY"; actorPlayerId: string }
  | { type: "TURN_TIMER_EXPIRED"; playerId: string; deadlineAt: number }
  | { type: "RESOLVE_BANKRUPTCY_IF_SOLVENT" }
  | { type: "RESET_GAME" }
  | { type: "LOAD_GAME"; state: GameState };
