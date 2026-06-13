import { getBoardSpaceByIndex } from "@/data/board";
import { addLogEntry } from "@/lib/game/createInitialGameState";
import { getPropertyOwner, getOwnership, isOwnableSpace } from "@/lib/game/ownership";
import { calculateRent } from "@/lib/game/rent";
import type { BoardSpace } from "@/types/board";
import type { GameLogEntry, GamePhase, GameState, LandingAction } from "@/types/game";
import type { Player } from "@/types/player";

type LandingResolution = {
  players: Player[];
  gameLog: GameLogEntry[];
  landingMessage: string;
  landingAction: LandingAction | null;
  phase: GamePhase;
  doublesCount: number;
};

function phaseAfterResolvedLanding(rolledDouble: boolean): GamePhase {
  return rolledDouble ? "readyToRoll" : "turnComplete";
}

function spaceTypeLabel(space: BoardSpace) {
  if (space.kind === "city") {
    return "city";
  }

  if (space.kind === "airport") {
    return "airport";
  }

  if (space.kind === "utility") {
    return "utility";
  }

  return "space";
}

export function resolveLanding(
  state: GameState,
  landedSpace: BoardSpace,
  rolledDouble: boolean,
): LandingResolution {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const landingMessage = `Landed on ${landedSpace.name}`;
  let nextLog = addLogEntry(state.gameLog, `${currentPlayer.name} landed on ${landedSpace.name}.`);

  if (isOwnableSpace(landedSpace)) {
    const ownership = getOwnership(state.ownerships, landedSpace.index);
    const owner = getPropertyOwner(state.ownerships, state.players, landedSpace.index);

    if (!ownership?.ownerId) {
      return {
        players: state.players,
        gameLog: nextLog,
        landingMessage,
        landingAction: {
          kind: "purchaseDecision",
          spaceIndex: landedSpace.index,
          message: `${landedSpace.name} is unowned. Buy it now or decline; auctions will be added later.`,
        },
        phase: "awaitingPurchaseDecision",
        doublesCount: state.doublesCount,
      };
    }

    if (!owner) {
      const message = `${currentPlayer.name} landed on ${landedSpace.name}, but owner data is missing.`;
      nextLog = addLogEntry(nextLog, message);

      return {
        players: state.players,
        gameLog: nextLog,
        landingMessage,
        landingAction: {
          kind: "message",
          spaceIndex: landedSpace.index,
          message,
        },
        phase: phaseAfterResolvedLanding(rolledDouble),
        doublesCount: state.doublesCount,
      };
    }

    if (owner.id === currentPlayer.id) {
      const message = `${currentPlayer.name} landed on ${landedSpace.name}. You own this property.`;
      nextLog = addLogEntry(nextLog, message);

      return {
        players: state.players,
        gameLog: nextLog,
        landingMessage,
        landingAction: {
          kind: "message",
          spaceIndex: landedSpace.index,
          message,
        },
        phase: phaseAfterResolvedLanding(rolledDouble),
        doublesCount: state.doublesCount,
      };
    }

    const rent = calculateRent(
      landedSpace,
      ownership,
      state.ownerships,
      state.diceRoll?.total ?? 0,
    );

    if (rent.isMortgaged) {
      const message = `${currentPlayer.name} landed on ${landedSpace.name}, but it is mortgaged. No rent is charged.`;
      nextLog = addLogEntry(nextLog, message);

      return {
        players: state.players,
        gameLog: nextLog,
        landingMessage,
        landingAction: {
          kind: "message",
          spaceIndex: landedSpace.index,
          message,
        },
        phase: phaseAfterResolvedLanding(rolledDouble),
        doublesCount: state.doublesCount,
      };
    }

    const payerCashAfter = currentPlayer.cash - rent.amount;
    const ownerCashAfter = owner.cash + rent.amount;
    const rentPlayers = state.players.map((player) => {
      if (player.id === currentPlayer.id) {
        return {
          ...player,
          cash: payerCashAfter,
        };
      }

      if (player.id === owner.id) {
        return {
          ...player,
          cash: ownerCashAfter,
        };
      }

      return player;
    });
    const rentMessage = `${currentPlayer.name} paid ${owner.name} $${rent.amount} rent for ${landedSpace.name}.`;
    const rentReasonMessage = `${rentMessage} (${rent.reason})`;

    nextLog = addLogEntry(nextLog, rentReasonMessage);

    return {
      players: rentPlayers,
      gameLog: nextLog,
      landingMessage: rentMessage,
      landingAction: {
        kind: "rentPayment",
        spaceIndex: landedSpace.index,
        message: rentReasonMessage,
        payerId: currentPlayer.id,
        ownerId: owner.id,
        rentAmount: rent.amount,
        payerCashAfter,
        ownerCashAfter,
        bankruptcyDeferred: false,
      },
      phase: phaseAfterResolvedLanding(rolledDouble),
      doublesCount: state.doublesCount,
    };
  }

  if (landedSpace.kind === "tax") {
    const taxedPlayers = state.players.map((player, index) =>
      index === state.currentPlayerIndex
        ? {
            ...player,
            cash: player.cash - landedSpace.amount,
          }
        : player,
    );
    const taxMessage = `${currentPlayer.name} paid $${landedSpace.amount} for ${landedSpace.name}.`;
    nextLog = addLogEntry(nextLog, taxMessage);

    return {
      players: taxedPlayers,
      gameLog: nextLog,
      landingMessage: taxMessage,
      landingAction: {
        kind: "message",
        spaceIndex: landedSpace.index,
        message: taxMessage,
      },
      phase: phaseAfterResolvedLanding(rolledDouble),
      doublesCount: state.doublesCount,
    };
  }

  if (landedSpace.kind === "go-to-jail") {
    const jailedPlayers = state.players.map((player, index) =>
      index === state.currentPlayerIndex
        ? {
            ...player,
            position: 10,
            isInJail: true,
          }
        : player,
    );
    const jailMessage = `${currentPlayer.name} landed on Go To Jail and was sent to Jail.`;
    nextLog = addLogEntry(nextLog, jailMessage);

    return {
      players: jailedPlayers,
      gameLog: nextLog,
      landingMessage: jailMessage,
      landingAction: {
        kind: "message",
        spaceIndex: 10,
        message: jailMessage,
      },
      phase: "turnComplete",
      doublesCount: 0,
    };
  }

  const message = getSpecialSpaceMessage(currentPlayer, landedSpace);
  nextLog = addLogEntry(nextLog, message);

  return {
    players: state.players,
    gameLog: nextLog,
    landingMessage,
    landingAction: {
      kind: "message",
      spaceIndex: landedSpace.index,
      message,
    },
    phase: phaseAfterResolvedLanding(rolledDouble),
    doublesCount: state.doublesCount,
  };
}

export function getSpecialSpaceMessage(player: Player, space: BoardSpace) {
  switch (space.kind) {
    case "go":
      return `${player.name} landed on GO.`;
    case "jail":
      return player.isInJail
        ? `${player.name} is in Jail.`
        : `${player.name} is just visiting Jail.`;
    case "free-parking":
      return `${player.name} landed on Free Parking. Nothing happens.`;
    case "chance":
      return `${player.name} landed on Chance.`;
    case "community-chest":
      return `${player.name} landed on Community Chest.`;
    default:
      return `${player.name} landed on ${space.name}.`;
  }
}

export function getSpaceTypeLabelByIndex(spaceIndex: number) {
  return spaceTypeLabel(getBoardSpaceByIndex(spaceIndex));
}
