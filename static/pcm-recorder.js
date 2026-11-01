// Mic -> 16 kHz PCM16 chunks. Runs in the audio thread.
class PCMRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Int16Array(2048); // 128 ms at 16 kHz
    this.n = 0;
    this.peak = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      if (Math.abs(s) > this.peak) this.peak = Math.abs(s);
      this.buf[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === this.buf.length) {
        this.port.postMessage({ buffer: this.buf.buffer, level: this.peak }, [this.buf.buffer]);
        this.buf = new Int16Array(2048);
        this.n = 0;
        this.peak = 0;
      }
    }
    return true;
  }
}
registerProcessor("pcm-recorder", PCMRecorder);
