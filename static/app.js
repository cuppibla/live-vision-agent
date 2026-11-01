// EP6 · Give your agent eyes.
//
//   camera -> canvas -> JPEG -> Blob -> model
//
// "Look"  = one deliberate frame (snapshot)
// "Watch" = frames over time (stream)

const $ = (id) => document.getElementById(id);
const el = {
  viewfinder: $("viewfinder"), video: $("video"), canvas: $("canvas"), flash: $("flash"),
  status: $("status"), statusText: $("statusText"), stat: $("stat"),
  you: $("youText"), agent: $("agentText"),
  look: $("lookBtn"), watch: $("watchBtn"), fps: $("fps"),
  pipeline: $("pipeline"), thumb: $("thumb"),
  watchTarget: $("watchTarget"), watchBadge: $("watchBadge"),
  mic: $("micBtn"), hint: $("hint"),
};

const S = {
  ws: null, live: false,
  audioIn: null, audioOut: null, player: null, micStream: null,
  streaming: false, fps: 1, timer: null,
  frames: 0, tokens: 0,
  agentText: "", agentFresh: true, youText: "",
};

/* ───────────────── camera ───────────────── */
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    el.video.srcObject = stream;
  } catch (e) {
    setHint("camera blocked", true);
  }
}

// One frame, end to end: video -> canvas -> JPEG bytes.
async function captureFrame() {
  const vw = el.video.videoWidth, vh = el.video.videoHeight;
  if (!vw) return null;
  lit("camera");
  const scale = Math.min(1, 768 / vw);
  el.canvas.width = Math.round(vw * scale);
  el.canvas.height = Math.round(vh * scale);
  el.canvas.getContext("2d").drawImage(el.video, 0, 0, el.canvas.width, el.canvas.height);
  lit("canvas", 90);
  const blob = await new Promise((r) => el.canvas.toBlob(r, "image/jpeg", 0.7));
  lit("jpeg", 180);
  const buf = await blob.arrayBuffer();
  return { b64: b64(buf), bytes: buf.byteLength, url: URL.createObjectURL(blob) };
}

async function sendFrame(mode) {
  const f = await captureFrame();
  if (!f) return;
  lit("blob", 270);
  showThumb(f.url);
  send({ type: "frame", mode, data: f.b64, watch: !!el.watchTarget.value.trim() });
  if (!S.live) { // offline: still show the pipeline so the UI teaches itself
    setTimeout(() => { lit("model"); bump(f.bytes); }, 360);
  }
}

/* ───────────────── modes ───────────────── */
function look() {
  if (S.streaming) return;
  el.flash.classList.remove("go"); void el.flash.offsetWidth; el.flash.classList.add("go");
  el.look.classList.add("go");
  el.viewfinder.dataset.mode = "snapshot";
  el.pipeline.classList.remove("stream");
  sendFrame("snapshot");
  setTimeout(() => { el.look.classList.remove("go"); if (!S.streaming) el.viewfinder.dataset.mode = "idle"; }, 500);
}

function setStreaming(on) {
  S.streaming = on;
  clearInterval(S.timer);
  el.watch.classList.toggle("on", on);
  el.pipeline.classList.toggle("stream", on);
  el.viewfinder.dataset.mode = on ? "stream" : "idle";
  if (on) {
    sendFrame("stream");
    S.timer = setInterval(() => sendFrame("stream"), 1000 / S.fps);
  }
}

el.look.onclick = look;
el.watch.onclick = (e) => { if (e.target.closest(".fps")) return; setStreaming(!S.streaming); };
el.fps.onclick = (e) => {
  const b = e.target.closest("b"); if (!b) return;
  S.fps = parseFloat(b.dataset.fps);
  [...el.fps.children].forEach((x) => x.classList.toggle("on", x === b));
  if (S.streaming) setStreaming(true);
};
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && e.target.tagName !== "INPUT") { e.preventDefault(); look(); }
});

/* ───────────────── watcher ───────────────── */
el.watchTarget.onchange = () => {
  const target = el.watchTarget.value.trim();
  send({ type: "watch", target });
  setBadge(target ? "watching" : "off", target ? "watching" : "");
};

/* ───────────────── live session ───────────────── */
async function connect() {
  setHint("connecting…");
  S.frames = 0; S.tokens = 0; S.lastKB = 0; stat();
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  S.ws = ws;
  ws.onopen = async () => {
    try { await startAudio(); } catch (e) { setHint("mic blocked", true); return; }
    S.live = true;
    el.mic.classList.add("live"); el.status.classList.add("live");
    el.statusText.textContent = "live"; setHint("listening");
    if (el.watchTarget.value.trim()) el.watchTarget.onchange();
  };
  ws.onmessage = (e) => handle(JSON.parse(e.data));
  ws.onclose = () => disconnect(false);
  ws.onerror = () => setHint("connection failed", true);
}

function disconnect(closeWs = true) {
  S.live = false;
  if (closeWs && S.ws) S.ws.close();
  S.ws = null;
  setStreaming(false);
  S.micStream?.getTracks().forEach((t) => t.stop());
  S.audioIn?.close(); S.audioOut?.close();
  S.audioIn = S.audioOut = S.player = S.micStream = null;
  el.mic.classList.remove("live"); el.status.classList.remove("live");
  el.statusText.textContent = "offline";
  if (!el.hint.classList.contains("err")) setHint("tap to go live");
  el.mic.style.setProperty("--level", 1);
}

el.mic.onclick = () => (S.live || S.ws ? disconnect() : connect());

function send(msg) {
  if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(msg));
}

function handle(m) {
  switch (m.type) {
    case "audio": {
      const buf = b64ToBuf(m.data); S.audioBytes = (S.audioBytes || 0) + buf.byteLength;
      S.player?.port.postMessage(buf);
      break;
    }
    case "transcript":
      if (m.role === "user") {
        S.youText = m.final ? m.text : S.youText + m.text;
        el.you.textContent = S.youText;
        if (m.final) S.youText = "";
      } else {
        if (S.agentFresh) { S.agentText = ""; S.agentFresh = false; }
        S.agentText = m.final ? m.text : S.agentText + m.text;
        el.agent.textContent = S.agentText;
        if (m.final) S.agentFresh = true;
      }
      break;
    case "turn_complete":
      S.agentFresh = true; S.youText = "";
      break;
    case "interrupted":
      S.player?.port.postMessage("clear");
      S.agentFresh = true;
      break;
    case "frame_ack":
      lit("model");
      bump(m.bytes);
      break;
    case "usage":
      S.tokens = m.total; stat();
      break;
    case "watch_target":
      setBadge(m.target ? "watching" : "off", m.target ? "watching" : "");
      break;
    case "watch":
      if (m.error) setBadge("error", "");
      else if (m.seen) setBadge(m.note || "seen", "seen");
      else setBadge("watching", "watching");
      break;
    case "error":
      setHint(m.message, true);
      break;
  }
}

/* ───────────────── audio ───────────────── */
async function startAudio() {
  S.audioOut = new AudioContext({ sampleRate: 24000 });
  await S.audioOut.audioWorklet.addModule("/static/pcm-player.js");
  S.player = new AudioWorkletNode(S.audioOut, "pcm-player");
  S.player.connect(S.audioOut.destination);

  S.micStream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  S.audioIn = new AudioContext({ sampleRate: 16000 });
  await S.audioIn.audioWorklet.addModule("/static/pcm-recorder.js");
  const src = S.audioIn.createMediaStreamSource(S.micStream);
  const rec = new AudioWorkletNode(S.audioIn, "pcm-recorder");
  src.connect(rec);
  rec.port.onmessage = (e) => {
    el.mic.style.setProperty("--level", 1 + Math.min(1, e.data.level * 2) * 0.35);
    send({ type: "audio", data: b64(e.data.buffer) });
  };
}

/* ───────────────── ui helpers ───────────────── */
function lit(node, delay = 0) {
  setTimeout(() => {
    const n = el.pipeline.querySelector(`[data-node="${node}"]`);
    n.classList.add("lit");
    setTimeout(() => n.classList.remove("lit"), 520);
  }, delay);
}
function showThumb(url) {
  el.thumb.src = url; el.thumb.classList.add("show");
  clearTimeout(showThumb.t); showThumb.t = setTimeout(() => el.thumb.classList.remove("show"), 1600);
}
function bump(bytes) { S.frames++; S.lastKB = Math.round(bytes / 1024); stat(); }
function stat() {
  const parts = [`${S.frames} frame${S.frames === 1 ? "" : "s"}`];
  if (S.lastKB) parts.push(`${S.lastKB} KB`);
  if (S.tokens) parts.push(`${(S.tokens / 1000).toFixed(1)}k tok`);
  el.stat.textContent = parts.join(" · ");
}
function setBadge(text, cls) { el.watchBadge.textContent = text; el.watchBadge.className = `badge ${cls}`; }
function setHint(text, err = false) { el.hint.textContent = text; el.hint.classList.toggle("err", err); }

function b64(buf) {
  const bytes = new Uint8Array(buf); let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function b64ToBuf(s) {
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

startCamera();
window.EYES = S; // exposed for tests
