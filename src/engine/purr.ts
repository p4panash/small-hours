/**
 * Milo's purr. On phones that support it (Android), the phone itself purrs: three slow
 * breaths of quick pulses. Everywhere (including iOS, which has no web vibration) a soft
 * synthesized rumble plays: low-passed noise with a ~24 Hz flutter. No voice, no samples.
 */
export class Purr {
  private ctx: AudioContext | null = null;
  private stopAt = 0;

  start(breaths = 3, breathSecs = 2.2) {
    this.vibrate(breaths, breathSecs);
    this.sound(breaths, breathSecs);
  }

  stop() {
    navigator.vibrate?.(0);
    void this.ctx?.close();
    this.ctx = null;
  }

  private vibrate(breaths: number, breathSecs: number) {
    if (!("vibrate" in navigator)) return;
    const pattern: number[] = [];
    for (let b = 0; b < breaths; b++) {
      // Rumble: short buzz / short gap, a little longer in the middle of each breath.
      const pulses = Math.floor((breathSecs * 1000) / 50);
      for (let i = 0; i < pulses; i++) {
        const mid = Math.sin((i / pulses) * Math.PI);
        pattern.push(Math.round(18 + mid * 14), Math.round(32 - mid * 14));
      }
      pattern[pattern.length - 1] += 450; // a pause between breaths
    }
    try {
      navigator.vibrate(pattern);
    } catch {
      // Some browsers refuse without a recent user gesture; the sound still plays.
    }
  }

  private sound(breaths: number, breathSecs: number) {
    try {
      const ctx = new AudioContext();
      this.ctx = ctx;
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        // Brown noise: warm and soft, no hiss.
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        data[i] = last * 3.5;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 220;

      // Amplitude flutter at ~24 Hz is what makes noise sound like a purr.
      const flutter = ctx.createGain();
      flutter.gain.value = 0.5;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 24;
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = 0.5;
      lfo.connect(lfoDepth).connect(flutter.gain);

      const env = ctx.createGain();
      env.gain.value = 0;
      const now = ctx.currentTime + 0.05;
      for (let b = 0; b < breaths; b++) {
        const t0 = now + b * (breathSecs + 0.45);
        env.gain.setValueAtTime(0, t0);
        env.gain.linearRampToValueAtTime(0.35, t0 + breathSecs * 0.4);
        env.gain.linearRampToValueAtTime(0, t0 + breathSecs);
      }
      this.stopAt = now + breaths * (breathSecs + 0.45);

      noise.connect(lowpass).connect(flutter).connect(env).connect(ctx.destination);
      noise.start(now);
      lfo.start(now);
      noise.stop(this.stopAt);
      lfo.stop(this.stopAt);
    } catch {
      // No audio available; the visual purr still plays.
    }
  }
}
