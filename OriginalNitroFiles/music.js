// @name OpsexCord
// @author @geofeed on discord
"use strict";
const { app, BrowserWindow, ipcMain, shell, safeStorage, net, globalShortcut } = require("electron");
const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");

const ENGINE_HTML = `<!doctype html><meta charset="utf-8"><title>OpsexCord player</title>
<script>
const ev = (n, d) => MEng.event(n, d || {});
window.onSpotifyWebPlaybackSDKReady = async () => {
  try {
    await navigator.requestMediaKeySystemAccess("com.widevine.alpha", [{
      initDataTypes: ["cenc"],
      audioCapabilities: [{ contentType: 'audio/mp4;codecs="mp4a.40.2"' }]
    }]);
  } catch (e) {
    return ev("error", { kind: "drm", message: "Widevine DRM isn't available. Run the app with the castlabs Electron build." });
  }
  const p = new Spotify.Player({
    name: "OpsexCord", volume: 0.7,
    getOAuthToken: async (cb) => cb(await MEng.token())
  });
  for (const k of ["initialization_error", "authentication_error", "account_error", "playback_error"])
    p.addListener(k, (e) => ev("error", { kind: k, message: e.message }));
  p.addListener("ready", (d) => ev("ready", { id: d.device_id }));
  p.addListener("not_ready", () => ev("not_ready"));
  p.addListener("player_state_changed", () => ev("state"));
  window.__p = p;
  if (!(await p.connect())) ev("error", { kind: "connect", message: "The Spotify player couldn't connect." });
};
</script>
<script src="https://sdk.scdn.co/spotify-player.js"></script>`;

const DEFAULT_CLIENT_ID = "";

const loginPage = (title, msg) => `<!doctype html><meta charset="utf-8"><title>OpsexCord</title>
<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;font:14px/1.45 'Segoe UI',system-ui,sans-serif;color:#f4f4f5;
background:radial-gradient(700px 360px at 50% -8%,rgba(255,255,255,.075),transparent 70%),#000">
<div style="text-align:center;padding:34px 40px;border-radius:18px;background:#050506;border:1px solid rgba(255,255,255,.11);box-shadow:0 40px 90px rgba(0,0,0,.85)">
<div style="font-size:22px;font-weight:700;letter-spacing:.02em;margin-bottom:6px">${title}</div>
<div style="color:#7e7e87;font-size:13px">${msg}</div></div></body>`;

module.exports = function initMusic({ getMainWindow, fromDiscord }) {
  const SP_PORT = 8898;
  const SP_REDIRECT = `http://127.0.0.1:${SP_PORT}/callback`;
  const SP_SCOPES = "user-read-playback-state user-modify-playback-state user-read-currently-playing streaming user-read-email user-read-private playlist-read-private playlist-read-collaborative";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let cfg = { clientId: "", enc: "" };
  let tokens = null;
  let loaded = false;
  const CFG_FILE = () => path.join(app.getPath("userData"), "music.json");
  function loadCfg() {
    if (loaded) return;
    loaded = true;
    try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(CFG_FILE(), "utf8")) }; } catch {}
    if (cfg.enc && safeStorage.isEncryptionAvailable()) {
      try { tokens = JSON.parse(safeStorage.decryptString(Buffer.from(cfg.enc, "base64"))); } catch { tokens = null; }
    }
  }
  const saveCfg = () => { try { fs.writeFileSync(CFG_FILE(), JSON.stringify(cfg), { mode: 0o600 }); } catch {} };
  function saveTokens() {
    cfg.enc = tokens && safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(JSON.stringify(tokens)).toString("base64") : "";
    saveCfg();
  }
  const canStream = () => !!tokens && /(^|\s)streaming(\s|$)/.test(tokens.scope || "");
  const canPlaylists = () => !!tokens && /(^|\s)playlist-read-private(\s|$)/.test(tokens.scope || "");

  let meId = "";
  const R = { spotify: [], playlist: [] };
  const S = { index: -1, track: null, playing: false, pos: 0, dur: 0, volume: 0.7, device: "",
    deviceId: "", engineDevice: "", engineActive: false, engineError: "" };
  const pub = (t) => (t ? { title: t.title, artist: t.artist, album: t.album, art: t.art } : null);
  const listOut = (arr) => arr.map((t) => ({ title: t.title, artist: t.artist, album: t.album, art: t.art, dur: t.dur }));
  const snapshot = () => ({
    track: S.track, playing: S.playing, pos: S.pos, dur: S.dur, volume: S.volume, device: S.device,
    spotify: { connected: !!tokens, clientId: cfg.clientId || DEFAULT_CLIENT_ID, canStream: canStream(), canPlaylists: canPlaylists() },
    engine: { ready: !!S.engineDevice, error: S.engineError, target: !!S.deviceId && S.deviceId === S.engineDevice },
    ts: Date.now()
  });
  function push() {
    const w = getMainWindow();
    if (w && !w.isDestroyed()) w.webContents.send("music:state", snapshot());
  }
  const str = (v, max) => (typeof v === "string" && v.length <= max ? v : "");
  const licenseMsg = (code) => "Spotify's license server refused in-app playback (HTTP " + code + "). Audio will stop or skip. Use another device in the list.";

  let engine = null, engineServer = null, enginePort = 0, engineStarting = false;
  let licFails = 0;
  function startEngineServer() {
    if (engineServer) return Promise.resolve(enginePort);
    return new Promise((resolve, reject) => {
      const srv = http.createServer((req, res) => {
        if (req.url === "/engine") {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
          res.end(ENGINE_HTML);
        } else { res.writeHead(404); res.end(); }
      });
      srv.on("error", reject);
      srv.listen(0, "127.0.0.1", () => { engineServer = srv; enginePort = srv.address().port; resolve(enginePort); });
    });
  }
  async function startEngine() {
    if ((engine && !engine.isDestroyed()) || engineStarting || !canStream() || S.engineDisabled) return;
    engineStarting = true;
    try {
      S.engineError = "";
      const port = await startEngineServer();
      engine = new BrowserWindow({
        show: false, width: 400, height: 300,
        webPreferences: {
          preload: path.join(__dirname, "music-engine-preload.js"),
          sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false,
          autoplayPolicy: "no-user-gesture-required", partition: "persist:opsec-music-engine"
        }
      });
      const wc = engine.webContents;
      wc.on("console-message", (e, level, message) => {
        const msg = e && typeof e.message === "string" ? e.message : message;
        if (msg) console.log("[OpsexCord music-engine]", msg);
      });
      engine.setMenu(null);
      wc.setWindowOpenHandler(() => ({ action: "deny" }));
      wc.on("will-navigate", (e) => e.preventDefault());
      wc.session.setPermissionRequestHandler((w, permission, cb) => cb(permission === "mediaKeySystem"));
      wc.session.setPermissionCheckHandler((w, permission) => permission === "mediaKeySystem");
      S.licenseStatus = 0;
      wc.session.webRequest.onCompleted({ urls: ["*://*/*widevine-license*"] }, (d) => {
        console.log("[OpsexCord music-engine] license request ->", d.statusCode);
        if (d.statusCode >= 400) {
          S.licenseStatus = d.statusCode; licFails++;
          S.engineError = licenseMsg(d.statusCode); push();
          if (licFails >= 3 && !S.engineDisabled) giveUpOnEngine(d.statusCode);
        } else { licFails = 0; if (S.licenseStatus) { S.licenseStatus = 0; S.engineError = ""; push(); } }
      });
      engine.on("closed", () => { engine = null; S.engineDevice = ""; S.engineActive = false; push(); });
      engine.loadURL(`http://127.0.0.1:${port}/engine`);
    } catch (e) {
      S.engineError = "Couldn't start the in-app player: " + String((e && e.message) || e);
      push();
    } finally { engineStarting = false; }
  }
  function stopEngine() {
    if (engine && !engine.isDestroyed()) engine.destroy();
    engine = null; S.engineDevice = ""; S.engineActive = false; S.engineError = "";
    if (S.deviceId) S.deviceId = "";
  }
  function giveUpOnEngine(code) {
    S.engineDisabled = true;
    if (tokens) spApi("PUT", "/v1/me/player/pause", { query: devQ() }).catch(() => {});
    setImmediate(() => {
      stopEngine();
      S.playing = false;
      S.engineError = "Spotify's license server refused in-app playback (HTTP " + code + "), so the in-app player was turned off. Pick your Spotify desktop app or phone under Devices. Restart OpsexCord to try again.";
      push();
    });
  }
  const fromEngine = (e) => !!engine && !engine.isDestroyed() && e.sender === engine.webContents;
  ipcMain.handle("meng:token", async (e) => {
    if (!fromEngine(e)) return "";
    try { await spEnsureToken(); return tokens.access; } catch { return ""; }
  });
  ipcMain.on("meng:event", (e, name, d) => {
    if (!fromEngine(e)) return;
    d = d && typeof d === "object" ? d : {};
    if (name === "ready") {
      S.engineDevice = str(d.id, 80); S.engineActive = false; S.engineError = "";
      if (!S.deviceId) S.deviceId = S.engineDevice;
      push();
    } else if (name === "not_ready") {
      if (S.deviceId === S.engineDevice) S.deviceId = "";
      S.engineDevice = ""; S.engineActive = false; push();
    } else if (name === "error") {
      const kind = str(d.kind, 40);
      console.log("[OpsexCord music-engine] ERROR event:", kind, "|", str(d.message, 300));
      S.engineError = kind === "account_error" ? "In-app playback needs Spotify Premium."
        : kind === "authentication_error" ? "Spotify rejected the login for the in-app player. Disconnect and connect again."
        : str(d.message, 200) || "The in-app player hit an error.";
      if (S.licenseStatus) S.engineError = licenseMsg(S.licenseStatus);
      push();
    } else if (name === "state") soon();
  });

  let timer = null, lastSp = 0;
  function startPoll() { if (!timer) timer = setInterval(tick, 500); }
  async function tick() {
    try {
      if (!tokens || Date.now() - lastSp < 3000) return;
      lastSp = Date.now();
      await spRefresh();
      push();
    } catch {}
  }

  async function spTokenRequest(params) {
    const res = await net.fetch("https://accounts.spotify.com/api/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: cfg.clientId, ...params }).toString(), signal: AbortSignal.timeout(10000)
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.access_token) throw new Error("Spotify login failed: " + (j.error_description || j.error || res.status));
    tokens = {
      access: j.access_token, refresh: j.refresh_token || (tokens && tokens.refresh),
      exp: Date.now() + (j.expires_in || 3600) * 1000, scope: j.scope || (tokens && tokens.scope) || ""
    };
    saveTokens();
  }
  async function spEnsureToken() {
    if (!tokens) throw new Error("Not connected to Spotify. Press Connect in the Music panel.");
    if (Date.now() > tokens.exp - 30000) await spRefreshToken();
  }
  async function spRefreshToken() {
    if (!tokens || !tokens.refresh) { tokens = null; saveTokens(); throw new Error("Spotify session expired. Connect again."); }
    try { await spTokenRequest({ grant_type: "refresh_token", refresh_token: tokens.refresh }); }
    catch (e) { tokens = null; saveTokens(); throw e; }
  }

  let loginServer = null;
  function spLogin(clientId) {
    loadCfg();
    clientId = clientId || cfg.clientId || DEFAULT_CLIENT_ID;
    if (!clientId) throw new Error("Paste your Spotify Client ID first (one-time setup).");
    if (!/^[a-f0-9]{32}$/i.test(clientId)) throw new Error("That doesn't look like a Spotify Client ID (it's 32 letters/numbers).");
    if (loginServer) { try { loginServer.close(); } catch {} loginServer = null; }
    cfg.clientId = clientId; saveCfg();
    const verifier = crypto.randomBytes(48).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    const state = crypto.randomBytes(16).toString("hex");
    return new Promise((resolve, reject) => {
      let t = null;
      const finish = (err) => {
        clearTimeout(t); try { srv.close(); } catch {} if (loginServer === srv) loginServer = null;
        err ? reject(err) : resolve(true);
      };
      const srv = http.createServer(async (req, res) => {
        const u = new URL(req.url, SP_REDIRECT);
        if (u.pathname !== "/callback") { res.writeHead(404).end(); return; }
        const page = (m, ok) => { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(loginPage(ok ? "Connected" : "Not connected", m)); };
        if (u.searchParams.get("state") !== state) { page("Login rejected (state mismatch). Close this tab."); return finish(new Error("Spotify login rejected.")); }
        const code = u.searchParams.get("code");
        if (!code) { page("Spotify login was cancelled. Close this tab."); return finish(new Error("Spotify login cancelled.")); }
        try {
          await spTokenRequest({ grant_type: "authorization_code", code, redirect_uri: SP_REDIRECT, code_verifier: verifier });
          page("Spotify is linked to OpsexCord. You can close this tab.", true);
          finish();
        } catch (e) { page("Login failed. Close this tab."); finish(e); }
      });
      t = setTimeout(() => finish(new Error("Spotify login timed out.")), 180000);
      srv.on("error", (e) => finish(new Error("Couldn't open port " + SP_PORT + " for the login callback (" + e.code + ").")));
      loginServer = srv;
      srv.listen(SP_PORT, "127.0.0.1", () => {
        const q = new URLSearchParams({ client_id: clientId, response_type: "code", redirect_uri: SP_REDIRECT,
          scope: SP_SCOPES, code_challenge_method: "S256", code_challenge: challenge, state });
        shell.openExternal("https://accounts.spotify.com/authorize?" + q);
      });
    });
  }

  async function spApi(method, p, { query, body } = {}) {
    await spEnsureToken();
    const url = "https://api.spotify.com" + p + (query ? "?" + new URLSearchParams(query) : "");
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await net.fetch(url, {
        method,
        headers: { Authorization: "Bearer " + tokens.access, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000)
      });
      if (res.status === 401 && attempt === 0) { await spRefreshToken(); continue; }
      if (res.status === 204) return null;
      if (res.status === 429) throw new Error("Spotify rate limit. Wait " + (res.headers.get("retry-after") || "a few") + "s.");
      const text = await res.text();
      let j = null; try { j = text ? JSON.parse(text) : null; } catch {}
      if (!res.ok) {
        const msg = (j && j.error && j.error.message) || String(res.status);
        const reason = j && j.error && j.error.reason;
        if (reason === "NO_ACTIVE_DEVICE" || (res.status === 404 && /device/i.test(msg)))
          throw new Error("No active Spotify device. Pick one in the Devices list (OpsexCord is the in-app player).");
        if (reason === "PREMIUM_REQUIRED" || /premium/i.test(msg)) throw new Error("Spotify Premium is required to control playback.");
        throw new Error("Spotify: " + msg);
      }
      return j;
    }
  }
  const pickArt = (imgs) => (imgs && imgs.length ? (imgs[1] || imgs[0]).url : "");
  const spTrack = (it) => ({
    uri: it.uri, title: it.name, artist: (it.artists || []).map((a) => a.name).join(", "),
    album: (it.album && it.album.name) || "", art: pickArt(it.album && it.album.images), dur: (it.duration_ms || 0) / 1000
  });
  async function spRefresh() {
    const r = await spApi("GET", "/v1/me/player");
    if (!r) { S.playing = false; return; }
    if (r.item) { const t = spTrack(r.item); S.track = pub(t); S.dur = t.dur; }
    S.pos = (r.progress_ms || 0) / 1000; S.playing = !!r.is_playing;
    S.device = (r.device && r.device.name) || "";
    if (r.device && typeof r.device.volume_percent === "number") S.volume = r.device.volume_percent / 100;
  }
  const devQ = () => (S.deviceId ? { device_id: S.deviceId } : undefined);
  const soon = () => setTimeout(() => { lastSp = Date.now(); spRefresh().then(push).catch(() => {}); }, 600);

  async function ensureTarget() {
    if (S.engineDevice && S.deviceId === S.engineDevice && !S.engineActive) {
      await spApi("PUT", "/v1/me/player", { body: { device_ids: [S.engineDevice], play: false } }).catch(() => {});
      await sleep(500);
      S.engineActive = true;
    }
  }

  const artCache = new Map();
  const api = {
    async state() {
      loadCfg();
      if (tokens) { startPoll(); if (canStream()) startEngine(); }
      return snapshot();
    },

    async search({ q }) {
      q = str(q, 120).trim();
      if (!q) return [];
      const j = await spApi("GET", "/v1/search", { query: { q, type: "track", limit: "10" } });
      R.spotify = ((j && j.tracks && j.tracks.items) || []).map(spTrack);
      return listOut(R.spotify);
    },

    async playlists() {
      if (!canPlaylists()) throw new Error("Reconnect Spotify to allow playlist access.");
      if (!meId) { try { const me = await spApi("GET", "/v1/me"); meId = (me && me.id) || ""; } catch {} }
      const out = [];
      for (let off = 0; off < 200; off += 50) {
        let j;
        try { j = await spApi("GET", "/v1/me/playlists", { query: { limit: "50", offset: String(off) } }); }
        catch (e) { if (off === 0) throw e; break; }
        const items = (j && j.items) || [];
        for (const p of items) {
          if (!p || !p.id) continue;
          const total = p.items && typeof p.items.total === "number" ? p.items.total
            : (p.tracks && typeof p.tracks.total === "number" ? p.tracks.total : null);
          out.push({
            id: p.id, name: p.name || "Untitled", count: total, art: pickArt(p.images),
            owner: (p.owner && (p.owner.display_name || p.owner.id)) || "",
            own: !meId || !!p.collaborative || !!(p.owner && p.owner.id === meId)
          });
        }
        if (items.length < 50 || !(j && j.next)) break;
      }
      return out;
    },

    async playlistTracks({ id }) {
      id = str(id, 64);
      if (!/^[A-Za-z0-9]{10,40}$/.test(id)) throw new Error("Bad playlist id.");
      let j;
      try { j = await spApi("GET", "/v1/playlists/" + id + "/items", { query: { limit: "50", market: "from_token" } }); }
      catch (e) {
        if (/403|forbidden/i.test(String((e && e.message) || e)))
          throw new Error("Spotify only lets this app open playlists you own or collaborate on.");
        throw e;
      }
      R.playlist = ((j && j.items) || [])
        .map((x) => (x && !x.is_local ? (x.item || x.track) : null))
        .filter((it) => it && it.uri && it.type !== "episode" && !it.is_local)
        .map(spTrack);
      return listOut(R.playlist);
    },

    async play({ index, src }) {
      const list = src === "playlist" ? R.playlist : R.spotify;
      const i = Number.isInteger(index) ? index : -1;
      const t = list[i];
      if (!t) throw new Error("That track isn't in the current results.");
      await ensureTarget();
      await spApi("PUT", "/v1/me/player/play", { query: devQ(), body: { uris: list.map((x) => x.uri), offset: { position: i } } });
      S.index = i; S.track = pub(t); S.dur = t.dur; S.pos = 0; S.playing = true;
      startPoll(); push(); soon();
      return true;
    },

    async toggle() {
      await ensureTarget();
      if (S.playing) await spApi("PUT", "/v1/me/player/pause", { query: devQ() });
      else await spApi("PUT", "/v1/me/player/play", { query: devQ() });
      S.playing = !S.playing; push(); soon();
      return true;
    },

    async next() { await spApi("POST", "/v1/me/player/next", { query: devQ() }); soon(); return true; },
    async prev() { await spApi("POST", "/v1/me/player/previous", { query: devQ() }); soon(); return true; },

    async seek({ sec }) {
      sec = Math.max(0, Number(sec) || 0);
      await spApi("PUT", "/v1/me/player/seek", { query: { position_ms: String(Math.round(sec * 1000)), ...(S.deviceId ? { device_id: S.deviceId } : {}) } });
      S.pos = sec; push(); return true;
    },

    async volume({ v }) {
      v = Math.min(1, Math.max(0, Number(v) || 0));
      S.volume = v;
      await spApi("PUT", "/v1/me/player/volume", { query: { volume_percent: String(Math.round(v * 100)), ...(S.deviceId ? { device_id: S.deviceId } : {}) } }).catch(() => {});
      return true;
    },

    async art({ url }) {
      if (typeof url !== "string" || !/^https:\/\/([a-z0-9-]+\.)*(scdn\.co|spotifycdn\.com)\//i.test(url)) return "";
      if (artCache.has(url)) return artCache.get(url);
      const res = await net.fetch(url, { signal: AbortSignal.timeout(8000) });
      const type = (res.headers.get("content-type") || "").split(";")[0];
      if (!res.ok || !/^image\/(jpeg|png|webp)$/.test(type)) return "";
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 800000) return "";
      const data = "data:" + type + ";base64," + buf.toString("base64");
      if (artCache.size > 300) artCache.delete(artCache.keys().next().value);
      artCache.set(url, data);
      return data;
    },

    async spLogin({ clientId }) {
      await spLogin(str(clientId, 64).trim());
      stopEngine();
      S.engineDisabled = false; licFails = 0;
      startPoll(); lastSp = 0; push();
      startEngine();
      return true;
    },
    async spLogout() {
      loadCfg(); stopEngine(); tokens = null; saveTokens();
      S.track = null; S.playing = false; S.device = ""; S.deviceId = "";
      push(); return true;
    },
    async spDevices() {
      const j = await spApi("GET", "/v1/me/player/devices");
      return ((j && j.devices) || []).map((d) => ({ id: d.id, name: d.name, type: d.type, active: !!d.is_active, selected: d.id === S.deviceId }));
    },
    async spTransfer({ id }) {
      id = str(id, 80);
      if (!id) throw new Error("No device selected.");
      await spApi("PUT", "/v1/me/player", { body: { device_ids: [id], play: false } });
      S.deviceId = id;
      if (id === S.engineDevice) S.engineActive = true;
      push(); soon();
      return true;
    }
  };

  ipcMain.handle("music:call", async (e, name, args) => {
    if (!fromDiscord(e)) return { ok: false, error: "Rejected." };
    if (typeof name !== "string" || !Object.hasOwn(api, name)) return { ok: false, error: "Unknown command." };
    try {
      loadCfg();
      const data = await api[name](args && typeof args === "object" ? args : {});
      return { ok: true, data: data === undefined ? true : data };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  });

  return {
    registerKeys() {
      for (const [k, fn] of [["MediaPlayPause", api.toggle], ["MediaNextTrack", api.next], ["MediaPreviousTrack", api.prev]]) {
        try { globalShortcut.register(k, () => { fn().catch(() => {}); }); } catch {}
      }
    },
    pause() {
      if (tokens) spApi("PUT", "/v1/me/player/pause", { query: devQ() }).catch(() => {});
      S.playing = false; push();
    },
    shutdown() {
      if (timer) clearInterval(timer);
      timer = null;
      if (engine && !engine.isDestroyed()) engine.destroy();
      try { engineServer && engineServer.close(); } catch {}
    }
  };
};