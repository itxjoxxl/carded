import { useEffect, useRef, useCallback, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useProfileStore } from '@/store/profileStore';
import { useRoomStore } from '@/store/roomStore';
import { broadcastGameAction } from '@/lib/realtime';
import type { GameAction, BaseGameState } from '@/types/game';
import type { Player } from '@/types/player';

// ---------------------------------------------------------------------------
// Engine interface
// ---------------------------------------------------------------------------

interface GameEngine {
  createInitialState: (
    players: Player[],
    options?: Record<string, unknown>,
    seed?: number
  ) => BaseGameState;
  applyAction: (state: BaseGameState, action: GameAction) => BaseGameState;
  getLegalActions: (state: BaseGameState, playerId: string) => GameAction[];
  isTerminal: (state: BaseGameState) => boolean;
  getWinners: (state: BaseGameState) => string[];
  getBotAction: (
    state: BaseGameState,
    playerId: string,
    difficulty: string
  ) => GameAction;
}

// Lazy engine map — add new games here
const engineMap: Record<string, () => Promise<GameEngine>> = {
  blackjack: () => import('@/engine/games/blackjack') as Promise<GameEngine>,
  war: () => import('@/engine/games/war') as Promise<GameEngine>,
  snap: () => import('@/engine/games/snap') as Promise<GameEngine>,
  uno: () => import('@/engine/games/uno') as Promise<GameEngine>,
  crazy8s: () => import('@/engine/games/crazy8s') as Promise<GameEngine>,
  go_fish: () => import('@/engine/games/go_fish') as Promise<GameEngine>,
  solitaire: () => import('@/engine/games/solitaire') as Promise<GameEngine>,
};

// ---------------------------------------------------------------------------
// Bot think-time (ms) per difficulty
// ---------------------------------------------------------------------------

const BOT_DELAY: Record<string, number> = {
  easy: 1200,
  medium: 800,
  hard: 400,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGame() {
  const {
    gameId,
    state,
    isOnline,
    roomCode,
    botDifficulty,
    _setState,
    endGame,
  } = useGameStore();

  const { profile } = useProfileStore();
  const { incrementSequence } = useRoomStore();

  const engineRef = useRef<GameEngine | null>(null);
  const [engineLoaded, setEngineLoaded] = useState(false);
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the engine whenever gameId changes
  useEffect(() => {
    if (!gameId) return;
    const loader = engineMap[gameId];
    if (!loader) {
      console.error(`[useGame] No engine registered for gameId: ${gameId}`);
      return;
    }
    setEngineLoaded(false);
    loader().then((mod) => {
      engineRef.current = mod;
      setEngineLoaded(true);
    });
  }, [gameId]);

  // Derive useful values
  const currentPlayer =
    state && state.players[state.currentPlayerIndex]
      ? state.players[state.currentPlayerIndex]
      : null;

  const myPlayerId = profile?.id ?? null;
  const isMyTurn =
    !!currentPlayer && currentPlayer.id === myPlayerId && !currentPlayer.isBot;

  const legalActions: GameAction[] =
    engineRef.current && state && myPlayerId
      ? engineRef.current.getLegalActions(state, myPlayerId)
      : [];

  // ---------------------------------------------------------------------------
  // doAction: apply an action locally and broadcast if online
  // ---------------------------------------------------------------------------
  const doAction = useCallback(
    (action: GameAction) => {
      if (!engineRef.current || !state) return;

      const nextState = engineRef.current.applyAction(state, action);
      _setState(nextState);

      if (isOnline && roomCode && myPlayerId) {
        const seq = incrementSequence();
        broadcastGameAction(roomCode, myPlayerId, seq, action).catch((err) =>
          console.error('[useGame] broadcastGameAction failed', err)
        );
      }

      // Check terminal
      if (engineRef.current.isTerminal(nextState)) {
        const winners = engineRef.current.getWinners(nextState);
        _setState({ ...nextState, status: 'ended', winners });
        endGame();
      }
    },
    [state, isOnline, roomCode, myPlayerId, _setState, incrementSequence, endGame]
  );

  // ---------------------------------------------------------------------------
  // Bot turns
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!engineLoaded || !state || state.status !== 'playing') return;
    if (!currentPlayer?.isBot) return;

    const delay = BOT_DELAY[botDifficulty] ?? 800;

    botTimerRef.current = setTimeout(() => {
      if (!engineRef.current || !state || !currentPlayer) return;
      try {
        const action = engineRef.current.getBotAction(
          state,
          currentPlayer.id,
          botDifficulty
        );
        doAction(action);
      } catch (err) {
        console.error('[useGame] getBotAction error', err);
      }
    }, delay);

    return () => {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
    };
  }, [
    engineLoaded,
    state?.currentPlayerIndex,
    state?.status,
    botDifficulty,
    doAction,
    // intentionally not exhaustive — we only re-run on index change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]);

  return {
    state,
    legalActions,
    doAction,
    isMyTurn,
    currentPlayer,
    engineLoaded,
  };
}
