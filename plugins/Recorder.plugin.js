/**
 * @name OpsexCord
 * @author @geofeed on discord
 */

const NAME = "Recorder";

const h = (tag, attrs, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
};
const clock = (s) => { s = Math.floor(s); const m = Math.floor(s / 60); return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
const live = (t) => t && t.readyState === "live";

const CSS = `
#rc-root, #rc-root * { box-sizing: border-box; }
#rc-root button { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; }

#rc-card { position: fixed; top: 48px; right: 16px; width: 300px; z-index: 9997; display: none; flex-direction: column; gap: 12px; padding: 16px;
  background: radial-gradient(320px 150px at 50% -14%, rgba(255,255,255,.075), transparent 72%), #000;
  color: #f4f4f5; border: 1px solid rgba(255,255,255,.13); border-radius: 18px;
  box-shadow: 0 0 0 1px rgba(0,0,0,.6), 0 18px 50px rgba(0,0,0,.8), 0 0 46px rgba(255,255,255,.04);
  font: 13px/1.45 "gg sans","Segoe UI",system-ui,sans-serif; -webkit-user-select: none; user-select: none; }
#rc-card.open { display: flex; animation: rcfade .3s ease both; }
@keyframes rcfade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
#rc-card h3 { margin: 0; font-size: 15px; font-weight: 600; letter-spacing: .02em; display: flex; align-items: center; }
#rc-card h3 button { margin-left: auto; width: 28px; height: 28px; border-radius: 50%; color: #7e7e87; transition: color .15s, background .15s; }
#rc-card h3 button:hover { background: rgba(255,255,255,.08); color: #fff; }

.rc-btns { display: flex; gap: 8px; }
.rc-btn { flex: 1; height: 42px; padding: 0 14px; border-radius: 999px; font-size: 13.5px; font-weight: 600; letter-spacing: .03em;
  display: flex; align-items: center; justify-content: center; gap: 8px; color: #fff;
  background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.33);
  transition: background .15s, border-color .15s, transform .1s; }
.rc-btn:hover { background: rgba(255,255,255,.22); border-color: rgba(255,255,255,.5); }
.rc-btn:active { transform: scale(.985); }
.rc-btn.ghost { font-weight: 500; font-size: 12.5px; height: 38px; color: #cfcfd4; background: rgba(255,255,255,.04); border-color: rgba(255,255,255,.13); }
.rc-btn.ghost:hover { color: #fff; background: rgba(255,255,255,.1); border-color: rgba(255,255,255,.3); }
.rc-dot { width: 9px; height: 9px; border-radius: 50%; background: #ff4d52; box-shadow: 0 0 10px rgba(255,77,82,.7); flex: none; }

.rc-chk { display: flex; align-items: center; gap: 10px; color: #b4b4bc; cursor: pointer; padding: 2px 2px; }
.rc-chk input { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; margin: 0; flex: none; cursor: pointer; border-radius: 6px;
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.25); transition: background .15s, border-color .15s, box-shadow .15s; }
.rc-chk input:hover { border-color: rgba(255,255,255,.5); }
.rc-chk input:focus-visible { box-shadow: 0 0 0 3px rgba(255,255,255,.12); outline: none; }
.rc-chk input:checked { background: #f4f4f5 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.4l3 3 6-6.4' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / 14px no-repeat; border-color: #f4f4f5; }
.rc-chk:hover { color: #fff; }

#rc-msg { min-height: 18px; color: #7e7e87; font-size: 12px; word-break: break-word; }
#rc-msg.err { color: #ff7b80; }
.rc-note { color: #6a6a73; font-size: 11.5px; line-height: 1.5; padding-top: 10px; border-top: 1px solid rgba(255,255,255,.08); }

#rc-pill { position: fixed; top: 12px; right: 170px; z-index: 9997; display: none; align-items: center; gap: 9px; padding: 6px 14px;
  border-radius: 999px; background: #000; color: #f4f4f5; border: 1px solid rgba(255,255,255,.22);
  font: 600 12px "gg sans","Segoe UI",system-ui,sans-serif; letter-spacing: .06em; cursor: pointer; transition: border-color .15s, background .15s;
  box-shadow: 0 6px 22px rgba(0,0,0,.7); }
#rc-pill:hover { border-color: rgba(255,255,255,.5); background: #0a0a0a; }
#rc-pill.show { display: flex; }
#rc-pill i { width: 8px; height: 8px; border-radius: 50%; background: #ff4d52; box-shadow: 0 0 10px rgba(255,77,82,.8); animation: rcblink 1.1s infinite; }
@keyframes rcblink { 50% { opacity: .25; } }

#rc-list { display: none; flex-direction: column; gap: 6px; max-height: 270px; overflow: auto; }
#rc-list.show { display: flex; }
#rc-root .rc-listhead { display: flex; align-items: center; justify-content: space-between; color: #b4b4bc; font-size: 12px; }
#rc-root .rc-listhead button { color: #cfcfd4; font-size: 11.5px; padding: 2px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,.15); margin-left: 6px; }
#rc-root .rc-listhead button:hover { color: #fff; border-color: rgba(255,255,255,.4); }
#rc-root .rc-item { display: flex; align-items: center; gap: 10px; padding: 6px; width: 100%; text-align: left; border-radius: 12px;
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.13); transition: background .15s, border-color .15s; }
#rc-root .rc-item:hover { background: rgba(255,255,255,.11); border-color: rgba(255,255,255,.4); }
#rc-root .rc-thumb { width: 88px; height: 50px; border-radius: 8px; background: #101012; flex: none; }
#rc-root .rc-item b { display: block; font-weight: 600; color: #fff; font-size: 13px; word-break: break-word; }
#rc-root .rc-item small { color: #7e7e87; font-size: 11.5px; }
#rc-root .rc-empty { color: #7e7e87; font-size: 12px; padding: 4px 2px; line-height: 1.5; }
`;

module.exports = class Recorder {
  start() {
    this.rec = window.OPSEC && window.OPSEC.rec;
    this.hook = window.__nsRec;
    if (!this.rec || !this.hook) {
      BdApi.UI.showToast("Recorder: bridge missing. Add the preload.js and main.js changes, then restart.", { type: "error", timeout: 6000 });
      return;
    }
    this.cur = null;
    BdApi.DOM.addStyle(NAME, CSS);
    this.build();
    this.keyH = (e) => {
      const K = window.OPSEC_KEYS;
      const hit = K && typeof K.match === "function" ? K.match(e, "recKey") : (e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey && e.key.toLowerCase() === "r");
      if (hit) {
        e.preventDefault();
        if (this.cur) this.finish(); else this.card.classList.toggle("open");
      }
    };
    document.addEventListener("keydown", this.keyH, true);
  }

  stop() {
    if (this.keyH) document.removeEventListener("keydown", this.keyH, true);
    if (this.cur) this.finish();
    this.root?.remove();
    BdApi.DOM.removeStyle(NAME);
  }

  msg(text, err) {
    this.msgEl.textContent = text || "";
    this.msgEl.className = err ? "err" : "";
  }

  build() {
    this.micChk = h("input", { type: "checkbox", checked: true });
    this.msgEl = h("div", { id: "rc-msg" });
    this.listEl = h("div", { id: "rc-list" });
    this.card = h("div", { id: "rc-card" },
      h("h3", null, "Recorder", h("button", { title: "Close", onclick: () => this.card.classList.remove("open") }, "\u2715")),
      h("div", { class: "rc-btns" },
        h("button", { class: "rc-btn rec", onclick: () => { this.listEl.classList.remove("show"); this.begin("voice"); } }, h("span", { class: "rc-dot" }), "Voice"),
        h("button", { class: "rc-btn rec", onclick: () => this.showPicker() }, h("span", { class: "rc-dot" }), "Screen")),
      h("label", { class: "rc-chk" }, this.micChk, "Include my mic"),
      this.listEl,
      this.msgEl,
      h("div", { class: "rc-btns" }, h("button", { class: "rc-btn ghost", onclick: () => this.rec.open() }, "Open recordings folder")),
      h("div", { class: "rc-note" },
        "Voice mixes everyone in the call into one file. Screen lets you pick your own share or any stream you're watching (click \"Watch Stream\" on it first). Let people know you're recording. Saved to Documents\\OpsexCord Recordings."));
    this.pillT = h("span", null, "REC 00:00:00");
    this.pill = h("div", { id: "rc-pill", title: "Click to stop and save", onclick: () => this.finish() }, h("i"), this.pillT);
    this.root = h("div", { id: "rc-root" }, this.card, this.pill);
    document.body.append(this.root);
  }

  candidates() {
    const out = [];
    const draw = (c, v) => {
      try {
        const w = v.videoWidth || v.width, hh = v.videoHeight || v.height;
        if (!w || !hh) return;
        const k = Math.min(c.width / w, c.height / hh), dw = w * k, dh = hh * k;
        c.getContext("2d").drawImage(v, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
      } catch {}
    };
    const canvas = () => { const c = document.createElement("canvas"); c.width = 176; c.height = 100; c.className = "rc-thumb"; return c; };

    for (const s of this.hook.shares) {
      const vt = s.getVideoTracks().find(live);
      if (!vt) continue;
      const thumb = canvas();
      try {
        const tv = document.createElement("video");
        tv.muted = true;
        tv.srcObject = new MediaStream([vt.clone()]);
        tv.play().catch(() => {});
        setTimeout(() => { draw(thumb, tv); tv.srcObject && tv.srcObject.getTracks().forEach((t) => t.stop()); tv.srcObject = null; }, 450);
      } catch {}
      const st = vt.getSettings ? vt.getSettings() : {};
      out.push({
        name: "Your screenshare", sub: st.width ? st.width + "\u00D7" + st.height : "you", thumb,
        make: () => live(vt) ? { track: vt.clone(), audioTrack: (s.getAudioTracks().find(live) || { clone: () => null }).clone(), label: "your screenshare" } : null
      });
    }

    const vids = [...document.querySelectorAll("video")]
      .filter((v) => v.srcObject && v.videoWidth > 0 && !v.paused && v.readyState > 2)
      .sort((a, b) => b.videoWidth * b.videoHeight - a.videoWidth * a.videoHeight);
    vids.forEach((v, i) => {
      const name = this.nameOf(v) || "Stream " + (i + 1);
      const thumb = canvas();
      draw(thumb, v);
      out.push({
        name, sub: v.videoWidth + "\u00D7" + v.videoHeight, thumb,
        make: () => {
          if (!v.isConnected) return null;
          const t = v.captureStream().getVideoTracks()[0];
          return t ? { track: t, audioTrack: null, label: name } : null;
        }
      });
    });
    return out;
  }

  nameOf(v) {
    let el = v;
    for (let i = 0; i < 9 && el && el !== document.body; i++, el = el.parentElement) {
      const t = el.querySelector && el.querySelector('[class*="username" i],[class*="overlayTitle" i],[class*="participantName" i],[class*="nickname" i]');
      const txt = t && t.textContent.trim();
      if (txt && txt.length < 50) return txt;
      const al = el.getAttribute && el.getAttribute("aria-label");
      if (al && al.length < 80 && !/^video$/i.test(al)) return al;
    }
    return "";
  }

  showPicker() {
    this.msg("");
    this.listEl.classList.add("show");
    this.renderList();
  }

  renderList() {
    this.listEl.replaceChildren(
      h("div", { class: "rc-listhead" }, h("span", null, "Pick what to record"),
        h("span", null, h("button", { onclick: () => this.renderList() }, "Refresh"), h("button", { onclick: () => this.listEl.classList.remove("show") }, "Cancel")))
    );
    const items = this.candidates();
    if (!items.length) {
      this.listEl.append(h("div", { class: "rc-empty" }, "Nothing to record yet. Start sharing your screen, or click \"Watch Stream\" on someone's stream so it's playing, then press Refresh."));
      return;
    }
    for (const it of items) {
      this.listEl.append(h("button", { class: "rc-item", onclick: () => this.choose(it) }, it.thumb, h("span", null, h("b", null, it.name), h("small", null, it.sub))));
    }
  }

  choose(it) {
    let pick = null;
    try { pick = it.make(); } catch {}
    if (!pick || !pick.track) return this.msg("That stream isn't available any more. Press Refresh.", true);
    this.begin("screen", pick);
  }

  async begin(mode, chosen) {
    if (this.cur) return;
    let pick = null;
    if (mode === "screen") {
      pick = chosen;
      if (!pick) return this.showPicker();
      this.listEl.classList.remove("show");
    }
    const useMic = this.micChk.checked;
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    const nodes = new Map();
    const shareAudio = pick && pick.audioTrack && live(pick.audioTrack) ? pick.audioTrack : null;
    const wanted = () => {
      const list = [];
      if (shareAudio) list.push(shareAudio);
      else for (const t of this.hook.remote) if (live(t)) list.push(t);
      if (useMic) for (const t of this.hook.mics) if (live(t)) list.push(t);
      return list;
    };
    const sync = () => {
      for (const t of wanted()) {
        if (nodes.has(t)) continue;
        try { const src = ctx.createMediaStreamSource(new MediaStream([t])); src.connect(dest); nodes.set(t, src); } catch {}
      }
      for (const [t, src] of nodes) if (!live(t)) { try { src.disconnect(); } catch {} nodes.delete(t); }
    };
    sync();
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});

    const stream = new MediaStream([...(pick ? [pick.track] : []), ...dest.stream.getAudioTracks()]);
    const mimes = pick ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"] : ["audio/webm;codecs=opus", "audio/webm"];
    const mimeType = mimes.find((m) => MediaRecorder.isTypeSupported(m));
    const begun = await this.rec.begin({ kind: mode });
    if (!begun || !begun.ok) {
      if (pick) { try { pick.track.stop(); pick.audioTrack && pick.audioTrack.stop(); } catch {} }
      ctx.close().catch(() => {});
      return this.msg((begun && begun.error) || "Couldn't start recording.", true);
    }
    const opts = { mimeType, audioBitsPerSecond: 160000 };
    if (pick) opts.videoBitsPerSecond = 8000000;
    const mr = new MediaRecorder(stream, opts);
    const cur = (this.cur = { mr, ctx, nodes, sync, pick, shareAudio, mode, t0: Date.now(), q: Promise.resolve(), path: begun.path });

    mr.ondataavailable = (e) => {
      if (!e.data || !e.data.size) return;
      cur.q = cur.q.then(() => e.data.arrayBuffer()).then((b) => this.rec.write(b)).catch(() => {});
    };
    mr.onstop = async () => {
      await cur.q;
      const r = await this.rec.end();
      clearInterval(cur.tick);
      for (const t of [pick && pick.track, shareAudio, ...dest.stream.getAudioTracks()]) { try { t && t.stop(); } catch {} }
      ctx.close().catch(() => {});
      if (this.cur === cur) this.cur = null;
      this.pill.classList.remove("show");
      this.msg(r && r.ok ? "Saved: " + r.path : "Recording stopped.");
      BdApi.UI.showToast(r && r.ok ? "Recording saved" : "Recording stopped", { type: "success" });
    };
    if (pick) pick.track.addEventListener("ended", () => this.finish());
    mr.start(1000);

    cur.tick = setInterval(() => {
      sync();
      const label = mode === "screen" ? "screen" : "voice";
      this.pillT.textContent = "REC " + clock((Date.now() - cur.t0) / 1000);
      this.msg("Recording " + label + (pick ? " (" + pick.label + ")" : "") + " \u00B7 " + nodes.size + " audio source" + (nodes.size === 1 ? "" : "s"));
    }, 500);
    this.pill.classList.add("show");
    this.card.classList.remove("open");
    BdApi.UI.showToast("Recording started (" + ((window.OPSEC_KEYS && window.OPSEC_KEYS.label("recKey")) || "Ctrl+Alt+R") + " to stop)", { type: "info" });
  }

  finish() {
    const c = this.cur;
    if (!c || c.mr.state === "inactive") return;
    try { c.mr.stop(); } catch {}
  }
};