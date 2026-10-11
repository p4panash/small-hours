import { useEffect, useState } from "react";
import { useStore } from "../store";

const CALL = "Miloooo!";

/** The white flash, "Miloooo!", and the end card. The close-up itself is drawn by the engine. */
export function EndingOverlay() {
  const phase = useStore((s) => s.ending);
  const requestReplay = useStore((s) => s.requestReplay);
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    if (phase !== "title") return;
    setTyped(0);
    // Type it out, stretching the o's like she's calling across the yard.
    let i = 0;
    let timer = 0;
    const next = () => {
      i++;
      setTyped(i);
      if (i < CALL.length) timer = window.setTimeout(next, CALL[i] === "o" && i > 3 ? 170 : 110);
    };
    timer = window.setTimeout(next, 350);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === "none") return null;
  const white = phase === "flash" || phase === "title";

  return (
    <>
      <div className={`ending-white ${white ? "on" : ""} ${phase === "flash" ? "flash" : ""}`} aria-live="polite">
        <p className="ending-call">{phase === "title" || phase === "scene" ? CALL.slice(0, typed) : ""}</p>
      </div>
      {phase === "card" && (
        <div className="end-card">
          <h1>Small Hours</h1>
          <p>Episode 1 · Milo</p>
          <button onClick={requestReplay}>Play again</button>
        </div>
      )}
    </>
  );
}
