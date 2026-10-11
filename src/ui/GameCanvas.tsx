import { useEffect, useRef } from "react";
import { Game } from "../game/game";
import { useStore } from "../store";

/** Mounts the engine once; it never re-renders per frame. */
export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const game = new Game(canvasRef.current!, stickRef.current);
    void game.start();
    if (import.meta.env.DEV) Object.assign(window, { __game: game, __store: useStore });
    return () => game.dispose();
  }, []);

  return (
    <div className="stage">
      <canvas ref={canvasRef} className="game-canvas" />
      <div ref={stickRef} className="stick" aria-hidden>
        <div className="stick-knob" />
      </div>
    </div>
  );
}
