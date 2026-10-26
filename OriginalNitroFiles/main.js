// @name OpsexCord
// @author @geofeed on discord

const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, nativeImage, desktopCapturer, session, shell, net, clipboard, components } = require("electron");
const fs = require("fs");
const path = require("path");

app.setName("OpsexCord");
app.setAppUserModelId("OpsexCord");

app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
app.commandLine.appendSwitch("enable-features", "PlatformHEVCDecoderSupport");
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");

const CLEAN_UA = (ua) => ua.replace(/\s?(Electron|OpsexCord|opsexcord)\/\S+/gi, "");
app.userAgentFallback = CLEAN_UA(app.userAgentFallback);

const DISCORD_URL = "https://discord.com/app";

const ROOT = path.join(__dirname, "..");
const readFile = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const pluginFiles = () => {
  const dir = path.join(ROOT, "plugins");
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".plugin.js")) : [];
};

const BLOCKED = [
  "*://discord.com/api/*/science",
  "*://discord.com/api/*/track",
  "*://*.sentry.io/*"
];

const DRAG_CSS = `
  div[class*="bar_"][class*="themed"],
  div[class*="titleBar"] {
    -webkit-app-region: drag;
  }
  div[class*="bar_"] button,
  div[class*="bar_"] [role="button"],
  div[class*="bar_"] a,
  div[class*="titleBar"] button,
  div[class*="titleBar"] [role="button"] {
    -webkit-app-region: no-drag;
  }
`;

const SHIFT_ICONS_JS = `
(() => {
  if (window.__nsShiftIcons) return;
  window.__nsShiftIcons = true;
  const OFFSET = 138;
  const apply = () => {
    const zone = window.innerWidth - OFFSET - 4;
    document.querySelectorAll('button, [role="button"], [aria-label]').forEach((el) => {
      if (el.dataset.nsShifted === "1") return;
      if (el.closest('[data-ns-shifted="1"]')) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.width > 60) return;
      if (r.top < 0 || r.bottom > 34) return;
      if (r.right < zone) return;
      el.style.translate = "-" + OFFSET + "px 0";
      el.dataset.nsShifted = "1";
    });
  };
  apply();
  new MutationObserver(apply).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("resize", apply);
})();
`;

const SHARE_QUALITY_JS = `
(() => {
  if (window.__nsPatchedDisplay) return;
  window.__nsPatchedDisplay = true;
  const md = navigator.mediaDevices;
  const orig = md.getDisplayMedia.bind(md);

  const senders = new Set();
  const isScreen = (t) => {
    try {
      if (!t || t.kind !== "video") return false;
      if (t.__nsScreen) return true;
      return !!t.getSettings().displaySurface || /^(screen|window):/i.test(t.label || "");
    } catch (e) { return false; }
  };
  const adjust = (sender, p) => {
    const q = window.__nsShareQuality;
    if (!q || !window.__nsSharing || !p || !p.encodings || !p.encodings.length || !isScreen(sender.track)) return false;
    const st = sender.track.getSettings();
    const fps = q.fps || 30;
    const target = Math.round(Math.min(20e6, Math.max(2.5e6, (st.width || 1920) * (st.height || 1080) * fps * 0.08)));
    let changed = false;
    if (p.degradationPreference !== "maintain-resolution") { p.degradationPreference = "maintain-resolution"; changed = true; }
    for (const e of p.encodings) {
      if (!e.maxBitrate || e.maxBitrate < target) { e.maxBitrate = target; changed = true; }
      if (e.scaleResolutionDownBy && e.scaleResolutionDownBy !== 1) { e.scaleResolutionDownBy = 1; changed = true; }
      if (e.maxFramerate && e.maxFramerate < fps) { e.maxFramerate = fps; changed = true; }
    }
    return changed;
  };
  const R = window.RTCRtpSender && RTCRtpSender.prototype;
  const PC = window.RTCPeerConnection && RTCPeerConnection.prototype;
  let origSet = null;
  try {
    if (R && R.setParameters) {
      origSet = R.setParameters;
      R.setParameters = function (p) { senders.add(this); try { adjust(this, p); } catch (e) {} return origSet.call(this, p); };
    }
    if (R && R.replaceTrack) {
      const o = R.replaceTrack;
      R.replaceTrack = function () { senders.add(this); return o.apply(this, arguments); };
    }
    if (PC && PC.addTrack) {
      const o = PC.addTrack;
      PC.addTrack = function () { const s = o.apply(this, arguments); if (s) senders.add(s); return s; };
    }
    if (PC && PC.addTransceiver) {
      const o = PC.addTransceiver;
      PC.addTransceiver = function () { const t = o.apply(this, arguments); if (t && t.sender) senders.add(t.sender); return t; };
    }
  } catch (e) { console.warn("[OpsexCord] sender hooks not installed:", e); }
  setInterval(() => {
    if (!window.__nsSharing || !origSet) return;
    for (const s of [...senders]) {
      try {
        if (!s.track || s.track.readyState === "ended") { senders.delete(s); continue; }
        const p = s.getParameters();
        if (adjust(s, p)) origSet.call(s, p).catch(() => {});
      } catch (e) {}
    }
  }, 2000);

  md.getDisplayMedia = async (constraints) => {
    console.log("[OpsexCord] Discord asked for:", JSON.stringify(constraints));
    let wide = constraints;
    try {
      const v = constraints && typeof constraints.video === "object" ? Object.assign({}, constraints.video) : {};
      delete v.width; delete v.height; delete v.aspectRatio; delete v.frameRate;
      v.width = { ideal: 7680 }; v.height = { ideal: 4320 }; v.frameRate = { ideal: 144, max: 144 };
      wide = Object.assign({}, constraints || {}, { video: v });
    } catch (e) {}
    let stream;
    try { stream = await orig(wide); }
    catch (e) {
      if (e && e.name === "OverconstrainedError") stream = await orig(constraints);
      else throw e;
    }
    const q = window.__nsShareQuality;
    for (const t of stream.getVideoTracks()) {
      t.__nsScreen = true;
      if (!q) continue;
      try {
        const s0 = t.getSettings();
        const c = { frameRate: { ideal: q.fps, max: q.fps }, resizeMode: "crop-and-scale" };
        if (q.height > 0 && s0.height && s0.width) {
          const hh = Math.min(q.height, s0.height);
          const ww = Math.round((hh * s0.width / s0.height) / 2) * 2;
          c.height = { ideal: hh, max: hh };
          c.width = { ideal: ww, max: ww };
        }
        await t.applyConstraints(c);
        t.contentHint = "detail";
        t.__nsWant = c;
      } catch (e) { console.warn("[OpsexCord] share quality not applied:", e); }
    }
    const logCapture = (label) => stream.getVideoTracks().forEach((t) => {
      const st = t.getSettings();
      console.log("[OpsexCord] capture " + label + ": " + st.width + "x" + st.height + " @ " + Math.round(st.frameRate || 0) + "fps (picked: " + (q ? q.height + "p " + q.fps + "fps" : "none") + ")");
    });
    logCapture("start");
    setTimeout(() => logCapture("after 5s"), 5000);
    const keep = setInterval(() => {
      let live = false;
      stream.getVideoTracks().forEach((t) => {
        if (t.readyState !== "live") return;
        live = true;
        try {
          if (t.contentHint !== "detail") t.contentHint = "detail";
          const st = t.getSettings(), w = t.__nsWant;
          if (w && w.height && st.height && st.height < w.height.ideal * 0.9) {
            t.applyConstraints(w).catch(() => {});
            console.log("[OpsexCord] capture shrank to " + st.width + "x" + st.height + ", re-applying");
          }
        } catch (e) {}
      });
      if (!live) clearInterval(keep);
    }, 3000);
    window.__nsSharing = true;
    window.dispatchEvent(new CustomEvent("opsec-share", { detail: { active: true } }));
    const tracks = stream.getVideoTracks();
    const iv = setInterval(() => {
      if (tracks.every((t) => t.readyState === "ended")) {
        clearInterval(iv);
        window.__nsSharing = false;
        window.dispatchEvent(new CustomEvent("opsec-share", { detail: { active: false } }));
      }
    }, 1000);
    return stream;
  };
})();
`;

const RECORD_HOOK_JS = `
(() => {
  if (window.__nsRec) return;
  const R = (window.__nsRec = { remote: new Set(), mics: new Set(), shares: new Set() });
  const live = (t) => t.readyState === "live";
  const add = (set, t) => { set.add(t); t.addEventListener("ended", () => set.delete(t)); };
  const Orig = window.RTCPeerConnection;
  if (Orig) {
    const Patched = function (...args) {
      const pc = new Orig(...args);
      pc.addEventListener("track", (e) => { if (e.track && e.track.kind === "audio") add(R.remote, e.track); });
      return pc;
    };
    Patched.prototype = Orig.prototype;
    Object.setPrototypeOf(Patched, Orig);
    window.RTCPeerConnection = Patched;
    if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = Patched;
  }
  const md = navigator.mediaDevices;
  if (md) {
    const gum = md.getUserMedia.bind(md);
    md.getUserMedia = async (c) => { const s = await gum(c); s.getAudioTracks().forEach((t) => add(R.mics, t)); return s; };
    const gdm = md.getDisplayMedia.bind(md);
    md.getDisplayMedia = async (c) => {
      const s = await gdm(c);
      R.shares.add(s);
      const done = () => { if (s.getTracks().every((t) => !live(t))) R.shares.delete(s); };
      s.getTracks().forEach((t) => t.addEventListener("ended", done));
      return s;
    };
  }
})();
`;

let mainWindow = null;

const isDiscordUrl = (u) => {
  try { const h = new URL(u).hostname; return h === "discord.com" || h.endsWith(".discord.com"); }
  catch { return false; }
};
const isTrusted = (u) => !u || u === "null" || u === "about:blank" || isDiscordUrl(u);

const ALLOWED_PERMISSIONS = new Set([
  "media",
  "display-capture",
  "notifications",
  "fullscreen",
  "clipboard-read",
  "clipboard-sanitized-write",
  "pointerLock",
  "speaker-selection",
  "mediaKeySystem"
]);

function pickSource(sources, wantAudio) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; resolve(v); if (!picker.isDestroyed()) picker.close(); };
    const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    const screens = sources.filter((s) => s.id.startsWith("screen:"));
    const windows = sources.filter((s) => !s.id.startsWith("screen:"));
    const tile = (s) =>
      `<button class="t" data-id="${esc(s.id)}"><img src="${s.thumbnail.toDataURL()}"><span>${esc(s.name)}</span></button>`;

    const html = `<!doctype html><meta charset="utf-8"><title>Share your screen</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font:14px "Segoe UI",system-ui,sans-serif;background:#16171d;color:#f2f3f5;display:flex;flex-direction:column;height:100vh}
  h1{font-size:16px;margin:0;padding:16px 20px 4px}
  h2{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:#8e9099;margin:14px 0 8px}
  main{flex:1;overflow:auto;padding:0 20px 12px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
  .t{background:#1d1f27;border:2px solid transparent;border-radius:10px;padding:8px;color:inherit;font:inherit;cursor:pointer;text-align:left}
  .t:hover{background:#262935}
  .t.sel{border-color:#7c5cff;background:#262935}
  .t img{width:100%;aspect-ratio:16/9;object-fit:contain;background:#0b0c10;border-radius:6px;display:block}
  .t span{display:block;margin-top:6px;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;border-top:1px solid rgba(255,255,255,.08);background:#1d1f27}
  label{display:flex;align-items:center;gap:8px;color:#b5bac1}
  .b{border:0;border-radius:8px;padding:9px 18px;font:inherit;font-weight:600;cursor:pointer;color:#fff;background:#7c5cff}
  .b:disabled{opacity:.4;cursor:default}
  .b.g{background:#2b2d37}
  select{background:#2b2d37;color:#f2f3f5;border:0;border-radius:6px;padding:7px 8px;font:inherit}
  .opts{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
</style>
<h1>Choose what to share</h1>
<main>
  ${screens.length ? `<h2>Screens</h2><div class="grid">${screens.map(tile).join("")}</div>` : ""}
  ${windows.length ? `<h2>Windows</h2><div class="grid">${windows.map(tile).join("")}</div>` : ""}
</main>
<footer>
  <div class="opts">
    <select id="p" title="Quick preset"><option value="">Preset…</option><option value="720,15">720p 15fps</option><option value="720,30">720p 30fps</option><option value="720,60">720p 60fps</option><option value="1080,15">1080p 15fps</option><option value="1080,30">1080p 30fps</option><option value="1080,60">1080p 60fps</option><option value="1440,30">1440p 30fps</option><option value="1440,60">1440p 60fps</option><option value="0,30">Source 30fps</option><option value="0,60">Source 60fps</option></select>
    <select id="r" title="Resolution"><option value="0">Source res</option><option value="1440">1440p (2K)</option><option value="1080" selected>1080p</option><option value="720">720p</option><option value="480">480p</option></select>
    <select id="f" title="Frame rate"><option value="15">15 fps</option><option value="30" selected>30 fps</option><option value="60">60 fps</option><option value="120">120 fps</option><option value="144">144 fps</option></select>
    <select id="k" title="Optimize for"><option value="motion">Smooth motion</option><option value="detail">Sharp detail</option></select>
    ${wantAudio ? '<label><input type="checkbox" id="a"> System audio</label>' : ""}
  </div>
  <div><button class="b g" id="c">Cancel</button> <button class="b" id="ok" disabled>Share</button></div>
</footer>
<script>
  let sel = null;
  const go = (path) => { location.href = "https://opsexcord.invalid/" + path; };
  document.querySelectorAll(".t").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll(".t").forEach((x) => x.classList.remove("sel"));
      b.classList.add("sel"); sel = b.dataset.id; document.getElementById("ok").disabled = false;
    };
    b.ondblclick = () => document.getElementById("ok").click();
  });
  document.getElementById("ok").onclick = () => {
    if (sel) go("pick?id=" + encodeURIComponent(sel) + "&audio=" + (document.getElementById("a")?.checked ? 1 : 0)
      + "&h=" + document.getElementById("r").value + "&fps=" + document.getElementById("f").value
      + "&hint=" + document.getElementById("k").value);
  };
  document.getElementById("p").onchange = (e) => {
    const v = e.target.value; if (!v) return;
    const parts = v.split(",");
    document.getElementById("r").value = parts[0]; document.getElementById("f").value = parts[1];
  };
  ['r', 'f'].forEach((id) => document.getElementById(id).addEventListener("change", () => { document.getElementById("p").value = ""; }));
  document.getElementById("c").onclick = () => go("cancel");
  addEventListener("keydown", (e) => { if (e.key === "Escape") go("cancel"); });
</script>`;

    const picker = new BrowserWindow({
      width: 780, height: 580, minWidth: 520, minHeight: 380,
      parent: mainWindow || undefined, modal: !!mainWindow,
      title: "Share your screen", backgroundColor: "#16171d",
      icon: path.join(ROOT, "icon.ico"),
      autoHideMenuBar: true, minimizable: false, maximizable: false,
      webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false }
    });
    picker.setMenu(null);
    picker.webContents.on("will-navigate", (event, url) => {
      event.preventDefault();
      let u; try { u = new URL(url); } catch { return finish(null); }
      if (u.hostname !== "opsexcord.invalid") return;
      if (u.pathname === "/pick") {
        const h = Number(u.searchParams.get("h")), fps = Number(u.searchParams.get("fps"));
        finish({
          id: u.searchParams.get("id"),
          audio: u.searchParams.get("audio") === "1",
          h: [0, 480, 720, 1080, 1440].includes(h) ? h : 720,
          fps: [15, 30, 60, 120, 144].includes(fps) ? fps : 30,
          hint: u.searchParams.get("hint") === "detail" ? "detail" : "motion"
        });
      }
      else finish(null);
    });
    picker.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    picker.on("closed", () => finish(null));
    picker.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  });
}

function setupMedia(ses) {
  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    const ok = ALLOWED_PERMISSIONS.has(permission) && isTrusted(details?.requestingUrl || wc.getURL());
    console.log(`[OpsexCord] permission request: ${permission} -> ${ok ? "allowed" : "DENIED"}`);
    callback(ok);
  });
  ses.setPermissionCheckHandler((wc, permission, origin) =>
    ALLOWED_PERMISSIONS.has(permission) && (isTrusted(origin) || isTrusted(wc?.getURL()))
  );

  ses.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 400, height: 225 },
        fetchWindowIcons: false
      });
      console.log(`[OpsexCord] screen share requested (${sources.length} sources)`);
      const choice = await pickSource(sources, request.audioRequested);
      const source = choice && sources.find((s) => s.id === choice.id);
      if (!source) return callback(null);
      const streams = { video: source };
      if (choice.audio && request.audioRequested) streams.audio = "loopback";
      const q = { height: choice.h, fps: choice.fps, hint: choice.hint };
      await mainWindow?.webContents.executeJavaScript(`window.__nsShareQuality = ${JSON.stringify(q)};`).catch(() => {});
      callback(streams);
    } catch (err) {
      console.error("Screen share failed:", err);
      callback(null);
    }
  });
}

const cfg = {
  panicEnabled: true,
  panicKey: "Control+Alt+P",
  lockKey: "Control+Alt+L",
  linkKey: "Control+Alt+C",
  panicHide: true,
  panicQuit: false,
  contentProtection: false,
  watchdog: false,
  watchdogMB: 1500
};
const ACCEL_KEYS = { space: " ", esc: "escape", up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright", plus: "+", return: "enter", del: "delete", ins: "insert" };
function accelMatch(input, accel) {
  if (!accel || typeof accel !== "string" || input.type !== "keyDown") return false;
  const parts = accel.split("+").map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return false;
  let key = parts.pop().toLowerCase();
  key = ACCEL_KEYS[key] || key;
  const mods = new Set(parts.map((m) => m.toLowerCase()));
  const mac = process.platform === "darwin";
  const wantCtrl = mods.has("control") || mods.has("ctrl") || (!mac && (mods.has("commandorcontrol") || mods.has("cmdorctrl")));
  const wantMeta = mods.has("meta") || mods.has("super") || mods.has("cmd") || mods.has("command") || (mac && (mods.has("commandorcontrol") || mods.has("cmdorctrl")));
  const wantAlt = mods.has("alt") || mods.has("option");
  const wantShift = mods.has("shift");
  if (!!input.control !== wantCtrl || !!input.alt !== wantAlt || !!input.shift !== wantShift || !!input.meta !== wantMeta) return false;
  const k = String(input.key || "").toLowerCase();
  if (k === key) return true;
  return key.length === 1 && (input.code === "Key" + key.toUpperCase() || input.code === "Digit" + key);
}
const pageState = { inCall: false, sharing: false };
let tray = null;
let watchdogTimer = null;

const fromDiscord = (e) =>
  !!mainWindow && e.sender === mainWindow.webContents && isDiscordUrl(e.senderFrame?.url || e.sender.getURL());

const music = require("./music")({ getMainWindow: () => mainWindow, fromDiscord });
require("./recorder")({ fromDiscord });

const sanitizeConfig = (c) => {
  const out = {};
  if (!c || typeof c !== "object") return out;
  for (const k of ["panicEnabled", "panicHide", "panicQuit", "contentProtection", "watchdog"]) {
    if (typeof c[k] === "boolean") out[k] = c[k];
  }
  if (typeof c.panicKey === "string" && c.panicKey.length > 0 && c.panicKey.length <= 40) out.panicKey = c.panicKey.trim();
  for (const k of ["lockKey", "linkKey"]) {
    if (typeof c[k] === "string" && c[k].length <= 40) out[k] = c[k].trim();
  }
  if (Number.isFinite(c.watchdogMB)) out.watchdogMB = Math.min(8000, Math.max(500, Math.round(c.watchdogMB)));
  return out;
};

const LOGO = "data:image/png;base64,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";
const LOCK_ICON_KEYS = ["wireshark", "tor", "tails", "proton", "mullvad", "ipvanish", "firefox", "monero", "wasabi", "librewolf", "telegram", "brave", "virtualbox", "googlevoice", "signal"];
const BUILTIN_LOCK_ICONS = {"ipvanish": "data:image/webp;base64,UklGRn4hAABXRUJQVlA4WAoAAAAQAAAA3AAA/wAAQUxQSJEKAAABBjv0/7dtJC1Ie7Mkv+3CpXZP9OWTNf1WEyr7yXNtKnNoc5uvnVDOyLvdvc3bzpnWZUt+015s99nSbrVDYt4j//8f/gAJ8PKBEQHRtpWq1s5zC7Pulh4i0A/Eblv+7z/+Zy9UwhbVSb+nx5O9vu/j+OkuKsn41vFJ3/fx1jjpIkyO3y9jjO8fTzoJeyflwxhj2e/984VJXnQZsvl50V3VanB5nksPUwlYVMBLNmHjK7Ij0Mgb/LFXcU1iOwKMvHzs7RY7Aoy8fOztFjsCDE78Dd4pQ+0/X5jkhQU6xY6QoCPsCBeHBd2OsBhfu6DYWEYd5tWJUXWNFjmPbtgluf/Bo29spZIQq1rw5gIvbXQCrPnAvgUEYw4YbtF/wJoP7PtbYC0AQwkZEEDzWNWBBqEhgITNvy4R5MNcIsjjq0uE2TJyiDDbtI5Q5EGeYUrNBAGb4nyehRhSA0/AJp9fHoR4kiI1zQVsYhbmn3hSJZpc/ssuM8bC4yFxBMh5yamGpomRi8ARYMFLRjUbJiosJzJyETgCGC9HS3402602QmI8GLkIHAGMl6OlWC993pCZfUYuAtOW8XK16JJsDFRw4XbjykiFFk43Ll6pSlchRk1KUNFICSmaKQFFI2XgXSGe7obQRDnaTXyDJEbRXsRyORv6tpJEl1oMvfZvJYoLOkP4VtLJvjM0tvLd0+8Oza0CiaZWWdJdiEU+TYOFIp80jnJViWHxfhsc3i4nyTpIosR9YXJ4O3NvLFYbWMIR7ZA4nkwOb2eOqenhKxeyUi5CsEPJ3YPuXIr96EpVxDu6wAtblY0Wn7QTymxZCnd0AmKye7TW0jG6E1bD2arsLsR0uugyJP1Jx6HrhA5u0nEn6hDjQYjOMPsCaxm5N9ilNm2wtOh8qhXG2YhK0mE2IYkGjifJ4nlkaLaG2XR2lJNEA9fujQDuUYPdqma1LupEA9eOqfDtUcnoytGyqtFNuBTle8JS+8pFqdvlLw3KIHm0rN9IIoRfVqMrdW3rYhRB+en2RZcC85Mj8Gs1IIabDZoKxgdkplQZblZoKo0iKDOlVkFvXrkyCkndRtuhkUYWPx8TR6rZhB1C3iim07x42CbokjQKilOpTdAbmukZDvlorW3hupbk6IZFtoXzBN1EBcbV2Q5okjnOasMiC+E6K75Yr5zk/PuZHimE6+8ZqpppFpQtcLuL4fhLlJgN03orsIjK7RdEAUUDxs3/ZIcisyHHsOtAYPalw/Fn+heeUi2AeuqFz/TjYVrtCkjSR9y/EX/2jQ+3Ah/+xs9uxP0J2xWAmr2DO2/eunlj/7Ot+fPZ/RvxFzEeTKlLw/eat+b9nYPJeJi2pZo8WpP9m3fevneXOqP8TdShNXvk0ro/zPbdkR3cuXccfzWf7dbN/dvanR0dx3u8ppETOblmd//w91PmS/Ru6/T8nV/S69n4+GrzXOzOXnnnfJUTB7dfW8uL81MSMGjQeHCW7HR68YCFJvzJHFuui/Wr9XVs1DJy18lXNx4FlRTJHCt1uZztJMoDs08lO7NlycOBvqQg0eyapm1at1njJJBbFS/SdHiyXtNwHnzTpHiQpgPyY5uG4y81QGl/mo6X8CKnRw1pmo6XAivzLPEhPOtfE5hP7Ud41rMTwaeoOTjWkN54ZTxAtP0PKtbGmE0iAc2Kd5NrzpOWkdD2akOmjZ3BbpNIQL9ncGI701xzU0J16w/DlVYTIZtEAvolipO5SF1rzsv1KB1VlzQtxcrPoizyBqwnydMZsZ3NaYLtTyQWJRRRP0tU7XF0TcknK6WW5OX6kbpvbL7Iwa6ommzLz5svVuvCsOWPxU4eQONGLNiuPdY0Kufni/S7sCn/ysjUNT7X8uhzGeGuE9IUHErUa6VKdL6etD1B58W1Ps2SEzZNfhglu1hTcijMp8KLUZX8fD1tG6O2SoH0ysFRV8iagkP7nqnXtBhUic4Xo7ZMgfTM65bzO9fiUKBe02JQpeh8sjEuUd65go0VFuoVL04I92tunXjoxMcV7Vs0e+9DR7fXFbGxphavQzZi8xq/K8A7tvG2cCCDtpbPFWjUh+/bJs6H24YlIVdhu0b2Anb1Kodt4XkD01QwdAoz3WWDsKhtaJqKjB5xprvEfApPWyfmqjzp3d7wDaN6rTPd/3N6UYaBQslGDsWp2FJVRqLKQEMZKIs6bseiQTdGPfLHrPYsKGQHMNcocmRTbkaqnAX0a3MqhCaiUbPgXcCUEtpVZrzL+kQ95o39Ls/zkz6Plweq6jGw4MAEj4cgGDcjVcCi749vZwnuSx6vjBSgQVjSLpAeIKXVXaX9rHQn6hONdTQWbpmfF2Xsz+dZUvWYTYUjmJoPFAseMW6Y6t1xAljE+OCUxhY4lZ74rDkNQpp2gfWA+mXnxCVM+nl8c5xANfA+0ShVg4EyHq8iPdYmp0p15QzcSNic0NBrikleGKJClAqPNjAalDSLIFISzKNelFHTftYXCXeRdsAuUOgoXsmIG2KXrKOVXmgwjeUdsLA5D9TzDAGqiGlq6styNlKUBtEMByUBMlF0GcEdR9WAWbYP5jiWQY1AxUXOVYzTEjD0pq6SQw3Yb7NagHeFP0D3OHkAAIlkgkjwtAQkIvAqOWI2p79XD6f8Le8V+EMHb5IJuagGOS9gnBkA3nBi8Af57PpOykdRrwB6R0S2gzzcAhnkAnHAHJNUipoCg2Jq8BP0vmB3CVGjWYY7ONAqtfnDXgijNFFGLC5tJ3G7X7Rf4LqjmtyqKZhluANBx0hW21bVNIZ7SJz4Bpx9/tJef+nz0YMm7K6nKt6e9IVERicF0O/9aaPr1TNTu8PIgdRMgdDvni1O+nj2rm7/iR5B4mL6aL8QyAaRo7z/w9c3OvavXHtxIQOPitNQBQnlIkTNHbHtNx4i0F65Onw+rkqpzFQNcPalL1YU9cXLX/yNDCgPGAbhBde1tdDc7KsBXl8vH/ZrLZahbUc5fq7mWJ796L4MLLAKNkhp+x8Y+kFPIBL7xZdjIZHxSUFfivzF63XG9Ht/jloEmHu/4WWQtrka9yhHgUgs/uarvVzmhiHS3KWPV2TJvxXBkJZFyzzbavNhsEc49APF8v6P70ejbN4BNcczHGXAOQ2vbDQbA9o8vhp6BGqgSO9ts6z5Y0m1DbFdZ3hZAGzsXOd3Rg0Dy7ZB0AmTqGMEQw2wbVaLk7iqLjpjhJAO6ptBCuCXSdIa9I9vMIkGI4FYt3w6MY11Giq9l6Au1KiqkoK7cZ7NIOctnyAQJeYSGXN30qTfOeS2EwZNmhaCuXFe+vZL+Wqjuf3rC+RiZDJ6cS+mqcF2SnsINaxWQjA3zuZPmyJqbqi0EvRKmyAVTXJeoNljggz5GsiSqA+Rgb8pYoSGSu27aQ8MHjV2DZmXSyhWtIBLTA0OTh9AD9pwRmncHW9h1xqxy5nrjHWTkuDuOoOhQslIWDYCoy+Upkhb+CcpLeTM/Mh33oZe1Jhkt2ta8eZ4CzlFud+QdoZxpySAo7WHhgolI2HZAMxebJYiLfcsA1rcaf3UR7n/G/SAkobubJO72kCOusiRWx2SFLFsOtRM9GQVYTbQMjM28lBCQkrUTUlHVSJk2W3L//3H/y9BBABWUDggxhYAAJBfAJ0BKt0AAAE+MRiJQ6IhoRJ6nWQgAwSxt34VDGGET/gO2urZ3X8w/Yxp39X/GG6rUJ5T/lX6N/ov7j+Snva/xfsV/Kn9w/PT6AP1H/2f986zH7aeoL+l/3r/v/5D3m/7j/r/7t7if7P/j/YA/sH9u///rM+wX+3XsI/yr/lerr/w/21+Eb+wf8P9yfaU/+XZ0dJP1T/mf4te5/vC+s/kb/Zv/D7D+OLxL63f2D/v+9N/Z+RHqTs0fav7t+0H5MfFH9s/Kb+2ejfwH1BfyX+Vf2/8ivy85B3VvML9ofln+T/vP7V/5b4k/i/9R+W/ur9gPYA/m/9P/1H5uetD4V33L/b+wJ/KP7D/qv8Z+WXxZf4H+d/KP29fQ//P/zPwH/y3+of7j+8/vN/m//p9XfsC/bP2Lf1j/7BU6pu0I6pu0I6pu0I6pu0I52tusDMieSrUslvZRagnTdoR1P1tIN9rFkn+nPP/H1DTMSdjodvbA6+3eiYzUlBEBzamsBozYPWNkWTxb/FQg5Qw6smtQN1V22DhVKg4phNgRdUz3lvKC67IPj1B+K0afEQ51yIlT0LEMxabZRDZNBEBvbVv6t1NDKdbfEcmGMH9qInKm2g+tQobLuDGCph9c5XbNrxLH50tJcH8+s9cg5tocy79CidrIrDqy7v//BJuEHyUMbux2mCttatbF0EfrFybbPLWRUzAAXZ0Q0W/Tw4pPRNBM9SXpgr0yHrlUJP8UWUsLcqldFzR6qtBQOLUrX9Xhc0IpfTlBBDRlhuyCv5aXXXOuI/00eI76/iwzOWFm9PRIWR8Md04oYgE0dy+xBr9+Ob6ollrauUpZJgWi9Jj0U12Plu0/4ZpOQaULeTiZysT/pCU8C3UD0YsD7i9f0P2GHJfYReHktUE3/YE81NboWa08uaGzJm2rfHZlw+zblLEm7MxW9YiODQPwJ+93d8jgdt/vwnj3xlw+pLlxxhuYYfP8XIm9ySF80qr6UoNTqQ1sNg+WAxsv2l3xnzqFw9WbUKGz06btCKQAP7/xE4ASlox3uAgXvD/K50wUfMF7nJw2ITELj9evL7HI5e16EKnaYW4Pj6DTq9wUpNxBDU7qnEw7ZCUloUG5ZKR6vFka3Lf+XSVLyrdieF1Xalh4W3OzUFfNvjgQ+XuqlmaCUiXsAcY7NQPwaQHPM6f5UB7UmUbiDBXnAtKvPH6qapUKp1l5dN7Xjj0XYME8aks2TOLXXMX8MWZHRgNW3Cf/wkTDwk8SeEUK1OUOUNSZcw7viaDrE3BGJRDZrL+dto7K19t3RvJAkyP1nhQIvVmotNBDQE4fkG1UMHvLkPkutLjGKfElHkyYOEdMNaNsT5/RAEBnp+5aiOu4JVha/IBsZNPp0+PdNTEuSwSISpoHk+aXdlYR71lLXsxkn+abHyD59Ip+xaYqAAcK8jfNbDNIE/OjYfYhOWAtAyABOdv048ZB/wA+h9UzVq2FtK7L+tqWpkkNkL16Y2ieElsiwcfLl2Rh3V7jRN2slt+Mb5ziS6fXTYJMbaE6P4mx6BjoEBgbhpofh1MclXamzV3oM6/J5/JbP7vwcm3yqEsCVd8LbTCY4if3w27HDy5CJ8usjjnxbJSvdtoUBuGvQadE6XKh13LTYLfsX7KBv5/1WZoeCJT5fQqsyFeXbk+FX3n7OXTh/5oikT3GJlQ/OdYEdux2CS8JWXpjyehjAnWm4wuh2fA3APtOr8Hij50WFBztGnrpQN6LWn1oozzQiD1j8/FmFnNUnQ/MaETsN9pI6Pk6UmoEjD8gW0siIudpYceT9QjUFYDRjzS6wVtDTXEcpem1uLC0OU66WYQpgKX5qeoiwtGZo9sNRicgj3lB/m/t6bkefQYC+yQ1tarzAkRlcSoxjQes5NjA6US5zdLuOBDbgYRHyy8zLA3qOwhpwk9Z9nB2Gq1IXwjMwxdgLTecGe9Qg4xKRY4VzSjrTchtfojnrmySXWHMtB9oEKDrDvyx0LbZN/NaOr9u+ozHjs1OH5TDAQisafubxBTAwIHHafERnfTL9PvUpgXIJF6v56sQUQXVm6YN/CnbkHOouZ3pCGY5Ll+L2RyeK8Fdf7M/8fga3i3Cp3Mo5ChOpVWYFMp8w5no7+J1KoY3AUv0fqth95nT4gA1IPbSsYypBf7DeUBQn1c+RpuLc0hpSFkag8N/p3NgOH+t34yBPhG9m9639PoqaUOqvvDCt8/ya5YdUA/KR+f1PebvUg3sVd7b2OJHI5Px9rBSmg4VKTRDk44m8F5S5eAnt1vSD+aqUugL8heB/zkK+sAoChx10QNzNdwzqOC4k3XVmAB22If3jfLeDRPO9/HX0vos1WP9UIRg50PrpCv9Mnx4iyOvopYnYR0CRRnwga6Zf9kk0IJBTP2dX3r9wJJdibcSxYKAFpCcFdPA+g50RcZ2z2Q18mpaBQIJuudnQcZWnJNOhVmEA8DCkWQ0mWx0mksERpK3lzrdOoUB5Q/7d1tbpPSBQOviNVoDINBOk+TVTifU0LSYsnX489bHwgsso88wVSuD8f4OHQYl1O+Uy9U4rwHqyID0quRJwcd/HLhG4Ni4uJf+4DYDcsTAjNDKzwBtsAp4Srqb1w17UTe6QerV4Z/+/zXbP7/8PbLaPwkNGT4jg5kfPMPfWNGRXmlmV6pjIU79caddsFzAM4JzMv7NWRf/4ZbT6pdo7tklU8yCvpdMF8RBPJ8qgoXlWWO677XzXXV2AGAhSH8/5eZCPcZAwUYgL4aeAA1u3QR57eu9QICLY3im8uIbBdWCwQK67EGUvBh66Ey1YGrog1px9ivta8P4EBSs82dXs/I9G2Z/gGepcmm+ceuIcIPY4qBQk8VShryOQs8Hf4wPf6uu9sMSu+E8kBp7udIX/ddJZ9Tdos2JzpU2yAsoapwJC/MuprLmD9FCNu9uPNydrCC8RdBMnCdr7oH/AfgO6vCshnO5yFJOTHK6xQXwzZvVoPZdLaTxWijs+2w/D93tcOF3ZtLO6iF6wnXBrfUlhQs+97li13O1tgVBJwgPv+ZM0yLqNH43XoOIDqKnlv6LZ0QyWrPWOFZTfmiUSe22IdyrKHT8tnHges4inUKoCFryo24BRmBvoloZmOabPojF5JWWnEvskp0Wg0TZuVDK9OVnXcavyx7NU3ecsuHXd+DW9N6BySms0xgRV/7CmVt54vQ8CgJ6FP/lu6HYnlP/k1YtqCCbn+glNoQPM7IdX3/RnvgfySokgUiAp33Bj0HuqSFhP65nx18xOOcJI+HzD4MgzKUAnqSC1qdw7OG0B8zzl0IRqXoCVkv8dnHBwfldXUrpoMQ0veXBF2qPDcpG4Q5fCX9blipqY56dfKOAy7QCoH3H2PQUqL/CShXPbfkrdmnf8cE2hF/p8UaCkdieMr8/e2++TgeGb5Ocx+9x/vy49RlfKEqedSdGgZsPKASXduqniVV6oTmOy1+cQQuOBGajvsxpzM8+FiIds1rVyOT9kFwTDsbzLm6nuJ9ecwYRE+ihA4KE9w7xr143TRPa5LVdS6xgooX0bDOJYNab1ns/Sd7zcau7LPP0he5aj/joPEqcFtcl1s2LsQJ/SAGyYO9+xt+lq09Fl7vR+wGoGK6FvUcuxmLKAWvIrYznc2vcAwvWZql/XBTTL4pEZKC6HJx1QNfHVtXN/trUZgah0xAECnGjyjWLWuYadw7CBH046vroiLAmKxN409ucoPBIvSRoOb55ivr22Cos7NlFbW6s7ibO1WH5Kasp/cpyaZwc0HqtOCOO7PCgISX/+R2+M+7ETZj97hdhiAuZbxxOco3rsivvrYWeE/V295s3r3yH4b1y+PQ18vDrw5u8sBClmd0hhkDldpYQrgRSHq4dbg52CyLdQXNMZmFII8Bq84Fgbdbq5faRmm/fhqxZXb+pEL3u0VVe41cf5IYe2eeNOhHGT8Cj+ikpWYP4nvEXtlS3wPsx6wMefp+hoUG7RIcqTS4jOvLYIlRFwd/ZAEKpWFGr5M4cv2CMYvSH5cJCSVTGVh4n10LXJyuMkRh59RzG/NH4b1N8fqs6O0jruUraiuQd1s1lforF2zLalrVHmJiSB3swSavJMqPzD5llvplWCVTA336XqKJ1kqSX4vqYt/HwzsnLv7AEa6bkLN8DHqhNQV7VRoUVSFqjSOL8w1IKYenpuz4fxX/N6mswEDvgIVe07G5iv+9k9GbcK8A78MaeInqFda1znT3aCBbdJJ7pwTD5dUrAuC15+JbXvwgp+15Ho1rTgSxNI6CODjfc5Ls9cz+H7Q1ZiM7Mg8fbpBY/XLR2Xl0EkEBO46yuIdjs4v9YnzfiKDrIt/uR2XPJ6f/QtPsTwli+F9FcA1l+CLIQl18uqyCxWUQOXqWAk9gEjmaVA/h2VJj4HKScxxpE4+N5tntyThpj1TvFJd7RHt8a834E/ZaO50067SX/rsUbajbwHsLVYEYfebYoYBjNPHtyeVKVnZLckjNsw8VYth0O3bfa1J5WwQAhEFC59FHthxKPSDDNblQ9Ev2tnNgxURYrH0QLC0oimb/hTFvyvqiMVB8W0fpR21gU5irS5+P54UZLq0/TU1G+ILNVzu4ie4g9JmxZUC77lLFtOjVbchan40PYd1rLfVGAzX+Cp/uFPGzuaZexXjNAu1BtZzMoFa+iOztacLVeLhJsZIuZjL00rrflUaetFbjrCOVuI+BJuerDo/XQnLPzYpFPfp3RTEmN9LwjA637x/Yjli+h+TaXO3I0/QSrU9vSNBTSzxrnma4PkIUemt7QTX3bfO+svlinhUv1GAbpfkIpUNiO5I7r/ShoQrS03DTnXBl+mdvDHkYIhHFrf31hV2+01VHz2ijY5Gnl6FytP7TNp24AjjHX5lB9opkh8IWeQxMi9qdtV8G/fSKDTSLNSlPSpl2kBcWim/iSkWdkqs4CMsHve/ytFX/f+tKf6Rehmvfbl9edmojZCEHOxxO7NknVqHwvuQRxcrTkhLj6LxxqO/2dN1kOKTRZ7jcztC/UDVYC7YnPpw8w6d0jkN4PZIWGEvUIBqZ7dqFBkt+1U08b6Ds2hAUZdbtBbjjqpbBozHI8hZMiB8M80Tc3I+0QH6SdyL/H3MYNtwg4Ik1gTEmdwjFEYwTwLEsu+OfiAIJ0v/FimrKDNYJiZe8wFmN2GgxOGLH9Z9nl9jD5x/q0elSFRuJLIyfS43oVKKtEFGU1NsQrYbh0ewXQL7h1zh7XZIEdbvAoUVe8+e6PVToK7wUx2e5x7unavOZ7lJpcfeuI+f0eORaGnneKuHubI/VUpy99SaHgSzU129h9UcWm9zVbif0u3KNYAaao9wK7pseVHlXXRmOd0nq+gL9XaYdQv8YAyp4V3HAWxcWfnzw00lv/N0EPNHgDRrV0i0FT82Mg1YDJqRvBoGEeEEO8LsEEeNUMJPfkf5DCV5Smi/s5R4oWIK38yWqRD+6d/uPOkcaQxg+FjwrscCSEmeZZa+fvbEhgEkeRsyaHeubzvXi3j05bB3gJN/LhcZEQpxrFopWEP9mSdsomaABaW4Xl1luXExk1I/VV3YZcvsRCnCCttRdkjL1hUVFKJVBZNa5OahMfBG1UZyAMi9pOiiql9vkAZAq7DxWczmaUGK0h/4sju4Lyz+EhMa23zwjfTx1+xJ0gQ5QGlg3nHLWnIEVLMLY4cQIe/geP7V2F41Xe741MbcHDPl2TYIi+klVssef7fTxwbVB7D8LFSjrwCQkib8mEta3E+2zpZ200jEFDh5RqbsZhbdbGVXPK6VkBHitki/ZezY4E6XbcQJnwlpKmfQgxUP3yt9HhNIStMlNx6iLXGDhKtK1VB97THLChvb6dxmO2eG+PUFrsR47f5nYCbFYFRyQMOmfEL57wYs9Tc+cke+S26vDyaf5fH0wdL8j2BozcDAyVrwAMVPetaBZA9tlP6xIP6VLZ45O2QXc+6KBA1wMx5Tr4GGUIpGP2BBLN/xzxgXZfkOPGu5VYf9T8qNm7DvLU6OvKA2OQ8Z9l4kmmYCFDkp5/WMmIyhb6LP3ZedDkmLxXxQEIJBPKKL1YHyCzgdFIozP6MEWfkpLGo78oah728WiuvC3QJJCJ18EXaII0/I40XiU7NdyKqmvYmSsvUYw2BwXgXgOda5IgT+fhs5lESaD/VS5d90oOktcwOt+XOHC3BgR7YHDopoxYxg5LGSNCTMiKUL08LPMKyQWJ/vRqOaOntykSUxNXxxKYw8zy+WjABsOzr0xd1drwqMGjQ1A4JTs4+PSE/Zbe+e7eC4KqLxooRWXPfIuqvVEO//rJmYVpv4Di3jE06REZxfuWMTYJibQHuy6O22DW+I51Zt0WAKCS2wrcxSJka6PuvWvNK+Cc+VCAD5m/sfu/IlNAT4af52UfqUlo7LHlPqeTavd1g8qN2CbofFb+2SXslt2oPSabvuH/GOGl8dcL9rGpsp/jORM/GA7G4muISR9c+ymjAG1aRKrZG4GQGC4MTdPDk9zNGsG20F21NzAHcU9884FQI0CnmpasTSRV3lkLqzVc2Go+kNZr5s8LsH80d0jAQwUoc5DPOTINg99Vv5e4Iqre9iRmx97HryrnzSLS3ai6A8CUZfs89ROobs++zcQvpXCmhP0sQhzxMze3/43c8XhWBpJNDngxGKUmp23dgo9cAXdKBXQtTIZyvfdIiX2N7Ty97PYYybrms6OJ6xJQDZgyGaQKhp64Hz/neVzEIeYDKV9CM31M17eyQbKlA1TkeInRNBBUuWTYjufL2ZhlYwHRbRFi2f6Ago6dyMZDhmj24vK7pic9Eakh9yQf9Y93UwiZZlJR/Ffz8wRQklwQsJzUKjxRBJTY1Ru905U58awXUS0JSIJl1QG6WuCbna5dL9nG9JzcSVBUZFu2mg2I6UZSkMH2pMHCZ6AjEAlHjRl6iMUS0NI7bZzVE6G0Qn7L655zsA7rvblJLPgZKyQmwEEMirPaS/S/HWzDgoVsUFyOvj+I9FIGpUmNbqnwPfMzSItWlIFrxnqqG+/Ei+qG9CqOTKZnWHh76Fol87SbxVVLQJbn2hPRu3YTgQ9Dc7hD1KWtOX3trq6gdnlzZV/L+DGzoD+w5MfYZsemPvE97acq4HjKkSA2nKRrHoB2eVYfumrVDBDXCD1vLnFd8DDl5154LnPIZBUbYKP8WXKfpwMdiZSb5PoYEXEBMS2vXlH47T1TCbxckySI4AnrUJ8t5hy+tiZzcNi1p7uNM07BE8jlm6pOiTveQ6SNpvgDQSrwTiwD0mGc3MLbipb/2tSaq2AShO/eWeCP36pE8n1oA0fIbSEQJBef+ABcVpQ+PngornU9kJyIXe+n6Ovh9J+NPibwvoWY/lWy7OLEcRL8Hyli4efR5gP/rmCl9/OXNIdVqUdFiEHNn3ifCm31NcKxhKyLrqVuf65DYRQuDC0MRO6tzMTPypg6nwXTPgIVpmOIBLusq80HgYk6DB/0kcsdb4yil0nQM54mzsYhRH9i78alSZCuZJp0Stc6Obnzlp23uslJk6ELXZuS3MHm1+XPVoaeJ88Pv2kr4LygL7EPnal7ixraXUodgt3TA4pQqaQ9B0bp4Nlbys5QxAlKxVvhHb/z+WqpJ2Xnz3XjHoK8LDPMBIHXXii+R/DvPGNS/5RnUn4pB8I0ChbcwLO+dRawo7CVmkKxTL4csRCj6I9uu6j1SbQBZsDBqSzYX6XGrgodxzV6Vi/2IwVdnPiT/4YNoOujJNIY1zEfJTWDzZvikYyXTNR0w9lm3GSWbeI8csQAAAAAAAAAAA=", "librewolf": "data:image/webp;base64,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", "monero": "data:image/webp;base64,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", "firefox": "data:image/webp;base64,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", "mullvad": "data:image/webp;base64,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", "wireshark": "data:image/webp;base64,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", "tails": "data:image/webp;base64,UklGRo4YAABXRUJQVlA4WAoAAAAQAAAAnAAArwAAQUxQSBkIAAABBjvbP0lu3KgaZLQ7AB06YywM5GwI5j65R7Qabmp/B4d3Jn8GrUIt5nFm61ZMDJF5ASj27cwPAUjREtN4PNNdVV2Ybt92d0RItG0lbKUTX2M6DkVjECRfEP8L+AAVIwTrm8EwL8YPw1Qgy6dldfNirILUYvRoVq+2r+eFClKL6w82+0an24vQAMposdOHGJvQAGo4KY0WB4vQ1Kql0cImNLVt20IGUF7ZX3iY2zURQA3zwif7q8bvvTJqFE43t557ZH9VMb9vazRO827vk/1VF7fNgYPTI9E9qL7j9LSGAAdDEh7gwfhty5AEifMf32w6QxIosu/9aqMPoSLC6NEHOx0UyHK9asJFHEwXYQJiNLULEvDgPINwod780XczCBfFp+9PVLhI89+UQwgXt3fVRA3CxetlOQwY+22VnwSMVBen4aKJ6eIfS0BFCBeQjWOCGGOQOBk9ehnT2fA8UxAgzh59cBfT8/IXzyYZBIfLt2YbHXfr1V+W1aMRhMa+XqZ6f4i6ibrZfNAWv1hMB5g3VN9vZvkJC/PQXVHgE6vrEdjksz/++lE2oC+qrcZK2YrwB73Dpghk33snjkDRTcplg6lpiPAAaopY5ZzlgZ9OsFM0RGTgAdQUQSIrBoNhe8L1nOXKA7hThIXCTzHu68InomWb+CjoToTV6zlMEcDnjfa00T7BFs8GskcfbBrtD3zxTIxdpWr1pe47hb3IOIjn0lYn3183fSefbbRDacxWTCKcXC56DjJnXVsxQO52vzHn7HKnXVud0GB3G6Wn1Un5gXOrr01JsLutbfqc4+2KU6un31qwiDAy5mJ/ITrnUj76+RcU1FzE8FTEb7/SBORcRPBURIwHAnIu3tv4KIIVPpBz8a/9T2CCQ+GFD5TC7787/hu+Fmb4QMzFMZY09/YXY2RHesSGjb+/GKNIpOfxL0aRSK//vyhTbTYfeFJ4yT8R8b4UbvJPTrwTvQ4Y5MT7ipx4Xy9CJB6G5cokSCLUeLbVBkESofLKIkgi4Os//K2JtAjvPoRFZODL1y/vGvly93KsfPE5rqrlTvyrDr88ItHadlldEUJ8CGNEa9Tq6YsrLlgb4n6HP674MWp+iThCzTMR4jX/RMjWfBQhWPNUhFTNXxEiNb9FONe8F+FWC4EIh1oYROwTpxaOVrM6MWugzAP8bpUXMW9b8BS6SMnQiRoorwYLjA5yb+VtSrXhrOEDZR4xz8Bz+7ZvYkyomwvpqh0o86jjlZcFTRzZAUI1QXJdd/vGPNKd5DsHoOQOEIFKkjfLcgiM3GyqCzHg4bi4kDmi0LY39XqB3lbmzWEkNuWCzRfzW5kjvhgrodiVfDHjyBTz143M8XpeCIL3n0tfNvyIrohtgxEfQSEOpvWeeBnII+ReSyC2aYICZIbt1wfdJHODy2u4q+Zqu9/GetZtvgUDbPmeltVNVaZu8Q4OEdRgmBd5GphrWZ/sKxEKa9q+SjpK6Crbo5Vpsf4SKzqtF7yVCcQWegm4XiZ/Tb/8wRpVfp0u6TUdlDFXbGXMSePkwAAbzvTDexKB14nTywXKIp1SHQTVaj8tK9slTLXxuOEFHrxZEE4KF8aDW6M9YbjBQiM7nLTaL1Zb2yWMtqFCOf/x58QUdAaUZfKwniy6riiQgK4tt3v8YUVMPDr+z17dow8vGyq23aNd0U3XFSNeEwQyo9Zodm6XyM6hmrOhtqN4uZ0yfwhiQHZl19gFVV0E51fwdLN99e5YOUMlQBzzMMKgsYRD9kQYfYgOpZooYbBYgr8QLsskeWG++uDWBVmwZBm5EGp0mCWbjJDR1ZwVVm/bPsjCcoib9gfjKjUaSdjJgMzLrbaV71bY1U6TJ1GQUIIwDNMUO6NhvfMkZV+xiWlttU0vUppef7DRVPApCnKN/H1YToaDNOzMbbNfliMZ40+c7qyttoGKMY2I2b+viyNQYNfN+vmZAnOhql79adY2kgPZZ7kxt9qQ2U8oKYutIQ7Yq8yzd76XgfyanuXIdhq0p9Nv/HKnUY76Yc5u07EClZ23f4KgjhPurn3zZ789HpQs0y5cT60hhxjfEIR0+hB3bfHFV8eDtZ+zW9XmcwRH9JSH+RR11/ThaGBWEXesOgtkNBeD5UiuUHeN4NjLpmW77e3tIzQxHUnz31gc0+Ggm0/k/xuMHtneWn+A7BE7ffdIxvizsvc9geoM900dAai/ttYfnFxwUYeDuPF9wiF4EXbVcF+5VzDCvkYfxclFfeV+QQbMtvmh3Ctn8Be8+gW92pmGG5/0+3o6kADJX/QM1pJHeabNqhw6g+rTMwgfxm5uGCL08i3fgSxHN2SA8Jv39aWfLKYD1G+e2Q5kjHD2fN14z+r6TIEdcdwbDqQRccTU4dcF+iDjQVQGVoBhOZDTCyNY+3Cn/WqCmUC0GBlge2prY7/t1gpzPRPEy3bppsv1oiuxRrbCvTP++KYCHsGe5DNqJfZy2URHlVLztLjBZ0H/HA7dRC0AOqoU+EcfXTW9W8ek3cFHlWCQOXjN+jhObqMpN/l5bE2OM8SoEgsAjB5hoRBne5uZRyJyRZzQBQ8wzmK5vMf2xBHVcc25o9osn7WikhFE4l9oJDHAzSMRbxPwgr4YkdBM5e/NsWwCojpTc/sGmXrPf3wOdviNZBi6b+iUCpFHolIrrHD5NqVkBbWGnpiSiOpczc0bZKVg3h4/AGvjAs3NGN84bDaA4xssoKz8E7aRhCrJUx04aiN6s7JakfeNZBoSGa9jqc0ZLcbQ/hfZEQEAVlA4IE4QAAAwSACdASqdALAAPjEWiUMiISESeW5wIAMEsaI7kJTzfCd7nzruU+0T3FGEeicff9D1mf43x2eg3+qe9A/VX1Vf7z+4HXXf2DgbP2A9JH0YPRJzVr+2fhn4Hf0z8b+uc8D+uv5N/BpWjXq/3j+6/tj/cv3V++f65/fepu9Q78k/iv9T/Jj+u/td7X/8t3W9TPQI9tvkH9+/t/7sf2r41PPv9F+XfuB4gf6O/4380Pin+7eFP9C/yPsE/k7/Vf2L8rvek/tv67/9v2k9pX5r/b/9f/iPyX+w/+cfyj/Qf1r95P8j///ox9Yv6vey1+lf3/ntUTOhJL99fd4qh0/iQ5YC3F3COtD06KU4J7j47F7B9lAl1nOcYXLgJ0YCVg4zAqjqwpJ8D7Z1u9kj7W72rzmvHB1Kch0iyC1ANhkvuafGIRLdHMIsK/X2Vs+FgpnbZjVoqud0u2PnyDDCuKPlaYQGLQoEeFi58sCE3g3o92vKX1+/RJD81IGHO1BTx/e//9Ec+/dHPMKSH7v7ZKY+21ID6+b48Aa+aANwYJszX39kEpLkfUn6/Z1gVR867MGTe1TsZqvS/P6RHapJvKi6FKNRmPVxPwxDGWCp2pRJS5MValWVTIN3J5jWXBUearKtnDZZE5c9JqadymURjb4UZP4ZDJOyxjk0lPAHqbZyFhst7YZgXblIMDkcM4NPgGBNaRe/1pInZDuJAbT8qDyhHTCyFJWrIncGNROM2EAeBU2k+C+rCsCY7fpMXWcnZl04LcY34pG7D1/3XMoAAP7+3YnutjqlNUiuiNqdm/reak9Cj5H9sUcOZ6pHNSFfHUBPgBQ+CImBwosMJwgAwvdJ94mdrK6D/fqUhUb6v07VmCIHBE3V99vRb9yUtU0Rv6C3WvcucvzsBoQuNMwGNH9Ifs4WRRrv4X7z68nnhGzP7u6DvPG6D8kFZSjJXHV8RsH3TMacUxbaQyhg04XpquWfoQ3bgmTOu096X+UpzAGgWJQ+B9mP8+B0zILOThgv3+XNV+8pOvC+5TAiaBmPPlCK31AggMmWPf1Sg8WvbLszcHQWAHeaSTzDJY9upeSvacHotb+Rw8F68ZY6nNm9IrWgsfDTVf9otfisZxgsjsyR4dS2126MSvoYyuODg4vTT+U5MygdGXOCIEKWPQcCdz2ljmnYreFbYhHGntSEMZErjYkdmfB6T/Sxe3OFTF/DJiCaz3Qj0EVLH2mAQW2LaU9LVsC/OY9ukJW6AAtfhoDEYfr9mosyz5W//r8lABbwYMbDAfiVI/ylV49qpxTDyICnIAA9R2yNF58tf33Zu5g556F7kha/6ROchqTM0ggrh5f46QzArkfdUlyKCca+OKRcHbSQb7fX7hnzqKmBoYkm3hyneyglWepOWoiS/gq5dLaB0ViOe8AbmtWynsMQO9U3DVCUf8aviRm1MRDnbpeTsvbj/LJ8Uq32NsdYv1UC+3aOiaEiaMpFFEaItnOrRYDDnBnnvpkYQoeWg5dlIQfeFVbxdOc5p08e72PgiBKzkZMYFKUCeJIlwSVuD77plCpHdy/j/dsadACtWEh5J93WgODHcmXK+LTOnJf+jjuc9O1qMUB3o0ACREQZXR3gelVQL/5Yf5l0i6izkA2cXU1Q3JSzi2dJ1mq2bv1rHRotUb/xnaRa2AU5HRltteY9FnwOeBmv9hfFc56agUmv4QzQLS9yT7B/FFIqWquh10dvwGr9k2sHOq99p0Uy0VlTIVBnPR9e3iYJvx7MLO0x0CUokWmqLLZai0ueGNhlrIU+aiPr3nZnnfmn6+BlNWWvPHXx31++E3zqqIa3AcZofn71g0Ut8Qg04U5z7k/Gx1mMdNcKwxO6xrQSQ/qC5iQpOEnjX5uMU0Hu4Q8RPM93YBbwFi2Gn0S16JHWydVCAfBjST+QnFpGWC/fdaXtXl6twZMChFMaqhWI96O9e+sI0OHeNs8g8eMgUyUvHgNYQyjQCB7nSb3Tyhkl78YG80VpDoYZSyq5eHyIjjde5vLF8UEXt+qV9YcMdytXWlji1ZGv4qQoJEFveNpdbn2WnJouixWWvmtwm09GOFFfgLZndoeeesacaz7vT53VdVSNB0qg04zQPwEe3MCci0VmjsOsfnzRA749LgD4oJuqS9P9khP7mCguw6WG/Zl2mh7PEdAaPh9IsN4pF6UCS3rHa62pR0b3/AjF3yOq5p7V+qeTfEpwNZO6Eg9q8q07cnxCi+Bl/pZgPm1ihnwP96dcBKSM0AdsNBAsK7oVR9B/omiCKDIZkUe8WrrGIx9si+prcxKW0frsCCVQeahRYjomBzpQEXeBOIg0vAYTKhGIvBwwUBqpzXGfjH9cfrdzt0RjJVd1pD4ozgFcuz72VCMJpuG8Lev86Av+kAtP/9f8svGov5K+04UNOYjbSzgT9s13o3MvN109/dw9CVA/MlOj2LKzR0NGpP7poL88SCpjgkWIkkQ3jUPIQV/rgGS16E3VTT9mSlxJPpGD5zcGuOhF6qEtj7wBULycZOBgDuGWC0WUpKPMMgyGWN6Tj+33JEebTvAExh5IEQ5V0ShyQFFevQP/QScGogeEE6/J3Ns4PNH7dR1nicOi5IqMBEn/3MShAstqQ/IkACgFWdXXs4FsIsrZRRKpUAyIowALQjV1OVauU3mz7sgf8si5K8b/zQtmI7tXSfUuTfsX4sZPBpkCBtJFNUcXVPXgbRgQILK5y1HdEFT9H/t/Yprlycwpfoidl10gHFlspPVHgzPMz1BIgRXmHAxBTXY/AHG674f08tGugXw/W6l9NPe4azo7uItf+7pemqEm2eZotvPhLIrlHNxKvPrEMrIEOSuRqsvyRaKbdbOFb5DPQ22XLR4SWBTipDqsItYxw6ungF7I4KHJPmy9HHDiX2OTvxm8o/LA0h+NMI0fKIKM73nz+QzVuUeVeDeuD4PDM+GEvlXqImERjO91bnKXrm5xzDKKXSlKMhhb3esxxLZFfI4dgVPCS4M8wMnZaU9nDoMYQQlHgixWnRrtYHuqzEM3mjf5a8c/p8wevvfcgrXljVrOep1G7bvtoMbMDu1vGUmTq8ijYwO/sU4IgNBUqS0MVShVwwx2XYWOrSwTWq/3vXzn+wuiJPSsMxADTwbYElUpQjjdp2okGOukcaDqxzjLwYDoG/F2O+1OFrcpLTbpbN9LrrBOUQJpRcXdfNOiCmx9KwSfYkiP1HEZ9K7UvFhJJWeCFogvsyJqOYOSIGNSbt46yeFtfD3sY+UlsZLDO/7OGV0n4mTwp13P91h2trKVPpIHNQ0Xg+2zgogRfy1o2ELfLtIAuTcN9kO660nqVx7FfaellP1xfVpMRAOt8VMaVMHnM3vEYgZgr4hkebzaT91Bbl5homldCjQipAUBjxtvBvDrVwuBQeityGuGMSqpDj4QR9Y5e/uKnO73S/VPocXbJeyMJcoEOuOdQHE40Ev5TJcKbyNqWKTmfFYl0DHa0yvUZ9+h/+62dwmclHkgcy4JAl0Q+YNL+a/Be2a4ngatF4favWDB/8wZ/VLdVAgvWcfiOLjvfnt1Tmng0aOV6wpA8UxtvtjOYnVRbAsD/Wh6FmJm8CQ4eisrdJbHkn+BP3i73iiZQYdVZGHkK2ckeyP3eKORnfD0wj7hJQVkoHhuO4UI0ns02sRvHawCHnrayvxApJeQQUdLb7GCvMFTavlFwJV+tSnzv/vnlyEpJP4ve+BpfYGUCm56WYrYjN9VXkmx2W5gh2mvroRy0zaQbDxasp4YM9HfyzTPx84mEGzMekVBaioKYmzVJLIupXY6Ad6KVGb+dUEgLyTvauh90whvtK/OCRIKxUEWn5SpyMUr5chIii/+5tif5tPpoAKbEpDz5wGeZVpZSnFFK/aM6XcQIQm48Sk20PaheLkAyLZZqY6B9/TlurX/NXyuCane7jxbDyHxO9CIR6/8xAAOYS+wDCW+o1bWiAU9to84vtzJJT6gFbbkFmWnUbscFTJL+zVQqsut7jCEGvwlVlgITeRmIN/h3ZN+zbuqjtYcPchV9GNOkMSZB9X8xHDU/j+xLeXLvlfXPaTwnnjGPvuNTU341e3eE7oaOSKF8xJ9WxezYdjp+tDHq4eYp8lvhnOAgSGEoyB1/Etudqsi0XW6cBIFI7XqlBMvDnoBIDg7MvmfcIVbO8WCaVyJRGO5+1nBjkz1iwrwJVzec6fOHMgATEJgN0ZcklCvaySQviEKmG3v5VIJc4c3/k3yzJ2XJ0xKNZX/6vjqXtyevD5HmU9OT7LTY62y+jj8RdxrBU3HsLDFc5FEb+OJXX0U3Jk0KRjp7xiQxJaIwrEPR+INgkSqWD6bSmHANHmdDzEIxqec2jkTBsIMRjS+UP+DmJOS+ILi8EE5cuF/Bwu76iCZGtVpJr3lb5FiAbhFYZclEaFSVtfQxpjY++rQlHCEjDGOkClxkXtE/jvZuREIk61/TfRUpuQjCMVUKTy1Pih1IT7eMFkRpqRdCULBVvyB65da8XasyojMqkvN2cd9wt+/C+joalrTc2XD71MS1jgmfppBjMTgYwTUoMahMtAqi5LTyHxbpisBgOiGrcEYxDWIoXXkbsTSQslE+bpazASEdigKk6k7g9suXsLDjpVfQtbv7dflQJvTDv1umJ4dDPPoBCBk5ROYRIc38xU2/8eAvkWw1cWwj+wOwpwUhAbaW4vbJh5p14P5lxHw0g5fPi1GqN772vmiBovgStLqKDD3lhuNidso1gcLyPWkGHwDNznRgnyflkRcTehP206i1xgHkehotoKNlVEa2SgvH5EbIbnorjXcnf2/PPlQY+V2XubCBgUmoS1lmtRxRkgFIrqc5MOQeE/9WTq8OnPEbCrQqqOcRImMoDTTwmD9EXKQl+6BXhqQZJNkEAbsFo6Yy0uZFY0lDweZ8FvA03Huk88FwTHIZQ2MvHcc8uDOMzmPnQKXult1pYHlO5Jusg5UHmeTw0Y8KR30K/+UgYboWVbWxjxkCuMrL7EBIhAj4jlRWeF0p3dlg5KyuQ/9PsSbJxNUS1HHU3POE4rmE1GFRHVNJ9aQeB7k0TGgWpIopNUVpbynOPrQ9FBvrcYWgcUKO18DBZzIYuF6I72DV1bCpmUQSrWRlklxrb425Sr/F6pGdYBYvrvPq+uZzfxBtxqTtoF85DZgr3KMDyi05CR6E4cK8F1wMAAxXtP+FI1+gafSlwgWbQKTrlvep5M0ax/jeD9eqZyStZGJl2PONipvFkP3nN0jYOy9kYZOQ5MqRX/z6yrBLqwxnchqgHwgPhc7Yh2mb9M+KSQTmljjFyn/Pe33HEOOQAkjAa8jHTr2i+1SFco6gb/ang3EYCSO44F44S8MW3hXSNlAfJFzF1jCYlF3aYT7vxAIDNycibus+tx9wFMId+Te1/3ePNzACbFJ89XmmikB8bycCmrcUZ4mMMmk4q8gGttgpZmTa8RfiMS6oNWPP5CD6rRjME79Sl7j7i9z6Vw5XdQkTCPhHlvOUy2lqE0AF10lu99bpANS0SbhEaohPhPF/NKsWF9YLsalH8DFlMYYqrBzhlXvDVK6/PTFwAAA", "tor": "data:image/webp;base64,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", "brave": "data:image/webp;base64,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", "wasabi": "data:image/webp;base64,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", "signal": "data:image/webp;base64,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", "telegram": "data:image/webp;base64,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", "googlevoice": "data:image/webp;base64,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", "virtualbox": "data:image/webp;base64,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", "proton": "data:image/webp;base64,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"};
function lockIcons() {
  const out = Object.assign({}, BUILTIN_LOCK_ICONS), dir = path.join(__dirname, "lock-icons");
  const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml" };
  for (const k of LOCK_ICON_KEYS) {
    for (const ext of Object.keys(mime)) {
      try {
        const f = path.join(dir, k + "." + ext), st = fs.statSync(f);
        if (st.size > 0 && st.size < 600 * 1024) { out[k] = "data:" + mime[ext] + ";base64," + fs.readFileSync(f).toString("base64"); break; }
      } catch {}
    }
  }
  return out;
}
const lockPage = (info) => `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>OpsexCord</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>
  *{box-sizing:border-box}
  html,body{height:100%}
  body{
    margin:0;display:flex;align-items:center;justify-content:center;overflow:hidden;
    font:14px/1.45 "gg sans","Segoe UI",system-ui,sans-serif;color:#f4f4f5;-webkit-user-select:none;user-select:none;
    background:
      radial-gradient(700px 360px at 50% -8%, rgba(255,255,255,.075), transparent 70%),
      radial-gradient(900px 500px at 50% 120%, rgba(255,255,255,.035), transparent 70%),
      #000;
  }
  #fx{position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none}
  .stack{position:relative;z-index:1;width:300px;display:flex;flex-direction:column;align-items:center;gap:14px;animation:fade .45s ease both}
  h1,.sub,#err,.link,.credit,.hint{text-shadow:0 0 10px #000,0 0 3px #000}
  @keyframes fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  @keyframes shake{0%,100%{transform:none}20%{transform:translateX(-7px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}
  h1{margin:0 0 6px;white-space:nowrap;font-size:25px;font-weight:600;letter-spacing:.01em;text-align:center}
  h1 b{font-weight:800;letter-spacing:.03em}
  .credit{margin:0 0 -6px;color:#9b9ba4;font-size:12.5px;letter-spacing:.02em;text-align:center;white-space:nowrap}
  .credit b{color:#f4f4f5;font-weight:600}
  .hint{margin:-8px 0 0;color:#7e7e87;font-size:12px;letter-spacing:.02em;text-align:center;white-space:nowrap}
  .hint b{color:#c9c9d1;font-weight:600}
  .logo{width:96px;height:96px;border-radius:50%;object-fit:contain;display:block;margin:4px 0 10px;
    box-shadow:0 0 0 1px rgba(255,255,255,.22),0 10px 34px rgba(0,0,0,.8),0 0 46px rgba(255,255,255,.1)}
  .logo{transition:opacity .18s ease}
  .logo.spin{width:110px;height:110px;border-radius:0;box-shadow:none;filter:drop-shadow(0 6px 18px rgba(0,0,0,.85));animation:spin 4s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .sub{margin:-4px 0 2px;color:#7e7e87;font-size:12.5px;text-align:center;min-height:18px}
  input{
    width:100%;height:48px;padding:0 22px;border-radius:999px;outline:none;text-align:center;
    color:#f4f4f5;font:inherit;font-size:17px;letter-spacing:.28em;
    background:#000 linear-gradient(rgba(255,255,255,.04),rgba(255,255,255,.04));border:1px solid rgba(255,255,255,.13);
    transition:border-color .15s,box-shadow .15s,background .15s;
  }
  input::placeholder{color:#7e7e87;letter-spacing:.04em;font-size:14.5px}
  input:focus{border-color:#f4f4f5;background:#000 linear-gradient(rgba(255,255,255,.06),rgba(255,255,255,.06));box-shadow:0 0 0 3px rgba(255,255,255,.12)}
  .btn{
    width:100%;height:48px;border-radius:999px;cursor:pointer;color:#fff;font:inherit;font-size:14.5px;font-weight:600;letter-spacing:.04em;
    background:#000 linear-gradient(rgba(255,255,255,.14),rgba(255,255,255,.14));border:1px solid rgba(255,255,255,.33);
    transition:background .15s,transform .1s,border-color .15s;
  }
  .btn:hover{background:#000 linear-gradient(rgba(255,255,255,.22),rgba(255,255,255,.22));border-color:rgba(255,255,255,.5)}
  .btn:active{transform:scale(.985)}
  .btn:disabled{opacity:.45;cursor:default}
  .link{background:none;border:0;color:#7e7e87;font:inherit;font-size:12.5px;cursor:pointer;padding:6px 10px;border-radius:999px;transition:color .15s,background .15s}
  .link:hover{color:#fff;background:rgba(255,255,255,.06)}
  .link.danger:hover{color:#ff7b80;background:rgba(237,66,69,.14)}
  #err{min-height:18px;margin:0;color:#ff7b80;font-size:12.5px;text-align:center}
  .shake{animation:shake .38s ease}
  .hide{display:none!important}
  .links{display:flex;gap:6px;margin-top:2px}
</style>
</head>
<body>
<canvas id="fx"></canvas>
<div class="stack" id="stack">
  <div class="credit" id="credit">client made by <b>@geofeed</b> on discord</div>
  <h1 id="title">welcome to <b>OpsexCord</b></h1>
  <div class="hint" id="hint"><b>TIP:</b> ctrl + alt + s to open settings</div>
  <img class="logo" id="logo" src="${LOGO}" alt="">
  <div class="sub" id="sub"></div>
  <input id="cur" type="password" inputmode="numeric" maxlength="12" autocomplete="off" placeholder="type pin">
  <input id="new" class="hide" type="password" inputmode="numeric" maxlength="12" autocomplete="off" placeholder="new pin">
  <input id="con" class="hide" type="password" inputmode="numeric" maxlength="12" autocomplete="off" placeholder="confirm new pin">
  <button class="btn" id="ok">confirm</button>
  <p id="err"></p>
  <div class="links">
    <button class="link" id="cancel">quit</button>
    <button class="link danger hide" id="rm">remove pin</button>
  </div>
</div>
<script>
  if (typeof LOCK === "undefined") {
    const infoP = Promise.resolve(${JSON.stringify(info)});
    window.LOCK = {
      info: () => infoP,
      submit: (data) => new Promise((r) => {
        window.__lockResult = r;
        location.href = "https://opsexcord.invalid/submit?d=" + encodeURIComponent(JSON.stringify(data));
      }),
      cancel: () => { location.href = "https://opsexcord.invalid/cancel"; }
    };
  }

  const $ = (id) => document.getElementById(id);
  const show = (...ids) => ids.forEach((i) => $(i).classList.remove("hide"));
  let mode = "unlock", hasPin = false, busy = false;

  ["cur", "new", "con"].forEach((i) => $(i).addEventListener("input", () => { $(i).value = $(i).value.replace(/\\D/g, ""); }));

  async function init() {
    let info;
    try { info = await LOCK.info(); } catch (e) { info = null; }
    if (!info) {
      $("sub").textContent = "Lock error: could not load PIN state.";
      return;
    }
    mode = info.mode; hasPin = info.hasPin;
    if (mode === "unlock") startFx();
    if (mode === "unlock") {
      $("sub").textContent = "enter your pin to continue";
      show("cur");
      $("cur").focus();
    } else if (mode === "setup") {
      startFx();
      $("title").innerHTML = "create a <b>pin</b>";
      $("hint").classList.add("hide");
      $("sub").textContent = "lock OpsexCord with a pin (optional). It is asked on launch and after panic";
      $("cur").classList.add("hide");
      show("new", "con");
      $("cancel").textContent = "skip for now";
      $("new").focus();
    } else if (hasPin) {
      $("title").innerHTML = "change <b>pin</b>"; $("credit").classList.add("hide"); $("hint").classList.add("hide");
      $("sub").textContent = "enter your current pin, then a new one";
      $("cur").placeholder = "current pin";
      show("cur", "new", "con", "rm");
      $("cancel").textContent = "cancel";
      $("cur").focus();
    } else {
      $("title").innerHTML = "set a <b>pin</b>"; $("credit").classList.add("hide"); $("hint").classList.add("hide");
      $("sub").textContent = "OpsexCord will ask for it on launch and after panic";
      $("cur").classList.add("hide");
      show("new", "con");
      $("cancel").textContent = "cancel";
      $("new").focus();
    }
    if (info.lockedFor > 0) $("err").textContent = "Too many attempts. Wait " + info.lockedFor + "s.";
  }

  async function send(action) {
    if (busy) return;
    busy = true; $("err").textContent = "";
    const res = await LOCK.submit({ action, pin: $("cur").value, newPin: $("new").value, confirm: $("con").value });
    busy = false;
    if (!res.ok) {
      $("err").textContent = res.error || "Failed.";
      $("cur").value = "";
      const s = $("stack"); s.classList.remove("shake"); void s.offsetWidth; s.classList.add("shake");
      (mode === "unlock" || hasPin ? $("cur") : $("new")).focus();
    }
  }
  const primary = () => send(mode === "unlock" ? "unlock" : "set");
  $("ok").onclick = primary;
  $("rm").onclick = () => send("remove");
  $("cancel").onclick = () => LOCK.cancel();
  addEventListener("keydown", (e) => {
    if (e.key === "Enter") primary();
    if (e.key === "Escape" && mode !== "unlock" && mode !== "setup") LOCK.cancel();
  });
  const FX_ON = true, FX_RATE = 26, FX_SPEED = 1;
  const REAL_ICONS = ${JSON.stringify(lockIcons())};
  const ICON_KEYS = ["wireshark", "tor", "tails", "proton", "mullvad", "ipvanish", "firefox", "monero", "wasabi", "librewolf", "telegram", "brave", "virtualbox", "googlevoice", "signal"];
  const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a);
  const poly = (c, pts, fill) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fillStyle = fill; c.fill(); };
  const disc = (c, x, y, r, fill) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = fill; c.fill(); };
  const tile = (c, fill) => { c.beginPath(); if (c.roundRect) c.roundRect(4, 4, 120, 120, 30); else c.rect(4, 4, 120, 120); c.fillStyle = fill; c.fill(); };
  const grad = (c, x0, y0, x1, y1, a, b) => { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  const line = (c, pts, col, w) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.strokeStyle = col; c.lineWidth = w; c.stroke(); };

  const DRAW = {
    wireshark(c) {
      tile(c, grad(c, 0, 0, 0, 128, "#2f95d6", "#124f7d"));
      c.beginPath(); c.moveTo(28, 98); c.bezierCurveTo(34, 70, 50, 40, 74, 16); c.bezierCurveTo(70, 46, 82, 74, 108, 98); c.quadraticCurveTo(68, 88, 28, 98); c.closePath(); c.fillStyle = "#fff"; c.fill();
      c.beginPath(); c.moveTo(20, 102); c.quadraticCurveTo(36, 90, 52, 102); c.quadraticCurveTo(68, 114, 84, 102); c.quadraticCurveTo(98, 92, 108, 100);
      c.strokeStyle = "#bfe3f8"; c.lineWidth = 7; c.stroke();
    },
    tor(c) {
      disc(c, 64, 64, 60, grad(c, 0, 0, 128, 128, "#9b60c2", "#58297f"));
      poly(c, [[64, 16], [54, 38], [74, 38]], "#7ed957");
      disc(c, 64, 74, 36, "#fff"); disc(c, 64, 74, 29, "#7d4698"); disc(c, 64, 74, 22, "#7ed957"); disc(c, 64, 74, 15, "#7d4698"); disc(c, 64, 74, 8, "#fff");
    },
    tails(c) {
      disc(c, 64, 64, 60, grad(c, 0, 0, 128, 128, "#74509e", "#2c1a4b"));
      c.lineCap = "round"; c.lineJoin = "round";
      c.beginPath(); c.moveTo(34, 42); c.lineTo(94, 42); c.moveTo(64, 42); c.lineTo(64, 84); c.quadraticCurveTo(64, 106, 88, 98);
      c.strokeStyle = "#fff"; c.lineWidth = 12; c.stroke();
    },
    proton(c) {
      tile(c, grad(c, 0, 0, 128, 128, "#8f72ff", "#5a3ee0"));
      c.beginPath(); if (c.roundRect) c.roundRect(24, 38, 80, 56, 10); else c.rect(24, 38, 80, 56); c.fillStyle = "#fff"; c.fill();
      c.lineCap = "round"; c.lineJoin = "round"; line(c, [[30, 46], [64, 73], [98, 46]], "#6d4aff", 7);
    },
    mullvad(c) {
      disc(c, 64, 64, 60, "#294d73");
      disc(c, 36, 42, 8, "#ffd524"); disc(c, 92, 42, 8, "#ffd524");
      c.beginPath(); c.ellipse(64, 64, 32, 30, 0, 0, TAU); c.fillStyle = "#ffd524"; c.fill();
      poly(c, [[64, 104], [50, 80], [78, 80]], "#ffd524");
      disc(c, 51, 58, 5, "#294d73"); disc(c, 77, 58, 5, "#294d73"); disc(c, 64, 98, 4.5, "#e8798d");
    },
    ipvanish(c) {
      tile(c, "#17171c");
      c.beginPath(); c.moveTo(64, 18); c.lineTo(100, 31); c.lineTo(100, 66); c.quadraticCurveTo(100, 92, 64, 110); c.quadraticCurveTo(28, 92, 28, 66); c.lineTo(28, 31); c.closePath();
      c.fillStyle = "#fff"; c.fill();
      c.lineCap = "round"; c.lineJoin = "round"; line(c, [[45, 47], [64, 83], [83, 47]], "#17171c", 11);
    },
    firefox(c) {
      disc(c, 64, 64, 60, grad(c, 20, 0, 108, 128, "#ffc247", "#ff3e1d"));
      disc(c, 68, 60, 38, grad(c, 40, 20, 96, 100, "#9a5af5", "#3a2a9e"));
      c.beginPath(); c.arc(64, 64, 50, 3.4, 5.0); c.strokeStyle = "#ffd36b"; c.lineWidth = 6; c.lineCap = "round"; c.stroke();
      poly(c, [[22, 38], [48, 16], [40, 42]], "#ffa21f");
    },
    monero(c) {
      disc(c, 64, 64, 60, "#ff6600");
      c.save(); c.beginPath(); c.arc(64, 64, 60, 0, TAU); c.clip(); c.fillStyle = "#4c4c4c"; c.fillRect(0, 94, 128, 40); c.restore();
      c.lineCap = "round"; c.lineJoin = "round"; line(c, [[34, 88], [34, 40], [64, 70], [94, 40], [94, 88]], "#fff", 12);
    },
    wasabi(c) {
      disc(c, 64, 64, 60, grad(c, 0, 0, 0, 128, "#222f28", "#0c1410"));
      c.lineCap = "round"; c.lineJoin = "round"; line(c, [[26, 42], [46, 90], [64, 56], [82, 90], [102, 42]], "#4be07f", 11);
      disc(c, 64, 32, 6, "#4be07f");
    },
    librewolf(c) {
      disc(c, 64, 64, 60, grad(c, 0, 0, 128, 128, "#3cbcff", "#0a6cd4"));
      poly(c, [[26, 24], [50, 50], [78, 50], [102, 24], [102, 72], [84, 100], [64, 110], [44, 100], [26, 72]], "#fff");
      poly(c, [[42, 66], [57, 70], [48, 78]], "#0a6cd4"); poly(c, [[86, 66], [71, 70], [80, 78]], "#0a6cd4");
      poly(c, [[55, 92], [73, 92], [64, 103]], "#0b2a52");
    },
    telegram(c) {
      disc(c, 64, 64, 60, grad(c, 0, 0, 0, 128, "#3cc0ff", "#0080bf"));
      poly(c, [[26, 62], [100, 32], [86, 98], [62, 81], [53, 100], [49, 77]], "#fff");
      poly(c, [[49, 77], [100, 32], [62, 81]], "#cfdfec");
    },
    brave(c) {
      c.beginPath(); c.moveTo(64, 6); c.lineTo(104, 16); c.lineTo(117, 44); c.lineTo(108, 96); c.lineTo(64, 123); c.lineTo(20, 96); c.lineTo(11, 44); c.lineTo(24, 16); c.closePath();
      c.fillStyle = grad(c, 0, 0, 0, 128, "#ff6a3d", "#e5361a"); c.fill();
      poly(c, [[42, 42], [64, 34], [86, 42], [92, 62], [80, 88], [64, 95], [48, 88], [36, 62]], "#fff");
      poly(c, [[54, 66], [64, 61], [74, 66], [72, 82], [64, 87], [56, 82]], "#e5361a");
      disc(c, 53, 54, 4, "#e5361a"); disc(c, 75, 54, 4, "#e5361a");
    },
    virtualbox(c) {
      poly(c, [[64, 8], [112, 36], [64, 64], [16, 36]], "#74bff5");
      poly(c, [[16, 36], [64, 64], [64, 120], [16, 92]], "#2377c6");
      poly(c, [[64, 64], [112, 36], [112, 92], [64, 120]], "#0d4b93");
      c.lineCap = "round"; c.lineJoin = "round"; line(c, [[28, 56], [40, 86], [52, 76]], "#fff", 8);
      line(c, [[78, 86], [78, 66], [92, 72], [78, 78], [92, 84], [78, 92]], "#fff", 6);
    },
    googlevoice(c) {
      c.beginPath(); c.moveTo(26, 12); c.lineTo(102, 12); c.quadraticCurveTo(116, 12, 116, 26); c.lineTo(116, 78); c.quadraticCurveTo(116, 92, 102, 92);
      c.lineTo(66, 92); c.lineTo(34, 120); c.lineTo(38, 92); c.lineTo(26, 92); c.quadraticCurveTo(12, 92, 12, 78); c.lineTo(12, 26); c.quadraticCurveTo(12, 12, 26, 12); c.closePath();
      c.fillStyle = grad(c, 0, 0, 0, 128, "#45c668", "#1b8a3b"); c.fill();
      c.save(); c.translate(64, 50); c.scale(2.5, 2.5); c.translate(-12, -12);
      c.fillStyle = "#fff"; c.fill(new Path2D("M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"));
      c.restore();
    },
    signal(c) {
      disc(c, 64, 64, 60, "#3a76f0");
      c.beginPath(); c.moveTo(64, 26); c.bezierCurveTo(90, 26, 106, 44, 106, 64); c.bezierCurveTo(106, 86, 88, 102, 64, 102); c.bezierCurveTo(56, 102, 50, 100, 44, 98); c.lineTo(26, 104); c.lineTo(32, 86); c.bezierCurveTo(26, 80, 22, 72, 22, 64); c.bezierCurveTo(22, 44, 40, 26, 64, 26); c.closePath();
      c.fillStyle = "#fff"; c.fill();
    }
  };

  const sprites = {};
  function shadowed(src) {
    const S = 160, sw = src.naturalWidth || src.width || 128, sh = src.naturalHeight || src.height || 128;
    const k0 = Math.min(1, 256 / Math.max(sw, sh)), w = Math.max(1, Math.round(sw * k0)), h = Math.max(1, Math.round(sh * k0));
    const t = document.createElement("canvas"); t.width = w; t.height = h;
    const tc = t.getContext("2d", { willReadFrequently: true });
    tc.drawImage(src, 0, 0, w, h);
    let box = { x: 0, y: 0, w, h };
    try {
      const im = tc.getImageData(0, 0, w, h), d = im.data;
      const white = (i) => d[i + 3] > 0 && false;
      const seen = new Uint8Array(w * h), st = [];
      const push = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const p = y * w + x; if (seen[p]) return; seen[p] = 1; if (white(p * 4)) st.push(p); };
      for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
      for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
      while (st.length) { const p = st.pop(), x = p % w, y = (p / w) | 0; d[p * 4 + 3] = 0; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
      tc.putImageData(im, 0, 0);
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 >= x0 && y1 >= y0) box = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    } catch (e) {}
    const cv = document.createElement("canvas"); cv.width = cv.height = S;
    const c = cv.getContext("2d"), k = Math.min(128 / box.w, 128 / box.h);
    c.shadowColor = "rgba(0,0,0,.6)"; c.shadowBlur = 12; c.shadowOffsetY = 3;
    c.drawImage(t, box.x, box.y, box.w, box.h, (S - box.w * k) / 2, (S - box.h * k) / 2 - 2, box.w * k, box.h * k);
    return cv;
  }
  const loads = [];
  ICON_KEYS.forEach((k) => {
    const cv = document.createElement("canvas"); cv.width = cv.height = 128;
    const c = cv.getContext("2d"); c.lineCap = "round"; c.lineJoin = "round";
    DRAW[k](c);
    sprites[k] = shadowed(cv);
    if (REAL_ICONS[k]) loads.push(new Promise((done) => { const im = new Image(); im.onload = () => { sprites[k] = shadowed(im); done(); }; im.onerror = done; im.src = REAL_ICONS[k]; }));
  });

  const fxc = $("fx"), fxx = fxc.getContext("2d");
  const FX = { ps: [], bag: [], rings: [], acc: 0, ringT: 0, t: 0, last: 0, on: false, W: 0, H: 0, dpr: 1 };
  const K = 1.15;
  function fxSize() { FX.dpr = Math.min(2, window.devicePixelRatio || 1); FX.W = innerWidth; FX.H = innerHeight; fxc.width = FX.W * FX.dpr; fxc.height = FX.H * FX.dpr; }
  function nextKey() { if (!FX.bag.length) FX.bag = ICON_KEYS.slice().sort(() => Math.random() - 0.5); return FX.bag.pop(); }
  function launch(age) {
    FX.ps.push({ k: nextKey(), a: rnd(0, TAU), t: age || 0, v0: (300 + Math.pow(Math.random(), 1.3) * 1500) * FX_SPEED, vd: rnd(70, 130) * FX_SPEED, r0: rnd(-3.5, 3.5), sc: rnd(0.75, 1.3) });
  }
  const dist = (p) => p.vd * p.t + ((p.v0 - p.vd) / K) * (1 - Math.exp(-K * p.t));
  function fxFrame(now) {
    if (!FX.on) return;
    requestAnimationFrame(fxFrame);
    const dt = Math.min(0.05, (now - FX.last) / 1000 || 0); FX.last = now; FX.t += dt;
    const lr = document.querySelector(".logo").getBoundingClientRect();
    const ox = lr.left + lr.width / 2, oy = lr.top + lr.height / 2;
    const R = Math.hypot(FX.W, FX.H) / 2, u = Math.max(0.7, Math.min(FX.W, FX.H) / 800);
    FX.acc += dt * FX_RATE;
    while (FX.acc >= 1) { FX.acc -= 1; if (FX.ps.length < 320) launch(0); }
    FX.ringT += dt; if (FX.ringT > 0.9) { FX.ringT = 0; FX.rings.push(0); }
    fxx.setTransform(FX.dpr, 0, 0, FX.dpr, 0, 0); fxx.clearRect(0, 0, FX.W, FX.H);
    const pulse = 0.5 + 0.5 * Math.sin(FX.t * 7), g = fxx.createRadialGradient(ox, oy, 20, ox, oy, 300 * u);
    g.addColorStop(0, "rgba(255,255,255," + (0.11 + 0.06 * pulse).toFixed(3) + ")"); g.addColorStop(1, "rgba(255,255,255,0)");
    fxx.fillStyle = g; fxx.fillRect(ox - 320 * u, oy - 320 * u, 640 * u, 640 * u);
    for (let i = FX.rings.length - 1; i >= 0; i--) {
      const a = (FX.rings[i] += dt), e = 1 - Math.pow(1 - Math.min(1, a / 1.6), 3);
      if (a > 1.6) { FX.rings.splice(i, 1); continue; }
      fxx.beginPath(); fxx.arc(ox, oy, 52 + e * R * 0.95, 0, TAU); fxx.strokeStyle = "rgba(255,255,255," + (0.3 * (1 - a / 1.6)).toFixed(3) + ")"; fxx.lineWidth = 2; fxx.stroke();
    }
    for (let i = FX.ps.length - 1; i >= 0; i--) {
      const p = FX.ps[i]; p.t += dt;
      const d = dist(p), x = ox + Math.cos(p.a) * d, y = oy + Math.sin(p.a) * d;
      const sz = (28 + 62 * Math.min(1, d / R)) * u * p.sc;
      if (x < -sz || x > FX.W + sz || y < -sz || y > FX.H + sz) { FX.ps.splice(i, 1); continue; }
      fxx.save(); fxx.translate(x, y); fxx.rotate(p.r0 * Math.exp(-1.3 * p.t)); fxx.globalAlpha = Math.min(1, d / 70) * 0.97;
      fxx.drawImage(sprites[p.k], -sz * 0.625, -sz * 0.625, sz * 1.25, sz * 1.25);
      fxx.restore();
    }
  }
  let logoBag = [];
  function cycleLogo() {
    const el = $("logo");
    el.classList.add("spin");
    const next = () => {
      if (!logoBag.length) logoBag = ICON_KEYS.slice().sort(() => Math.random() - 0.5);
      const k = logoBag.pop();
      el.style.opacity = 0;
      setTimeout(() => { el.src = sprites[k].toDataURL(); el.style.opacity = 1; }, 180);
    };
    next();
    setInterval(next, 3000);
  }
  function startFx() {
    if (!FX_ON || FX.on) return;
    FX.on = true; fxSize(); addEventListener("resize", fxSize);
    Promise.all(loads).then(() => {
      cycleLogo();
      for (let i = 0; i < 80; i++) launch(rnd(0, 4.5));
      FX.last = performance.now(); requestAnimationFrame(fxFrame);
    });
  }

  $("cur").focus();
  init();
</script>
</body>
</html>`;

const crypto = require("crypto");
const LOCK_FILE = () => path.join(app.getPath("userData"), "lock.json");
let locked = false;
let starting = true;
let lockWin = null;
let lockMode = "unlock";
let lockResolve = null;
let fails = 0, lockedUntil = 0;

function readLock() {
  try { return JSON.parse(fs.readFileSync(LOCK_FILE(), "utf8")); } catch { return null; }
}
const hasPin = () => { const l = readLock(); return !!(l && l.salt && l.hash); };
function verifyPin(pin) {
  const l = readLock();
  if (!l || typeof pin !== "string") return false;
  const a = crypto.scryptSync(pin, Buffer.from(l.salt, "hex"), 32);
  const b = Buffer.from(l.hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function savePin(pin) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pin, salt, 32);
  fs.writeFileSync(LOCK_FILE(), JSON.stringify({ salt: salt.toString("hex"), hash: hash.toString("hex") }), { mode: 0o600 });
}
const validPin = (p) => typeof p === "string" && /^\d{4,12}$/.test(p);
const waitLeft = () => Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));

function checkPin(pin) {
  if (waitLeft() > 0) return { ok: false, error: "Too many attempts. Wait " + waitLeft() + "s." };
  if (verifyPin(pin)) { fails = 0; return { ok: true }; }
  fails++;
  if (fails >= 5) lockedUntil = Date.now() + 30000 * Math.pow(2, Math.min(fails - 5, 6));
  return { ok: false, error: waitLeft() > 0 ? "Too many attempts. Wait " + waitLeft() + "s." : "Wrong PIN." };
}

let quitting = false;
app.on("before-quit", () => { quitting = true; });

const overlayAlive = () => !!lockWin && !lockWin.isDestroyed() && (lockMode === "unlock" || lockMode === "setup");

function syncOverlay() {
  if (!overlayAlive() || !mainWindow) return;
  if (!mainWindow.isVisible() || mainWindow.isMinimized()) { lockWin.hide(); return; }
  lockWin.setBounds(mainWindow.getBounds());
  if (!lockWin.isVisible()) lockWin.show();
  lockWin.focus();
}
function ensureOverlay() {
  if (locked && hasPin() && !overlayAlive()) openLockWindow("unlock");
}

function openLockWindow(mode) {
  if (lockWin && !lockWin.isDestroyed()) { lockWin.focus(); return Promise.resolve(false); }
  return new Promise((resolve) => {
    lockMode = mode;
    lockResolve = resolve;
    const cover = (mode === "unlock" || mode === "setup") && mainWindow;
    const opts = cover
      ? { ...mainWindow.getBounds(), frame: false, skipTaskbar: true, show: false, hasShadow: false,
          resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false,
          parent: mainWindow }
      : { width: 400, height: 580, useContentSize: true, resizable: false, minimizable: false, maximizable: false,
          parent: mainWindow || undefined, modal: !!mainWindow };
    lockWin = new BrowserWindow({
      ...opts,
      title: "OpsexCord Lock", backgroundColor: "#16171d",
      icon: path.join(ROOT, "icon.ico"),
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true, sandbox: true, nodeIntegration: false
      }
    });
    const w = lockWin;
    w.setMenu(null);
    w.setContentProtection(true);
    w.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    const wc = w.webContents;
    const run = (code) => { if (!w.isDestroyed()) wc.executeJavaScript(code).catch(() => {}); };
    wc.on("did-finish-load", () => run(`window.__lockInit && window.__lockInit(${JSON.stringify(lockInfo())})`));
    wc.on("will-navigate", (e, url) => {
      e.preventDefault();
      let u; try { u = new URL(url); } catch { return; }
      if (u.hostname !== "opsexcord.invalid" || w !== lockWin) return;
      if (u.pathname === "/submit") {
        let d = null; try { d = JSON.parse(u.searchParams.get("d")); } catch {}
        const r = lockSubmit(d);
        run(`window.__lockResult && window.__lockResult(${JSON.stringify(r)})`);
      } else if (u.pathname === "/cancel") lockCancel();
    });
    w.on("close", (e) => { if (cover && locked && !quitting) e.preventDefault(); });
    if (cover) w.once("ready-to-show", syncOverlay); else w.once("ready-to-show", () => w.show());
    w.on("closed", () => {
      if (lockWin === w) lockWin = null;
      if (lockResolve) { const r = lockResolve; lockResolve = null; r(false); }
    });
    w.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(lockPage(lockInfo())));
  });
}
function closeLock(result) {
  const r = lockResolve; lockResolve = null;
  if (r) r(result);
  if (lockWin && !lockWin.isDestroyed()) lockWin.close();
}
const fromLock = (e) => !!lockWin && !lockWin.isDestroyed() && e.sender === lockWin.webContents;

const PROMPT_FILE = () => path.join(app.getPath("userData"), "pin-prompted.json");
const pinPrompted = () => { try { return fs.existsSync(PROMPT_FILE()); } catch { return false; } };
const markPinPrompted = () => { try { fs.writeFileSync(PROMPT_FILE(), "{}"); } catch {} };
let pinPromptTimer = null;
function maybePromptPin(url) {
  if (hasPin() || pinPrompted() || lockWin || !mainWindow) return;
  let u; try { u = new URL(url); } catch { return; }
  if (!/(^|\.)discord\.com$/.test(u.hostname) || !/^\/(channels|app|activity)\b/.test(u.pathname)) return;
  clearTimeout(pinPromptTimer);
  pinPromptTimer = setTimeout(() => {
    if (!hasPin() && !pinPrompted() && !lockWin && mainWindow && mainWindow.isVisible()) openLockWindow("setup");
  }, 2000);
}

const lockInfo = () => ({ mode: lockMode, hasPin: hasPin(), lockedFor: waitLeft() });

function lockSubmit(d) {
  if (!d || typeof d !== "object") return { ok: false, error: "Rejected." };
  if (lockMode === "setup") {
    if (!validPin(d.newPin)) return { ok: false, error: "PIN must be 4-12 digits." };
    if (d.newPin !== d.confirm) return { ok: false, error: "PINs don't match." };
    savePin(d.newPin);
    markPinPrompted();
    closeLock(true);
    if (mainWindow) mainWindow.focus();
    return { ok: true };
  }
  if (lockMode === "unlock") {
    const r = checkPin(d.pin);
    if (r.ok) {
      locked = false;
      closeLock(true);
      if (mainWindow) mainWindow.focus();
    }
    return r;
  }
  if (hasPin()) {
    const r = checkPin(d.pin);
    if (!r.ok) return r;
  }
  if (d.action === "remove") {
    if (!hasPin()) return { ok: false, error: "No PIN is set." };
    try { fs.unlinkSync(LOCK_FILE()); } catch {}
    locked = false;
    closeLock(true);
    return { ok: true };
  }
  if (!validPin(d.newPin)) return { ok: false, error: "New PIN must be 4-12 digits." };
  if (d.newPin !== d.confirm) return { ok: false, error: "PINs don't match." };
  savePin(d.newPin);
  closeLock(true);
  return { ok: true };
}
function lockCancel() {
  if (lockMode === "setup") { markPinPrompted(); closeLock(false); if (mainWindow) mainWindow.focus(); return; }
  if (lockMode === "unlock") app.quit();
  else closeLock(false);
}

ipcMain.handle("lock:info", (e) => (fromLock(e) ? lockInfo() : null));
ipcMain.handle("lock:submit", (e, d) => (fromLock(e) ? lockSubmit(d) : { ok: false, error: "Rejected." }));
ipcMain.on("lock:cancel", (e) => { if (fromLock(e)) lockCancel(); });

function restoreWindow() {
  if (!mainWindow) return;
  if (tray) { tray.destroy(); tray = null; }
  if (!mainWindow.isVisible()) mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (locked && hasPin()) { ensureOverlay(); syncOverlay(); }
  else mainWindow.focus();
}

function ensureTray() {
  if (tray) return;
  try {
    const img = nativeImage.createFromPath(path.join(ROOT, "icon.ico"));
    tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
    tray.setToolTip("OpsexCord");
    tray.on("click", restoreWindow);
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Show", click: restoreWindow },
      { label: "Quit", click: () => app.quit() }
    ]));
  } catch (err) {
    console.warn("[OpsexCord] tray failed:", err.message);
    tray = null;
  }
}

function panic() {
  if (!mainWindow) return;
  const shown = mainWindow.isVisible() && !mainWindow.isMinimized();
  if (!shown) return restoreWindow();
  if (hasPin()) { locked = true; ensureOverlay(); }
  mainWindow.webContents.send("opsec:panic");
  try { music.pause(); } catch {}
  setTimeout(() => {
    if (!mainWindow) return;
    if (cfg.panicQuit) return app.quit();
    if (cfg.panicHide) { ensureTray(); mainWindow.hide(); }
    else mainWindow.minimize();
  }, 80);
}

function registerPanicKey() {
  try { globalShortcut.unregisterAll(); } catch {}
  try { music.registerKeys(); } catch {}
  if (!cfg.panicEnabled || !cfg.panicKey) return true;
  try { return globalShortcut.register(cfg.panicKey, panic); }
  catch { return false; }
}

function memoryInfo() {
  const metrics = app.getAppMetrics();
  const kb = (m) => (m && m.memory && m.memory.workingSetSize) || 0;
  const pid = mainWindow ? mainWindow.webContents.getOSProcessId() : -1;
  return {
    rendererMB: Math.round(kb(metrics.find((m) => m.pid === pid)) / 1024),
    totalMB: Math.round(metrics.reduce((sum, m) => sum + kb(m), 0) / 1024)
  };
}

function checkMemory() {
  if (!mainWindow || !cfg.watchdog) return;
  const idle = !mainWindow.isVisible() || mainWindow.isMinimized() || !mainWindow.isFocused();
  if (!idle || pageState.inCall || pageState.sharing) return;
  const { rendererMB } = memoryInfo();
  if (rendererMB > cfg.watchdogMB) {
    console.log(`[OpsexCord] watchdog: page at ${rendererMB} MB (limit ${cfg.watchdogMB}), reloading`);
    mainWindow.webContents.reload();
  }
}
function startWatchdog() {
  stopWatchdog();
  if (cfg.watchdog) watchdogTimer = setInterval(checkMemory, 60 * 1000);
}
function stopWatchdog() {
  if (watchdogTimer) clearInterval(watchdogTimer);
  watchdogTimer = null;
}

ipcMain.handle("opsec:config", (e, c) => {
  if (!fromDiscord(e)) return null;
  Object.assign(cfg, sanitizeConfig(c));
  const panicKeyOk = registerPanicKey();
  mainWindow.setContentProtection(!!cfg.contentProtection);
  startWatchdog();
  return { panicKeyOk };
});
ipcMain.on("opsec:state", (e, st) => {
  if (!fromDiscord(e) || !st) return;
  pageState.inCall = !!st.inCall;
  pageState.sharing = !!st.sharing;
});
ipcMain.handle("opsec:memory", (e) => (fromDiscord(e) ? memoryInfo() : null));
ipcMain.on("opsec:panic", (e) => { if (fromDiscord(e)) panic(); });
ipcMain.on("opsec:reload", (e) => { if (fromDiscord(e)) mainWindow.webContents.reload(); });

const dnsP = require("dns").promises;
const nodeNet = require("net");
const { domainToUnicode } = require("url");

const LC_FILE = () => path.join(app.getPath("userData"), "linkcheck.json");
const lcList = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === "string").map((x) => x.trim().toLowerCase().replace(/^\*?\./, "")).filter(Boolean) : []);
function lcConfig() {
  let c = {};
  try { c = JSON.parse(fs.readFileSync(LC_FILE(), "utf8")) || {}; } catch {}
  return {
    enabled: c.enabled !== false,
    safeBrowsingKey: (typeof c.safeBrowsingKey === "string" && c.safeBrowsingKey.trim()) || process.env.SAFE_BROWSING_KEY || "",
    virusTotalKey: (typeof c.virusTotalKey === "string" && c.virusTotalKey.trim()) || process.env.VT_API_KEY || "",
    domainAge: c.domainAge === true,
    blockedDomains: lcList(c.blockedDomains),
    extraLoggers: lcList(c.extraLoggers)
  };
}

const LC_PASS_SCHEMES = new Set(["mailto", "tel", "spotify", "discord", "steam"]);

const LC_SHORTENERS = new Set(["bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "v.gd", "ow.ly", "cutt.ly", "rebrand.ly",
  "shorturl.at", "tiny.cc", "buff.ly", "rb.gy", "t.ly", "bl.ink", "lnkd.in", "adf.ly", "bc.vc", "shorte.st", "s.id", "fb.me", "amzn.to", "trib.al", "dlvr.it"]);
const LC_TLD_PTS = { zip: 2, mov: 2, tk: 2, ml: 2, ga: 2, cf: 2, gq: 2, pw: 2, gift: 2,
  top: 1, click: 1, icu: 1, cyou: 1, buzz: 1, rest: 1, loan: 1, work: 1, country: 1, kim: 1, xyz: 1, monster: 1, sbs: 1,
  su: 1, cam: 1, bond: 1, cfd: 1, lol: 1, quest: 1, wtf: 1, lat: 1, ws: 1, live: 1, fun: 1 };
const LC_EXEC = /\.(exe|scr|bat|cmd|msi|msix|msixbundle|appx|pif|jar|jnlp|apk|vbs|vbe|jse|wsf|ps1|psm1|lnk|hta|dll|cpl|chm|reg|iso|img|dmg|pkg|appimage|sh)$/i;
const LC_DOUBLE_EXT = /\.(pdf|docx?|xlsx?|pptx?|jpe?g|png|gif|txt|mp[34]|mov|zip|rar)\.(exe|scr|bat|cmd|msi|pif|js|vbs|vbe|lnk|jar|com|hta|ps1)$/i;
const LC_MACRO = /\.(docm|xlsm|pptm|xlsb|dotm|xlam)$/i;
const LC_BIN_TYPE = /octet-stream|x-msdownload|x-msdos-program|x-dosexec|x-msi|java-archive|vnd\.android\.package|x-zip|\/zip|x-rar|x-7z|x-iso9660/i;
const LC_TUNNELS = ["ngrok.io", "ngrok-free.app", "ngrok-free.dev", "ngrok.app", "ngrok.dev", "trycloudflare.com", "loca.lt", "localtunnel.me", "serveo.net", "pagekite.me", "lhr.life", "localhost.run", "tunnelto.dev", "playit.gg", "pinggy.link", "pinggy.io"];
const LC_DDNS = ["duckdns.org", "ddns.net", "no-ip.org", "no-ip.com", "no-ip.biz", "noip.com", "hopto.org", "zapto.org", "sytes.net", "servehttp.com", "serveftp.com", "servebeer.com", "myftp.biz", "myftp.org", "hopto.me", "redirectme.net", "freedynamicdns.org", "dynu.net", "dynv6.net", "ddnsking.com", "mooo.com", "chickenkiller.com", "gotdns.ch", "ydns.eu", "3utilities.com", "bounceme.net", "dnsalias.com", "dyndns.org"];
const LC_FREEHOST = ["workers.dev", "pages.dev", "vercel.app", "netlify.app", "glitch.me", "repl.co", "replit.app", "replit.dev", "web.app", "firebaseapp.com", "herokuapp.com", "github.io", "gitlab.io", "onrender.com", "weebly.com", "wixsite.com", "blogspot.com", "000webhostapp.com", "infinityfreeapp.com", "rf.gd", "epizy.com", "byethost.com", "webflow.io", "framer.app", "framer.website", "carrd.co", "godaddysites.com", "square.site", "myshopify.com", "typedream.app", "notion.site", "surge.sh", "fly.dev", "railway.app", "up.railway.app", "azurewebsites.net", "cloudfront.net", "r2.dev", "s3.amazonaws.com", "storage.googleapis.com", "blob.core.windows.net"];
const LC_FILEHOSTS = ["discordapp.com", "discordapp.net", "github.com", "githubusercontent.com", "dropbox.com", "dropboxusercontent.com", "mediafire.com", "mega.nz", "mega.io", "gofile.io", "anonfiles.com", "drive.google.com", "drive.usercontent.google.com", "1drv.ms", "onedrive.live.com", "wetransfer.com", "we.tl", "transfer.sh", "catbox.moe", "sendspace.com", "filebin.net", "pixeldrain.com", "krakenfiles.com", "workupload.com", "bayfiles.com", "temp.sh", "file.io", "uploadnow.io", "send.cm", "files.fm", "cdn.discordapp.com"];
const LC_PASTE = new Set(["pastebin.com", "hastebin.com", "paste.ee", "rentry.co", "rentry.org", "ghostbin.com", "controlc.com", "justpaste.it", "privatebin.net", "ix.io", "dpaste.com", "paste.mozilla.org", "pastes.io", "paste.gg", "bin.mudfish.net"]);
const LC_CRED_WORDS = /(log-?in|sign-?in|verify|verification|auth(?!or)|recover|unlock|2fa|captcha|password|wallet)/;
const LC_PATH_SCAM = /(seed-?phrase|recovery-?phrase|connect-?wallet|wallet-?connect|claim-?(nitro|reward|prize|airdrop|gift)|free-?nitro|nitro-?(gift|free|promo)|airdrop|steam-?gift|verify-?(human|you)|captcha-?verif|robux-?(free|generator)|free-?robux|vbucks)/;
const lcMatchHost = (host, list) => list.some((d) => host === d || host.endsWith("." + d));
const LC_ARCHIVE = /\.(zip|rar|7z|tar|gz)$/i;
const LC_IP_LOGGERS = new Set([
  "grabify.link", "iplogger.org", "iplogger.com", "iplogger.ru", "iplogger.co", "iplogger.info",
  "2no.co", "yip.su", "ipgrabber.ru", "ipgraber.ru", "02ip.ru", "iplis.ru",
  "leancoding.co", "stopify.co", "freegiftcards.co", "joinmy.site", "curiouscat.club",
  "catsnthings.fun", "catsnthings.com", "gyazo.nl", "blasze.com", "blasze.tk", "bmwforum.co",
  "quickmessage.us", "spottyfly.com", "fortnitechat.site", "lovebird.guru", "trulove.guru",
  "dateing.club", "otherhalf.life", "datasig.io", "gamingfun.me", "linkbuddy.link", "ezstat.ru"
]);
const lcIsLogger = (host, extra) => {
  const all = (d) => host === d || host.endsWith("." + d);
  for (const d of LC_IP_LOGGERS) if (all(d)) return true;
  return (extra || []).some(all);
};
const LC_SCAM_WORDS = /(free-?nitro|nitro-?(gift|free|drop|promo|giveaway)|gift-?nitro|giveaway|airdrop|robux|vbucks|free-?skins|claim-?(nitro|reward|prize)|steam-?gift)/;

const LC_BRANDS = {
  discord: ["discord.com", "discord.gg", "discord.gift", "discord.gifts", "discordapp.com", "discordapp.net", "discord.media", "discordstatus.com", "dis.gd", "discordcdn.com", "discord.new", "discord.co", "discordmerch.com", "discord.dev"],
  steam: ["steampowered.com", "steamcommunity.com", "steamstatic.com", "steamusercontent.com", "steam-chat.com", "steamcontent.com"],
  roblox: ["roblox.com", "rbxcdn.com"],
  epicgames: ["epicgames.com", "unrealengine.com", "fortnite.com"],
  paypal: ["paypal.com", "paypal.me"],
  microsoft: ["microsoft.com", "live.com", "office.com", "xbox.com", "windows.com", "microsoftonline.com", "bing.com", "azure.com"],
  google: ["google.com", "googleapis.com", "googleusercontent.com", "gstatic.com", "youtube.com", "youtu.be", "goo.gl"],
  apple: ["apple.com", "icloud.com"],
  amazon: ["amazon.com", "amzn.to", "amazonaws.com"],
  netflix: ["netflix.com"],
  spotify: ["spotify.com", "scdn.co"],
  twitch: ["twitch.tv", "ttvnw.net"],
  binance: ["binance.com"],
  coinbase: ["coinbase.com"],
  metamask: ["metamask.io"],
  opensea: ["opensea.io"],
  blizzard: ["blizzard.com", "battle.net"],
  minecraft: ["minecraft.net", "mojang.com"],
  instagram: ["instagram.com"],
  facebook: ["facebook.com", "fb.com"],
  twitter: ["twitter.com", "x.com", "t.co"],
  tiktok: ["tiktok.com"],
  telegram: ["telegram.org", "t.me"],
  whatsapp: ["whatsapp.com", "wa.me"],
  github: ["github.com", "githubusercontent.com", "github.io", "githubassets.com"],
  adobe: ["adobe.com", "adobe.io"],
  dropbox: ["dropbox.com", "dropboxusercontent.com"],
  linkedin: ["linkedin.com", "licdn.com"],
  ubisoft: ["ubisoft.com", "ubi.com"],
  riotgames: ["riotgames.com", "leagueoflegends.com", "valorant.com"],
  nvidia: ["nvidia.com"],
  ledger: ["ledger.com"],
  trezor: ["trezor.io"],
  exodus: ["exodus.com"],
  phantom: ["phantom.app"],
  kraken: ["kraken.com"],
  uniswap: ["uniswap.org"],
  trustwallet: ["trustwallet.com"],
  docusign: ["docusign.com", "docusign.net"],
  fedex: ["fedex.com"],
  wetransfer: ["wetransfer.com", "we.tl"],
  mediafire: ["mediafire.com"]
};
const LC_KNOWN = new Set(["youtube.com", "youtu.be", "google.com", "github.com", "githubusercontent.com", "wikipedia.org", "reddit.com", "twitter.com",
  "x.com", "twitch.tv", "spotify.com", "imgur.com", "tenor.com", "giphy.com", "discord.com", "discord.gg", "discordapp.com", "discordapp.net",
  "steampowered.com", "steamcommunity.com", "microsoft.com", "apple.com", "amazon.com", "stackoverflow.com", "netflix.com", "instagram.com",
  "facebook.com", "tiktok.com", "linkedin.com", "roblox.com", "epicgames.com", "mozilla.org", "wikimedia.org"]);
const LC_SECOND_LEVEL = new Set(["co", "com", "org", "net", "gov", "edu", "ac", "or", "ne", "go"]);

function lcRegDomain(host) {
  const l = host.split(".");
  if (l.length <= 2) return host;
  const tld = l[l.length - 1], sld = l[l.length - 2];
  return (tld.length === 2 && LC_SECOND_LEVEL.has(sld) ? l.slice(-3) : l.slice(-2)).join(".");
}
function lcLev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const lcLeet = (t) => t.replace(/0/g, "o").replace(/1/g, "l").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t").replace(/rn/g, "m").replace(/vv/g, "w");
function lcBrandMatch(token, brand) {
  if (token === brand) return "exact";
  if (lcLeet(token) === brand || token.replace(/1/g, "i") === brand) return "leet";
  if (brand.length >= 6 && token.length >= 6 && token[0] === brand[0] && lcLev(token, brand) <= 1) return "typo";
  return null;
}
const lcIsRealBrandHost = (host, domains) => domains.some((d) => host === d || host.endsWith("." + d));

function lcLevel(findings) {
  let sum = 0, max = 0;
  for (const f of findings) if (f.level === "bad" || f.level === "warn") { sum += f.pts; max = Math.max(max, f.pts); }
  return max >= 5 || sum >= 5 ? "danger" : sum >= 2 ? "caution" : "ok";
}
const LC_ORDER = { bad: 0, warn: 1, info: 2, good: 3 };

function analyzeUrl(raw) {
  const f = [];
  const add = (pts, level, text) => f.push({ pts, level, text });
  let u;
  try { u = new URL(raw); } catch {
    add(5, "bad", "This isn't a valid web address.");
    return { url: String(raw), host: "", domain: "", unicodeHost: "", findings: f, level: "danger", shortener: false };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    add(5, "bad", "This isn't a normal web link (it uses \"" + u.protocol + "\"). Links like this can run code or open local files.");
    return { url: u.href, host: u.hostname, domain: u.hostname, unicodeHost: "", findings: f, level: "danger", shortener: false };
  }
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  const bare = host.replace(/^\[|\]$/g, "");
  const isIp = nodeNet.isIP(bare) !== 0;
  const domain = isIp ? bare : lcRegDomain(bare);
  const uni = isIp ? "" : domainToUnicode(bare);
  const labels = bare.split(".");
  const regLen = domain.split(".").length;
  const subLabels = isIp ? [] : labels.slice(0, Math.max(0, labels.length - regLen));
  const regLabel = domain.split(".")[0];
  const tld = labels[labels.length - 1];
  const path_ = u.pathname.toLowerCase();

  if (u.protocol === "http:") add(1, "warn", "Not encrypted (http). Anything you type there can be read on the way.");
  if (u.username || u.password) add(4, "bad", "Has a \"name@\" part before the real address. That is a common trick to make a link look like a different site.");
  if (isIp) add(3, "warn", "Goes to a raw IP address (" + bare + ") instead of a normal domain name.");
  if (!isIp && bare.includes("xn--")) add(4, "bad", "The domain uses look-alike international characters (shows as \"" + uni + "\"). Often used to imitate real sites.");
  if (u.port && u.port !== "80" && u.port !== "443") add(1, "warn", "Uses an unusual port (" + u.port + ").");

  const logger = !isIp && lcIsLogger(bare, lcConfig().extraLoggers);
  if (logger) add(6, "bad", "Known IP logger (" + domain + "). Opening this link tells whoever made it your IP address. Do not open it, and do not load a preview.");

  let shortener = false;
  if (!isIp && LC_SHORTENERS.has(domain)) {
    shortener = true;
    add(2, "warn", "URL shortener: the real destination is hidden. Load the preview to see where it leads.");
  }
  if (!isIp && Object.hasOwn(LC_TLD_PTS, tld)) add(LC_TLD_PTS[tld], "warn", "Ends in \"." + tld + "\", an ending that is heavily used by scam and throw-away sites.");
  if (!isIp && subLabels.length >= 3) add(subLabels.length >= 5 ? 2 : 1, "warn", "Lots of subdomains (" + bare + "). Long chains are used to bury the real domain.");
  if (bare.length > 45) add(1, "warn", "Unusually long domain name.");
  if ((bare.match(/-/g) || []).length >= 3) add(1, "warn", "Domain has many hyphens, typical of throw-away scam domains.");

  let brandHit = null;
  if (!isIp) {
    for (const [brand, reals] of Object.entries(LC_BRANDS)) {
      if (lcIsRealBrandHost(bare, reals)) continue;
      if (brand === "google" && /^google\.([a-z]{2}|co\.[a-z]{2}|com(\.[a-z]{2})?)$/.test(domain) && !Object.hasOwn(LC_TLD_PTS, tld)) continue;
      const subTokens = subLabels.flatMap((l) => l.split("-"));
      const regTokens = regLabel.split("-");
      const names = [brand, ...new Set(reals.map((d) => d.split(".")[0]).filter((l) => l !== brand && l.includes(brand)))];
      const sm = subTokens.flatMap((t) => names.map((n) => lcBrandMatch(t, n)));
      const rm = regTokens.flatMap((t) => names.map((n) => lcBrandMatch(t, n)));
      let pts = 0;
      if (sm.includes("exact") || sm.includes("leet")) pts = 5;
      else if (rm.includes("leet")) pts = 5;
      else if (sm.includes("typo") || rm.includes("typo") || rm.includes("exact")) pts = 3;
      else if (brand.length >= 6 && regLabel.includes(brand)) pts = 3;
      if (pts && (!brandHit || pts > brandHit.pts)) brandHit = { pts, brand };
    }
    if (brandHit) {
      const nm = brandHit.brand[0].toUpperCase() + brandHit.brand.slice(1);
      add(brandHit.pts, brandHit.pts >= 5 ? "bad" : "warn",
        brandHit.pts >= 5
          ? "Imitates " + nm + ". The real domain of this link is \"" + domain + "\", which is not " + nm + "'s."
          : "Looks like it is trying to pass as " + nm + ", but the domain \"" + domain + "\" is not an official " + nm + " site.");
    }
    const sw = LC_SCAM_WORDS.exec(bare);
    if (sw) add(2, "warn", "Domain contains \"" + sw[1] + "\", wording used in giveaway and gift scams.");
  }

  const rawStr = String(raw).trim();
  let dec; try { dec = decodeURIComponent(rawStr); } catch { dec = rawStr; }
  if (/[‪-‮⁦-⁩​-‏⁠﻿]/.test(dec))
    add(4, "bad", "Contains hidden direction or zero-width characters. These are used to disguise file names and addresses.");
  if (/^[a-z][a-z0-9+.-]*:\/\/(?:[^\/@?#]*@)?(?:0x[0-9a-f]+|\d{8,10}|0\d+(?:\.0?\d+){3})(?=[:\/?#]|$)/i.test(rawStr))
    add(4, "bad", "The address is a disguised IP number (hex, decimal or octal form). Real sites don't write addresses like that.");
  const lcCfg = lcConfig();
  if (!isIp && lcMatchHost(bare, lcCfg.blockedDomains)) add(6, "bad", "On your own blocked-domains list (" + domain + ").");
  if (!isIp) {
    if (lcMatchHost(bare, LC_TUNNELS)) add(3, "warn", "Temporary tunnel address (" + bare + "). Pages and servers run from someone's own computer this way, which is common for phishing pages and malware servers.");
    else if (lcMatchHost(bare, LC_DDNS)) add(3, "warn", "Dynamic-DNS address (" + bare + "). Often a home-hosted page or a malware command server, rarely a real business.");
    else if (lcMatchHost(bare, LC_FREEHOST)) add(1, "warn", "Free hosting service (" + bare + "). Anyone can publish a page here, so the name tells you nothing about who is behind it.");
  }
  if ((bare === "discord.com" || bare === "discordapp.com" || bare === "ptb.discord.com" || bare === "canary.discord.com") && /^\/api\/(v\d+\/)?webhooks\//.test(path_))
    add(3, "warn", "Discord webhook address. Token stealers use these to send stolen data out. Opening it does nothing useful for you.");
  if (bare === "api.telegram.org" && /^\/bot/.test(path_))
    add(3, "warn", "Telegram bot API address. Malware uses these to send stolen data out. Opening it does nothing useful for you.");
  if (LC_PASTE.has(bare) && /\/raw(\/|$)/.test(path_))
    add(2, "warn", "Raw text from a paste site. Malware loaders often fetch their commands from places like this.");
  if (!isIp && !LC_KNOWN.has(domain)) {
    const pq = (path_ + u.search).toLowerCase();
    if (LC_PATH_SCAM.test(pq)) add(2, "warn", "The address uses wording from gift, wallet and giveaway scams (\"" + LC_PATH_SCAM.exec(pq)[0] + "\").");
    if (LC_CRED_WORDS.test(pq)) {
      for (const [brand, reals] of Object.entries(LC_BRANDS)) {
        if (lcIsRealBrandHost(bare, reals)) continue;
        if (new RegExp("(^|[^a-z])" + brand + "([^a-z]|$)").test(pq)) {
          const nm = brand[0].toUpperCase() + brand.slice(1);
          add(2, "warn", "The address talks about " + nm + " logins or verification, but the site is " + domain + ", not " + nm + ".");
          break;
        }
      }
    }
  }
  if (LC_DOUBLE_EXT.test(path_)) add(3, "bad", "Double file ending (" + path_.split("/").pop() + "). A program disguised as a document or picture.");
  if (LC_MACRO.test(path_)) add(2, "warn", "Office file with macros (" + path_.split("/").pop() + "). Macros can run malware when you enable editing.");
  if ((LC_EXEC.test(path_) || LC_ARCHIVE.test(path_) || LC_MACRO.test(path_)) && lcMatchHost(bare, LC_FILEHOSTS))
    add(1, "warn", "A well-known file host is not a guarantee. Malware is regularly served from places like " + domain + ".");

  if (LC_EXEC.test(path_)) add(3, "warn", "Points straight at a program or script file (" + path_.split("/").pop() + "). Do not run files from links you don't trust.");
  else if (LC_ARCHIVE.test(path_)) add(1, "warn", "Points at an archive file (" + path_.split("/").pop() + "), which can hide programs.");
  if (/[?&](url|u|redirect|redirect_uri|next|continue|dest|destination|goto|link|target|r)=(https?|%68%74%74%70)/i.test(u.search))
    add(1, "warn", "Contains another web address in its options, so it may bounce you somewhere else.");
  if ((bare === "discord.com" || bare === "discordapp.com") && /^\/(api\/)?(v\d+\/)?oauth2\/authorize/.test(path_))
    add(2, "warn", "Discord authorization link. Continuing lets an app or bot access your account or server. Only go ahead if you know exactly what it is.");

  const total = f.reduce((s, x) => s + (x.level === "bad" || x.level === "warn" ? x.pts : 0), 0);
  if (total === 0 && !isIp && LC_KNOWN.has(domain)) add(0, "good", "Well-known site (" + domain + ").");
  else if (total === 0) add(0, "info", "No red flags in how this link is built.");
  f.sort((a, b) => LC_ORDER[a.level] - LC_ORDER[b.level]);
  return { url: u.href, host: bare, domain, unicodeHost: uni, findings: f, level: lcLevel(f), shortener, logger };
}

function lcPrivateIp(ip) {
  ip = String(ip).toLowerCase().replace(/^\[|\]$/g, "");
  if (nodeNet.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19));
  }
  if (nodeNet.isIPv6(ip)) {
    if (ip === "::" || ip === "::1") return true;
    const m4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
    if (m4) return lcPrivateIp(m4[1]);
    const mh = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(ip);
    if (mh) { const hi = parseInt(mh[1], 16), lo = parseInt(mh[2], 16); return lcPrivateIp([hi >> 8, hi & 255, lo >> 8, lo & 255].join(".")); }
    return /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip);
  }
  return false;
}
const lcLocalName = (h) => h === "localhost" || /\.(localhost|local|internal|lan|home\.arpa|corp)$/.test(h);
function lcHostLiteralPrivate(host) {
  host = String(host).toLowerCase().replace(/^\[|\]$/g, "");
  return lcLocalName(host) || (nodeNet.isIP(host) !== 0 && lcPrivateIp(host));
}
async function lcHostIsPrivate(host) {
  host = String(host).toLowerCase().replace(/^\[|\]$/g, "");
  if (lcHostLiteralPrivate(host)) return true;
  if (nodeNet.isIP(host)) return false;
  const addrs = await dnsP.lookup(host, { all: true });
  return addrs.some((a) => lcPrivateIp(a.address));
}

let lcSes = null;
function lcSession() {
  if (lcSes) return lcSes;
  lcSes = session.fromPartition("opsec-link-preview");
  lcSes.setPermissionRequestHandler((wc, p, cb) => cb(false));
  lcSes.setPermissionCheckHandler(() => false);
  lcSes.on("will-download", (e) => e.preventDefault());
  lcSes.webRequest.onBeforeRequest((d, cb) => {
    let u; try { u = new URL(d.url); } catch { return cb({ cancel: true }); }
    if (u.protocol === "data:") return cb({});
    if (u.protocol !== "http:" && u.protocol !== "https:") return cb({ cancel: true });
    cb({ cancel: lcHostLiteralPrivate(u.hostname) });
  });
  return lcSes;
}

function lcFetchHop(url) {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn, v) => { if (done) return; done = true; clearTimeout(timer); fn(v); };
    const timer = setTimeout(() => { try { req.abort(); } catch {} finish(reject, new Error("The site took too long to answer.")); }, 10000);
    const req = net.request({ url, method: "GET", redirect: "manual", session: lcSession(), useSessionCookies: false });
    req.setHeader("Accept", "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5");
    req.setHeader("Accept-Language", "en-US,en;q=0.8");
    req.on("redirect", (status, method, redirectUrl) => { try { req.abort(); } catch {} finish(resolve, { status, redirect: redirectUrl }); });
    req.on("response", (res) => {
      const status = res.statusCode;
      const ct = String(res.headers["content-type"] || "");
      const disp = String(res.headers["content-disposition"] || "");
      if (!/html|xml/i.test(ct)) { try { req.abort(); } catch {} return finish(resolve, { status, body: "", type: ct, disp }); }
      const chunks = []; let size = 0;
      const out = () => finish(resolve, { status, body: Buffer.concat(chunks).toString("utf8"), type: ct, disp });
      res.on("data", (c) => { chunks.push(c); size += c.length; if (size > 400000) { try { req.abort(); } catch {} out(); } });
      res.on("end", out);
      res.on("error", out);
    });
    req.on("error", (e) => finish(reject, e));
    req.end();
  });
}

function lcDecode(s) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ""; } catch { return ""; }
    }
    return named[e.toLowerCase()] ?? m;
  }).replace(/\s+/g, " ").trim();
}
function lcParseMeta(html) {
  const head = String(html).slice(0, 250000);
  const metas = head.match(/<meta\b[^>]*>/gi) || [];
  const meta = (names) => {
    for (const tag of metas) {
      const n = /(?:name|property)\s*=\s*["']?([^"'\s>]+)/i.exec(tag);
      const c = /content\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
      if (n && c && names.includes(n[1].toLowerCase())) return lcDecode(c[1] ?? c[2] ?? "");
    }
    return "";
  };
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head);
  const refresh = /<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*content\s*=\s*["']\s*\d+\s*;\s*url\s*=\s*([^"']+)["']/i.exec(head);
  return {
    title: (lcDecode(t ? t[1] : "") || meta(["og:title", "twitter:title"])).slice(0, 200),
    description: meta(["og:description", "description", "twitter:description"]).slice(0, 400),
    siteName: meta(["og:site_name"]).slice(0, 80),
    refresh: refresh ? lcDecode(refresh[1]).slice(0, 300) : ""
  };
}

function lcCapture(url) {
  return new Promise((resolve) => {
    let bw = null, done = false;
    const finish = (v) => { if (done) return; done = true; clearTimeout(timer); try { if (bw && !bw.isDestroyed()) bw.destroy(); } catch {} resolve(v); };
    const timer = setTimeout(() => finish(null), 15000);
    try {
      bw = new BrowserWindow({
        show: false, width: 1100, height: 720,
        webPreferences: { session: lcSession(), sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false, webSecurity: true, backgroundThrottling: false, spellcheck: false }
      });
      const wc = bw.webContents;
      wc.setAudioMuted(true);
      wc.setWindowOpenHandler(() => ({ action: "deny" }));
      const guard = (e, u) => { try { if (lcHostLiteralPrivate(new URL(u).hostname)) e.preventDefault(); } catch { e.preventDefault(); } };
      wc.on("will-navigate", guard);
      wc.on("will-redirect", guard);
      wc.on("did-fail-load", (e, code, desc, u, isMain) => { if (isMain) finish(null); });
      wc.on("did-finish-load", () => setTimeout(async () => {
        try {
          const img = await wc.capturePage();
          if (img.isEmpty()) return finish(null);
          finish("data:image/jpeg;base64," + img.resize({ width: 640 }).toJPEG(70).toString("base64"));
        } catch { finish(null); }
      }, 700));
      bw.loadURL(url).catch(() => finish(null));
    } catch { finish(null); }
  });
}

function lcAnalyzeBody(html, finalUrl, meta) {
  const out = [];
  const add = (pts, level, text) => out.push({ pts, level, text });
  if (!html) return out;
  const fa = analyzeUrl(finalUrl);
  const low = String(html).slice(0, 400000).toLowerCase();
  const text = low.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const known = LC_KNOWN.has(fa.domain);
  const hasPw = /<input[^>]+type\s*=\s*["']?password/.test(low);

  const runCmd = /(powershell|pwsh|mshta|cmd(\.exe)?\s*\/c|wscript|cscript|rundll32|regsvr32|certutil|bitsadmin|invoke-expression|invoke-webrequest|downloadstring|iex\s*\(|curl[^"'<>]{0,80}\|\s*(sh|bash))/.test(low);
  const clip = /clipboard\.writetext|execcommand\(\s*["']copy/.test(low);
  const steps = /(win(dows)?\s*(key)?\s*\+\s*r\b|press\s+win|open\s+(the\s+)?run\b|ctrl\s*\+\s*v|paste\s+(it|the|this)?[^.]{0,40}(run|terminal|command|powershell|prompt))/.test(text);
  const human = /(verify\s+(that\s+)?you\s+are\s+(a\s+)?human|i['’]?m\s+not\s+a\s+robot|human\s+verification|captcha)/.test(text);
  if ((clip && runCmd) || (steps && runCmd))
    add(7, "bad", "Fake-CAPTCHA trick: the page puts a command on your clipboard and tells you to run it. That installs malware. Close this page.");
  else if (steps && human) add(5, "bad", "A \"verify you are human\" page that tells you to use the Run box or paste something. Real CAPTCHAs never do this.");
  else if (clip && human) add(3, "warn", "A human-verification screen that copies something to your clipboard. Don't paste anything it gives you.");

  if (hasPw && !known) add(2, "warn", "The page has a password box. Never type a password on a site you got to through a link.");
  const fre = /<form[^>]+action\s*=\s*["']?(https?:\/\/[^"'\s>]+)/g;
  for (let m; (m = fre.exec(low)); ) {
    let d; try { d = lcRegDomain(new URL(m[1]).hostname); } catch { continue; }
    if (d !== fa.domain && !LC_KNOWN.has(d)) { add(hasPw ? 4 : 1, "warn", "A form on this page sends what you type to a different site (" + d + ")."); break; }
  }
  const title = ((meta && meta.title) || "") + " " + ((meta && meta.siteName) || "");
  const tl = title.toLowerCase();
  for (const [brand, reals] of Object.entries(LC_BRANDS)) {
    if (lcIsRealBrandHost(fa.host, reals)) continue;
    if (brand === "google" && /^google\.[a-z.]{2,6}$/.test(fa.domain)) continue;
    if (new RegExp("\\b" + brand + "\\b").test(tl)) {
      const nm = brand[0].toUpperCase() + brand.slice(1);
      add(hasPw ? 5 : 2, "warn", "The page calls itself " + nm + " but it is on " + fa.domain + ", not an official " + nm + " site.");
      break;
    }
  }
  if (!known) {
    if (/(free\s+nitro|claim\s+(your\s+)?(free\s+)?nitro|nitro\s+(gift|giveaway)|you['’]?ve\s+been\s+gifted)/.test(text)) add(4, "warn", "The page pushes a free-Nitro / gift offer. These are scams.");
    if (/(seed\s+phrase|recovery\s+phrase|secret\s+recovery|private\s+key|12[- ]word|24[- ]word)/.test(text)) add(3, "warn", "The page mentions a wallet seed phrase or private key. No real site ever needs these from you.");
    if (/discord(app)?\.com\/api\/(v\d+\/)?webhooks\/\d+/.test(low) || /api\.telegram\.org\/bot\d/.test(low)) add(4, "bad", "The page contains a Discord webhook or Telegram bot address, which is how stolen data is sent out.");
    const obf = (low.match(/\beval\s*\(|atob\s*\(|unescape\s*\(|fromcharcode|(\\x[0-9a-f]{2}){3}/g) || []).length;
    if (obf >= 4) add(2, "warn", "The page's script is heavily scrambled, a common way to hide what a page really does.");
    if (/<iframe[^>]+(width\s*=\s*["']?0|height\s*=\s*["']?0|display\s*:\s*none|visibility\s*:\s*hidden)/.test(low)) add(2, "warn", "The page contains a hidden frame loading something else behind the scenes.");
    if (/href\s*=\s*["'][^"']+\.(exe|msi|scr|bat|ps1|jar|apk|dmg|pkg|lnk|hta)(\?[^"']*)?["']/.test(low)) add(2, "warn", "The page links to program downloads.");
  }
  return out;
}

const lcFriendly = (e) => {
  const c = e && e.code, m = String((e && e.message) || e);
  if (c === "ENOTFOUND" || /ERR_NAME_NOT_RESOLVED/.test(m)) return "That domain doesn't exist or can't be found.";
  if (/ERR_CERT|SSL|certificate/i.test(m)) return "The site's security certificate is invalid. That's a bad sign.";
  if (/ERR_CONNECTION_REFUSED|ECONNREFUSED/.test(m)) return "The site refused the connection.";
  return m;
};

async function lcBuildPreview(startUrl, st) {
  const chain = [];
  let url = startUrl, last = null;
  for (let hop = 0; hop < 9; hop++) {
    let u; try { u = new URL(url); } catch { return { error: "Bad redirect address." }; }
    if (u.protocol !== "http:" && u.protocol !== "https:") return { chain, error: "The link redirects to a non-web address (" + u.protocol + "), so it was not followed." };
    if (lcIsLogger(u.hostname.toLowerCase().replace(/\.$/, ""), lcConfig().extraLoggers)) {
      if (hop > 0) st.extra.push({ pts: 6, level: "bad", text: "The link redirects to a known IP logger (" + u.hostname + "). The preview stopped before contacting it." });
      return { chain, error: "Preview stopped: " + u.hostname + " is a known IP logger, so it was not contacted." };
    }
    let priv;
    try { priv = await lcHostIsPrivate(u.hostname); } catch (e) { return { chain, error: lcFriendly(e) }; }
    if (priv) return { chain, error: "This link points at an address on your own computer or network (" + u.hostname + "), so it was not loaded." };
    if (hop > 0) {
      const a = analyzeUrl(url);
      for (const x of a.findings) if ((x.level === "bad" || x.level === "warn") && !st.extra.some((y) => y.text === "Redirects to " + a.host + ": " + x.text))
        st.extra.push({ pts: x.pts, level: x.level, text: "Redirects to " + a.host + ": " + x.text });
    }
    let r;
    try { r = await lcFetchHop(url); } catch (e) { return { chain, error: lcFriendly(e) }; }
    chain.push({ url, status: r.status });
    if (r.redirect) { try { url = new URL(r.redirect, url).href; } catch { return { chain, error: "Bad redirect address." }; } continue; }
    last = r; break;
  }
  if (!last) return { chain, error: "Too many redirects. That alone is suspicious." };
  const finalUrl = chain[chain.length - 1].url;
  const fa = analyzeUrl(finalUrl);
  if (chain.length > 1) {
    st.extra.push({ pts: 0, level: "info", text: "Redirected " + (chain.length - 1) + " time" + (chain.length > 2 ? "s" : "") + ". The page you actually land on is " + fa.domain + "." });
    if (fa.domain !== analyzeUrl(startUrl).domain && !analyzeUrl(startUrl).shortener)
      st.extra.push({ pts: 1, level: "warn", text: "The link says " + analyzeUrl(startUrl).domain + " but ends up on a different site (" + fa.domain + ")." });
  }
  const meta = lcParseMeta(last.body || "");
  if (meta.refresh) st.extra.push({ pts: 2, level: "warn", text: "The page tries to send you on to another address automatically (" + meta.refresh + ")." });
  if (last.status >= 400) st.extra.push({ pts: 0, level: "info", text: "The site answered with an error (" + last.status + ")." });
  if (/attachment/i.test(last.disp || "") || LC_BIN_TYPE.test(last.type || ""))
    st.extra.push({ pts: 3, level: "warn", text: "This link downloads a file (" + (last.type || "unknown type") + ") instead of showing a page. It was not downloaded. Don't run files you didn't expect." });
  for (const x of lcAnalyzeBody(last.body || "", finalUrl, meta)) st.extra.push(x);
  const image = /html|xml/i.test(last.type || "") ? await lcCapture(finalUrl) : null;
  return {
    chain, final: { url: finalUrl, domain: fa.domain, status: last.status },
    title: meta.title, description: meta.description, siteName: meta.siteName, image,
    note: /html|xml/i.test(last.type || "") ? (image ? "" : "No screenshot (the page may need JavaScript, or took too long).") : "This isn't a web page (" + (last.type || "unknown type") + "), so there is nothing to preview."
  };
}

async function lcSafeBrowsing(url, key) {
  const res = await fetch("https://safebrowsing.googleapis.com/v4/threatMatches:find?key=" + encodeURIComponent(key), {
    method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      client: { clientId: "opsexcord", clientVersion: "1.0" },
      threatInfo: {
        threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
        platformTypes: ["ANY_PLATFORM"], threatEntryTypes: ["URL"], threatEntries: [{ url }]
      }
    })
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const j = await res.json();
  return (j.matches || []).map((m) => m.threatType);
}
const LC_THREAT = { MALWARE: "malware", SOCIAL_ENGINEERING: "phishing / a deceptive site", UNWANTED_SOFTWARE: "unwanted software", POTENTIALLY_HARMFUL_APPLICATION: "a harmful app" };

let linkWin = null, linkSeq = 0, linkState = null;
let lcUiReady = false;
const lcJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
function lcView() {
  const s = linkState;
  if (!s || !s.a) return { id: s ? s.id : 0, url: "", findings: [], level: "ok", rep: "off", preview: null };
  const hasIssue = s.extra.some((x) => x.level === "bad" || x.level === "warn");
  const findings = s.a.findings.filter((x) => !(hasIssue && x.pts === 0 && (x.level === "info" || x.level === "good"))).concat(s.extra)
    .sort((a, b) => LC_ORDER[a.level] - LC_ORDER[b.level]);
  return { id: s.id, logger: !!s.a.logger, url: s.a.url, host: s.a.host, domain: s.a.domain, unicodeHost: s.a.unicodeHost, findings, level: lcLevel(findings), rep: s.rep, preview: s.preview };
}
function lcPush() {
  if (lcUiReady && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("link:view", { show: false, view: lcView() });
  if (!linkWin || linkWin.isDestroyed()) return;
  linkWin.webContents.executeJavaScript("window.__lcSet && window.__lcSet(" + lcJson(lcView()) + ")").catch(() => {});
}
const lcNormalize = (s) => { s = String(s || "").trim(); return s && !/^[a-z][a-z0-9+.-]*:/i.test(s) ? "https://" + s : s; };

async function lcVirusTotal(url, key) {
  const id = Buffer.from(url).toString("base64url");
  const res = await fetch("https://www.virustotal.com/api/v3/urls/" + id, { headers: { "x-apikey": key, accept: "application/json" }, signal: AbortSignal.timeout(10000) });
  if (res.status === 404) return { pts: 0, level: "info", text: "VirusTotal has no record of this exact link yet." };
  if (res.status === 401 || res.status === 403) throw new Error("VirusTotal key rejected");
  if (!res.ok) throw new Error("VirusTotal HTTP " + res.status);
  const j = await res.json();
  const st = (j.data && j.data.attributes && j.data.attributes.last_analysis_stats) || {};
  const mal = st.malicious || 0, sus = st.suspicious || 0;
  const total = Object.values(st).reduce((x, y) => x + (Number(y) || 0), 0);
  if (mal >= 3) return { pts: 6, level: "bad", text: "VirusTotal: " + mal + " of " + total + " security engines flag this link as malicious." };
  if (mal >= 1 || sus >= 1) return { pts: 3, level: "warn", text: "VirusTotal: " + mal + " engine(s) call this link malicious and " + sus + " suspicious (of " + total + ")." };
  return { pts: 0, level: "good", text: "VirusTotal: none of " + total + " engines flag this link. (Only covers links it has already scanned.)" };
}

async function lcDomainAge(domain) {
  const res = await fetch("https://rdap.org/domain/" + encodeURIComponent(domain), { headers: { accept: "application/rdap+json" }, signal: AbortSignal.timeout(8000), redirect: "follow" });
  if (res.status === 404) return { pts: 0, level: "info", text: "No public registration record for " + domain + " (some country domains don't publish one)." };
  if (!res.ok) throw new Error("registry lookup HTTP " + res.status);
  const j = await res.json();
  const ev = (j.events || []).find((e) => /registration/i.test(e.eventAction));
  if (!ev || !ev.eventDate) return { pts: 0, level: "info", text: "Couldn't find when " + domain + " was registered." };
  const days = Math.floor((Date.now() - new Date(ev.eventDate).getTime()) / 86400000);
  if (!(days >= 0)) return null;
  if (days < 7) return { pts: 5, level: "bad", text: domain + " was registered only " + days + " day(s) ago. Brand-new domains are a top sign of scam and phishing sites." };
  if (days < 30) return { pts: 4, level: "warn", text: domain + " was registered only " + days + " days ago. Very new domains are a common sign of scam sites." };
  if (days < 90) return { pts: 2, level: "warn", text: domain + " is less than 3 months old (" + days + " days)." };
  return { pts: 0, level: "info", text: domain + " was registered " + (days >= 730 ? Math.floor(days / 365) + " years" : days + " days") + " ago." };
}

function lcStart(raw) {
  const id = ++linkSeq;
  const url = lcNormalize(raw);
  if (!url) { linkState = { id, a: null, extra: [], rep: "off", preview: null }; return; }
  const a = analyzeUrl(url);
  const conf = lcConfig();
  const web = /^https?:/i.test(a.url);
  const st = (linkState = { id, a, extra: [], rep: "off", preview: null });
  const jobs = [];
  const job = (fn) => jobs.push(
    fn().catch((e) => ({ pts: 0, level: "info", text: "An online check failed (" + String((e && e.message) || e).slice(0, 80) + ")." }))
      .then((r) => { if (linkState !== st) return; for (const x of [].concat(r || [])) st.extra.push(x); lcPush(); })
  );
  if (web && conf.safeBrowsingKey) job(async () => {
    const types = await lcSafeBrowsing(a.url, conf.safeBrowsingKey);
    return types.length
      ? { pts: 6, level: "bad", text: "Google Safe Browsing lists this link as " + [...new Set(types)].map((t) => LC_THREAT[t] || t).join(", ") + "." }
      : { pts: 0, level: "good", text: "Not on Google Safe Browsing's lists. (That only covers sites Google already knows about.)" };
  });
  if (web && conf.virusTotalKey) job(() => lcVirusTotal(a.url, conf.virusTotalKey));
  if (web && conf.domainAge && !a.logger && a.domain && !nodeNet.isIP(a.host) && !LC_KNOWN.has(a.domain)) job(() => lcDomainAge(a.domain));
  if (jobs.length) {
    st.rep = "checking";
    Promise.all(jobs).then(() => { if (linkState === st) { st.rep = "done"; lcPush(); } });
  }
}

async function lcRunPreview(id) {
  const st = linkState;
  if (!st || st.id !== id || !st.a || !/^https?:/i.test(st.a.url) || st.a.logger) return;
  st.preview = "loading"; lcPush();
  let result;
  try { result = await lcBuildPreview(st.a.url, st); } catch (e) { result = { error: lcFriendly(e) }; }
  if (linkState !== st) return;
  st.preview = result; lcPush();
}

function lcPage(view) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>OpsexCord Link Check</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>
  *{box-sizing:border-box}
  html,body{height:100%}
  body{margin:0;overflow-y:auto;font:14px/1.45 "gg sans","Segoe UI",system-ui,sans-serif;color:#f4f4f5;
    background:radial-gradient(700px 360px at 50% -8%, rgba(255,255,255,.075), transparent 70%),#000}
  .wrap{max-width:500px;margin:0 auto;padding:22px 20px 30px;display:flex;flex-direction:column;gap:14px}
  h1{margin:0;font-size:22px;font-weight:600;text-align:center}
  h1 b{font-weight:800;letter-spacing:.03em}
  .row{display:flex;gap:8px}
  input{flex:1;min-width:0;height:42px;padding:0 16px;border-radius:999px;outline:none;color:#f4f4f5;font:inherit;
    background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.13)}
  input:focus{border-color:#f4f4f5;box-shadow:0 0 0 3px rgba(255,255,255,.12)}
  input::placeholder{color:#7e7e87}
  .btn{height:42px;padding:0 20px;border-radius:999px;cursor:pointer;color:#fff;font:inherit;font-weight:600;
    background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.33);transition:background .15s}
  .btn:hover{background:rgba(255,255,255,.22)}
  .btn.warn{background:rgba(237,66,69,.22);border-color:rgba(237,66,69,.6)}
  .btn.warn:hover{background:rgba(237,66,69,.34)}
  .btn.ghost{background:none;border-color:rgba(255,255,255,.16);color:#b5b5bd}
  .pill{align-self:center;padding:8px 20px;border-radius:999px;font-weight:700;font-size:15px;letter-spacing:.02em;border:1px solid}
  .pill.ok{color:#3ddc84;background:rgba(61,220,132,.1);border-color:rgba(61,220,132,.4)}
  .pill.caution{color:#ffb02e;background:rgba(255,176,46,.1);border-color:rgba(255,176,46,.45)}
  .pill.danger{color:#ff5d63;background:rgba(255,93,99,.12);border-color:rgba(255,93,99,.5)}
  .urlbox{padding:10px 14px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);
    color:#d6d6dc;font-size:12.5px;word-break:break-all;max-height:84px;overflow:auto;-webkit-user-select:text;user-select:text}
  .domain{text-align:center;color:#9a9aa3;font-size:13px}.domain b{color:#fff;font-size:15px}
  ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
  li{display:flex;gap:10px;align-items:flex-start;padding:9px 12px;border-radius:12px;background:rgba(255,255,255,.035);font-size:13px}
  .ic{flex:none;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:800;margin-top:1px}
  li.bad .ic{background:#ff5d63;color:#000}li.warn .ic{background:#ffb02e;color:#000}
  li.info .ic{background:rgba(255,255,255,.18);color:#fff}li.good .ic{background:#3ddc84;color:#000}
  .card{padding:14px;border-radius:14px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;gap:10px}
  .card h2{margin:0;font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:#8e9099}
  .small{color:#7e7e87;font-size:12px}
  .chain{font-size:12px;color:#b5b5bd;word-break:break-all;display:flex;flex-direction:column;gap:4px}
  .ptitle{font-weight:700;font-size:15px;word-break:break-word}
  .pdesc{color:#b5b5bd;font-size:13px;word-break:break-word}
  .shot{width:100%;border-radius:10px;border:1px solid rgba(255,255,255,.12);display:block;background:#fff}
  .err{color:#ff7b80;font-size:13px}
  .actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:2px}
  .hide{display:none!important}
</style></head><body>
<div class="wrap">
  <h1>link <b>check</b></h1>
  <div class="row"><input id="u" placeholder="paste a link to check" spellcheck="false" autocomplete="off"><button class="btn" id="chk">check</button></div>
  <div id="empty" class="small" style="text-align:center">Paste a link above and press Enter. Links Discord tries to open show up here automatically.</div>
  <div id="res" class="hide" style="display:contents">
    <div class="pill" id="pill"></div>
    <div class="urlbox" id="urlbox"></div>
    <div class="domain" id="domain"></div>
    <ul id="finds"></ul>
    <div class="small" id="rep" style="text-align:center"></div>
    <div class="card"><h2>Preview</h2><div id="pv" style="display:flex;flex-direction:column;gap:10px"></div></div>
    <div class="small" style="text-align:center">A clean result means no red flags were found. It is not a guarantee that a link is safe.</div>
    <div class="actions"><button class="btn" id="open">open in browser</button><button class="btn ghost" id="copy">copy link</button><button class="btn ghost" id="close">close</button></div>
  </div>
</div>
<script>
  let S = ${lcJson(view)};
  const $ = (id) => document.getElementById(id);
  const go = (p) => { location.href = "https://opsexcord.invalid/" + p; };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const ICON = { bad: "\\u2715", warn: "!", info: "i", good: "\\u2713" };
  const LABEL = { ok: "No red flags found", caution: "Looks suspicious", danger: "Likely dangerous" };
  let armed = false, armTimer = null, shownUrl = null;

  function renderPreview() {
    const P = S.preview, pv = $("pv");
    pv.replaceChildren();
    const loadBtn = (label) => { const b = el("button", "btn", label); b.onclick = () => go("preview?id=" + S.id); return b; };
    if (!P && S.logger) {
      pv.append(el("div", "err", "Preview disabled: this is a known IP logger, and loading it would reveal your IP."));
    } else if (!P) {
      pv.append(loadBtn("load preview"), el("div", "small", "This contacts the site from your own IP address. It follows redirects, reads the title, and takes a screenshot with JavaScript turned off."));
    } else if (P === "loading") {
      pv.append(el("div", "small", "Loading\\u2026 following redirects and taking a screenshot (up to ~25 seconds)."));
    } else {
      if (P.error) { pv.append(el("div", "err", P.error)); }
      if (P.chain && P.chain.length) {
        const c = el("div", "chain");
        P.chain.forEach((h, i) => c.append(el("div", null, (i === 0 ? "" : "\\u21B3 ") + h.status + "  " + h.url)));
        pv.append(c);
      }
      if (P.title) pv.append(el("div", "ptitle", P.title));
      if (P.siteName) pv.append(el("div", "small", P.siteName));
      if (P.description) pv.append(el("div", "pdesc", P.description));
      if (P.image) { const i = el("img", "shot"); i.src = P.image; i.alt = "page screenshot"; pv.append(i); }
      if (P.note) pv.append(el("div", "small", P.note));
      if (P.image) pv.append(el("div", "small", "Screenshot taken with JavaScript off, so some pages look empty or unstyled."));
      if (P.error) pv.append(loadBtn("try again"));
    }
  }

  function render() {
    const empty = !S.url;
    $("empty").classList.toggle("hide", !empty);
    $("res").classList.toggle("hide", empty);
    if (shownUrl !== S.url) { $("u").value = S.url; shownUrl = S.url; }
    if (empty) return;
    const pill = $("pill"); pill.className = "pill " + S.level; pill.textContent = LABEL[S.level];
    $("urlbox").textContent = S.url;
    const d = $("domain"); d.replaceChildren(el("span", null, "real domain: "), el("b", null, S.domain || S.host));
    if (S.unicodeHost && S.unicodeHost !== S.host) d.append(el("span", null, "  (displays as " + S.unicodeHost + ")"));
    const ul = $("finds"); ul.replaceChildren();
    S.findings.forEach((f) => { const li = el("li", f.level); li.append(el("span", "ic", ICON[f.level]), el("span", null, f.text)); ul.append(li); });
    $("rep").textContent = S.rep === "checking" ? "Running online checks\\u2026" : "";
    const o = $("open");
    o.textContent = armed ? "click again to open" : (S.level === "danger" ? "open anyway" : "open in browser");
    o.className = "btn" + (S.level === "danger" ? " warn" : "");
    renderPreview();
  }
  window.__lcSet = (s) => { if (S.url !== s.url) armed = false; S = s; render(); };

  const submit = () => { const v = $("u").value.trim(); if (v) go("check?u=" + encodeURIComponent(v)); };
  $("chk").onclick = submit;
  $("u").addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  $("open").onclick = () => {
    if (S.level === "danger" && !armed) {
      armed = true; render(); clearTimeout(armTimer); armTimer = setTimeout(() => { armed = false; render(); }, 3500); return;
    }
    go("open");
  };
  $("copy").onclick = () => go("copy");
  $("close").onclick = () => go("close");
  addEventListener("keydown", (e) => { if (e.key === "Escape") go("close"); });
  render();
  if (!S.url) $("u").focus();
</script></body></html>`;
}

function openLinkCheck(raw) {
  lcStart(raw);
  if (lcUiReady && mainWindow && !mainWindow.isDestroyed()) {
    if (!mainWindow.isVisible()) mainWindow.show();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.webContents.send("link:view", { show: true, view: lcView() });
    return;
  }
  if (linkWin && !linkWin.isDestroyed()) {
    lcPush();
    if (linkWin.isMinimized()) linkWin.restore();
    linkWin.focus();
    return;
  }
  const w = (linkWin = new BrowserWindow({
    width: 540, height: 720, minWidth: 420, minHeight: 480, useContentSize: true,
    parent: mainWindow || undefined, title: "OpsexCord Link Check", backgroundColor: "#000000",
    icon: path.join(ROOT, "icon.ico"), autoHideMenuBar: true, minimizable: false, maximizable: false,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false }
  }));
  w.setMenu(null);
  w.setContentProtection(!!cfg.contentProtection);
  w.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  w.webContents.on("will-navigate", (e, url) => {
    e.preventDefault();
    let u; try { u = new URL(url); } catch { return; }
    if (u.hostname !== "opsexcord.invalid" || w !== linkWin) return;
    const st = linkState;
    if (u.pathname === "/check") { openLinkCheck(u.searchParams.get("u") || ""); }
    else if (u.pathname === "/preview") { lcRunPreview(Number(u.searchParams.get("id"))); }
    else if (u.pathname === "/copy") { if (st && st.a) clipboard.writeText(st.a.url); }
    else if (u.pathname === "/open") {
      if (st && st.a && /^https?:\/\//i.test(st.a.url)) { shell.openExternal(st.a.url); w.close(); }
    }
    else if (u.pathname === "/close") w.close();
  });
  w.on("closed", () => { if (linkWin === w) { linkWin = null; linkState = null; } });
  w.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(lcPage(lcView())));
}

ipcMain.on("link:ready", (e) => { if (fromDiscord(e)) lcUiReady = true; });
ipcMain.on("link:check", (e, raw) => { if (fromDiscord(e) && typeof raw === "string" && raw.length < 4096) openLinkCheck(raw); });
ipcMain.on("link:preview", (e, id) => { if (fromDiscord(e)) lcRunPreview(Number(id)); });
ipcMain.on("link:copy", (e) => { if (fromDiscord(e) && linkState && linkState.a) clipboard.writeText(linkState.a.url); });
ipcMain.on("link:open", (e) => {
  const st = linkState;
  if (fromDiscord(e) && st && st.a && /^https?:\/\//i.test(st.a.url)) shell.openExternal(st.a.url);
});
ipcMain.on("link:close", (e) => { if (fromDiscord(e)) linkState = null; });

function routeExternal(url) {
  let u; try { u = new URL(url); } catch { return; }
  const proto = u.protocol.replace(":", "");
  if (proto === "http" || proto === "https") return lcConfig().enabled ? openLinkCheck(u.href) : shell.openExternal(u.href);
  if (LC_PASS_SCHEMES.has(proto)) return shell.openExternal(u.href);
  console.log("[OpsexCord] blocked link with scheme:", proto + ":");
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 500,
    backgroundColor: "#1e1f22",
    title: "OpsexCord",
    icon: path.join(ROOT, "icon.ico"),
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#00000000",
      symbolColor: "#b5bac1",
      height: 28
    },
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
      backgroundThrottling: false,
      autoplayPolicy: "no-user-gesture-required",
      partition: "persist:nitroshield"
    }
  });
  mainWindow = win;
  win.setContentProtection(!!cfg.contentProtection);

  win.webContents.on("did-navigate", (e, url) => maybePromptPin(url));
  win.webContents.on("did-navigate-in-page", (e, url) => maybePromptPin(url));
  win.webContents.on("did-start-navigation", (e) => { if (e && e.isMainFrame && !e.isSameDocument) lcUiReady = false; });
  win.webContents.on("before-input-event", (e, input) => {
    if (accelMatch(input, cfg.lockKey)) {
      e.preventDefault();
      openLockWindow("manage");
    }
    if (accelMatch(input, cfg.linkKey)) {
      e.preventDefault();
      if (locked && hasPin()) return;
      const m = /https?:\/\/[^\s<>"'`]+/i.exec(clipboard.readText() || "");
      openLinkCheck(m ? m[0].replace(/[).,;!?]+$/, "") : "");
    }
  });
  for (const ev of ["show", "restore", "hide", "minimize", "move", "resize", "maximize", "unmaximize", "enter-full-screen", "leave-full-screen"]) {
    win.on(ev, () => {
      if (overlayAlive() && lockMode === "setup") { syncOverlay(); return; }
      if (!locked || !hasPin()) return;
      if (ev === "show" || ev === "restore") ensureOverlay();
      syncOverlay();
    });
  }
  win.on("focus", () => { if (overlayAlive() && lockWin.isVisible()) lockWin.focus(); });

  const ses = session.fromPartition("persist:nitroshield");

  const ua = CLEAN_UA(win.webContents.getUserAgent());
  win.webContents.setUserAgent(ua);
  ses.setUserAgent(ua);
  console.log("[OpsexCord] user agent:", ua);

  ses.webRequest.onBeforeSendHeaders({ urls: ["*://*.discord.com/*"] }, (details, callback) => {
    const h = details.requestHeaders;
    for (const k of Object.keys(h)) {
      if (k.toLowerCase() === "sec-ch-ua") {
        h[k] = String(h[k]).split(", ").filter((b) => !/electron/i.test(b)).join(", ");
      }
    }
    callback({ requestHeaders: h });
  });

  ses.webRequest.onBeforeRequest(
    { urls: BLOCKED },
    (details, callback) => callback({ cancel: true })
  );

  setupMedia(ses);

  win.webContents.on("dom-ready", async () => {
    const wc = win.webContents;
    const plugins = pluginFiles();
    console.log("[OpsexCord] main.js v9 (PIN lock + link checker) | plugins loaded:", plugins.join(", ") || "none");
    try {
      const dir = path.join(ROOT, "plugins");
      const ignored = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".js") && !f.endsWith(".plugin.js")) : [];
      if (ignored.length) console.log("[OpsexCord] IGNORED (name must end in .plugin.js):", ignored.join(", "));
    } catch {}
    try {
      await wc.insertCSS(DRAG_CSS);
      await wc.insertCSS(readFile("public/css/discord-theme.css"));
      await wc.executeJavaScript(SHIFT_ICONS_JS);
      await wc.executeJavaScript(SHARE_QUALITY_JS);
      await wc.executeJavaScript(RECORD_HOOK_JS);
      await wc.executeJavaScript(`window.__nitroPlugins = ${plugins.length > 0};`);
      await wc.executeJavaScript(readFile("public/js/nitro-api.js"));
      await wc.executeJavaScript(readFile("public/js/logic.js"));

      for (const file of plugins) {
        const code = fs.readFileSync(path.join(ROOT, "plugins", file), "utf8");
        await wc.executeJavaScript(
          `(function(){const module={exports:{}};const exports=module.exports;\n${code}\n;` +
          `window.NitroLoader.register(module.exports, ${JSON.stringify(file)});})();`
        );
      }
    } catch (err) {
      console.error("Injection failed:", err);
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === "" || url === "about:blank") {
      return {
        action: "allow",
        overrideBrowserWindowOptions: { autoHideMenuBar: true, backgroundColor: "#1e1f22", icon: path.join(ROOT, "icon.ico") }
      };
    }
    routeExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    const host = new URL(url).hostname;
    if (host !== "discord.com" && !host.endsWith(".discord.com")) {
      event.preventDefault();
      routeExternal(url);
    }
  });

  win.on("page-title-updated", (event) => event.preventDefault());

  win.on("closed", () => {
    mainWindow = null;
    stopWatchdog();
    if (tray) { tray.destroy(); tray = null; }
  });

  win.loadURL(DISCORD_URL);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => restoreWindow());
  app.on("will-quit", () => { globalShortcut.unregisterAll(); try { music.shutdown(); } catch {} });

  app.whenReady().then(async () => {
    if (components) {
      try {
        await Promise.race([
          components.whenReady(),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timed out after 45s")), 45000))
        ]);
        console.log("[OpsexCord] Widevine components:", JSON.stringify(components.status()));
      } catch (e) {
        console.warn("[OpsexCord] Widevine not ready:", (e && e.message) || e);
      }
    } else {
      console.warn("[OpsexCord] Not running on the castlabs Electron build: Spotify in-app playback will not work.");
    }
    createWindow();
    starting = false;
    if (hasPin()) { locked = true; openLockWindow("unlock"); }
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (starting) return;
    if (process.platform !== "darwin") app.quit();
  });
}