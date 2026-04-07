import { create } from 'zustand';
import type { Player, BotDifficulty } from '@/types/player';
import type { GameAction, BaseGameState } from '@/types/game';

interface GameStore {
  gameId: string | null;
  state: BaseGameState | null;
  isOnline: boolean;
  roomCode: string | null;
  botDifficulty: BotDifficulty;
  // Actions
  startGame(
    gameId: string,
    players: Player[],
    options?: Record<string, unknown>,
    seed?: number
  ): void;
  applyAction(action: GameAction): void;
  setOnlineMode(roomCode: string): void;
  endGame(): void;
  setBotDifficulty(d: BotDifficulty): void;
  // Internal – set state from engine
  _setState(state: BaseGameState): void;
}

export const useGameStore = create<GameStore>()((set, get) => ({
  gameId: null,
  state: null,
  isOnline: false,
  roomCode: null,
  botDifficulty: 'medium',

  startGame(
    gameId: string,
    players: Player[],
    _options?: Record<string, unknown>,
    _seed?: number
  ) {
    // The engine hook (useGame) handles initialising the actual game state;
    // here we just record which game is active and who's playing.
    const baseState: BaseGameState = {
      gameId,
      players,
      currentPlayerIndex: 0,
      status: 'playing',
      winners: [],
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    };
    set({ gameId, state: baseState, isOnline: get().isOnline });
  },

  applyAction(action: GameAction) {
    // The useGame hook owns the real reducer call; this method exists so the
    // roomStore / online path can route actions through a single place.
    // The hook replaces state via _setState after running the engine.
    // For offline games the hook handles everything directly.
    void action; // will be consumed by useGame
  },

  setOnlineMode(roomCode: string) {
    set({ isOnline: true, roomCode });
  },

  endGame() {
    set({ gameId: null, state: null, isOnline: false, roomCode: null });
  },

  setBotDifficulty(d: BotDifficulty) {
    set({ botDifficulty: d });
  },

  _setState(state: BaseGameState) {
    set({ state });
  },
}));
