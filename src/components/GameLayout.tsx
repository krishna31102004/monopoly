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
import { MobileActionBar } from "@/components/MobileActionBar";
import { boardSpaces } from "@/data/board";
import { createSetupGameState } from "@/lib/game/createInitialGameState";
import { gameReducer } from "@/lib/game/gameReducer";
import { saveGame, loadGame } from "@/lib/game/persistence";
import {
  isPlayerInActiveAuction,
  isPlayerInActiveTrade,
  isPlayerInDebt,
} from "@/lib/game/playerPanelHelpers";
import type { OwnableSpace } from "@/types/board";

export function GameLayout() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createSetupGameState);
  const [selectedSpace, setSelectedSpace] = useState<OwnableSpace | null>(null);
  const { displayPositions, isAnimating, landingPlayerIds } = usePlayerMovementAnimation(state.players);
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

  if (state.phase === "setup") {
    return <GameSetup onStartGame={(players, rules) => dispatch({ type: "START_GAME", players, rules })} />;
  }

  const winner = state.winnerId ? state.players.find((p) => p.id === state.winnerId) : null;

  return (
    <main className="min-h-screen px-2 py-3 pb-20 sm:pb-5 sm:px-4 sm:py-5 lg:px-6">
      {/* Game-over banner */}
      {state.phase === "gameOver" && winner ? (
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

      <div className="mx-auto mb-3 max-w-[1560px]">
        <GameStatusStrip state={state} isMultiplayer={false} />
      </div>

      <div className="mx-auto grid max-w-[1560px] gap-4 xl:grid-cols-[minmax(680px,1fr)_370px]">
        {/* Board */}
        <section className="min-w-0">
          <GameBoard
            spaces={boardSpaces}
            players={state.players}
            ownerships={state.ownerships}
            displayPositions={displayPositions}
            landingPlayerIds={landingPlayerIds}
            onOpenProperty={setSelectedSpace}
            currentPlayerIndex={state.currentPlayerIndex}
          />
        </section>

        {/* Sidebar */}
        <aside className="min-w-0 xl:max-h-[calc(100vh-2.5rem)] xl:overflow-y-auto">
          <div className="mb-3 grid gap-3">
            <GameControls state={state} dispatch={dispatch} isAnimating={isAnimating} presentationStatus={presentationStatus} showLandingMessage={showLandingPanel} />
            {state.phase === "awaitingJailDecision" ? (
              <JailActionPanel state={state} dispatch={dispatch} />
            ) : null}
            {state.phase === "auction" && showLandingPanel ? (
              <AuctionPanel state={state} dispatch={dispatch} />
            ) : null}
            {state.drawnCard && showCardPanel ? (
              <CardPanel drawnCard={state.drawnCard} showResolved={showCardResolved} />
            ) : null}
            {showLandingPanel ? <LandingActionPanel state={state} dispatch={dispatch} /> : null}
            <BankruptcyPanel state={state} dispatch={dispatch} />
            <TradePanel state={state} dispatch={dispatch} />
            <GameSaveControls state={state} dispatch={dispatch} />
            <GameLogDrawer entries={state.gameLog} />
          </div>

          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                Players
              </p>
              <h2 className="text-lg font-black text-slate-950">Player Panels</h2>
            </div>
            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">
              Live
            </span>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
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
      />
    </main>
  );
}
