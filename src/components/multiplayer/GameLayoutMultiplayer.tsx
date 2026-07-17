"use client";

import { useCallback, useState } from "react";
import { usePlayerMovementAnimation } from "@/hooks/usePlayerMovementAnimation";
import { useGameplayPresentation } from "@/hooks/useGameplayPresentation";
import { AuctionPanel } from "@/components/AuctionPanel";
import { CardPanel } from "@/components/CardPanel";
import { GameBoard } from "@/components/board/GameBoard";
import { GameControls } from "@/components/GameControls";
import { GameLogDrawer } from "@/components/GameLogDrawer";
import { GameStatusStrip } from "@/components/GameStatusStrip";
import { JailActionPanel } from "@/components/JailActionPanel";
import { LandingActionPanel } from "@/components/LandingActionPanel";
import { PlayerPanel } from "@/components/PlayerPanel";
import { PropertyCardModal } from "@/components/PropertyCardModal";
import { BankruptcyPanel } from "@/components/BankruptcyPanel";
import { TradePanel } from "@/components/TradePanel";
import { MobileActionBar } from "@/components/MobileActionBar";
import { GamePresentationLayer } from "@/components/presentation/GamePresentationLayer";
import { boardSpaces } from "@/data/board";
import {
  isPlayerInActiveAuction,
  isPlayerInActiveTrade,
  isPlayerInDebt,
} from "@/lib/game/playerPanelHelpers";
import { getMobileTabAttention, type MobileGameTab } from "@/lib/ui/mobileGameNavigation";
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
  onForfeit?: () => void;
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
  onForfeit,
  onRequestSync,
  tradeDraft,
  startTradeDraft,
  updateTradeDraft,
  cancelTradeDraft,
  submitTradeDraft,
}: Props) {
  const [selectedSpace, setSelectedSpace] = useState<OwnableSpace | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileGameTab>("board");
  const [mobilePlayerId, setMobilePlayerId] = useState<string | null>(null);
  const diceKey =
    gameState.diceRoll && gameState.currentPlayerHasRolled
      ? `${gameState.currentPlayerIndex}:${gameState.doublesCount}:${gameState.diceRoll.die1}:${gameState.diceRoll.die2}`
      : null;
  const { displayPositions, isAnimating, landingPlayerIds } = usePlayerMovementAnimation(gameState.players, diceKey);
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

  const currentActor = gameState.players.find((p) => p.id === actorId);
  const actionAttention = getMobileTabAttention(gameState, myPlayerId);

  return (
    <main className="min-h-screen px-2 py-3 sm:px-4 sm:py-5 xl:pb-5 xl:bg-[radial-gradient(circle_at_top_left,rgba(198,161,91,.10),transparent_35rem)]">
      <GamePresentationLayer state={gameState} />

      {/* Connection status banner */}
      {connectionStatus === "reconnecting" ? (
        <div className="mx-auto mb-2 max-w-[1560px] rounded-[var(--wc-radius-medium)] border border-amber-400/40 bg-[var(--wc-navy)] px-4 py-2 text-sm font-semibold text-amber-100 shadow-[var(--wc-shadow-card)]">
          Reconnecting to server…
        </div>
      ) : connectionStatus === "disconnected" ? (
        <div className="mx-auto mb-2 flex max-w-[1560px] items-center gap-3 rounded-[var(--wc-radius-medium)] border border-rose-500/40 bg-[var(--wc-navy)] px-4 py-2 text-sm font-semibold text-rose-100 shadow-[var(--wc-shadow-card)]">
          <span>Disconnected from server.</span>
          <button
            onClick={onRequestSync}
            className="wc-button wc-button-danger ml-auto min-h-11 px-3 py-1 text-xs font-bold xl:min-h-9"
          >
            Request Sync
          </button>
        </div>
      ) : null}

      {/* Status strip — sticky on mobile, slim inline on desktop */}
      <div className="mx-auto mb-3 max-w-[1560px]">
        <GameStatusStrip
          state={gameState}
          isMultiplayer
          roomCode={room.roomCode}
          myName={myPlayer?.name ?? null}
          connectionStatus={connectionStatus === "connected" || connectionStatus === "reconnecting" || connectionStatus === "disconnected" ? connectionStatus : null}
          onSync={onRequestSync}
          onLeave={onLeave}
          onForfeit={onForfeit}
        />
        {!isMyTurn ? (
          <p className="mt-1 px-1 text-xs font-semibold text-slate-300">
            Waiting for {currentActor?.name ?? "another player"}…
          </p>
        ) : null}
      </div>

      {/* Server error display */}
      {error ? (
        <div className="mx-auto mb-3 max-w-[1560px] rounded-[var(--wc-radius-medium)] border border-rose-500/40 bg-[var(--wc-navy)] px-4 py-2 text-sm font-semibold text-rose-100 shadow-[var(--wc-shadow-card)]">
          {error}
        </div>
      ) : null}

      <div className="mobile-game-content mx-auto grid max-w-[1560px] gap-4 xl:grid-cols-[minmax(680px,1fr)_370px]">
        {/* Board */}
        <section className={`${mobileTab === "board" ? "block" : "hidden xl:block"} min-w-0 xl:rounded-[var(--wc-radius-large)] xl:bg-[var(--wc-ivory-raised)] xl:p-4 xl:shadow-[var(--wc-shadow-panel)]`}>
          <GameBoard
            spaces={boardSpaces}
            players={gameState.players}
            ownerships={gameState.ownerships}
            displayPositions={displayPositions}
            landingPlayerIds={landingPlayerIds}
            onOpenProperty={setSelectedSpace}
            currentPlayerIndex={gameState.currentPlayerIndex}
            autoFollowKey={`${gameState.currentPlayerIndex}:${diceKey ?? ""}`}
          />
        </section>

        {/* Sidebar */}
        <aside className="min-w-0 xl:max-h-[calc(100vh-2.5rem)] xl:overflow-y-auto xl:rounded-[var(--wc-radius-large)] xl:border xl:border-[var(--wc-border)] xl:bg-[var(--wc-navy)] xl:p-3 xl:shadow-[var(--wc-shadow-panel)]">
          {gameState.phase === "auction" && showLandingPanel ? (
            <AuctionPanel state={gameState} dispatch={dispatch} isMyTurn={isMyTurn} serverAuthoritative />
          ) : null}
          <div className={`${mobileTab === "actions" ? "grid" : "hidden xl:grid"} mb-3 gap-3`}>
            <div className="order-5 xl:order-none"><GameControls state={gameState} dispatch={dispatch} isMyTurn={isMyTurn} isAnimating={isAnimating} presentationStatus={presentationStatus} showLandingMessage={showLandingPanel} /></div>
            {gameState.phase === "awaitingJailDecision" ? (
              <div className="order-1 xl:order-none"><JailActionPanel state={gameState} dispatch={dispatch} isMyTurn={isMyTurn} /></div>
            ) : null}
            {gameState.drawnCard && showCardPanel ? (
              <div className="order-4 xl:order-none"><CardPanel drawnCard={gameState.drawnCard} showResolved={showCardResolved} /></div>
            ) : null}
            {showLandingPanel ? <div className="order-2 xl:order-none"><LandingActionPanel state={gameState} dispatch={dispatch} isMyTurn={isMyTurn} /></div> : null}
            <div className="order-3 xl:order-none"><BankruptcyPanel state={gameState} dispatch={dispatch} /></div>
            <div className="order-4 xl:order-none"><TradePanel
              state={gameState}
              dispatch={dispatch}
              myPlayerId={myPlayerId}
              tradeDraft={tradeDraft}
              onDraftStart={(recipientId) => startTradeDraft({ recipientId })}
              onDraftUpdate={updateTradeDraft}
              onDraftCancel={cancelTradeDraft}
              onDraftSubmit={submitTradeDraft}
            /></div>
          </div>

          <div className={`${mobileTab === "log" ? "block" : "hidden xl:block"} mb-3`}>
            <GameLogDrawer entries={gameState.gameLog} forceOpen={mobileTab === "log"} />
          </div>

          <div className={`${mobileTab === "players" ? "block" : "hidden xl:block"} mb-3`}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Players
            </p>
            <h2 className="text-lg font-black text-white">Player Panels</h2>
          </div>

          <div className={`${mobileTab === "players" ? "grid" : "hidden xl:grid"} gap-2.5 sm:grid-cols-2 xl:grid-cols-1`}>
            {gameState.players.map((player, index) => (
              <PlayerPanel
                key={player.id}
                player={player}
                spaces={boardSpaces}
                ownerships={gameState.ownerships}
                isCurrentPlayer={index === gameState.currentPlayerIndex}
                allPlayers={gameState.players}
                isOnline={room.players.find((p) => p.playerId === player.id)?.connected}
                isInActiveTrade={isPlayerInActiveTrade(gameState, player.id)}
                isInActiveAuction={isPlayerInActiveAuction(gameState, player.id)}
                isInDebt={isPlayerInDebt(gameState, player.id)}
                mobileSheetOpen={mobilePlayerId === player.id}
                onMobileDetailsOpen={setMobilePlayerId}
                onMobileDetailsClose={() => setMobilePlayerId(null)}
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
        activeTab={mobileTab}
        onTabChange={setMobileTab}
        actionAttention={actionAttention}
      />
    </main>
  );
}
