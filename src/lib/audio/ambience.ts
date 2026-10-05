"use client";

/**
 * Procedural sound design (WebAudio, zero assets):
 * room tone · warm pad · door creak & thud · footsteps · page rustle · discovery chime · thinking shimmer.
 */
class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  private reverb!: ConvolverNode;
  private noiseBuf!: AudioBuffer;
  private ambienceStarted = false;
  private shimmer: { g: GainNode } | null = null;

  init() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);
    // noise buffer
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // synthetic hall impulse response
    const ir = ctx.createBuffer(2, ctx.sampleRate * 2.8, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 3.2);
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.reverb.connect(wet).connect(this.master);
  }

  setEnabled(on: boolean) {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.2);
  }

  private noise(loop = false) {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = loop;
    return s;
  }

  private out(node: AudioNode, dry = 1, wet = 0.6) {
    const ctx = this.ctx!;
    const d = ctx.createGain();
    d.gain.value = dry;
    node.connect(d).connect(this.master);
    const w = ctx.createGain();
    w.gain.value = wet;
    node.connect(w).connect(this.reverb);
  }

  startAmbience() {
    if (!this.ctx || this.ambienceStarted) return;
    this.ambienceStarted = true;
    const ctx = this.ctx;
    // room tone
    const n = this.noise(true);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 220;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 4);
    n.connect(lp).connect(g);
    this.out(g, 1, 0.2);
    n.start();
    // warm pad (slowly breathing open fifths)
    const notes = [110, 164.81, 220, 277.18];
    const pad = ctx.createGain();
    pad.gain.value = 0;
    pad.gain.linearRampToValueAtTime(0.022, ctx.currentTime + 8);
    const padLp = ctx.createBiquadFilter();
    padLp.type = "lowpass";
    padLp.frequency.value = 900;
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? "triangle" : "sine";
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 8;
      const og = ctx.createGain();
      og.gain.value = 0.5;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.03;
      const lg = ctx.createGain();
      lg.gain.value = 0.35;
      lfo.connect(lg).connect(og.gain);
      o.connect(og).connect(padLp);
      o.start();
      lfo.start();
    });
    padLp.connect(pad);
    this.out(pad, 0.6, 1);
  }

  door() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // creak: resonant sawtooth with jittery pitch
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(70, t);
    for (let i = 0; i < 20; i++) o.frequency.linearRampToValueAtTime(55 + Math.random() * 40, t + 0.1 + i * 0.09);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 700;
    bp.Q.value = 8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.3);
    g.gain.linearRampToValueAtTime(0.05, t + 1.4);
    g.gain.linearRampToValueAtTime(0, t + 2.2);
    o.connect(bp).connect(g);
    this.out(g, 1, 0.9);
    o.start(t);
    o.stop(t + 2.3);
    // heavy air / swell
    const n = this.noise();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(200, t);
    lp.frequency.linearRampToValueAtTime(1200, t + 1.8);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(0.12, t + 1.6);
    ng.gain.linearRampToValueAtTime(0, t + 2.6);
    n.connect(lp).connect(ng);
    this.out(ng, 1, 1);
    n.start(t);
    n.stop(t + 2.7);
  }

  footstep(pan = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const n = this.noise();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 500 + Math.random() * 300;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    n.connect(bp).connect(g).connect(p);
    this.out(p, 1, 0.5);
    n.start(t, Math.random());
    n.stop(t + 0.15);
  }

  pageRustle() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const n = this.noise();
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    for (let i = 0; i < 8; i++) g.gain.linearRampToValueAtTime(Math.random() * 0.09, t + 0.04 + i * 0.05);
    g.gain.linearRampToValueAtTime(0, t + 0.55);
    n.connect(hp).connect(g);
    this.out(g, 1, 0.4);
    n.start(t, Math.random());
    n.stop(t + 0.6);
  }

  chime() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [880, 1318.5, 1760].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + i * 0.08);
      g.gain.linearRampToValueAtTime(0.05, t + i * 0.08 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0005, t + i * 0.08 + 1.6);
      o.connect(g);
      this.out(g, 0.7, 1);
      o.start(t + i * 0.08);
      o.stop(t + i * 0.08 + 1.7);
    });
  }

  thinking(on: boolean) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (on && !this.shimmer) {
      const n = this.noise(true);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 3000;
      bp.Q.value = 6;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.6;
      const lg = ctx.createGain();
      lg.gain.value = 1500;
      lfo.connect(lg).connect(bp.frequency);
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(0.03, ctx.currentTime, 0.3);
      n.connect(bp).connect(g);
      this.out(g, 0.6, 1);
      n.start();
      lfo.start();
      this.shimmer = { g };
      (g as any)._stop = () => {
        n.stop();
        lfo.stop();
      };
    } else if (!on && this.shimmer) {
      const g = this.shimmer.g;
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      setTimeout(() => (g as any)._stop?.(), 1200);
      this.shimmer = null;
    }
  }
}

export const audio = new AudioEngine();
