"use client";

import { useEffect, useReducer, useState } from "react";
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
import { GameSaveControls } from "@/components/GameSaveControls";
import { GameSetup } from "@/components/setup/GameSetup";
import { LocalRollOffScreen } from "@/components/setup/LocalRollOffScreen";
import { MobileActionBar } from "@/components/MobileActionBar";
import { GamePresentationLayer } from "@/components/presentation/GamePresentationLayer";
import { boardSpaces } from "@/data/board";
import { createSetupGameState } from "@/lib/game/createInitialGameState";
import { gameReducer } from "@/lib/game/gameReducer";
import { saveGame, loadGame } from "@/lib/game/persistence";
import {
  isPlayerInActiveAuction,
  isPlayerInActiveTrade,
  isPlayerInDebt,
} from "@/lib/game/playerPanelHelpers";
import { getMobileTabAttention, type MobileGameTab } from "@/lib/ui/mobileGameNavigation";
import type { OwnableSpace } from "@/types/board";
import type { StartGamePlayer, GameRules } from "@/types/game";

export function GameLayout() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createSetupGameState);
  const [selectedSpace, setSelectedSpace] = useState<OwnableSpace | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileGameTab>("board");
  const [mobilePlayerId, setMobilePlayerId] = useState<string | null>(null);
  const [pendingRollOff, setPendingRollOff] = useState<{ players: StartGamePlayer[]; rules: GameRules } | null>(null);
  const [showStartSequence, setShowStartSequence] = useState(false);
  // diceKey: opaque string that changes exactly once per new roll — passed to
  // usePlayerMovementAnimation so it can self-gate movement until dice finish.
  const diceKey =
    state.diceRoll && state.currentPlayerHasRolled
      ? `${state.currentPlayerIndex}:${state.doublesCount}:${state.diceRoll.die1}:${state.diceRoll.die2}`
      : null;
  const { displayPositions, isAnimating, landingPlayerIds } = usePlayerMovementAnimation(state.players, diceKey);
  const { showLandingPanel, showCardPanel, showCardResolved, presentationPhase } = useGameplayPresentation(state, isAnimating);

  const presentationStatus =
    presentationPhase === "rollingDice" ? "Rolling dice…" :
    presentationPhase === "showingDiceResult" ? `Dice: ${state.diceRoll ? `${state.diceRoll.die1} + ${state.diceRoll.die2}` : "—"}` :
    presentationPhase === "movingToken" ? "Moving…" :
    presentationPhase === "landing" ? "Resolving landing…" :
    presentationPhase === "revealingCard" ? "Revealing card…" :
    null;
  // On mount: auto-resume saved game if one exists
  useEffect(() => {
    const saved = loadGame();
    if (saved && saved.phase !== "setup") {
      dispatch({ type: "LOAD_GAME", state: saved });
    }
  }, []); // intentionally run once on mount

  // Auto-save after every state change (skip setup phase)
  useEffect(() => {
    if (state.phase !== "setup") {
      saveGame(state);
    }
  }, [state]);

  if (state.phase === "setup" && !pendingRollOff) {
    return (
      <GameSetup
        onStartGame={(players, rules) => setPendingRollOff({ players, rules })}
      />
    );
  }

  if (state.phase === "setup" && pendingRollOff) {
    return (
      <LocalRollOffScreen
        players={pendingRollOff.players}
        onComplete={(sortedPlayers) => {
          dispatch({ type: "START_GAME", players: sortedPlayers, rules: pendingRollOff.rules });
          setPendingRollOff(null);
          setShowStartSequence(true);
        }}
      />
    );
  }

  const actionAttention = getMobileTabAttention(state, state.players[state.currentPlayerIndex]?.id);

  return (
    <main className="min-h-screen px-2 py-3 sm:px-4 sm:py-5 xl:pb-5 xl:bg-[radial-gradient(circle_at_top_left,rgba(198,161,91,.10),transparent_35rem)]">
      <GamePresentationLayer state={state} showStart={showStartSequence} onStartShown={() => setShowStartSequence(false)} onNavigate={setMobileTab} />

      <div className="mx-auto mb-3 max-w-[1560px]">
        <GameStatusStrip state={state} isMultiplayer={false} />
      </div>

      <div className="mobile-game-content mx-auto grid max-w-[1560px] gap-4 xl:grid-cols-[minmax(680px,1fr)_370px]">
        {/* Board */}
        <section className={`${mobileTab === "board" ? "block" : "hidden xl:block"} min-w-0 xl:rounded-[var(--wc-radius-large)] xl:bg-[var(--wc-ivory-raised)] xl:p-4 xl:shadow-[var(--wc-shadow-panel)]`}>
          <GameBoard
            spaces={boardSpaces}
            players={state.players}
            ownerships={state.ownerships}
            displayPositions={displayPositions}
            landingPlayerIds={landingPlayerIds}
            onOpenProperty={setSelectedSpace}
            currentPlayerIndex={state.currentPlayerIndex}
            autoFollowKey={`${state.currentPlayerIndex}:${diceKey ?? ""}`}
          />
        </section>

        {/* Sidebar */}
        <aside className="min-w-0 xl:max-h-[calc(100vh-2.5rem)] xl:overflow-y-auto xl:rounded-[var(--wc-radius-large)] xl:border xl:border-[var(--wc-border)] xl:bg-[var(--wc-navy)] xl:p-3 xl:shadow-[var(--wc-shadow-panel)]">
          {state.phase === "auction" && showLandingPanel ? (
            <AuctionPanel state={state} dispatch={dispatch} />
          ) : null}
          <div className={`${mobileTab === "actions" ? "grid" : "hidden xl:grid"} mb-3 gap-3`}>
            <div className="order-5 xl:order-none"><GameControls state={state} dispatch={dispatch} isAnimating={isAnimating} presentationStatus={presentationStatus} showLandingMessage={showLandingPanel} /></div>
            {state.phase === "awaitingJailDecision" ? (
              <div className="order-1 xl:order-none"><JailActionPanel state={state} dispatch={dispatch} /></div>
            ) : null}
            {state.drawnCard && showCardPanel ? (
              <div className="order-4 xl:order-none"><CardPanel drawnCard={state.drawnCard} showResolved={showCardResolved} /></div>
            ) : null}
            {showLandingPanel ? <div className="order-2 xl:order-none"><LandingActionPanel state={state} dispatch={dispatch} /></div> : null}
            <div className="order-3 xl:order-none"><BankruptcyPanel state={state} dispatch={dispatch} /></div>
            <div className="order-4 xl:order-none"><TradePanel state={state} dispatch={dispatch} /></div>
            <div className="order-6 xl:order-none"><GameSaveControls state={state} dispatch={dispatch} /></div>
          </div>

          <div className={`${mobileTab === "log" ? "block" : "hidden xl:block"} mb-3`}>
            <GameLogDrawer entries={state.gameLog} forceOpen={mobileTab === "log"} />
          </div>

          <div className={`${mobileTab === "players" ? "block" : "hidden xl:block"} mb-3 flex items-end justify-between gap-3`}>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Players
              </p>
              <h2 className="text-lg font-black text-white">Player Panels</h2>
            </div>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-200">
              Live
            </span>
          </div>

          <div className={`${mobileTab === "players" ? "grid" : "hidden xl:grid"} gap-2.5 sm:grid-cols-2 xl:grid-cols-1`}>
            {state.players.map((player, index) => (
              <PlayerPanel
                key={player.id}
                player={player}
                spaces={boardSpaces}
                ownerships={state.ownerships}
                isCurrentPlayer={index === state.currentPlayerIndex}
                allPlayers={state.players}
                isInActiveTrade={isPlayerInActiveTrade(state, player.id)}
                isInActiveAuction={isPlayerInActiveAuction(state, player.id)}
                isInDebt={isPlayerInDebt(state, player.id)}
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
        players={state.players}
        ownerships={state.ownerships}
        onClose={() => setSelectedSpace(null)}
        currentPlayer={state.players[state.currentPlayerIndex]}
        dispatch={dispatch}
        state={state}
      />

      {/* Sticky bottom bar — mobile only (hidden on sm+) */}
      <MobileActionBar
        state={state}
        dispatch={dispatch}
        isAnimating={isAnimating}
        presentationStatus={presentationStatus}
        activeTab={mobileTab}
        onTabChange={setMobileTab}
        actionAttention={actionAttention}
      />
    </main>
  );
}
