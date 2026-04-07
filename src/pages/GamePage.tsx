import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GameLayout from '@/components/layout/GameLayout';
import GameBoard from '@/components/game/GameBoard';
import { useGameStore } from '@/store/gameStore';

export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { gameId: storeGameId, state } = useGameStore();

  // Redirect home only if no game was ever loaded (not on game-over)
  useEffect(() => {
    if (!storeGameId) {
      navigate('/', { replace: true });
    }
  }, [storeGameId, navigate]);

  if (!gameId) return null;

  return (
    <GameLayout>
      <GameBoard gameId={gameId} />
    </GameLayout>
  );
}
