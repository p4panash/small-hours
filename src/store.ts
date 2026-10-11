import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type CameraMode = "follow" | "rooms";
export type BeamMode = "sweep" | "pointer" | "off";

export interface Settings {
  cellCss: number;
  fear: number;
  autoFear: boolean;
  ambient: number;
  exposure: number;
  camera: CameraMode;
  beam: BeamMode;
  bloom: boolean;
  safeArea: boolean;
  fireflies: boolean;
}

export interface Stats {
  fps: number;
  composeMs: number;
  gridW: number;
  gridH: number;
  cellPx: number;
  fear: number;
}

/** The ending, as the React overlay needs to know it. */
export type EndingPhase = "none" | "flash" | "title" | "scene" | "card";

interface Store {
  settings: Settings;
  stats: Stats;
  ending: EndingPhase;
  /** Bumped by the UI; the game loop notices the change and acts on it. */
  endingRequest: number;
  replayRequest: number;
  set: (patch: Partial<Settings>) => void;
  setStats: (stats: Stats) => void;
  setEnding: (phase: EndingPhase) => void;
  requestEnding: () => void;
  requestReplay: () => void;
}

export const DEFAULT_SETTINGS: Settings = {
  cellCss: 7,
  fear: 0,
  autoFear: true,
  ambient: 0.6,
  exposure: 2.2,
  camera: "follow",
  beam: "sweep",
  bloom: true,
  safeArea: false,
  fireflies: true,
};

// The engine reads `useStore.getState()` each frame; React only re-renders the debug panel.
export const useStore = create<Store>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      stats: { fps: 0, composeMs: 0, gridW: 0, gridH: 0, cellPx: 0, fear: 0 },
      ending: "none",
      endingRequest: 0,
      replayRequest: 0,
      set: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setStats: (stats) => set({ stats }),
      setEnding: (ending) => set({ ending }),
      requestEnding: () => set((s) => ({ endingRequest: s.endingRequest + 1 })),
      requestReplay: () => set((s) => ({ replayRequest: s.replayRequest + 1 })),
    }),
    {
      name: "small-hours-debug",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ settings: s.settings }),
      merge: (persisted, current) => ({
        ...current,
        settings: { ...DEFAULT_SETTINGS, ...(persisted as Partial<Store>)?.settings },
      }),
    },
  ),
);
