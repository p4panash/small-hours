import { useState } from "react";
import { DEFAULT_SETTINGS, useStore, type BeamMode, type CameraMode } from "../store";

/** M1 spike controls: everything the gate review needs to tune on a real device. */
export function DebugPanel() {
  const [open, setOpen] = useState(false);
  const settings = useStore((s) => s.settings);
  const stats = useStore((s) => s.stats);
  const set = useStore((s) => s.set);
  const requestEnding = useStore((s) => s.requestEnding);

  return (
    <aside className={`debug ${open ? "open" : ""}`}>
      <button className="debug-toggle" onClick={() => setOpen(!open)}>
        {stats.fps} fps · {stats.gridW}×{stats.gridH} {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="debug-body">
          <p className="debug-stats">
            compose {stats.composeMs} ms · cell {stats.cellPx} device px · fear {stats.fear}
          </p>

          <Slider label="Cell size (CSS px)" min={4} max={14} step={0.5} value={settings.cellCss}
            onChange={(cellCss) => set({ cellCss })} />
          <Slider label="Moonlight" min={0.1} max={1.2} step={0.05} value={settings.ambient}
            onChange={(ambient) => set({ ambient })} />
          <Slider label="Glyph exposure" min={1} max={4} step={0.1} value={settings.exposure}
            onChange={(exposure) => set({ exposure })} />

          <label className="row">
            <input type="checkbox" checked={settings.autoFear} onChange={(e) => set({ autoFear: e.target.checked })} />
            Auto fear (beam scares, tall grass / Shift calms)
          </label>
          {!settings.autoFear && (
            <Slider label="Fear" min={0} max={1} step={0.01} value={settings.fear}
              onChange={(fear) => set({ fear })} />
          )}

          <Choice label="Camera" value={settings.camera} options={["follow", "rooms"]}
            onChange={(camera) => set({ camera: camera as CameraMode })} />
          <Choice label="Girl" value={settings.beam} options={["sweep", "pointer", "off"]}
            onChange={(beam) => set({ beam: beam as BeamMode })} />

          <label className="row">
            <input type="checkbox" checked={settings.bloom} onChange={(e) => set({ bloom: e.target.checked })} />
            Bloom
          </label>
          <label className="row">
            <input type="checkbox" checked={settings.fireflies} onChange={(e) => set({ fireflies: e.target.checked })} />
            Fireflies
          </label>
          <label className="row">
            <input type="checkbox" checked={settings.safeArea} onChange={(e) => set({ safeArea: e.target.checked })} />
            Show 64×64 safe area
          </label>

          <button className="reset" onClick={requestEnding}>Play ending</button>
          <button className="reset" onClick={() => set(DEFAULT_SETTINGS)}>Reset settings</button>
          <p className="hint">Move: WASD / arrows, or drag anywhere on touch. Shift: crouch.</p>
        </div>
      )}
    </aside>
  );
}

function Slider(props: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="slider">
      <span>{props.label}: {props.value}</span>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))} />
    </label>
  );
}

function Choice(props: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="choice">
      <span>{props.label}</span>
      {props.options.map((o) => (
        <button key={o} className={o === props.value ? "on" : ""} onClick={() => props.onChange(o)}>{o}</button>
      ))}
    </div>
  );
}
