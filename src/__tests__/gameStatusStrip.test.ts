import { describe, it, expect } from "vitest";
import { getGameStatusPhaseLabel, getGameStatusStripInfo } from "@/lib/ui/gameStatusStrip";
import { makeGameState } from "@/__tests__/helpers/factory";

describe("getGameStatusPhaseLabel", () => {
  it("maps readyToRoll to Roll", () => {
    const state = makeGameState();
    expect(getGameStatusPhaseLabel(state)).toBe("Roll");
  });

  it("maps turnComplete to Move", () => {
    const state = { ...makeGameState(), phase: "turnComplete" as const };
    expect(getGameStatusPhaseLabel(state)).toBe("Move");
  });

  it("maps auction phase to Auction", () => {
    const state = { ...makeGameState(), phase: "auction" as const };
    expect(getGameStatusPhaseLabel(state)).toBe("Auction");
  });

  it("maps bankruptcyPending to Payment Required", () => {
    const state = { ...makeGameState(), phase: "bankruptcyPending" as const };
    expect(getGameStatusPhaseLabel(state)).toBe("Payment Required");
  });

  it("maps gameOver to Game Over", () => {
    const state = { ...makeGameState(), phase: "gameOver" as const };
    expect(getGameStatusPhaseLabel(state)).toBe("Game Over");
  });
});

describe("getGameStatusStripInfo", () => {
  it("multiplayer status strip shows room code", () => {
    const state = makeGameState();
    const info = getGameStatusStripInfo({ state, isMultiplayer: true, roomCode: "LONDON-4821" });
    expect(info.roomCode).toBe("LONDON-4821");
  });

  it("shows current turn player name", () => {
    const state = makeGameState();
    const info = getGameStatusStripInfo({ state, isMultiplayer: false });
    expect(info.currentPlayerName).toBe(state.players[state.currentPlayerIndex].name);
  });

  it("shows user identity (You: name) in multiplayer", () => {
    const state = makeGameState();
    const info = getGameStatusStripInfo({ state, isMultiplayer: true, myName: "kb" });
    expect(info.myName).toBe("kb");
  });

  it("shows phase/status", () => {
    const state = makeGameState();
    const info = getGameStatusStripInfo({ state, isMultiplayer: false });
    expect(info.phaseLabel).toBe("Roll");
  });

  it("local mode status strip does not show irrelevant room code or identity", () => {
    const state = makeGameState();
    const info = getGameStatusStripInfo({ state, isMultiplayer: false, roomCode: "SHOULD-NOT-SHOW", myName: "kb" });
    expect(info.roomCode).toBeNull();
    expect(info.myName).toBeNull();
    expect(info.isMultiplayer).toBe(false);
  });

  it("disconnected/reconnecting state displays if available", () => {
    const state = makeGameState();
    const reconnecting = getGameStatusStripInfo({ state, isMultiplayer: true, connectionStatus: "reconnecting" });
    const disconnected = getGameStatusStripInfo({ state, isMultiplayer: true, connectionStatus: "disconnected" });
    expect(reconnecting.connectionStatus).toBe("reconnecting");
    expect(disconnected.connectionStatus).toBe("disconnected");
  });

  it("connection status is suppressed in local mode", () => {
    const state = makeGameState();
    const info = getGameStatusStripInfo({ state, isMultiplayer: false, connectionStatus: "disconnected" });
    expect(info.connectionStatus).toBeNull();
  });
});
