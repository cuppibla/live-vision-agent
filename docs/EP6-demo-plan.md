# EP6 · Give Your AI Agent Eyes — Demo 录制与放置方案

App: `live-vision-agent`（Look / Watch / Pipeline strip / Watcher）。
目标片长 ~7–8 min。下面是：① 诊断 ② 5 段 demo 怎么录、说什么 ③ 放在脚本哪里 ④ 录制清单。

---

## ① 诊断：现在的脚本哪里会掉人

1. **Hook 是 topic 不是 promise。** "Gemini Live agent is not only with voice. It can also see." 是在陈述主题。观众还没看到它"看见"任何东西。这一集最强的 hook 就是 **cold open demo**：举起一个东西 → "What is this?" → agent 2 秒答出来。先看到结果，再讲原理。
2. **全片没有一个 demo 点位。** 7 分钟纯概念，Part 2（snapshot vs stream）会是 sag 点。好在 app 和脚本是 1:1 对应的：Part 1 → pipeline strip，Part 2 → Look/Watch + token 计数，Part 3 → 语音+画面 + Watcher。每个 Part 都能"说一句、看一眼"。
3. **"frames are not free" 没有证据。** 现在是口述。app 右上角的 `frames · KB · tok` 就是证据，让数字自己涨。
4. **结尾是 recap + 系列回顾，没有 loop。** 这是 series 最后一集，结尾应该把 hook 的那个 demo 再跑一次（闭环），然后抛问题。

---

## ② 五段 demo：录什么、说什么

> 每段录 2–3 个 take，模型每次说的不一样，挑最短最准的那条。

### D0 · Cold open（最重要）
**画面**：浏览器全屏（Chrome 隐藏标签栏），取景框里是你的手举着一个**有文字的东西**（零食包装 / 书封面 / 写着 EP6 的便利贴）。
**操作**：按 `Space`（Look）→ 立刻问。
**你说**：
> "What is this?"
> （agent 答）
> "What does it say?"
> （agent 读出文字）

**剪辑**：两问两答，总长 ≤ 12 s。agent 的回答大字幕已经在画面底部，不用再加字幕。
**旁白接**：
> "It just read the label in my hand. Same live session, same model as the voice agent we built — 今天给它装眼睛。"

### D1 · 一帧的路径（Part 1）
**画面**：按一次 Look。右侧 strip 依次点亮 `CAMERA → CANVAS → JPEG → BLOB → MODEL`，右上角弹出缩略图和 `1 frame · 8 KB`。
**剪辑**：这一下**放慢 50%** + zoom 到 strip。你念 "Camera. Canvas. JPEG. Blob. Model." 的每个词正好卡一个点亮。
**旁白**：
> "Camera. Canvas. JPEG. Blob. Model. That is the pipeline. 看这张缩略图 — 8 KB，这就是 model 收到的全部。"

**加一个代码镜头**（3 s）：`main.py` 里并排的两行
```python
queue.send_realtime(types.Blob(data=pcm,  mime_type="audio/pcm;rate=16000"))
queue.send_realtime(types.Blob(data=jpeg, mime_type="image/jpeg"))
```
> "Same queue. 一行是声音，一行是图。"

### D2 · Look vs Watch（Part 2）
**三个镜头，按顺序：**

a. **Look**：举一本书 / 一份文件，Look，问 "Summarize this page in one sentence." 一帧，答完。
> "One good image is enough."

b. **Watch 1 fps**：开 Watch，紫色边框 + 扫描线。你起身在房间里走、把东西拿进拿出画面，不说话，让 agent 自己评论变化。
> "Now it is watching, not looking."

c. **数字镜头（卡点）**：zoom 到右上角 `tok`。Look 之后是 ~1.3k，Watch 30 秒后 ~5k+。
> "Every frame costs context. 30 seconds of watching = 4× the tokens of one look."

d. **（可选）The wall**：把 fps 调到 2，边 Watch 边连续说话。如果语音开始卡 / 被打断 / 回答滞后，这就是 browser episode 那个 trap 的现场证据。
> "This is the trap from the browser episode — stream the page, and the voice session starts to stutter."
> ⚠️ 这个不一定每次复现。如果录不到，用 c 的 token 数字当 stakes 就够了，不要硬演。

### D3 · "This" 到底指什么（Part 3 开头 · flip 卡点）
**画面**：先**不开摄像头**（取景框显示 "Turn on camera"），问 "What is this?" → agent 说看不到。点 "Turn on camera"，举起东西再问 → 答对。
**旁白**：
> "Same words. The first time 'this' meant nothing. The image resolves the reference."

这是全片最好的 before→after 卡点，放在 Part 3 第一句之前。

### D4 · Watcher（Part 3 advanced）
**画面**：Watcher 输入框打 `a raised hand`，开 Watch。你和 agent 聊别的（"Tell me a two-line poem about coffee."）。聊到一半**举手** → badge 变薄荷绿 "seen…" → agent 插一句 "I just spotted a raised hand."
**旁白**：
> "Two models. One talks. One watches for a single thing. The talker never carries every frame."

**剪辑**：badge 变色的瞬间 zoom。

### D5 · 结尾闭环
再跑一次 D0 的那个物体（或换一个更好玩的），一问一答 5 s，然后系列蒙太奇：
> "Hear. Talk. Act. Remember. See."
每个词配前几集 1 s 的画面，最后停在这一集的取景框。
> "What multimodal agent would you build?"

---

## ③ 放到视频的哪里（~7:30 版本）

| 时间 | 脚本段 | Demo | 备注 |
|---|---|---|---|
| 0:00–0:12 | **（新）cold open** | D0 | 先于任何解释。hook 在 12 s 内落地 |
| 0:12–0:40 | "By the end this video…" promise | — | 把 "we will cover…" 三句压成一句 |
| 0:40–2:00 | Part 1 · how an agent sees | D1 在 "Here is one frame, end to end." 处 | 念一个词亮一个点 |
| 2:00–2:10 | Part 1 takeaway 卡 | — | 标题卡 + 一句 open loop："but **when** do you send it? 这是真正的设计决定" |
| 2:10–4:20 | Part 2 · snapshot vs stream | D2 a→b→c（→d） | token 数字是这一段的 stakes |
| 4:20–4:30 | Part 2 takeaway 卡 | — | open loop："so how does it work with voice at the same time?" |
| 4:30–4:50 | Part 3 开头 | **D3 先于 "You do not have to choose"** | flip 卡点 |
| 4:50–5:30 | Part 3 · words + image | D0 的素材可复用 | "'This' now means the thing in the frame" |
| 5:30–6:30 | Part 3 advanced pattern | D4 | |
| 6:30–7:00 | Recap | — | 三条压到一口气，别重复 takeaway 卡 |
| 7:00–7:30 | Series close | D5 | 蒙太奇 + 问题 |

**节奏**：D1（放慢 zoom）、D2c（数字 punch）、D3（flip）、D4（badge 变色）就是四个 burst，间隔 ~1.5–2 min，刚好 calm → burst → calm。

---

## ④ 录制清单

**设备**
- MacBook 自带摄像头够用；举东西的话用左上角 **FLIP** 切前摄。想用手机当摄像头：`ngrok http 8000`，手机开 https 链接（摄像头和麦克风需要 https）。
- **戴耳机**。echo cancellation 开着，但耳机能保证 agent 不会听到自己说话。
- 系统声音（agent 的声音）和你的麦克风**分轨录**（OBS / Loopback），后期才能调平衡。

**浏览器**
- Chrome，`http://localhost:8000`，全屏（⌃⌘F）或用 "Create shortcut → open as window" 去掉地址栏。
- 1920×1080 录屏。UI 本来就是深色 16:9，直接丢进深色时间线不用加边框。

**操作节奏**
- 先 **Look 再问**（1 秒内）。不要问完再 Look，VAD 可能先触发回答，那一帧还没到。
- 举东西：离镜头 20–30 cm，背景干净，按 Look 前**静止 1 秒**（避免动态模糊）。
- 选**有文字、有颜色**的物体，"read this" 比 "describe this" 更有说服力。
- Watch 模式演示控制在 30–40 s，再长 token 数涨得没意思，而且回答会变啰嗦。

**后期**
- agent 的回答已经是画面底部的大字幕，不要再叠一层字幕。
- 需要 zoom 的四个点：pipeline strip（D1）、右上角 tok（D2c）、"Turn on camera"→画面出现（D3）、watcher badge 变绿（D4）。
- 每段 demo 的 agent 回答如果超过 2 句，剪掉后半句，保留"答对"的那一句。
