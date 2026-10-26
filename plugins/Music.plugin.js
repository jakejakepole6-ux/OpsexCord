/**
 * @name OpsexCord
 * @author @geofeed on discord
 */

const NAME = "Music";
const GLYPH = { play: "\u25B6\uFE0E", pause: "\u23F8\uFE0E", prev: "\u23EE\uFE0E", next: "\u23ED\uFE0E" };

const h = (tag, attrs, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "value") e.value = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
};
const fmt = (s) => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

const CSS = `
#ms-root, #ms-root * { box-sizing: border-box; }
#ms-root { --ms-line: rgba(255,255,255,.08); --ms-muted: #7e7e87; --ms-accent: #f4f4f5; }
#ms-root button { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; }

#ms-panel { position: fixed; right: 16px; bottom: 64px; width: 380px; height: 580px; max-height: calc(100vh - 100px);
  z-index: 9998; display: none; flex-direction: column; overflow: hidden; color: #f4f4f5;
  font: 14px/1.45 "gg sans","Segoe UI",system-ui,sans-serif;
  background: radial-gradient(520px 200px at 50% -22%, rgba(255,255,255,.07), transparent 70%), #050506;
  border: 1px solid rgba(255,255,255,.11); border-radius: 18px;
  box-shadow: 0 40px 90px rgba(0,0,0,.85), 0 0 0 1px #000, 0 0 50px rgba(255,255,255,.035); }
#ms-panel.open { display: flex; animation: ms-pop .26s cubic-bezier(.2,.9,.3,1.08) both; }
@keyframes ms-pop { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes ms-slide { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

.ms-head { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--ms-line); }
.ms-logo { width: 36px; height: 36px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: 17px;
  background: rgba(255,255,255,.06);
  box-shadow: 0 0 0 1px rgba(255,255,255,.2), 0 6px 20px rgba(0,0,0,.7), 0 0 24px rgba(255,255,255,.09); }
.ms-titles { flex: 1; min-width: 0; }
.ms-h1 { font-size: 15px; font-weight: 700; letter-spacing: .01em; }
.ms-sub { color: var(--ms-muted); font-size: 12px; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ms-x { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 9px; background: rgba(255,255,255,.05);
  color: #c9ccd6; font-size: 14px; transition: background .15s, color .15s; }
.ms-x:hover { background: rgba(237,66,69,.22); color: #fff; }

.ms-input, #ms-devices { width: 100%; min-width: 0; padding: 9px 14px; color: inherit; font: inherit; font-size: 13px; outline: none;
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.13); border-radius: 999px;
  transition: border-color .15s, box-shadow .15s, background .15s; }
.ms-input::placeholder { color: var(--ms-muted); }
.ms-input:focus, #ms-devices:focus { border-color: var(--ms-accent); background: rgba(255,255,255,.06); box-shadow: 0 0 0 3px rgba(255,255,255,.12); }
.ms-input:disabled { opacity: .5; }
#ms-devices { cursor: pointer; }
#ms-devices option { background: #0d0d10; }
.ms-btn { flex: none; padding: 9px 16px; color: #fff; font-size: 13px; font-weight: 600; letter-spacing: .03em; border-radius: 999px;
  background: rgba(255,255,255,.14) !important; border: 1px solid rgba(255,255,255,.33) !important;
  transition: background .15s, transform .1s, border-color .15s; }
.ms-btn:hover { background: rgba(255,255,255,.22) !important; border-color: rgba(255,255,255,.5) !important; }
.ms-btn:active { transform: scale(.97); }
.ms-btn:disabled { opacity: .45; cursor: default; }
.ms-btn.ghost { background: rgba(255,255,255,.05) !important; border-color: var(--ms-line) !important; color: #c9ccd6; font-weight: 500; }
.ms-btn.ghost:hover { background: rgba(237,66,69,.22) !important; color: #fff; }
.ms-btn.big { width: 100%; height: 46px; font-size: 14.5px; }
.ms-link { color: var(--ms-muted); font-size: 12.5px; padding: 6px 10px; border-radius: 999px; transition: color .15s, background .15s; }
.ms-link:hover { color: #fff; background: rgba(255,255,255,.06); }
.ms-row { display: flex; gap: 8px; padding: 6px 16px; align-items: center; }

#ms-connect { flex: 1; min-height: 0; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
  padding: 24px 32px; text-align: center; animation: ms-slide .25s ease both; }
#ms-connect.show { display: flex; }
#ms-connect .ms-logo { width: 72px; height: 72px; font-size: 30px; margin-bottom: 6px; }
.ms-big { font-size: 20px; font-weight: 700; letter-spacing: .01em; }
.ms-hint { color: var(--ms-muted); font-size: 12.5px; line-height: 1.5; }
.ms-hint b { color: #c9ccd6; font-weight: 600; }
.ms-hint code { background: rgba(255,255,255,.07); border: 1px solid var(--ms-line); padding: 1px 6px; border-radius: 5px; font-size: 11.5px; user-select: text; }
#ms-cidbox { width: 100%; display: none; flex-direction: column; gap: 8px; text-align: left; }
#ms-cidbox.show { display: flex; }
#ms-cstatus { min-height: 18px; font-size: 12.5px; color: var(--ms-muted); }
#ms-cstatus.err { color: #ff7b80; }

#ms-player { flex: 1; min-height: 0; display: none; flex-direction: column; animation: ms-slide .25s ease both; }
#ms-player.show { display: flex; }
#ms-list { flex: 1; overflow-y: auto; margin: 6px 16px; min-height: 0; border: 1px solid var(--ms-line); border-radius: 14px; background: rgba(255,255,255,.022); }
#ms-list:empty::before { content: "Search for a song or artist"; display: block; text-align: center; color: var(--ms-muted); padding: 48px 0; font-size: 13px; }
.ms-item { position: relative; display: flex; gap: 10px; align-items: center; width: 100%; padding: 8px 12px; text-align: left; transition: background .15s; }
.ms-item + .ms-item { border-top: 1px solid var(--ms-line); }
.ms-item:hover { background: rgba(255,255,255,.05); }
.ms-item.now { background: rgba(255,255,255,.1); }
.ms-item.now::before { content: ""; position: absolute; left: 0; top: 10px; bottom: 10px; width: 3px; border-radius: 0 3px 3px 0; background: var(--ms-accent); }
.ms-art { width: 40px; height: 40px; flex: none; border-radius: 8px; background: #0b0c10 center/cover no-repeat; box-shadow: 0 0 0 1px rgba(255,255,255,.08); }
.ms-meta { flex: 1; min-width: 0; }
.ms-t, .ms-a { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ms-t { font-weight: 600; font-size: 13.5px; color: #f1f2f6; }
.ms-a { color: var(--ms-muted); font-size: 12px; }
.ms-d { color: var(--ms-muted); font-size: 12px; flex: none; }
#ms-status { padding: 2px 18px 6px; min-height: 22px; color: var(--ms-muted); font-size: 12px; }
#ms-status.err { color: #ff7b80; }

.ms-np { padding: 12px 16px 14px; border-top: 1px solid var(--ms-line); background: rgba(255,255,255,.022); display: flex; flex-direction: column; gap: 10px; }
.ms-npt { display: flex; gap: 12px; align-items: center; }
.ms-npt .ms-art { width: 52px; height: 52px; border-radius: 10px; }
.ms-bar { display: flex; align-items: center; gap: 8px; color: var(--ms-muted); font-size: 11.5px; }
.ms-bar input[type=range] { flex: 1; }
input[type=range] { accent-color: var(--ms-accent); }
.ms-ctl { display: flex; align-items: center; justify-content: center; gap: 10px; }
.ms-ctl button { width: 36px; height: 36px; border-radius: 50%; font-size: 15px; background: rgba(255,255,255,.07); border: 1px solid var(--ms-line); transition: background .15s, transform .1s; }
.ms-ctl button:hover { background: rgba(255,255,255,.16); }
.ms-ctl button:active { transform: scale(.94); }
.ms-ctl button.main { width: 46px; height: 46px; background: var(--ms-accent); color: #050506; border-color: transparent; font-size: 17px; }
.ms-ctl button.main:hover { background: #fff; }
.ms-vol { display: flex; align-items: center; gap: 6px; margin-left: 6px; color: var(--ms-muted); font-size: 11.5px; }
.ms-vol input { width: 74px; }

#ms-pill { position: fixed; right: 16px; bottom: 16px; z-index: 9998; display: none; align-items: center; gap: 8px; max-width: 290px;
  padding: 5px 6px 5px 5px; border-radius: 999px; background: #050506; color: #f4f4f5;
  border: 1px solid rgba(255,255,255,.13); box-shadow: 0 8px 28px rgba(0,0,0,.6), 0 0 24px rgba(255,255,255,.04);
  font: 12.5px "gg sans","Segoe UI",system-ui,sans-serif; cursor: pointer; }
#ms-pill.show { display: flex; }
#ms-pill .ms-art { width: 30px; height: 30px; border-radius: 50%; }
#ms-pill .ms-t { max-width: 170px; font-weight: 500; font-size: 12.5px; }
#ms-pill button { width: 28px; height: 28px; border-radius: 50%; background: var(--ms-accent); color: #050506; }
.ms-tabs { display: flex; gap: 6px; padding: 6px 16px 0; }
#ms-root .ms-tab { flex: 1; padding: 7px 10px; border-radius: 999px; font-size: 12.5px; font-weight: 600; color: var(--ms-muted);
  background: rgba(255,255,255,.04); border: 1px solid var(--ms-line); transition: background .15s, color .15s, border-color .15s; }
#ms-root .ms-tab:hover { color: #fff; background: rgba(255,255,255,.08); }
#ms-root .ms-tab.on { color: #fff; background: rgba(255,255,255,.14); border-color: rgba(255,255,255,.33); }
.ms-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; padding: 40px 24px; color: var(--ms-muted); font-size: 13px; }
.ms-item.dim { opacity: .5; }
.ms-back .ms-t { color: var(--ms-muted); }
#ms-list::-webkit-scrollbar { width: 8px; }
#ms-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,.16); border-radius: 8px; }
#ms-list::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,.3); }
body.ns-blur #ms-root .ms-art { filter: blur(10px); }
`;

module.exports = class Music {
  start() {
    this.api = window.OPSEC && window.OPSEC.music;
    if (!this.api) {
      BdApi.UI.showToast("Music: bridge missing. Add the preload.js and main.js changes, then restart.", { type: "error", timeout: 6000 });
      return;
    }
    this.st = {};
    this.results = [];
    this.artWanted = new Map();
    this.view = "search";
    this.searchResults = [];
    this.listSrc = "spotify";
    this.playlists = null;
    this.curPl = null;
    this.dragging = false;
    this.editCid = false;
    BdApi.DOM.addStyle(NAME, CSS);
    this.build();
    this.api.onState((st) => this.onState(st));
    this.call("state").then((st) => st && this.onState(st));
    this.keyH = (e) => {
      const K = window.OPSEC_KEYS;
      const hit = K && typeof K.match === "function" ? K.match(e, "musicKey") : (e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey && e.key.toLowerCase() === "m");
      if (hit) { e.preventDefault(); this.toggle(); }
    };
    document.addEventListener("keydown", this.keyH, true);
    this.tickT = setInterval(() => this.tickBar(), 250);
  }

  stop() {
    if (this.keyH) document.removeEventListener("keydown", this.keyH, true);
    clearInterval(this.tickT);
    this.root?.remove();
    BdApi.DOM.removeStyle(NAME);
  }

  async call(name, args) {
    let r;
    try { r = await this.api.call(name, args); } catch (e) { r = { ok: false, error: String(e) }; }
    if (!r || !r.ok) { this.status((r && r.error) || "Something went wrong.", true); return null; }
    return r.data;
  }

  status(msg, isErr) {
    for (const el of [this.statusEl, this.cstatusEl]) {
      if (!el) continue;
      el.textContent = msg || "";
      el.className = isErr ? "err" : "";
    }
  }

  build() {
    const esc = (e) => { e.stopPropagation(); if (e.key === "Escape") this.toggle(false); };

    this.subEl = h("div", { class: "ms-sub" }, "Spotify");
    const head = h("div", { class: "ms-head" },
      h("div", { class: "ms-logo" }, "\u266A"),
      h("div", { class: "ms-titles" }, h("div", { class: "ms-h1" }, "Music"), this.subEl),
      h("button", { class: "ms-x", title: "Close (" + ((window.OPSEC_KEYS && window.OPSEC_KEYS.label("musicKey")) || "Ctrl+Alt+M") + ")", onclick: () => this.toggle(false) }, "\u2715"));

    this.cid = h("input", { class: "ms-input", type: "text", placeholder: "Spotify Client ID", spellcheck: "false",
      onkeydown: (e) => { esc(e); if (e.key === "Enter") this.connect(); } });
    this.cidBox = h("div", { id: "ms-cidbox" },
      this.cid,
      h("div", { class: "ms-hint" },
        h("b", null, "One-time setup: "),
        "create a free app at developer.spotify.com/dashboard, add the Redirect URI ",
        h("code", null, "http://127.0.0.1:8898/callback"),
        ", tick Web API + Web Playback SDK, add your own Spotify account under User Management, then paste its Client ID above."));
    this.connBtn = h("button", { class: "ms-btn big", onclick: () => this.connect() }, "Sign in with Spotify");
    this.cidLink = h("button", { class: "ms-link", onclick: () => { this.editCid = !this.editCid; this.syncView(); } }, "Use a different Client ID");
    this.cstatusEl = h("div", { id: "ms-cstatus" });
    this.connectView = h("div", { id: "ms-connect" },
      h("div", { class: "ms-logo" }, "\u266A"),
      h("div", { class: "ms-big" }, "Connect Spotify"),
      h("div", { class: "ms-hint" }, "Opens Spotify's own sign-in page in your browser. Your password never goes through this app. Playback needs Spotify Premium."),
      this.cidBox, this.connBtn, this.cidLink, this.cstatusEl);

    this.inp = h("input", { class: "ms-input", type: "text", placeholder: "Search songs or artists", spellcheck: "false",
      onkeydown: (e) => { esc(e); if (e.key === "Enter") this.search(); } });
    this.goBtn = h("button", { class: "ms-btn", onclick: () => this.search() }, "Search");
    this.devSel = h("select", { id: "ms-devices", onmousedown: () => this.loadDevices(), onchange: () => this.pickDevice() },
      h("option", { value: "" }, "Devices (click to refresh)"));
    this.searchRow = h("div", { class: "ms-row" }, this.inp, this.goBtn);
    this.tabSearch = h("button", { class: "ms-tab on", onclick: () => this.setView("search") }, "Search");
    this.tabPl = h("button", { class: "ms-tab", onclick: () => this.setView("playlists") }, "Playlists");
    this.tabs = h("div", { class: "ms-tabs" }, this.tabSearch, this.tabPl);
    this.list = h("div", { id: "ms-list" });
    this.statusEl = h("div", { id: "ms-status" });

    this.npArt = h("div", { class: "ms-art" });
    this.npT = h("div", { class: "ms-t" }, "Nothing playing");
    this.npA = h("div", { class: "ms-a" }, "");
    this.seekEl = h("input", { type: "range", min: "0", max: "1000", value: "0",
      oninput: () => { this.dragging = true; this.timeL.textContent = fmt(this.seekEl.value / 1000 * (this.st.dur || 0)); },
      onchange: () => { const sec = this.seekEl.value / 1000 * (this.st.dur || 0); this.dragging = false; this.call("seek", { sec }); } });
    this.timeL = h("span", null, "0:00");
    this.timeR = h("span", null, "0:00");
    this.playBtn = h("button", { class: "main", onclick: () => this.call("toggle") }, GLYPH.play);
    this.volEl = h("input", { type: "range", min: "0", max: "100", value: "70",
      onchange: () => this.call("volume", { v: this.volEl.value / 100 }) });

    this.playerView = h("div", { id: "ms-player" },
      h("div", { class: "ms-row" }, this.devSel, h("button", { class: "ms-btn ghost", onclick: () => this.call("spLogout") }, "Disconnect")),
      this.tabs, this.searchRow,
      this.list, this.statusEl,
      h("div", { class: "ms-np" },
        h("div", { class: "ms-npt" }, this.npArt, h("div", { class: "ms-meta" }, this.npT, this.npA)),
        h("div", { class: "ms-bar" }, this.timeL, this.seekEl, this.timeR),
        h("div", { class: "ms-ctl" },
          h("button", { onclick: () => this.call("prev"), title: "Previous" }, GLYPH.prev),
          this.playBtn,
          h("button", { onclick: () => this.call("next"), title: "Next" }, GLYPH.next),
          h("div", { class: "ms-vol" }, "vol", this.volEl))));

    this.panel = h("div", { id: "ms-panel" }, head, this.connectView, this.playerView);

    this.pArt = h("div", { class: "ms-art" });
    this.pT = h("div", { class: "ms-t" }, "");
    this.pBtn = h("button", { onclick: (e) => { e.stopPropagation(); this.call("toggle"); } }, GLYPH.play);
    this.pill = h("div", { id: "ms-pill", onclick: () => this.toggle(true) }, this.pArt, this.pT, this.pBtn);

    this.root = h("div", { id: "ms-root" }, this.panel, this.pill);
    document.body.append(this.root);
    this.syncView();
  }

  toggle(force) {
    const open = typeof force === "boolean" ? force : !this.panel.classList.contains("open");
    this.panel.classList.toggle("open", open);
    if (open) {
      if (this.st.spotify?.connected) { this.inp.focus(); this.loadDevices(); }
    }
    this.tickBar();
  }

  syncView() {
    const sp = this.st.spotify || {};
    const connected = !!sp.connected;
    if (!connected) this.playlists = null;
    this.connectView.classList.toggle("show", !connected);
    this.playerView.classList.toggle("show", connected);
    const needId = !sp.clientId;
    this.cidBox.classList.toggle("show", needId || this.editCid);
    this.cidLink.style.display = needId ? "none" : "";
    if (!this.cid.value && sp.clientId) this.cid.value = sp.clientId;
    this.subEl.textContent = connected ? (this.st.device ? "Playing on " + this.st.device : "Spotify connected") : "Spotify \u00B7 not connected";
  }

  async connect() {
    this.connBtn.disabled = true;
    this.status("Finish signing in in your browser\u2026");
    const ok = await this.call("spLogin", { clientId: this.cid.value.trim() });
    this.connBtn.disabled = false;
    this.editCid = false;
    if (ok) {
      this.status("");
      this.playlists = null;
      const st = await this.call("state");
      if (st) this.onState(st);
      if (this.view !== "search") this.showPlaylists();
    }
  }

  async loadDevices() {
    const devs = await this.call("spDevices");
    if (!devs) return;
    this.devSel.replaceChildren(h("option", { value: "" }, devs.length ? "Choose a device" : "No devices open"),
      ...devs.map((d) => h("option", { value: d.id, selected: d.selected || (d.active && !devs.some((x) => x.selected)) }, d.name + " (" + d.type + ")")));
  }

  async pickDevice() {
    if (!this.devSel.value) return;
    const ok = await this.call("spTransfer", { id: this.devSel.value });
    if (ok) this.status("Playing on " + this.devSel.selectedOptions[0].textContent + ".");
  }

  async search() {
    const q = this.inp.value.trim();
    if (!q) return;
    this.status("Searching\u2026");
    const res = await this.call("search", { q });
    if (!res) return;
    this.searchResults = res;
    this.results = res;
    this.listSrc = "spotify";
    this.view = "search";
    this.renderList();
    this.status(res.length ? "" : "No results.");
  }

  setView(v) {
    this.status("");
    if (v === "search") {
      this.view = "search";
      this.tabSearch.classList.add("on"); this.tabPl.classList.remove("on");
      this.searchRow.style.display = "";
      this.results = this.searchResults; this.listSrc = "spotify";
      this.renderList();
    } else this.showPlaylists();
  }

  async showPlaylists(force) {
    this.view = "playlists";
    this.tabSearch.classList.remove("on"); this.tabPl.classList.add("on");
    this.searchRow.style.display = "none";
    this.status("");
    const sp = this.st.spotify || {};
    if (!sp.canPlaylists) {
      this.list.replaceChildren(h("div", { class: "ms-empty" },
        "To show your playlists, Spotify needs your permission to read them.",
        h("button", { class: "ms-btn", onclick: () => this.connect() }, "Allow playlist access")));
      return;
    }
    if (!this.playlists || force) {
      this.list.replaceChildren(h("div", { class: "ms-empty" }, "Loading your playlists…"));
      const res = await this.call("playlists");
      if (this.view !== "playlists") return;
      if (!res) {
        this.list.replaceChildren(h("div", { class: "ms-empty" }, "Couldn't load your playlists.",
          h("button", { class: "ms-btn ghost", onclick: () => this.showPlaylists(true) }, "Try again")));
        return;
      }
      this.playlists = res;
    }
    this.renderPlaylists();
  }

  renderPlaylists() {
    if (!this.playlists.length) { this.list.replaceChildren(h("div", { class: "ms-empty" }, "No playlists found on your account.")); return; }
    this.list.replaceChildren(...this.playlists.map((p) => {
      const art = h("div", { class: "ms-art" });
      this.setArt(art, p.art);
      const sub = (p.owner ? p.owner : "") + (p.count != null ? (p.owner ? " · " : "") + p.count + " tracks" : "");
      return h("button", { class: "ms-item" + (p.own ? "" : " dim"), title: p.own ? "" : "Spotify only lets this app open playlists you own or collaborate on",
        onclick: () => (p.own ? this.openPlaylist(p) : this.status("Spotify only lets this app open playlists you own or collaborate on.", true)) },
        art, h("div", { class: "ms-meta" }, h("div", { class: "ms-t" }, p.name), h("div", { class: "ms-a" }, sub)),
        h("div", { class: "ms-d" }, "›"));
    }));
  }

  async openPlaylist(p) {
    this.status("Loading " + p.name + "…");
    const res = await this.call("playlistTracks", { id: p.id });
    if (!res || this.view !== "playlists") return;
    this.curPl = p;
    this.results = res;
    this.listSrc = "playlist";
    this.view = "tracks";
    this.renderList();
    this.status(res.length ? "" : "No playable tracks in this playlist.");
  }

  backRow() {
    if (this.view !== "tracks") return [];
    return [h("button", { class: "ms-item ms-back", onclick: () => this.showPlaylists() },
      h("div", { class: "ms-meta" },
        h("div", { class: "ms-t" }, "‹ " + (this.curPl ? this.curPl.name : "Playlists")),
        h("div", { class: "ms-a" }, "Back to your playlists")))];
  }

  renderList() {
    this.list.replaceChildren(...this.backRow(), ...this.results.map((t, i) => {
      const art = h("div", { class: "ms-art" });
      this.setArt(art, t.art);
      return h("button", { class: "ms-item", "data-i": String(i), onclick: () => this.call("play", { index: i, src: this.listSrc }) },
        art, h("div", { class: "ms-meta" }, h("div", { class: "ms-t" }, t.title), h("div", { class: "ms-a" }, t.artist + (t.album ? " \u00B7 " + t.album : ""))),
        h("div", { class: "ms-d" }, fmt(t.dur)));
    }));
    this.markNow();
  }

  markNow() {
    const cur = this.st.track;
    for (const el of this.list.children) {
      const t = this.results[Number(el.dataset.i)];
      el.classList.toggle("now", !!(cur && t && t.title === cur.title && t.artist === cur.artist));
    }
  }

  setArt(el, url) {
    el.style.backgroundImage = "";
    if (!url) return;
    if (!this.artWanted.has(url)) this.artWanted.set(url, this.call("art", { url }));
    this.artWanted.get(url).then((data) => { if (data && el.isConnected !== false) el.style.backgroundImage = `url("${data}")`; });
  }

  onState(st) {
    const prevArt = this.st.track && this.st.track.art;
    this.st = st;
    const t = st.track;
    this.npT.textContent = t ? t.title : "Nothing playing";
    this.npA.textContent = t ? t.artist : "";
    this.pT.textContent = t ? t.title + " \u2013 " + t.artist : "";
    if (t && t.art !== prevArt) { this.setArt(this.npArt, t.art); this.setArt(this.pArt, t.art); }
    if (!t) { this.npArt.style.backgroundImage = ""; this.pArt.style.backgroundImage = ""; }
    this.playBtn.textContent = this.pBtn.textContent = st.playing ? GLYPH.pause : GLYPH.play;
    if (document.activeElement !== this.volEl) this.volEl.value = Math.round((st.volume || 0) * 100);
    this.syncView();
    this.markNow();
    if (st.spotify?.connected) {
      if (st.engine && st.engine.error) this.status(st.engine.error, true);
      else if (!st.spotify.canStream) this.status("Disconnect and sign in again to play inside OpsexCord.");
    }
    this.tickBar();
  }

  tickBar() {
    if (!this.st) return;
    const st = this.st;
    this.pill.classList.toggle("show", !!st.track && !this.panel.classList.contains("open"));
    if (this.dragging || !st.ts) return;
    const dur = st.dur || 0;
    const pos = Math.min(dur, (st.pos || 0) + (st.playing ? (Date.now() - st.ts) / 1000 : 0));
    this.seekEl.value = dur ? Math.round((pos / dur) * 1000) : 0;
    this.timeL.textContent = fmt(pos);
    this.timeR.textContent = fmt(dur);
  }
};