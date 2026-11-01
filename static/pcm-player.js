// 24 kHz PCM16 from the model -> speakers, via a ring buffer.
class PCMPlayer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ring = new Float32Array(24000 * 60);
    this.w = 0;
    this.r = 0;
    this.port.onmessage = (e) => {
      if (e.data === "clear") { this.w = this.r = 0; return; }
      const pcm = new Int16Array(e.data);
      for (let i = 0; i < pcm.length; i++) {
        this.ring[this.w] = pcm[i] / 0x8000;
        this.w = (this.w + 1) % this.ring.length;
      }
    };
  }
  process(_inputs, outputs) {
    const out = outputs[0][0];
    for (let i = 0; i < out.length; i++) {
      if (this.r === this.w) { out[i] = 0; continue; }
      out[i] = this.ring[this.r];
      this.r = (this.r + 1) % this.ring.length;
    }
    return true;
  }
}
registerProcessor("pcm-player", PCMPlayer);
