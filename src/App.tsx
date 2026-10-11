import { DebugPanel } from "./ui/DebugPanel";
import { EndingOverlay } from "./ui/EndingOverlay";
import { GameCanvas } from "./ui/GameCanvas";

export function App() {
  return (
    <main className="app">
      <GameCanvas />
      <DebugPanel />
      <EndingOverlay />
    </main>
  );
}
