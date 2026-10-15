"use client";

import { Copy } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MoveView } from "@/lib/live-match";

/** Move list as numbered pairs (1. e4 e5), always scrolled to the latest move, plus Copy PGN. */
export function PgnPanel({ moves, pgn }: { moves: MoveView[]; pgn: string }) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [moves.length]);

  const rows: { n: number; white?: string; black?: string }[] = [];
  moves.forEach((m, i) => {
    if (i % 2 === 0) rows.push({ n: i / 2 + 1, white: m.san });
    else rows[rows.length - 1].black = m.san;
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pgn);
      toast.success("PGN copied");
    } catch {
      toast.error("Couldn't copy, your browser blocked clipboard access");
    }
  };

  return (
    <Card className="gap-3">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Moves</CardTitle>
        <Button variant="outline" size="sm" onClick={copy} disabled={!pgn}>
          <Copy /> Copy PGN
        </Button>
      </CardHeader>
      <CardContent>
        <div ref={scroller} className="max-h-72 overflow-y-auto rounded-md border">
          {rows.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No moves yet</p>
          ) : (
            <table className="w-full font-mono text-sm">
              <tbody>
                {rows.map((r) => (
                  <tr key={r.n} className="odd:bg-muted/50">
                    <td className="w-10 px-3 py-1 text-right text-muted-foreground">{r.n}.</td>
                    <td className="px-3 py-1">{r.white}</td>
                    <td className="px-3 py-1">{r.black ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
