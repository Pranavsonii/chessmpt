"use client";

import { Chess } from "chess.js";
import { useState } from "react";
import { Chessboard } from "react-chessboard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Side } from "@/lib/live-match";

const PROMOTIONS = [
  { piece: "q", label: "Queen", white: "♕", black: "♛" },
  { piece: "r", label: "Rook", white: "♖", black: "♜" },
  { piece: "b", label: "Bishop", white: "♗", black: "♝" },
  { piece: "n", label: "Knight", white: "♘", black: "♞" },
] as const;

const LAST_MOVE_STYLE = { background: "rgba(250, 204, 21, 0.4)" };

/** Is from->to a legal move here? (Used before asking which piece to promote to.) */
function isLegal(fen: string, from: string, to: string): boolean {
  return new Chess(fen).moves({ verbose: true }).some((m) => m.from === from && m.to === to);
}

/**
 * The live board. Pieces can only be dragged on your turn, and only your own.
 * `onMove` returns false for an illegal move, which makes the piece snap back.
 */
export function GameBoard({
  position,
  orientation,
  canMove,
  lastMove,
  onMove,
}: {
  position: string;
  orientation: Side;
  canMove: boolean;
  lastMove?: { from: string; to: string };
  onMove: (from: string, to: string, promotion?: string) => boolean;
}) {
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const myPrefix = orientation === "white" ? "w" : "b";

  return (
    <>
      <div className="aspect-square w-full overflow-hidden rounded-lg shadow-sm ring-1 ring-border">
        <Chessboard
          options={{
            id: "live-board",
            position,
            boardOrientation: orientation,
            allowDragging: canMove,
            canDragPiece: ({ piece }) => canMove && piece.pieceType.startsWith(myPrefix),
            onPieceDrop: ({ piece, sourceSquare, targetSquare }) => {
              if (!targetSquare || targetSquare === sourceSquare) return false;
              const lastRank = orientation === "white" ? "8" : "1";
              if (piece.pieceType.endsWith("P") && targetSquare.endsWith(lastRank)) {
                if (!isLegal(position, sourceSquare, targetSquare)) return false;
                setPromotion({ from: sourceSquare, to: targetSquare }); // ask first, then move
                return false;
              }
              return onMove(sourceSquare, targetSquare);
            },
            squareStyles: lastMove
              ? { [lastMove.from]: LAST_MOVE_STYLE, [lastMove.to]: LAST_MOVE_STYLE }
              : {},
            darkSquareStyle: { backgroundColor: "#7a5c3e" },
            lightSquareStyle: { backgroundColor: "#ead9b9" },
          }}
        />
      </div>

      <Dialog open={promotion !== null} onOpenChange={(open) => !open && setPromotion(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Promote pawn</DialogTitle>
            <DialogDescription>Choose the piece your pawn becomes.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-2">
            {PROMOTIONS.map((p) => (
              <Button
                key={p.piece}
                variant="outline"
                className="h-20 flex-col gap-1"
                onClick={() => {
                  if (promotion) onMove(promotion.from, promotion.to, p.piece);
                  setPromotion(null);
                }}
              >
                <span className="text-4xl leading-none" aria-hidden>
                  {orientation === "white" ? p.white : p.black}
                </span>
                <span className="text-xs">{p.label}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
