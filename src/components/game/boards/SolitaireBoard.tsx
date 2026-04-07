import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '@/hooks/useGame';
import Card from '@/components/card/Card';
import GameHUD from '@/components/game/GameHUD';
import ResultOverlay from '@/components/game/ResultOverlay';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import type { BoardProps } from '../GameBoard';
import type { Card as CardType } from '@/types';

export default function SolitaireBoard({ gameId }: BoardProps) {
  const navigate = useNavigate();
  const { state, legalActions, doAction, isMyTurn, restart } = useGame(gameId);
  const [selected, setSelected] = useState<{ source: string; cardId: string; cards: CardType[] } | null>(null);

  if (!state) return null;

  const sol = state as any;
  const stock: CardType[] = sol.stock ?? [];
  const waste: CardType[] = sol.waste ?? [];
  const foundations: CardType[][] = sol.foundations ?? [[], [], [], []];
  const tableau: CardType[][] = sol.tableau ?? [[], [], [], [], [], [], []];
  const topWaste = waste[waste.length - 1];

  const gameOver = state.status === 'finished' || state.status === 'ended';
  const localPlayer = state.players[0];

  function handleStockClick() {
    doAction({ type: 'stockToWaste', payload: {} });
  }

  function handleWasteClick() {
    if (!topWaste) return;
    // Try to auto-move to foundation
    const canFoundation = legalActions.some((a: any) => a.type === 'wasteToFoundation');
    if (canFoundation) doAction({ type: 'wasteToFoundation', payload: {} });
  }

  function handleTableauCardClick(colIndex: number, card: CardType) {
    const col = tableau[colIndex];
    const cardIdx = col.findIndex((c) => c.id === card.id);
    if (!card.faceUp) return;

    if (selected) {
      // Try to place
      doAction({ type: 'tableauToTableau', payload: { fromCol: selected.source === 'waste' ? -1 : parseInt(selected.source), toCol: colIndex, cardId: selected.cardId } });
      setSelected(null);
    } else {
      // Select this card and everything below it
      const cards = col.slice(cardIdx);
      setSelected({ source: String(colIndex), cardId: card.id, cards });
    }
  }

  function handleFoundationClick(idx: number) {
    if (!selected) return;
    if (selected.source === 'waste') {
      doAction({ type: 'wasteToFoundation', payload: {} });
    } else {
      doAction({ type: 'tableauToFoundation', payload: { fromCol: parseInt(selected.source), cardId: selected.cardId } });
    }
    setSelected(null);
  }

  const cardW = 46;
  const cardH = 64;

  return (
    <div className="relative w-full h-full bg-felt-dark flex flex-col overflow-hidden">
      <GameHUD
        gameId={gameId}
        currentPlayerName=""
        isMyTurn={true}
        onExit={() => navigate('/')}
      />

      {/* Top row: stock + waste + foundations */}
      <div className="flex gap-1.5 px-2 pt-16 pb-2 justify-between">
        {/* Stock */}
        <div
          className={cn('rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer transition-transform active:scale-95')}
          style={{ width: cardW, height: cardH }}
          onClick={handleStockClick}
        >
          {stock.length > 0 ? (
            <Card card={stock[stock.length - 1]} faceUp={false} size="sm" />
          ) : (
            <span className="text-white/20 text-xs">↺</span>
          )}
        </div>
        {/* Waste */}
        <div
          className="relative rounded-lg border-2 border-dashed border-white/10 cursor-pointer"
          style={{ width: cardW, height: cardH }}
          onClick={handleWasteClick}
        >
          {topWaste && <Card card={topWaste} faceUp size="sm" />}
        </div>
        <div style={{ width: cardW }} />
        {/* Foundations */}
        {foundations.map((foundation, i) => {
          const top = foundation[foundation.length - 1];
          return (
            <div
              key={i}
              className="rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer"
              style={{ width: cardW, height: cardH }}
              onClick={() => handleFoundationClick(i)}
            >
              {top ? <Card card={top} faceUp size="sm" /> : <span className="text-white/20">A</span>}
            </div>
          );
        })}
      </div>

      {/* Tableau */}
      <div className="flex gap-1 px-2 flex-1 overflow-hidden">
        {tableau.map((col, colIndex) => (
          <div
            key={colIndex}
            className="relative flex-1"
            onClick={() => {
              if (selected && !col.length) {
                doAction({ type: 'tableauToTableau', payload: { fromCol: parseInt(selected.source), toCol: colIndex, cardId: selected.cardId } });
                setSelected(null);
              }
            }}
          >
            <div className="absolute inset-0 rounded-lg border-2 border-dashed border-white/10" />
            {col.map((card, cardIdx) => {
              const isSelected = selected?.cardId === card.id || (selected?.cards ?? []).some(c => c.id === card.id);
              return (
                <div
                  key={card.id}
                  className="absolute"
                  style={{ top: cardIdx * 16, left: 0, right: 0, zIndex: cardIdx }}
                  onClick={(e) => { e.stopPropagation(); handleTableauCardClick(colIndex, card); }}
                >
                  <Card card={card} faceUp={card.faceUp} size="sm" selected={isSelected} />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Auto complete */}
      {legalActions.some((a: any) => a.type === 'autoComplete') && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center">
          <Button variant="gold" onClick={() => doAction({ type: 'autoComplete', payload: {} })}>
            Auto Complete ✨
          </Button>
        </div>
      )}

      <ResultOverlay
        visible={gameOver}
        winners={localPlayer ? [localPlayer] : []}
        isLocalPlayerWinner={gameOver}
        players={state.players}
        onPlayAgain={restart}
        onExit={() => navigate('/')}
      />
    </div>
  );
}
