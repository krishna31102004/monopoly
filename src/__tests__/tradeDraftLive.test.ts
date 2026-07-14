import { describe, it, expect } from "vitest";
import { RoomManager } from "@/lib/multiplayer/rooms";

function setupRoom() {
  const mgr = new RoomManager();
  const { room, playerId: aliceId } = mgr.createRoom(
    { displayName: "Alice", token: "car", tokenLabel: "CAR", color: "#ef4444" },
    "socket-alice",
  );
  const roomCode = room.roomCode;
  const joinResult = mgr.joinRoom(
    { roomCode, displayName: "Bob", token: "hat", tokenLabel: "HAT", color: "#2563eb" },
    "socket-bob",
  );
  if (!joinResult.ok) throw new Error("join failed");
  const bobId = joinResult.value.playerId;

  const startResult = mgr.startGame(roomCode, aliceId);
  if (!startResult.ok) throw new Error("start failed");

  return { mgr, roomCode, aliceId, bobId };
}

describe("RoomManager — live trade draft", () => {
  it("current player can start a trade draft", () => {
    const { mgr, roomCode, aliceId, bobId } = setupRoom();
    const result = mgr.startTradeDraft(roomCode, aliceId, bobId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.proposerId).toBe(aliceId);
      expect(result.value.recipientId).toBe(bobId);
      expect(result.value.offerFromProposer).toEqual({ cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 });
    }
    expect(mgr.getTradeDraft(roomCode)).not.toBeNull();
  });

  it("rejects starting a draft from a non-current player", () => {
    const { mgr, roomCode, bobId } = setupRoom();
    const result = mgr.startTradeDraft(roomCode, bobId, bobId);
    expect(result.ok).toBe(false);
    expect(mgr.getTradeDraft(roomCode)).toBeNull();
  });

  it("rejects starting a draft targeting self", () => {
    const { mgr, roomCode, aliceId } = setupRoom();
    const result = mgr.startTradeDraft(roomCode, aliceId, aliceId);
    expect(result.ok).toBe(false);
  });

  it("rejects starting a second draft while one is already open", () => {
    const { mgr, roomCode, aliceId, bobId } = setupRoom();
    mgr.startTradeDraft(roomCode, aliceId, bobId);
    const second = mgr.startTradeDraft(roomCode, aliceId, bobId);
    expect(second.ok).toBe(false);
  });

  it("only the proposer can update the draft — recipient edits are rejected", () => {
    const { mgr, roomCode, aliceId, bobId } = setupRoom();
    mgr.startTradeDraft(roomCode, aliceId, bobId);

    const proposerUpdate = mgr.updateTradeDraft(roomCode, aliceId, {
      offerFromProposer: { cash: 100, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
    });
    expect(proposerUpdate.ok).toBe(true);
    if (proposerUpdate.ok) expect(proposerUpdate.value.offerFromProposer.cash).toBe(100);

    const recipientUpdate = mgr.updateTradeDraft(roomCode, bobId, {
      offerFromRecipient: { cash: 50, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
    });
    expect(recipientUpdate.ok).toBe(false);
  });

  it("proposer can edit the recipient's side of the draft (recipient side is proposer-controlled)", () => {
    const { mgr, roomCode, aliceId, bobId } = setupRoom();
    mgr.startTradeDraft(roomCode, aliceId, bobId);
    const update = mgr.updateTradeDraft(roomCode, aliceId, {
      offerFromRecipient: { cash: 200, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
    });
    expect(update.ok).toBe(true);
    if (update.ok) expect(update.value.offerFromRecipient.cash).toBe(200);
  });

  it("only the proposer can cancel the draft", () => {
    const { mgr, roomCode, aliceId, bobId } = setupRoom();
    mgr.startTradeDraft(roomCode, aliceId, bobId);
    const badCancel = mgr.cancelTradeDraft(roomCode, bobId);
    expect(badCancel.ok).toBe(false);
    expect(mgr.getTradeDraft(roomCode)).not.toBeNull();

    const goodCancel = mgr.cancelTradeDraft(roomCode, aliceId);
    expect(goodCancel.ok).toBe(true);
    expect(mgr.getTradeDraft(roomCode)).toBeNull();
  });

  it("keeps a cash-only draft open because it cannot become a trade", () => {
    const { mgr, roomCode, aliceId, bobId } = setupRoom();
    mgr.startTradeDraft(roomCode, aliceId, bobId);
    mgr.updateTradeDraft(roomCode, aliceId, {
      offerFromProposer: { cash: 100, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
    });

    const badSubmit = mgr.submitTradeDraft(roomCode, bobId);
    expect(badSubmit.ok).toBe(false);
    expect(mgr.getTradeDraft(roomCode)).not.toBeNull();

    const goodSubmit = mgr.submitTradeDraft(roomCode, aliceId);
    expect(goodSubmit.ok).toBe(false);
    expect(mgr.getTradeDraft(roomCode)).not.toBeNull();
  });

  it("submitting an invalid draft (insufficient cash) fails and keeps the draft open", () => {
    const { mgr, roomCode, aliceId, bobId } = setupRoom();
    mgr.startTradeDraft(roomCode, aliceId, bobId);
    mgr.updateTradeDraft(roomCode, aliceId, {
      offerFromProposer: { cash: 999999, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
    });
    const submit = mgr.submitTradeDraft(roomCode, aliceId);
    expect(submit.ok).toBe(false);
    expect(mgr.getTradeDraft(roomCode)).not.toBeNull();
  });

  it("a stale draft is dropped once the proposer's turn ends", () => {
    const { mgr, roomCode, aliceId, bobId } = setupRoom();
    mgr.startTradeDraft(roomCode, aliceId, bobId);
    expect(mgr.getTradeDraft(roomCode)).not.toBeNull();

    // Force the turn to move on to Bob without going through the draft API.
    const raw = mgr.getRawRoom(roomCode)!;
    raw.gameState = { ...raw.gameState!, currentPlayerIndex: 1 };

    const result = mgr.applyGameAction(roomCode, bobId, { type: "ROLL_DICE" }, { die1: 2, die2: 3, total: 5, isDouble: false });
    expect(result.ok).toBe(true);
    expect(mgr.getTradeDraft(roomCode)).toBeNull();
  });

  it("getTradeDraft returns null for an unknown room", () => {
    const mgr = new RoomManager();
    expect(mgr.getTradeDraft("NOPE")).toBeNull();
  });
});
