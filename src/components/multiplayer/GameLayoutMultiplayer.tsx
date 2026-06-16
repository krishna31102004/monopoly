"use client";

import { useCallback, useState } from "react";
import { usePlayerMovementAnimation } from "@/hooks/usePlayerMovementAnimation";
import { useGameplayPresentation } from "@/hooks/useGameplayPresentation";
import { AuctionPanel } from "@/components/AuctionPanel";
import { CardPanel } from "@/components/CardPanel";
import { GameBoard } from "@/components/board/GameBoard";
import { GameControls } from "@/components/GameControls";
import { GameLogDrawer } from "@/components/GameLogDrawer";
import { JailActionPanel } from "@/components/JailActionPanel";
import { LandingActionPanel } from "@/components/LandingActionPanel";
import { PlayerPanel } from "@/components/PlayerPanel";
import { PropertyCardModal } from "@/components/PropertyCardModal";
import { BankruptcyPanel } from "@/components/BankruptcyPanel";
import { TradePanel } from "@/components/TradePanel";
import { MobileActionBar } from "@/components/MobileActionBar";
import { boardSpaces } from "@/data/board";
import type { GameAction, GameState } from "@/types/game";
import type { GameActionIntent, RoomPublicView, TradeDraftState, TradeDraftStartPayload, TradeDraftUpdatePayload } from "@/types/multiplayer";
import type { OwnableSpace } from "@/types/board";

import type { ConnectionStatus } from "@/hooks/useRoom";

type Props = {
  gameState: GameState;
  myPlayerId: string;
  room: RoomPublicView;
  sendAction: (action: GameActionIntent) => void;
  error: string | null;
  connectionStatus: ConnectionStatus;
  onLeave: () => void;
  onRequestSync: () => void;
  tradeDraft: TradeDraftState | null;
  startTradeDraft: (payload: TradeDraftStartPayload) => void;
  updateTradeDraft: (payload: TradeDraftUpdatePayload) => void;
  cancelTradeDraft: () => void;
  submitTradeDraft: () => void;
};

// Determine which player ID should be acting right now
function getActorId(gs: GameState): string {
  if (gs.phase === "auction" && gs.auction) return gs.auction.activePlayerIds[gs.auction.currentBidderIndex];
  if (gs.phase === "bankruptcyPending" && gs.bankruptcy) return gs.bankruptcy.debtorPlayerId;
  return gs.players[gs.currentPlayerIndex]?.id ?? "";
}

export function GameLayoutMultiplayer({
  gameState,
  myPlayerId,
  room,
  sendAction,
  error,
  connectionStatus,
  onLeave,
  onRequestSync,
  tradeDraft,
  startTradeDraft,
  updateTradeDraft,
  cancelTradeDraft,
  submitTradeDraft,
}: Props) {
  const [selectedSpace, setSelectedSpace] = useState<OwnableSpace | null>(null);
  const { displayPositions, isAnimating, landingPlayerIds } = usePlayerMovementAnimation(gameState.players);
  const { showLandingPanel, showCardPanel, showCardResolved, presentationPhase } = useGameplayPresentation(gameState, isAnimating);

  const presentationStatus =
    presentationPhase === "rollingDice" ? "Rolling dice…" :
    presentationPhase === "showingDiceResult" ? `Dice: ${gameState.diceRoll ? `${gameState.diceRoll.die1} + ${gameState.diceRoll.die2}` : "—"}` :
    presentationPhase === "movingToken" ? "Moving…" :
    presentationPhase === "landing" ? "Resolving landing…" :
    presentationPhase === "revealingCard" ? "Revealing card…" :
    null;

  const actorId = getActorId(gameState);
  const isMyTurn = myPlayerId === actorId;
  const myPlayer = gameState.players.find((p) => p.id === myPlayerId);

  // Wrap sendAction into a GameAction dispatch.
  // ROLL_DICE/ROLL_IN_JAIL: strip client dice (server rolls authoritatively).
  // System-only actions (RESET_GAME, LOAD_GAME, START_GAME) are blocked in multiplayer.
  const dispatch = useCallback(
    (action: GameAction) => {
      if (
        action.type === "RESET_GAME" ||
        action.type === "LOAD_GAME" ||
        action.type === "START_GAME"
      ) {
        return;
      }
      // Trade response actions (accept/decline/cancel) bypass turn order —
      // each is authorized by recipient or initiator role, not whose turn it is.
      if (action.type === "ACCEPT_TRADE" || action.type === "DECLINE_TRADE" || action.type === "CANCEL_TRADE") {
        sendAction({ type: action.type });
        return;
      }
      // Block all other turn-gated actions when it isn't this player's turn
      if (!isMyTurn) return;
      if (action.type === "ROLL_DICE") {
        sendAction({ type: "ROLL_DICE" });
        return;
      }
      if (action.type === "ROLL_IN_JAIL") {
        sendAction({ type: "ROLL_IN_JAIL" });
        return;
      }
      sendAction(action as GameActionIntent);
    },
    [sendAction, isMyTurn],
  );

  const winner = gameState.winnerId
    ? gameState.players.find((p) => p.id === gameState.winnerId)
    : null;

  const currentActor = gameState.players.find((p) => p.id === actorId);

  return (
    <main className="min-h-screen px-2 py-3 pb-20 sm:pb-5 sm:px-4 sm:py-5 lg:px-6">
      {/* Game-over banner */}
      {gameState.phase === "gameOver" && winner ? (
        <div className="mx-auto mb-4 max-w-[1560px] overflow-hidden rounded-xl border border-emerald-300 bg-emerald-50 px-6 py-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">
            Game Over
          </p>
          <h1 className="mt-0.5 text-2xl font-black text-slate-950">
            🏆 {winner.name} wins!
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            All other players have gone bankrupt. Congratulations!
          </p>
        </div>
      ) : null}

      {/* Connection status banner */}
      {connectionStatus === "reconnecting" ? (
        <div className="mx-auto mb-2 max-w-[1560px] rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
          Reconnecting to server…
        </div>
      ) : connectionStatus === "disconnected" ? (
        <div className="mx-auto mb-2 max-w-[1560px] flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">
          <span>Disconnected from server.</span>
          <button
            onClick={onRequestSync}
            className="ml-auto rounded-md border border-red-300 px-3 py-1 text-xs font-bold hover:bg-red-100"
          >
            Request Sync
          </button>
        </div>
      ) : null}

      {/* Turn indicator */}
      <div className="mx-auto mb-3 max-w-[1560px]">
        <div
          className={`flex flex-wrap items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold ${
            isMyTurn
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          {isMyTurn ? (
            <span>Your turn</span>
          ) : (
            <span>Waiting for {currentActor?.name ?? "another player"}…</span>
          )}
          {myPlayer ? (
            <span className="text-xs font-normal text-slate-400">You: {myPlayer.name}</span>
          ) : null}
          <span className="ml-auto text-xs font-normal text-slate-400">
            {room.roomCode}
          </span>
          <button
            onClick={onRequestSync}
            className="rounded-md border border-slate-300 px-2 py-0.5 text-xs font-bold text-slate-500 hover:bg-slate-100"
            title="Resync game state from server"
          >
            Sync
          </button>
          <button
            onClick={onLeave}
            className="text-xs text-slate-400 underline hover:text-slate-600"
          >
            Leave
          </button>
        </div>
      </div>

      {/* Server error display */}
      {error ? (
        <div className="mx-auto mb-3 max-w-[1560px] rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mx-auto grid max-w-[1560px] gap-4 xl:grid-cols-[minmax(680px,1fr)_370px]">
        {/* Board */}
        <section className="min-w-0">
          <GameBoard
            spaces={boardSpaces}
            players={gameState.players}
            ownerships={gameState.ownerships}
            displayPositions={displayPositions}
            landingPlayerIds={landingPlayerIds}
            onOpenProperty={setSelectedSpace}
            currentPlayerIndex={gameState.currentPlayerIndex}
          />
        </section>

        {/* Sidebar */}
        <aside className="min-w-0 xl:max-h-[calc(100vh-2.5rem)] xl:overflow-y-auto">
          <div className="mb-3 grid gap-3">
            <GameControls state={gameState} dispatch={dispatch} isMyTurn={isMyTurn} isAnimating={isAnimating} presentationStatus={presentationStatus} showLandingMessage={showLandingPanel} />
            {gameState.phase === "awaitingJailDecision" ? (
              <JailActionPanel state={gameState} dispatch={dispatch} isMyTurn={isMyTurn} />
            ) : null}
            {gameState.phase === "auction" && showLandingPanel ? (
              <AuctionPanel state={gameState} dispatch={dispatch} isMyTurn={isMyTurn} serverAuthoritative />
            ) : null}
            {gameState.drawnCard && showCardPanel ? (
              <CardPanel drawnCard={gameState.drawnCard} showResolved={showCardResolved} />
            ) : null}
            {showLandingPanel ? <LandingActionPanel state={gameState} dispatch={dispatch} isMyTurn={isMyTurn} /> : null}
            <BankruptcyPanel state={gameState} dispatch={dispatch} />
            <TradePanel
              state={gameState}
              dispatch={dispatch}
              myPlayerId={myPlayerId}
              tradeDraft={tradeDraft}
              onDraftStart={(recipientId) => startTradeDraft({ recipientId })}
              onDraftUpdate={updateTradeDraft}
              onDraftCancel={cancelTradeDraft}
              onDraftSubmit={submitTradeDraft}
            />
            <GameLogDrawer entries={gameState.gameLog} />
          </div>

          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                Players
              </p>
              <h2 className="text-lg font-black text-slate-950">Player Panels</h2>
            </div>
            <span className="rounded-full border border-blue-300 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-blue-700">
              Online
            </span>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
            {gameState.players.map((player, index) => (
              <PlayerPanel
                key={player.id}
                player={player}
                spaces={boardSpaces}
                ownerships={gameState.ownerships}
                isCurrentPlayer={index === gameState.currentPlayerIndex}
              />
            ))}
          </div>
        </aside>
      </div>

      <PropertyCardModal
        space={selectedSpace}
        players={gameState.players}
        ownerships={gameState.ownerships}
        onClose={() => setSelectedSpace(null)}
        currentPlayer={gameState.players[gameState.currentPlayerIndex]}
        dispatch={dispatch}
        state={gameState}
      />

      {/* Sticky bottom bar — mobile only (hidden on sm+) */}
      <MobileActionBar
        state={gameState}
        dispatch={dispatch}
        isMyTurn={isMyTurn}
        isAnimating={isAnimating}
        presentationStatus={presentationStatus}
      />
    </main>
  );
}
