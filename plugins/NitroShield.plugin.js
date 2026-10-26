/**
 * @name OpsexCord
 * @author @geofeed on discord
 */

const NAME = "NitroShield";
const HOVER_SEL = '[data-list-item-id]:hover,[class*="peopleListItem"]:hover,[class*="interactive"]:hover,[class*="nowPlayingColumn"] [class*="card"]:hover';

const KEYBIND_DEFAULTS = {
  panicKey: "Control+Alt+P",
  blurKey: "Control+Alt+B",
  centerKey: "Control+Alt+K",
  lockKey: "Control+Alt+L",
  linkKey: "Control+Alt+C",
  musicKey: "Control+Alt+M",
  recKey: "Control+Alt+R",
  fxToggle: "Control+Alt+E",
  fxTetris: "Control+Alt+T"
};
const KEYBIND_MAIN = ["panicKey", "lockKey", "linkKey"];
const KEYBIND_LABELS = {
  panicKey: "Panic (hide + mute + blur)",
  blurKey: "Toggle blur mode",
  centerKey: "Open Control Center",
  lockKey: "PIN lock manager",
  linkKey: "Check link on clipboard",
  musicKey: "Music player",
  recKey: "Recorder (open / stop recording)",
  fxToggle: "Ambience: effects on / off",
  fxTetris: "Ambience: Tetris"
};
const ACCEL_MODS = ["control", "ctrl", "alt", "option", "shift", "super", "meta", "cmd", "command", "commandorcontrol", "cmdorctrl"];
const ACCEL_NAMED = ["space", "enter", "return", "tab", "escape", "esc", "up", "down", "left", "right", "backspace", "delete", "del", "insert", "ins", "home", "end", "pageup", "pagedown", "plus"];
function accelValid(a) {
  if (typeof a !== "string") return false;
  const parts = a.split("+").map((x) => x.trim()).filter(Boolean);
  if (parts.length < 1 || parts.length > 5) return false;
  const key = parts.pop().toLowerCase();
  if (!parts.every((m) => ACCEL_MODS.includes(m.toLowerCase()))) return false;
  const isF = /^f([1-9]|1\d|2[0-4])$/.test(key);
  if (!isF && !parts.length) return false;
  return isF || /^[a-z0-9]$/.test(key) || ACCEL_NAMED.includes(key);
}
const accelNorm = (a) => {
  const parts = String(a).split("+").map((x) => x.trim()).filter(Boolean);
  const key = (parts.pop() || "").toLowerCase();
  const mods = parts.map((m) => { m = m.toLowerCase(); return m === "ctrl" ? "control" : m === "option" ? "alt" : m === "cmd" || m === "command" ? "meta" : m; }).sort();
  return mods.concat(key).join("+");
};
function accelMatchEvent(e, accel) {
  if (!accelValid(accel)) return false;
  const parts = accel.split("+").map((x) => x.trim()).filter(Boolean);
  let key = parts.pop().toLowerCase();
  key = { space: " ", esc: "escape", up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright", plus: "+", return: "enter", del: "delete", ins: "insert" }[key] || key;
  const m = new Set(parts.map((x) => x.toLowerCase()));
  const wantCtrl = m.has("control") || m.has("ctrl") || m.has("commandorcontrol") || m.has("cmdorctrl");
  const wantAlt = m.has("alt") || m.has("option");
  const wantShift = m.has("shift");
  const wantMeta = m.has("meta") || m.has("super") || m.has("cmd") || m.has("command");
  if (!!e.ctrlKey !== wantCtrl || !!e.altKey !== wantAlt || !!e.shiftKey !== wantShift || !!e.metaKey !== wantMeta) return false;
  if (String(e.key || "").toLowerCase() === key) return true;
  return key.length === 1 && (e.code === "Key" + key.toUpperCase() || e.code === "Digit" + key);
}

const DEFAULTS = {
  ...KEYBIND_DEFAULTS,
  fakePremium: true,
  emojiLinks: true,
  splitLongMessages: true,
  hideUpsells: true,
  bigUploads: true,
  maxNativeMB: 10,
  uploadHost: "litterbox",
  litterboxTime: "72h",
  avatarUrl: "",
  backgroundUrl: "",
  bgFit: "fit",
  bgSharp: true,
  bgSmooth: 35,
  bgSharpen: 20,
  panelDark: 0,
  readOutline: true,
  readOutlineAmt: 60,
  readGlow: true,
  readGlowAmt: 30,
  badgesEnabled: true,
  badgePresets: { nitro: true },
  badges: "",

  textColorOn: false,
  textColor: "#ffffff",
  textColorTarget: "all",
  textColorDim: true,

  blockTelemetry: true,
  hideTyping: true,
  stripLinkTrackers: true,
  stripExif: true,
  randomizeFilenames: true,
  blurMode: false,
  hideParts: {},
  blockReadAck: false,
  redactNotifications: false,

  panicEnabled: true,
  panicMute: true,
  panicHide: true,
  panicQuit: false,
  autoBlurUnfocus: false,
  autoBlurIdleMin: 0,
  autoBlurShare: true,
  contentProtection: false,
  watchdog: false,
  watchdogMB: 1500,

  logDeleted: true,
  logEdits: true,
  ignoreSelf: true,
  ignoreBots: false,
  ghostPingAlerts: true,
  persistLog: false,
  maxLogEntries: 300
};

const BADGE_CDN = "https://cdn.discordapp.com/badge-icons/";
const PRESET_BADGES = [
  { key: "nitro", name: "Nitro", hash: "2ba85e8026a8614b640c2837bcdfe21b" },
  { key: "bravery", name: "HypeSquad Bravery", hash: "8a88d63823d8a71cd5e390baa45efa02" },
  { key: "brilliance", name: "HypeSquad Brilliance", hash: "011940fd013da3f7fb926e4a1cd2e618" },
  { key: "balance", name: "HypeSquad Balance", hash: "3aa41de486fa12454c3761e8e223442e" },
  { key: "events", name: "HypeSquad Events", hash: "bf01d1073931f921909045f3a39fd264" },
  { key: "bughunter", name: "Bug Hunter", hash: "2717692c7dca7289b35297368a940dd0" },
  { key: "bughuntergold", name: "Bug Hunter Gold", hash: "848f79194d4be5ff5f81505cbd0ce1e6" },
  { key: "earlysupporter", name: "Early Supporter", hash: "7060786766c9c840eb3019e725d2b358" },
  { key: "botdev", name: "Early Verified Bot Developer", hash: "6df5892e0f35b051f8b61eace34f4967" },
  { key: "modalumni", name: "Moderator Programs Alumni", hash: "fee1624003e2fee35cb398e125dc479b" },
  { key: "activedev", name: "Active Developer", hash: "6bdc42827a38498929a4920da12695d9" },
  { key: "partner", name: "Partner", hash: "3f9748e53446a137a052f3454e2de41e" },
  { key: "staff", name: "Discord Staff", hash: "5e74e9b61934fc1f67c65515d1f7e60d" }
];

const TELEMETRY = [/\/api\/v\d+\/science/i, /\/api\/v\d+\/track/i, /sentry\.io/i];

const TRACKING_PARAMS = [
  /^utm_/i, /^fbclid$/i, /^gclid$/i, /^dclid$/i, /^msclkid$/i, /^igshid$/i, /^igsh$/i,
  /^mc_eid$/i, /^mc_cid$/i, /^_hsenc$/i, /^_hsmi$/i, /^ref_src$/i, /^ref_url$/i, /^yclid$/i, /^twclid$/i
];
const SI_HOSTS = /(^|\.)(youtube\.com|youtu\.be|spotify\.com)$/i;
const IMG_TYPES = /^image\/(jpeg|png|webp)$/;

const VIEW_CHANNEL = 1n << 10n;

const CHANNEL_TYPES = {
  0: "Text", 2: "Voice", 4: "Category", 5: "Announcement", 13: "Stage", 14: "Directory", 15: "Forum", 16: "Media"
};

const USER_FLAGS = [
  [1 << 0, "Discord Staff"], [1 << 1, "Partner"], [1 << 2, "HypeSquad Events"], [1 << 3, "Bug Hunter 1"],
  [1 << 6, "HypeSquad Bravery"], [1 << 7, "HypeSquad Brilliance"], [1 << 8, "HypeSquad Balance"],
  [1 << 9, "Early Supporter"], [1 << 10, "Team User"], [1 << 14, "Bug Hunter 2"], [1 << 16, "Verified Bot"],
  [1 << 17, "Early Verified Bot Dev"], [1 << 18, "Certified Moderator"], [1 << 19, "Bot (HTTP interactions)"],
  [1 << 22, "Active Developer"]
];

const h = (tag, attrs, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === "style") e.style.cssText = v;
    else if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
};

const HIDE_PARTS = [
  { key: "profilePanel", name: "DM profile sidebar", note: "The profile card on the right in DMs (banner, member since, wishlist).",
    sel: '[data-ns-panel],[class*="profilePanel"],[class*="userPanelOuter"]' },
  { key: "memberList", name: "Server member list", note: "The member list on the right in servers.",
    sel: '[class*="membersWrap"]' },
  { key: "activeNow", name: "Active Now column", note: "The Active Now / activity column on the Friends page.",
    sel: '[class*="nowPlayingColumn"]' },

  { key: "topBanner", name: "Top banner (\"Get the desktop app\")", note: "The green notice bar at the very top.",
    sel: '[class*="noticeRegion"],div[class*="notice_"]' },
  { key: "questPromo", name: "Quest / reward promo above your account", note: "The \"Get Reward!\" card at the bottom left.",
    sel: '[data-ns-quest]' },
  { key: "dmNitro", name: "Nitro Home (DM list)", sel: 'li:has([data-list-item-id^="private-channels"][data-list-item-id*="nitro"]),[data-list-item-id^="private-channels"][data-list-item-id*="nitro"]' },
  { key: "dmShop", name: "Shop (DM list)", sel: 'li:has([data-list-item-id^="private-channels"][data-list-item-id*="shop"]),[data-list-item-id^="private-channels"][data-list-item-id*="shop"]' },
  { key: "dmQuests", name: "Quests (DM list)", sel: 'li:has([data-list-item-id^="private-channels"][data-list-item-id*="quests"]),[data-list-item-id^="private-channels"][data-list-item-id*="quests"]' },
  { key: "dmLibrary", name: "Library (DM list)", sel: 'li:has([data-list-item-id^="private-channels"][data-list-item-id*="library"]),[data-list-item-id^="private-channels"][data-list-item-id*="library"]' },

  { key: "btnGif", name: "GIF button", note: "In the message box.",
    sel: '[class*="buttonContainer"]:has([aria-label="Open GIF picker"]),[aria-label="Open GIF picker"]' },
  { key: "btnSticker", name: "Sticker button", sel: '[class*="buttonContainer"]:has([aria-label="Open sticker picker"]),[aria-label="Open sticker picker"]' },
  { key: "btnEmoji", name: "Emoji button", sel: '[class*="buttonContainer"]:has([aria-label="Select emoji"]),[aria-label="Select emoji"]' },
  { key: "btnGift", name: "Gift button", sel: '[class*="buttonContainer"]:has([aria-label="Send a gift"]),[aria-label="Send a gift"]' },
  { key: "btnApps", name: "Apps button", sel: '[class*="buttonContainer"]:has([aria-label="Apps"]),[aria-label="Apps"]' },

  { key: "headerSearch", name: "Search bar", note: "The search box in the top right of the chat.",
    sel: '[class*="toolbar_"] [class*="search"],[class*="searchBar"]' },
  { key: "headerCalls", name: "Call / video buttons", note: "Voice call, video call, pins and add-friend icons in the chat header.",
    sel: '[aria-label="Start Voice Call"],[aria-label="Start Video Call"],[aria-label="Pinned Messages"],[aria-label="Add Friends to DM"]' },
  { key: "inboxHelp", name: "Inbox and Help icons", note: "Top-right corner of the window.",
    sel: '[aria-label="Inbox"],[aria-label="Help"]' },
  { key: "serverAdd", name: "Add server and Discover buttons", sel: '[class*="listItem"]:has([data-list-item-id="guildsnav___create-join-button"]),[class*="listItem"]:has([data-list-item-id="guildsnav___guild-discover-button"])' },
  { key: "serverList", name: "Whole server list (far left)", note: "You can still switch servers with Ctrl+K.",
    sel: 'nav[aria-label="Servers sidebar"]' },

  { key: "waveStuff", name: "Wave buttons and welcome sticker", note: "The Wave button in the DM list and the \"Wave to ...\" sticker in new chats.",
    sel: '[class*="waveButton"],[class*="welcomeSticker"],[class*="greetButton" i]' }
];

const HIDE_CATEGORY = (s) => ({
  type: "category", id: "hideUi", name: "Hide parts of Discord",
  settings: HIDE_PARTS.map((p) => ({
    type: "switch", id: `hide_${p.key}`, name: p.name, note: p.note, value: !!s.hideParts?.[p.key]
  }))
});

const snowflakeDate = (id) => {
  try { return new Date(Number((BigInt(id) >> 22n) + 1420070400000n)); } catch { return null; }
};
const fmtDate = (d) => (d ? d.toLocaleString() : "unknown");
const imgExt = (hash) => (hash.startsWith("a_") ? "gif" : "png");

const migrateBg = (st) => {
  if (!st.bgV3) {
    if (st.bgSmooth === 70) st.bgSmooth = DEFAULTS.bgSmooth;
    if ([30, 50, 60].includes(st.bgSharpen)) st.bgSharpen = DEFAULTS.bgSharpen;
    delete st.bgClean; delete st.bgBlend;
    st.bgV2 = true; st.bgV3 = true;
  }
  return st;
};

const BG_VERT = "#version 300 es\nin vec2 p;out vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}";
const BG_FRAG = `#version 300 es
precision highp float;
in vec2 v; out vec4 o;
uniform sampler2D t;
uniform vec2 tex;
uniform vec2 outSz;
uniform float sharp;
uniform float smoothing;
uniform float fitMode;
uniform vec3 base;

float bc(float x, float B) {
  float C = (1. - B) * .5;
  x = abs(x);
  if (x < 1.) return ((12. - 9. * B - 6. * C) * x * x * x + (-18. + 12. * B + 6. * C) * x * x + (6. - 2. * B)) / 6.;
  if (x < 2.) return ((-B - 6. * C) * x * x * x + (6. * B + 30. * C) * x * x + (-12. * B - 48. * C) * x + (8. * B + 24. * C)) / 6.;
  return 0.;
}
vec2 bc2(vec2 x, float B) { return vec2(bc(x.x, B), bc(x.y, B)); }

vec4 cr(vec2 uv, float B) {
  vec2 sp = uv * tex;
  vec2 t1 = floor(sp - .5) + .5;
  vec2 f = sp - t1;
  vec2 w0 = bc2(1. + f, B);
  vec2 w1 = bc2(f, B);
  vec2 w2 = bc2(1. - f, B);
  vec2 w3 = bc2(2. - f, B);
  vec2 w12 = w1 + w2;
  vec2 o12 = w2 / w12;
  vec2 t0 = (t1 - 1.) / tex, t3 = (t1 + 2.) / tex, t12 = (t1 + o12) / tex;
  vec4 r = vec4(0.);
  r += texture(t, vec2(t0.x, t0.y)) * w0.x * w0.y;
  r += texture(t, vec2(t12.x, t0.y)) * w12.x * w0.y;
  r += texture(t, vec2(t3.x, t0.y)) * w3.x * w0.y;
  r += texture(t, vec2(t0.x, t12.y)) * w0.x * w12.y;
  r += texture(t, vec2(t12.x, t12.y)) * w12.x * w12.y;
  r += texture(t, vec2(t3.x, t12.y)) * w3.x * w12.y;
  r += texture(t, vec2(t0.x, t3.y)) * w0.x * w3.y;
  r += texture(t, vec2(t12.x, t3.y)) * w12.x * w3.y;
  r += texture(t, vec2(t3.x, t3.y)) * w3.x * w3.y;
  return clamp(r, 0., 1.);
}
float luma(vec3 c) { return dot(c, vec3(.299, .587, .114)); }

void main() {
  float sCover = max(outSz.x / tex.x, outSz.y / tex.y);
  float sFit = min(outSz.x / tex.x, outSz.y / tex.y);
  bool fit = fitMode > .5 && fitMode < 1.5;
  float s = fit ? sFit : sCover;
  vec2 pos = (v * outSz - .5 * outSz) / s + .5 * tex;
  if (fitMode > 1.5) pos = v * tex;
  vec2 uv = vec2(pos.x / tex.x, 1. - pos.y / tex.y);
  bool outside = fit && (pos.x < 0. || pos.y < 0. || pos.x > tex.x || pos.y > tex.y);

  vec2 p2 = (v * outSz - .5 * outSz) / sCover + .5 * tex;
  vec3 backdrop = textureLod(t, vec2(p2.x / tex.x, 1. - p2.y / tex.y), max(0., log2(max(tex.x, tex.y)) - 3.)).rgb * .45;

  float B = smoothing * clamp(s, 0., 1.);
  vec4 c = cr(uv, B);
  vec3 rgb = c.rgb;
  if (sharp > 0. && s > 1.) {
    vec2 px = 1. / (s * tex);
    float r = clamp(s * .45, .8, 2.2);
    vec3 n1 = texture(t, uv + vec2(r, 0.) * px).rgb;
    vec3 n2 = texture(t, uv - vec2(r, 0.) * px).rgb;
    vec3 n3 = texture(t, uv + vec2(0., r) * px).rgb;
    vec3 n4 = texture(t, uv - vec2(0., r) * px).rgb;
    vec3 b = (n1 + n2 + n3 + n4) * .25;
    vec3 d = rgb - b;
    float e = smoothstep(.012, .07, abs(luma(d)));
    vec3 sharpened = rgb + d * sharp * (.3 + .7 * e);
    vec3 lo = min(rgb, min(min(n1, n2), min(n3, n4)));
    vec3 hi = max(rgb, max(max(n1, n2), max(n3, n4)));
    rgb = clamp(sharpened, lo, hi);
  }
  o = vec4(outside ? backdrop : mix(base, rgb, c.a), 1.);
}`;

class SharpBackground {
  static supported() {
    return !!(window.ImageDecoder && window.WebGL2RenderingContext && window.createImageBitmap);
  }

  constructor(opts) {
    this.sharp = opts.sharp;
    this.smooth = opts.smooth == null ? 0.35 : opts.smooth;
    this.fit = opts.fit == null ? 1 : opts.fit;
    this.onFail = opts.onFail || (() => {});
    this.dead = false;
    this.dirty = true;
    this.cur = null;
    this.bitmaps = [];
    this.dec = null;
    this.raf = 0;
    this.w = this.h = 0;
  }

  setSharp(v) { if (v !== this.sharp) { this.sharp = v; this.dirty = true; } }
  setSmooth(v) { if (v !== this.smooth) { this.smooth = v; this.dirty = true; } }
  setFit(v) { if (v !== this.fit) { this.fit = v; this.dirty = true; } }

  static sniff(buf, fallback) {
    const b = new Uint8Array(buf, 0, Math.min(12, buf.byteLength));
    const s = String.fromCharCode(...b);
    if (s.startsWith("GIF8")) return "image/gif";
    if (b[0] === 0x89 && s.slice(1, 4) === "PNG") return "image/png";
    if (s.startsWith("RIFF") && s.slice(8, 12) === "WEBP") return "image/webp";
    if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
    return fallback || "";
  }

  async start(blob) {
    const buf = await blob.arrayBuffer();
    const type = SharpBackground.sniff(buf, blob.type);
    if (!type || !(await ImageDecoder.isTypeSupported(type))) throw new Error("image type not supported: " + type);

    const canvas = (this.canvas = document.createElement("canvas"));
    canvas.id = "ns-bg-canvas";
    canvas.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;";
    const gl = (this.gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false }));
    if (!gl) throw new Error("WebGL2 not available");
    const sh = (kind, src) => {
      const o = gl.createShader(kind); gl.shaderSource(o, src); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error("shader: " + gl.getShaderInfoLog(o));
      return o;
    };
    const prog = (this.prog = gl.createProgram());
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, BG_VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, BG_FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link: " + gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf2 = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf2);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    for (const n of ["t", "tex", "outSz", "sharp", "smoothing", "fitMode", "base"]) this.u[n] = gl.getUniformLocation(prog, n);
    gl.uniform1i(this.u.t, 0);
    gl.uniform3f(this.u.base, 5 / 255, 6 / 255, 10 / 255);

    const dec = (this.dec = new ImageDecoder({ data: buf, type }));
    await dec.tracks.ready;
    await dec.completed;
    const track = dec.tracks.selectedTrack;
    const n = track ? track.frameCount : 1;
    const first = await dec.decode({ frameIndex: 0 });
    this.w = first.image.displayWidth; this.h = first.image.displayHeight;
    if (this.w > gl.getParameter(gl.MAX_TEXTURE_SIZE) || this.h > gl.getParameter(gl.MAX_TEXTURE_SIZE)) { first.image.close(); throw new Error("image too large for this GPU"); }

    const levels = Math.floor(Math.log2(Math.max(this.w, this.h))) + 1;
    this.tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texStorage2D(gl.TEXTURE_2D, levels, gl.RGBA8, this.w, this.h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform2f(this.u.tex, this.w, this.h);

    this.upload(first.image);
    const firstDur = first.image.duration;
    first.image.close?.();
    this.size();

    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.fail(new Error("WebGL context lost")); });
    this.onResize = () => { this.size(); this.dirty = true; };
    window.addEventListener("resize", this.onResize);
    document.body.prepend(canvas);
    this.draw();
    this.loop();

    if (n > 1) this.animate(dec, n, firstDur);
    else { dec.close(); this.dec = null; }
  }

  upload(src) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  size() {
    const dpr = window.devicePixelRatio || 1;
    let w = Math.max(1, Math.round(window.innerWidth * dpr)), h = Math.max(1, Math.round(window.innerHeight * dpr));
    const k = Math.min(1, 4096 / w, 4096 / h);
    w = Math.round(w * k); h = Math.round(h * k);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }

  draw() {
    const gl = this.gl;
    if (!gl || this.dead || gl.isContextLost()) return;
    if (this.cur) { this.upload(this.cur); this.cur = null; }
    if (!this.canvas.isConnected) document.body.prepend(this.canvas);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.u.outSz, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u.sharp, this.sharp);
    gl.uniform1f(this.u.smoothing, this.smooth);
    gl.uniform1f(this.u.fitMode, this.fit);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.dirty = false;
  }

  loop() {
    const tick = () => {
      if (this.dead) return;
      if (this.dirty && !document.hidden) { try { this.draw(); } catch (e) { return this.fail(e); } }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  frameMs(d) { const ms = (d || 0) / 1000; return ms < 20 ? 100 : ms; }

  async animate(dec, n, firstDur) {
    const keep = this.w * this.h * 4 * n <= 192 * 1024 * 1024;
    const durs = [this.frameMs(firstDur)];
    try {
      if (keep) {
        this.bitmaps[0] = await createImageBitmap((await dec.decode({ frameIndex: 0 })).image);
        let decoded = 1, done = false;
        (async () => {
          try {
            for (let i = 1; i < n && !this.dead; i++) {
              const { image } = await dec.decode({ frameIndex: i });
              durs[i] = this.frameMs(image.duration);
              this.bitmaps[i] = await createImageBitmap(image);
              image.close();
              decoded = i + 1;
            }
          } catch (e) { }
          done = true;
        })();
        while (!this.dead) {
          for (let i = 0; i < Math.max(1, decoded) && !this.dead; i++) {
            if (document.hidden) { await new Promise((r) => document.addEventListener("visibilitychange", r, { once: true })); }
            if (this.bitmaps[i]) { this.cur = this.bitmaps[i]; this.dirty = true; }
            await this.sleep(durs[i] || 100);
            if (i === decoded - 1 && !done) { await this.sleep(20); i--; }
          }
        }
      } else {
        while (!this.dead) {
          for (let i = 0; i < n && !this.dead; i++) {
            const t0 = performance.now();
            const { image } = await dec.decode({ frameIndex: i });
            if (document.hidden) { await new Promise((r) => document.addEventListener("visibilitychange", r, { once: true })); }
            if (this.cur && this.cur.close) this.cur.close();
            this.cur = image; this.dirty = true;
            await this.sleep(Math.max(0, this.frameMs(image.duration) - (performance.now() - t0)));
          }
        }
      }
    } catch (e) { if (!this.dead) this.fail(e); }
  }

  fail(e) { if (this.dead) return; console.warn("[NitroShield] sharp background stopped:", e); const f = this.onFail; this.dispose(); f(e); }

  dispose() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    if (this.onResize) window.removeEventListener("resize", this.onResize);
    for (const b of this.bitmaps) { try { b && b.close(); } catch {} }
    this.bitmaps = [];
    try { this.cur && this.cur.close && this.cur.close(); } catch {}
    try { this.dec && this.dec.close(); } catch {}
    try { this.gl && this.gl.getExtension("WEBGL_lose_context")?.loseContext(); } catch {}
    this.canvas?.remove();
  }
}

module.exports = class NitroShield {
  constructor() {
    this.s = migrateBg(Object.assign({}, DEFAULTS, BdApi.Data.load(NAME, "settings")));
    Object.assign(this.s, KEYBIND_DEFAULTS);
    this.localUrls = {};
    this.listeners = [];
    this.observer = null;
    this.rafPending = false;
    this.log = [];
    this.deletedIds = new Set();
    this.overlay = null;
    this.timers = {};
    this.autoBlur = new Set();
    this.sharing = false;
    this.privacyCleanup = [];
  }

  static early() {
    const tmp = Object.create(NitroShield.prototype);
    tmp.s = migrateBg(Object.assign({}, DEFAULTS, BdApi.Data.load(NAME, "settings")));
    tmp.localUrls = {};
    tmp.timers = {};
    tmp.UserStore = { getCurrentUser: () => null };
    NitroShield.__early = tmp;
    tmp.applyCss();
    tmp.applyTextColor();
    tmp.startTagObserver();
    tmp.refreshLocal().then(() => { if (NitroShield.__early === tmp) tmp.applyCss(); });
  }

  save() { BdApi.Data.save(NAME, "settings", this.s); }
  toast(msg, type = "info") { BdApi.UI.showToast(`${NAME}: ${msg}`, { type }); }

  start() {
    const W = BdApi.Webpack;
    const early = NitroShield.__early;
    if (early) {
      early.tagObs?.disconnect();
      early.clearObs?.disconnect();
      if (early.clearSoon) window.removeEventListener("resize", early.clearSoon);
      Object.values(early.timers).forEach(clearTimeout);
      this.localUrls = { ...early.localUrls };
      this.bgLuma = early.bgLuma;
      this.bgLumaSig = early.bgLumaSig;
      NitroShield.__early = null;
    }
    this.UserStore = W.getStore("UserStore");
    this.EmojiStore = W.getStore("EmojiStore");
    this.SelectedGuildStore = W.getStore("SelectedGuildStore");
    this.SelectedChannelStore = W.getStore("SelectedChannelStore");
    this.MessageStore = W.getStore("MessageStore");
    this.ChannelStore = W.getStore("ChannelStore");
    this.GuildStore = W.getStore("GuildStore");
    this.GuildMemberStore = W.getStore("GuildMemberStore");
    this.PermissionStore = W.getStore("PermissionStore");
    this.VoiceStateStore = W.getStore("VoiceStateStore");
    this.UserProfileStore = W.getStore("UserProfileStore");
    this.MessageActions = W.getByKeys("sendMessage", "receiveMessage");
    this.Typing = W.getByKeys("startTyping", "stopTyping");
    this.Dispatcher = W.getByKeys("dispatch", "subscribe", "unsubscribe");
    this.UserFetch = W.getByKeys("getUser", "fetchCurrentUser");
    this.ProfileFetch = W.getByKeys("fetchProfile");

    if (this.s.persistLog) this.log = BdApi.Data.load(NAME, "log") || [];

    const run = (name, fn) => { try { fn(); } catch (e) { console.error(NAME, `${name} failed, continuing without it:`, e); } };
    run("patchPremium", () => this.patchPremium());
    run("patchTyping", () => this.patchTyping());
    run("patchNetwork", () => this.patchNetwork());
    run("patchSend", () => this.patchSend());
    run("patchFileInputs", () => this.patchFileInputs());
    run("patchDispatcher", () => this.patchDispatcher());
    run("applyCss", () => this.applyCss());
    run("applyTextColor", () => this.applyTextColor());
    run("refreshLocal", () => this.refreshLocal().then(() => this.applyCss()).catch((e) => console.error(NAME, e)));
    run("deletedMessages", () => { for (const e of this.log) if (e.type === "delete" && e.raw) this.deletedIds.add(e.id); this.scheduleDeletedCss(); });
    run("startBadgeObserver", () => this.startBadgeObserver());
    run("startTagObserver", () => this.startTagObserver());
    run("startHoverCheck", () => this.startHoverCheck());
    run("addHotkeys", () => this.addHotkeys());
    run("patchNotifications", () => this.patchNotifications());
    run("startPrivacy", () => this.startPrivacy());
    run("patchVolumeMenu", () => this.patchVolumeMenu());
  }

  stop() {
    try { delete window.OPSEC_KEYS; } catch { window.OPSEC_KEYS = undefined; }
    this.unpatchVolumeMenu();
    BdApi.Patcher.unpatchAll(NAME);
    BdApi.DOM.removeStyle(NAME);
    BdApi.DOM.removeStyle(`${NAME}-deleted`);
    BdApi.DOM.removeStyle(`${NAME}-textcolor`);
    document.body.classList.remove("ns-blur", "ns-bg-on", "ns-bg-canvas");
    if (NitroShield.__bg) { NitroShield.__bg.token++; NitroShield.__bg.r?.dispose(); NitroShield.__bg = null; }
    for (const [type, fn] of this.listeners) document.removeEventListener(type, fn, true);
    this.listeners = [];
    this.observer?.disconnect();
    this.observer = null;
    this.tagObs?.disconnect();
    this.tagObs = null;
    this.clearObs?.disconnect();
    this.clearObs = null;
    if (this.clearSoon) window.removeEventListener("resize", this.clearSoon);
    document.querySelectorAll("[data-ns-clear]").forEach((e) => e.removeAttribute("data-ns-clear"));
    document.querySelectorAll("[data-ns-flat]").forEach((e) => e.removeAttribute("data-ns-flat"));
    document.querySelectorAll("[data-ns-quest]").forEach((e) => e.removeAttribute("data-ns-quest"));
    document.querySelectorAll("[data-ns-noshadow]").forEach((e) => e.removeAttribute("data-ns-noshadow"));
    document.querySelectorAll("[data-ns-panel],[data-ns-mask]").forEach((e) => { e.removeAttribute("data-ns-panel"); e.removeAttribute("data-ns-mask"); });
    this.stopPrivacy();
    this.closeCenter();
    Object.values(this.timers).forEach(clearTimeout);
    this.timers = {};
    this.removeBadges();
  }

  patchPremium() {
    BdApi.Patcher.after(NAME, this.UserStore, "getCurrentUser", (_, __, user) => {
      if (user && this.s.fakePremium) user.premiumType = 2;
    });
  }

  raiseMax(el, depth = 0) {
    const R = BdApi.React;
    if (!el || typeof el !== "object" || !el.props || depth > 8) return el;
    if (typeof el.props.maxValue === "number") {
      if (el.props.maxValue >= 200) return el;
      this.volFound = true;
      const extra = Array.isArray(el.props.markers) ? { markers: [0, 100, 200] } : {};
      return R.cloneElement(el, { maxValue: 200, ...extra });
    }
    const kids = el.props.children;
    if (Array.isArray(kids)) return R.cloneElement(el, undefined, ...kids.map((k) => this.raiseMax(k, depth + 1)));
    if (kids && typeof kids === "object") return R.cloneElement(el, undefined, this.raiseMax(kids, depth + 1));
    return el;
  }

  patchVolumeMenu() {
    this.volMenuCb = (tree) => {
      try {
        const isVol = (n) => n && n.props && typeof n.props.control === "function" && /volume/i.test(String(n.props.id || "") + " " + (typeof n.props.label === "string" ? n.props.label : ""));
        const item = BdApi.Utils.findInTree(tree, isVol, { walkable: ["props", "children"] });
        if (!item || item.props.__nsVol) return;
        item.props.__nsVol = true;
        const orig = item.props.control;
        item.props.control = (p, ref) => {
          this.volFound = false;
          const out = this.raiseMax(orig(p, ref));
          if (!this.volFound && !this.volWarned) { this.volWarned = true; console.warn(NAME, "found the volume menu item but not its slider's maxValue (already 200, or Discord changed the layout)"); }
          return out;
        };
      } catch (e) { console.warn(NAME, "volume slider patch failed:", e); }
    };
    if (!BdApi.ContextMenu || typeof BdApi.ContextMenu.patch !== "function") {
      console.warn(NAME, "this BetterDiscord version has no context menu API, so the 200% volume slider is unavailable");
      this.volMenuCb = null;
      return;
    }
    for (const nav of ["user-context", "stream-context"]) BdApi.ContextMenu.patch(nav, this.volMenuCb);
  }

  unpatchVolumeMenu() {
    if (!this.volMenuCb) return;
    for (const nav of ["user-context", "stream-context"]) { try { BdApi.ContextMenu?.unpatch(nav, this.volMenuCb); } catch {} }
    this.volMenuCb = null;
  }

  patchTyping() {
    if (!this.Typing) return console.warn(NAME, "typing module not found");
    BdApi.Patcher.instead(NAME, this.Typing, "startTyping", (that, args, orig) => {
      if (this.s.hideTyping) return;
      return orig.apply(that, args);
    });
  }

  patchNetwork() {
    const blocked = (url) => this.s.blockTelemetry && typeof url === "string" && TELEMETRY.some((r) => r.test(url));
    const swallowed = (method, url) => {
      if (typeof url !== "string" || String(method || "GET").toUpperCase() !== "POST") return false;
      if (this.s.hideTyping && /\/channels\/\d+\/typing(\?|$)/.test(url)) return true;
      if (this.s.blockReadAck && /\/(channels\/\d+\/messages\/\d+\/ack|read-states\/ack-bulk)(\?|$)/.test(url)) return true;
      return false;
    };

    BdApi.Patcher.instead(NAME, window, "fetch", (that, args, orig) => {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
      const method = args[1]?.method || (typeof args[0] === "object" ? args[0]?.method : "GET");
      if (blocked(url) || swallowed(method, url)) return Promise.resolve(new Response(null, { status: 204 }));
      return orig.apply(that, args);
    });

    BdApi.Patcher.before(NAME, XMLHttpRequest.prototype, "open", (xhr, args) => {
      const url = String(args[1]);
      xhr.__nsBlocked = blocked(url);
      xhr.__nsFake = swallowed(args[0], url);
      xhr.__nsUrl = url;
    });
    BdApi.Patcher.instead(NAME, XMLHttpRequest.prototype, "send", (xhr, args, orig) => {
      if (xhr.__nsBlocked) { try { xhr.abort(); } catch {} return; }
      if (xhr.__nsFake) return this.fakeXhrSuccess(xhr);
      return orig.apply(xhr, args);
    });
  }

  fakeXhrSuccess(xhr) {
    const def = (k, v) => { try { Object.defineProperty(xhr, k, { configurable: true, get: () => v }); } catch {} };
    def("readyState", 4);
    def("status", 204);
    def("statusText", "No Content");
    def("responseText", "");
    def("response", "");
    def("responseURL", xhr.__nsUrl || "");
    setTimeout(() => {
      for (const t of ["readystatechange", "load", "loadend"]) {
        try { xhr.dispatchEvent(new Event(t)); } catch {}
      }
    }, 0);
  }

  patchSend() {
    if (!this.MessageActions) return console.warn(NAME, "message module not found");

    BdApi.Patcher.instead(NAME, this.MessageActions, "sendMessage", (that, args, orig) => {
      const [channelId, msg, ...rest] = args;
      if (!msg || typeof msg.content !== "string") return orig.apply(that, args);

      let content = msg.content;

      if (this.s.stripLinkTrackers) {
        content = content.replace(/https?:\/\/[^\s<>]+/g, (link) => this.cleanUrl(link));
      }

      if (this.s.emojiLinks) {
        const currentGuild = this.SelectedGuildStore.getGuildId();
        content = content.replace(/<(a?):(\w+):(\d+)>/g, (m, animated, name, id) => {
          const emoji = this.EmojiStore.getCustomEmojiById?.(id);
          if (emoji && emoji.guildId === currentGuild) return m;
          const ext = animated ? "gif" : "webp";
          return `https://cdn.discordapp.com/emojis/${id}.${ext}?size=48&name=${name}`;
        });
      }

      if (this.s.splitLongMessages && content.length > 2000) {
        const chunks = this.splitText(content, 2000);
        (async () => {
          for (let i = 0; i < chunks.length; i++) {
            const m = { ...msg, content: chunks[i] };
            if (i > 0) delete m.messageReference;
            await orig.call(that, channelId, m, ...rest);
          }
        })();
        return Promise.resolve();
      }

      return orig.call(that, channelId, { ...msg, content }, ...rest);
    });
  }

  cleanUrl(link) {
    try {
      const u = new URL(link);
      let changed = false;
      for (const key of [...u.searchParams.keys()]) {
        const isTracker = TRACKING_PARAMS.some((r) => r.test(key)) || (key === "si" && SI_HOSTS.test(u.hostname));
        if (isTracker) { u.searchParams.delete(key); changed = true; }
      }
      return changed ? u.toString() : link;
    } catch {
      return link;
    }
  }

  splitText(text, max) {
    const out = [];
    while (text.length > max) {
      let cut = text.lastIndexOf("\n", max);
      if (cut < max * 0.5) cut = text.lastIndexOf(" ", max);
      if (cut < max * 0.5) cut = max;
      out.push(text.slice(0, cut));
      text = text.slice(cut).replace(/^\s+/, "");
    }
    if (text) out.push(text);
    return out;
  }

  patchFileInputs() {
    const handler = async (e) => {
      if (e.__nsHandled) return;

      let files;
      if (e.type === "drop") files = e.dataTransfer?.files;
      else if (e.type === "paste") files = e.clipboardData?.files;
      else if (e.type === "change") {
        if (!(e.target instanceof HTMLInputElement) || e.target.type !== "file") return;
        files = e.target.files;
      }
      if (!files?.length) return;

      const limit = this.s.maxNativeMB * 1024 * 1024;
      const isBig = (f) => this.s.bigUploads && f.size > limit;
      const needsClean = (f) => this.s.stripExif && IMG_TYPES.test(f.type);

      const list = [...files];
      if (!list.some((f) => isBig(f) || needsClean(f))) return;

      e.preventDefault();
      e.stopImmediatePropagation();
      const target = e.target;
      const type = e.type;

      const cleaned = [];
      for (const f of list) {
        try { cleaned.push(needsClean(f) ? await this.cleanFile(f) : f); }
        catch (err) { console.error(NAME, err); cleaned.push(f); }
      }

      const big = cleaned.filter(isBig);
      const small = cleaned.filter((f) => !isBig(f));

      if (small.length) {
        const dt = new DataTransfer();
        small.forEach((f) => dt.items.add(f));
        let ev;
        if (type === "change") {
          target.files = dt.files;
          ev = new Event("change", { bubbles: true });
        } else if (type === "drop") {
          ev = new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt });
        } else {
          ev = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt });
        }
        ev.__nsHandled = true;
        target.dispatchEvent(ev);
      } else if (type === "change") {
        target.value = "";
      }

      const channelId = this.SelectedChannelStore.getChannelId();
      for (const file of big) {
        try {
          this.toast(`Uploading ${file.name} (${(file.size / 1048576).toFixed(1)} MB)…`);
          const url = await this.uploadExternal(file);
          this.MessageActions.sendMessage(channelId, {
            content: url, tts: false, invalidEmojis: [], validNonShortcutEmojis: []
          });
          this.toast("Uploaded and sent!", "success");
        } catch (err) {
          console.error(NAME, err);
          this.toast(`Upload failed: ${err.message}`, "error");
        }
      }
    };

    for (const t of ["drop", "paste", "change"]) {
      document.addEventListener(t, handler, true);
      this.listeners.push([t, handler]);
    }
  }

  async cleanFile(file) {
    if (!IMG_TYPES.test(file.type)) return file;
    const bmp = await createImageBitmap(file);
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    canvas.getContext("2d").drawImage(bmp, 0, 0);
    bmp.close?.();
    const blob = await canvas.convertToBlob({ type: file.type, quality: 0.95 });

    let name = file.name;
    if (this.s.randomizeFilenames) {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const rnd = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("");
      name = `${rnd}.${ext}`;
    }
    return new File([blob], name, { type: blob.type, lastModified: Date.now() });
  }

  async uploadExternal(file) {
    const fd = new FormData();
    fd.append("reqtype", "fileupload");
    let url;
    if (this.s.uploadHost === "catbox") {
      url = "https://catbox.moe/user/api.php";
    } else {
      url = "https://litterbox.catbox.moe/resources/internals/api.php";
      fd.append("time", this.s.litterboxTime);
    }
    fd.append("fileToUpload", file, file.name);

    let res;
    try {
      res = await (BdApi.Net?.fetch ?? fetch)(url, { method: "POST", body: fd });
    } catch (e) {
      res = await fetch(url, { method: "POST", body: fd });
    }
    const text = (await res.text()).trim();
    if (!text.startsWith("http")) throw new Error(text.slice(0, 120) || `HTTP ${res.status}`);
    return text;
  }

  patchDispatcher() {
    if (!this.Dispatcher) return console.warn(NAME, "dispatcher not found; message logger disabled");

    BdApi.Patcher.instead(NAME, this.Dispatcher, "dispatch", (that, args, orig) => {
      const action = args[0];
      try {
        if (action?.type === "MESSAGE_DELETE" && this.s.logDeleted) {
          if (this.handleDelete(action.id, action.channelId)) return Promise.resolve();
        } else if (action?.type === "MESSAGE_DELETE_BULK" && this.s.logDeleted) {
          const remaining = (action.ids || []).filter((id) => !this.handleDelete(id, action.channelId));
          if (!remaining.length) return Promise.resolve();
          return orig.call(that, { ...action, ids: remaining });
        } else if (action?.type === "MESSAGE_UPDATE" && this.s.logEdits) {
          this.handleEdit(action.message);
        } else if (action?.type === "LOAD_MESSAGES_SUCCESS" && this.s.logDeleted) {
          args[0] = this.restoreDeleted(action);
        }
      } catch (e) {
        console.error(NAME, "logger error", e);
      }
      return orig.apply(that, args);
    });
  }

  toRaw(m, channelId) {
    try {
      const a = m.author || {};
      const iso = (t) => { try { return t ? new Date(t).toISOString() : null; } catch { return null; } };
      const raw = {
        id: m.id,
        channel_id: channelId,
        type: m.type,
        content: m.content || "",
        author: {
          id: a.id, username: a.username, global_name: a.globalName ?? a.global_name ?? null,
          discriminator: a.discriminator ?? "0", avatar: a.avatar ?? null, bot: !!a.bot
        },
        timestamp: iso(m.timestamp),
        edited_timestamp: null,
        tts: false,
        pinned: false,
        mention_everyone: !!m.mentionEveryone,
        mention_roles: m.mentionRoles || [],
        mentions: (m.mentions || []).map((u) => {
          if (u && typeof u === "object") return u;
          const user = this.UserStore.getUser(u);
          return { id: u, username: user?.username || "unknown", discriminator: "0", avatar: user?.avatar ?? null };
        }),
        attachments: (m.attachments || []).map((x) => ({
          id: x.id, filename: x.filename, url: x.url, proxy_url: x.proxy_url || x.url,
          size: x.size, content_type: x.content_type, width: x.width, height: x.height
        })),
        embeds: []
      };
      if (m.messageReference) {
        raw.message_reference = {
          channel_id: m.messageReference.channel_id, message_id: m.messageReference.message_id, guild_id: m.messageReference.guild_id
        };
      }
      return raw;
    } catch (e) {
      console.error(NAME, "toRaw failed", e);
      return null;
    }
  }

  restoreDeleted(action) {
    try {
      const saved = this.log.filter(
        (e) => e.type === "delete" && e.channelId === action.channelId && e.raw?.id && e.raw.author?.id && e.raw.timestamp
      );
      if (!saved.length || !Array.isArray(action.messages) || !action.messages.length) return action;

      const ids = action.messages.map((x) => BigInt(x.id));
      const newest = ids.reduce((a, b) => (a > b ? a : b));
      const oldest = ids.reduce((a, b) => (a < b ? a : b));
      const have = new Set(action.messages.map((x) => x.id));

      const extra = saved
        .map((e) => e.raw)
        .filter((r) => {
          if (have.has(r.id)) return false;
          const id = BigInt(r.id);
          if (action.hasMoreBefore !== false && id < oldest) return false;
          if (action.hasMoreAfter !== false && id > newest) return false;
          return true;
        });
      if (!extra.length) return action;

      for (const r of extra) this.deletedIds.add(r.id);
      this.scheduleDeletedCss();
      const messages = [...action.messages, ...extra].sort((a, b) => (BigInt(b.id) > BigInt(a.id) ? 1 : -1));
      return { ...action, messages };
    } catch (e) {
      console.error(NAME, "restoreDeleted failed", e);
      return action;
    }
  }

  messageInfo(m, channelId) {
    const channel = this.ChannelStore.getChannel(channelId);
    const guild = channel?.guild_id ? this.GuildStore.getGuild(channel.guild_id) : null;
    return {
      id: m.id,
      channelId,
      channelName: channel?.name || "",
      guildName: guild?.name || "",
      authorId: m.author?.id,
      authorName: m.author?.globalName || m.author?.username || "",
      at: Date.now()
    };
  }

  handleDelete(id, channelId) {
    const m = this.MessageStore.getMessage(channelId, id);
    if (!m) return false;
    const me = this.UserStore.getCurrentUser()?.id;
    if (this.s.ignoreSelf && m.author?.id === me) return false;
    if (this.s.ignoreBots && m.author?.bot) return false;
    if (m.type !== 0 && m.type !== 19) return false;

    const mentionsMe =
      !!m.mentionEveryone ||
      (Array.isArray(m.mentions) && m.mentions.some((u) => (u?.id ?? u) === me));

    this.addLog({
      ...this.messageInfo(m, channelId),
      type: "delete",
      content: m.content || "",
      attachments: (m.attachments || []).map((a) => ({ name: a.filename, url: a.url })),
      ghost: mentionsMe,
      raw: this.toRaw(m, channelId)
    });

    this.deletedIds.add(id);
    this.scheduleDeletedCss();

    if (mentionsMe && this.s.ghostPingAlerts) {
      const who = m.author?.globalName || m.author?.username || "someone";
      this.toast(`Ghost ping: ${who} pinged you and deleted the message`, "warning");
    }
    return true;
  }

  handleEdit(msg) {
    if (!msg || msg.content === undefined || !msg.edited_timestamp) return;
    const old = this.MessageStore.getMessage(msg.channel_id, msg.id);
    if (!old || old.content === msg.content) return;
    const me = this.UserStore.getCurrentUser()?.id;
    if (this.s.ignoreSelf && old.author?.id === me) return;
    if (this.s.ignoreBots && old.author?.bot) return;

    this.addLog({
      ...this.messageInfo(old, msg.channel_id),
      type: "edit",
      before: old.content || "",
      after: msg.content || ""
    });
  }

  addLog(entry) {
    this.log.unshift(entry);
    const max = Math.max(10, Number(this.s.maxLogEntries) || 300);
    if (this.log.length > max) this.log.length = max;
    this.persistLog();
  }

  persistLog() {
    if (!this.s.persistLog) return;
    clearTimeout(this.timers.persist);
    this.timers.persist = setTimeout(() => BdApi.Data.save(NAME, "log", this.log), 1000);
  }

  scheduleDeletedCss() {
    clearTimeout(this.timers.deleted);
    this.timers.deleted = setTimeout(() => {
      const ids = [...this.deletedIds].slice(-300);
      const css = ids
        .map(
          (id) =>
            `[id^="chat-messages-"][id$="-${id}"]{background:rgba(240,71,71,.08) !important;box-shadow:inset 3px 0 0 #f04747;}\n` +
            `[id^="chat-messages-"][id$="-${id}"] [id^="message-content-"]::after{content:" (deleted)";color:#f04747;font-size:.75rem;font-weight:600;}`
        )
        .join("\n");
      BdApi.DOM.removeStyle(`${NAME}-deleted`);
      if (css) BdApi.DOM.addStyle(`${NAME}-deleted`, css);
    }, 100);
  }

  openCenter(tab = "log") {
    this.closeCenter();

    const tabs = {
      log: ["Message log", () => this.tabLog()],
      hidden: ["Hidden channels", () => this.tabHidden()],
      voice: ["Voice overview", () => this.tabVoice()],
      info: ["Inspector", () => this.tabInfo()]
    };

    const body = h("div", { class: "ns-body" });
    const tabBar = h("div", { class: "ns-tabs" });

    const show = (key) => {
      body.replaceChildren();
      try {
        body.append(tabs[key][1]());
      } catch (err) {
        console.error(NAME, err);
        body.append(h("div", { class: "ns-muted" }, `Something went wrong: ${err.message}`));
      }
      [...tabBar.children].forEach((b) => (b.dataset.active = b.dataset.key === key ? "1" : "0"));
    };

    for (const [key, [label]] of Object.entries(tabs)) {
      tabBar.append(h("button", { class: "ns-tab", "data-key": key, onclick: () => show(key) }, label));
    }

    const panel = h(
      "div",
      { class: "ns-panel", onclick: (e) => e.stopPropagation() },
      h("div", { class: "ns-head" }, tabBar, h("button", { class: "ns-btn", onclick: () => this.closeCenter() }, "Close")),
      body
    );
    this.overlay = h("div", { class: "ns-overlay", onclick: () => this.closeCenter() }, panel);
    document.body.append(this.overlay);

    this.escHandler = (e) => { if (e.key === "Escape") { e.stopPropagation(); this.closeCenter(); } };
    document.addEventListener("keydown", this.escHandler, true);

    show(tab);
  }

  closeCenter() {
    this.overlay?.remove();
    this.overlay = null;
    if (this.escHandler) document.removeEventListener("keydown", this.escHandler, true);
    this.escHandler = null;
  }

  tabLog() {
    const wrap = h("div");
    let filter = "all";
    const list = h("div");

    const render = () => {
      list.replaceChildren();
      const items = this.log.filter((e) => filter === "all" || e.type === filter);
      if (!items.length) {
        list.append(h("div", { class: "ns-muted" }, "Nothing logged yet. Deleted and edited messages from chats you have open will show up here."));
      }
      for (const e of items.slice(0, 200)) list.append(this.logCard(e));
    };

    const filterBtn = (label, val) => h("button", { class: "ns-btn", onclick: () => { filter = val; render(); } }, label);
    const clear = h("button", {
      class: "ns-btn ns-danger",
      onclick: () => {
        this.log = [];
        this.deletedIds.clear();
        this.scheduleDeletedCss();
        if (this.s.persistLog) BdApi.Data.save(NAME, "log", this.log);
        render();
      }
    }, "Clear log");

    wrap.append(
      h("div", { class: "ns-row" },
        filterBtn("All", "all"), filterBtn("Deleted", "delete"), filterBtn("Edited", "edit"),
        h("span", { class: "ns-muted", style: "flex:1" }, `${this.log.length} entries · ${this.s.persistLog ? "saved to disk" : "memory only (cleared on restart)"}`),
        clear
      ),
      list
    );
    render();
    return wrap;
  }

  logCard(e) {
    const loc = `${e.guildName ? e.guildName + " › " : ""}#${e.channelName || e.channelId}`;
    const card = h("div", { class: "ns-card" },
      h("div", { class: "ns-muted" }, `${e.type === "delete" ? "🗑 Deleted" : "✏️ Edited"} · ${new Date(e.at).toLocaleString()} · ${loc}`),
      h("div", { class: "ns-strong" }, e.authorName || e.authorId || "unknown", e.ghost ? h("span", { class: "ns-tag" }, "👻 pinged you") : null)
    );
    if (e.type === "delete") {
      if (e.content) card.append(h("div", { class: "ns-pre" }, e.content));
      for (const a of e.attachments || []) {
        card.append(h("div", {}, "📎 ", h("a", { href: a.url, target: "_blank", rel: "noreferrer noopener" }, a.name || a.url)));
      }
    } else {
      card.append(
        h("div", { class: "ns-muted" }, "Before"), h("div", { class: "ns-pre" }, e.before || "(empty)"),
        h("div", { class: "ns-muted" }, "After"), h("div", { class: "ns-pre" }, e.after || "(empty)")
      );
    }
    return card;
  }

  tabHidden() {
    const wrap = h("div");
    const guilds = Object.values(this.GuildStore.getGuilds?.() ?? {});
    if (!guilds.length) return h("div", { class: "ns-muted" }, "No server data available.");

    const cur = this.SelectedGuildStore.getGuildId();
    const sel = h("select", { class: "ns-input" },
      guilds.map((g) => h("option", { value: g.id, selected: g.id === cur }, g.name))
    );
    const out = h("div", { style: "margin-top:10px" });

    const render = () => {
      out.replaceChildren();
      const gid = sel.value;
      const chans = Object.values(this.ChannelStore.getMutableGuildChannelsForGuild?.(gid) ?? {}).sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0)
      );
      if (!chans.length) {
        out.append(h("div", { class: "ns-muted" }, "Discord hasn't sent channel data for this server."));
        return;
      }

      const roles = this.GuildStore.getRoles?.(gid) ?? {};
      const hidden = chans.filter((c) => {
        if (c.type === 4) return false;
        try { return !this.PermissionStore.can(VIEW_CHANNEL, c); } catch { return false; }
      });

      out.append(h("div", { class: "ns-muted", style: "margin-bottom:8px" }, `${hidden.length} hidden of ${chans.length} channels. Only names and permission info are available, never the messages.`));

      for (const c of hidden) {
        const parent = c.parent_id ? this.ChannelStore.getChannel(c.parent_id)?.name : null;
        const grants = Object.values(c.permissionOverwrites ?? {})
          .filter((o) => (BigInt(o.allow ?? 0) & VIEW_CHANNEL) !== 0n)
          .map((o) => {
            const isRole = o.type === 0 || o.type === "role";
            return isRole ? `@${roles[o.id]?.name ?? o.id}` : `user ${this.UserStore.getUser(o.id)?.username ?? o.id}`;
          });

        out.append(
          h("div", { class: "ns-card" },
            h("div", { class: "ns-strong" }, `#${c.name}`, h("span", { class: "ns-tag" }, CHANNEL_TYPES[c.type] ?? `Type ${c.type}`), c.nsfw ? h("span", { class: "ns-tag" }, "NSFW") : null),
            parent ? h("div", { class: "ns-muted" }, `Category: ${parent}`) : null,
            c.topic ? h("div", { class: "ns-pre" }, c.topic) : null,
            h("div", { class: "ns-muted" }, grants.length ? `Explicit access: ${grants.join(", ")}` : "No explicit grants (access is inherited from the category or role permissions)"),
            h("div", { class: "ns-muted" }, `ID ${c.id} · created ${fmtDate(snowflakeDate(c.id))}`)
          )
        );
      }
      if (!hidden.length) out.append(h("div", { class: "ns-muted" }, "You can see every channel in this server."));
    };

    sel.addEventListener("change", render);
    wrap.append(sel, out);
    render();
    return wrap;
  }

  tabVoice() {
    const wrap = h("div");
    let all = {};
    try { all = this.VoiceStateStore.getAllVoiceStates?.() ?? {}; } catch {}

    let any = false;
    for (const [gid, users] of Object.entries(all)) {
      const byChannel = {};
      for (const st of Object.values(users || {})) {
        if (!st?.channelId) continue;
        (byChannel[st.channelId] ??= []).push(st);
      }
      const channelIds = Object.keys(byChannel);
      if (!channelIds.length) continue;
      any = true;

      const g = this.GuildStore.getGuild(gid);
      wrap.append(h("div", { class: "ns-strong", style: "margin:10px 0 6px" }, g?.name ?? (gid === "@me" ? "Direct messages / calls" : gid)));

      for (const cid of channelIds) {
        const ch = this.ChannelStore.getChannel(cid);
        const card = h("div", { class: "ns-card" }, h("div", { class: "ns-muted" }, `🔊 ${ch?.name ?? cid} · ${byChannel[cid].length} connected`));
        for (const st of byChannel[cid]) {
          const u = this.UserStore.getUser(st.userId);
          const flags = [
            st.selfMute || st.mute ? "🔇" : "",
            st.selfDeaf || st.deaf ? "🙉" : "",
            st.selfStream ? "📺 streaming" : "",
            st.selfVideo ? "📷 camera" : ""
          ].filter(Boolean).join(" ");
          card.append(h("div", {}, `${u?.globalName ?? u?.username ?? st.userId} ${flags}`));
        }
        wrap.append(card);
      }
    }
    if (!any) wrap.append(h("div", { class: "ns-muted" }, "Your client doesn't know about anyone in a voice channel right now. (Very large servers may not report everyone.)"));
    return wrap;
  }

  tabInfo() {
    const wrap = h("div");
    const chId = this.SelectedChannelStore.getChannelId();
    const ch = chId ? this.ChannelStore.getChannel(chId) : null;
    const gId = this.SelectedGuildStore.getGuildId();
    const g = gId ? this.GuildStore.getGuild(gId) : null;
    const me = this.UserStore.getCurrentUser();

    const kv = (k, v) => h("div", {}, h("span", { class: "ns-muted" }, `${k}: `), v == null ? "—" : v);

    wrap.append(
      h("div", { class: "ns-card" },
        h("div", { class: "ns-strong" }, "Current location"),
        kv("Server", g ? `${g.name} (${g.id})` : "Direct messages"),
        kv("Channel", ch ? `${ch.name ? "#" + ch.name : "DM"} (${ch.id})` : null),
        kv("Channel created", ch ? fmtDate(snowflakeDate(ch.id)) : null),
        kv("Server created", g ? fmtDate(snowflakeDate(g.id)) : null),
        kv("Your user ID", me?.id)
      )
    );

    const userIn = h("input", { class: "ns-input", placeholder: "User ID", style: "width:260px" });
    const userOut = h("div", { style: "margin-top:8px" });
    const doUser = async () => {
      const id = userIn.value.trim();
      if (!/^\d{15,22}$/.test(id)) { userOut.replaceChildren("Enter a valid user ID."); return; }
      userOut.replaceChildren("Looking up…");
      try { userOut.replaceChildren(await this.userCard(id)); }
      catch (err) { userOut.replaceChildren(`Lookup failed: ${err.message}`); }
    };
    wrap.append(
      h("div", { class: "ns-card" },
        h("div", { class: "ns-strong" }, "User lookup"),
        h("div", { class: "ns-row" }, userIn,
          h("button", { class: "ns-btn", onclick: doUser }, "Look up"),
          h("button", { class: "ns-btn", onclick: () => { userIn.value = me?.id ?? ""; doUser(); } }, "Me")),
        userOut
      )
    );

    const msgIn = h("input", { class: "ns-input", placeholder: "Message ID (in the current channel)", style: "width:320px" });
    const msgOut = h("div", { style: "margin-top:8px" });
    const doMsg = () => {
      const id = msgIn.value.trim();
      const m = chId && id ? this.MessageStore.getMessage(chId, id) : null;
      if (!m) { msgOut.replaceChildren("That message isn't loaded in the current channel."); return; }
      let json;
      try { json = JSON.stringify(m, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2); }
      catch (err) { json = `Couldn't serialize message: ${err.message}`; }
      msgOut.replaceChildren(
        h("button", { class: "ns-btn", onclick: () => this.copy(json) }, "Copy JSON"),
        h("pre", { class: "ns-pre ns-code" }, json)
      );
    };
    wrap.append(
      h("div", { class: "ns-card" },
        h("div", { class: "ns-strong" }, "Raw message viewer"),
        h("div", { class: "ns-row" }, msgIn, h("button", { class: "ns-btn", onclick: doMsg }, "Show")),
        msgOut
      )
    );
    return wrap;
  }

  async userCard(id) {
    let user = this.UserStore.getUser(id);
    if (!user && this.UserFetch?.getUser) {
      try { user = await this.UserFetch.getUser(id); } catch {}
    }
    if (!user) return h("div", { class: "ns-muted" }, "Discord has no data for that ID.");

    try { await this.ProfileFetch?.fetchProfile?.(id, { withMutualGuilds: true }); } catch {}
    const profile = this.UserProfileStore?.getUserProfile?.(id);

    const avatar = user.avatar;
    const banner = user.banner ?? profile?.banner;
    const avatarFull = avatar ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.${imgExt(avatar)}?size=4096` : null;
    const avatarSmall = avatar ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=128` : null;
    const bannerFull = banner ? `https://cdn.discordapp.com/banners/${id}/${banner}.${imgExt(banner)}?size=4096` : null;

    const flagBits = Number(user.publicFlags ?? user.public_flags ?? 0);
    const badges = USER_FLAGS.filter(([bit]) => (flagBits & bit) !== 0).map(([, n]) => n);

    const mutual = [];
    for (const g of Object.values(this.GuildStore.getGuilds?.() ?? {})) {
      const m = this.GuildMemberStore.getMember?.(g.id, id);
      if (!m) continue;
      const roles = this.GuildStore.getRoles?.(g.id) ?? {};
      const roleNames = (m.roles || []).map((r) => roles[r]?.name).filter(Boolean);
      mutual.push(
        `${g.name}${m.nick ? ` · nick “${m.nick}”` : ""}${m.joinedAt ? ` · joined ${new Date(m.joinedAt).toLocaleDateString()}` : ""}${roleNames.length ? ` · roles: ${roleNames.join(", ")}` : ""}`
      );
    }

    const kv = (k, v) => h("div", {}, h("span", { class: "ns-muted" }, `${k}: `), v == null ? "—" : v);

    return h("div", {},
      h("div", { class: "ns-row" },
        avatarSmall ? h("img", { src: avatarSmall, style: "width:64px;height:64px;border-radius:50%" }) : null,
        h("div", {},
          h("div", { class: "ns-strong" }, user.globalName || user.username, user.bot ? h("span", { class: "ns-tag" }, "BOT") : null),
          h("div", { class: "ns-muted" }, `@${user.username} · ${id}`)
        )
      ),
      kv("Account created", fmtDate(snowflakeDate(id))),
      kv("Public badges", badges.length ? badges.join(", ") : "none"),
      kv("Full-size avatar", avatarFull ? h("a", { href: avatarFull, target: "_blank", rel: "noreferrer noopener" }, "open") : "default avatar"),
      kv("Banner", bannerFull ? h("a", { href: bannerFull, target: "_blank", rel: "noreferrer noopener" }, "open") : "none / not available"),
      h("div", { class: "ns-muted", style: "margin-top:6px" }, `Servers you share (${mutual.length}, from your client's cache)`),
      ...mutual.map((m) => h("div", { class: "ns-pre" }, m))
    );
  }

  copy(text) {
    try {
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text);
      else DiscordNative?.clipboard?.copy?.(text);
      this.toast("Copied", "success");
    } catch {
      this.toast("Couldn't copy", "error");
    }
  }

  localUrl(v) {
    if (!v) return "";
    if (typeof v === "string" && v.startsWith("local:")) return this.localUrls[v.split(":")[1]] || "";
    return v;
  }

  async refreshLocal() {
    for (const v of [this.s.avatarUrl, this.s.backgroundUrl]) {
      if (typeof v === "string" && v.startsWith("local:")) {
        const key = v.split(":")[1];
        try { this.localUrls[key] = await BdApi.Files.getUrl(key); }
        catch (e) { console.error(NAME, "couldn't load local image", e); }
      }
    }
  }

  syncBackground(url, key) {
    const want = this.s.bgSharp !== false && !!url && SharpBackground.supported();
    const sig = want ? url : "";
    const S = NitroShield.__bg || (NitroShield.__bg = { sig: "", r: null, token: 0 });
    const amount = Math.min(100, Math.max(0, Number(this.s.bgSharpen) || 0)) / 100 * 1.4;
    const smooth = Math.min(100, Math.max(0, Number(this.s.bgSmooth) || 0)) / 100;
    const fit = { fill: 0, fit: 1, stretch: 2 }[this.s.bgFit] ?? 1;
    if (S.sig === sig) { if (S.r) { S.r.setSharp(amount); S.r.setSmooth(smooth); S.r.setFit(fit); } return; }
    S.token++;
    const token = S.token;
    S.r?.dispose();
    S.r = null;
    S.sig = sig;
    document.body.classList.remove("ns-bg-canvas");
    if (!want) return;
    (async () => {
      let blob = null;
      try { if (key && BdApi.Files?.getBlob) blob = await BdApi.Files.getBlob(key); } catch {}
      if (!blob) { const res = await fetch(url); if (!res.ok) throw new Error("HTTP " + res.status); blob = await res.blob(); }
      if (S.token !== token) return;
      const r = new SharpBackground({
        sharp: amount,
        smooth,
        fit,
        onFail: () => { if (S.r === r) { S.r = null; document.body.classList.remove("ns-bg-canvas"); } }
      });
      try { await r.start(blob); } catch (e) { r.dispose(); throw e; }
      if (S.token !== token) { r.dispose(); return; }
      S.r = r;
      document.body.classList.add("ns-bg-canvas");
    })().catch((e) => console.warn(NAME, "sharp background unavailable, using the plain background:", e && e.message ? e.message : e));
  }

  applyCss() {
    const me = this.UserStore.getCurrentUser()?.id;
    const q = (u) => u.replace(/"/g, "%22");
    const avatar = this.localUrl(this.s.avatarUrl);
    const background = this.localUrl(this.s.backgroundUrl);
    const bgRaw = this.s.backgroundUrl;
    const bgKey = typeof bgRaw === "string" && bgRaw.startsWith("local:") ? bgRaw.split(":")[1] : null;
    this.syncBackground(background, bgKey);
    this.measureBackground(background, bgKey);
    let css = "";

    if (avatar && me) {
      css += `img[src*="/avatars/${me}/"]{content:url("${q(avatar)}") !important;object-fit:cover;}\n`;
    }
    document.body.classList.toggle("ns-bg-on", !!background);
    if (background) this.clearSoon?.(300);
    if (background) {
      const tint = `rgba(10,11,15,${this.panelAlpha()})`;
      css += `html{background:#05060a !important;}
html body,html #app-mount{background:transparent !important;}
body.ns-bg-on::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:url("${q(background)}") center/${ { fill: "cover", fit: "contain", stretch: "100% 100%" }[this.s.bgFit] || "contain" } no-repeat;}
body.ns-bg-canvas::before{display:none !important;}
body.ns-bg-on,body.ns-bg-on .theme-dark,body.ns-bg-on .theme-darker,body.ns-bg-on .theme-midnight,body.ns-bg-on .theme-light{
  --background-base-lowest:transparent !important;--background-base-lower:${tint} !important;--background-base-low:${tint} !important;
  --background-surface-high:${tint} !important;--background-surface-higher:${tint} !important;--background-primary:transparent !important;
  --background-secondary:${tint} !important;--background-secondary-alt:${tint} !important;--background-tertiary:transparent !important;
  --chat-background-default:transparent !important;--bg-base-primary:transparent !important;--bg-base-secondary:${tint} !important;--bg-base-tertiary:transparent !important;}

body.ns-bg-on [data-ns-clear]{background-color:transparent !important;background-image:none !important;}
body.ns-bg-on #app-mount *:not([class*="layerContainer"] *),body.ns-bg-on #app-mount *:not([class*="layerContainer"] *)::before,body.ns-bg-on #app-mount *:not([class*="layerContainer"] *)::after{border-color:transparent !important;box-shadow:none !important;}
body.ns-bg-on :is(hr,[role="separator"],[class*="divider"]:empty){background:transparent !important;border-color:transparent !important;}
body.ns-bg-on ::-webkit-scrollbar-thumb{background:transparent !important;}
body.ns-bg-on *:hover::-webkit-scrollbar-thumb{background:rgba(255,255,255,.2) !important;}
body.ns-bg-on [data-ns-flat]{background:transparent !important;box-shadow:none !important;border-color:transparent !important;backdrop-filter:none !important;}
`;
    }
    {
      const amt = (v, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : d; };
      const shadows = [];
      if (background && this.s.readOutline !== false) {
        const k = amt(this.s.readOutlineAmt, 60) / 100;
        if (k > 0) {
          const lightHalo = this.s.textColorOn && /^#[0-9a-f]{6}$/i.test(String(this.s.textColor)) && this.hexLuma(this.s.textColor) < 0.08;
          const c = `${lightHalo ? "rgba(255,255,255," : "rgba(0,0,0,"}${(0.25 + 0.7 * k).toFixed(2)})`;
          shadows.push(`0 0 2px ${c}`, `0 0 3px ${c}`, `0 1px 3px ${c}`);
        }
      }
      const g = this.s.readGlow !== false ? amt(this.s.readGlowAmt, 30) : 0;
      if (g > 0) {
        const r = (3 + g * 0.12).toFixed(1), pct = Math.round(35 + g * 0.45);
        const plain = [...shadows, `0 0 ${r}px currentColor`].join(",");
        const mixed = [...shadows, `0 0 ${r}px color-mix(in srgb, currentColor ${pct}%, transparent)`].join(",");
        css += `#app-mount *{text-shadow:${plain};text-shadow:${mixed};}\n`;
      } else if (shadows.length) {
        css += `#app-mount *{text-shadow:${shadows.join(",")};}\n`;
      }
    }
    css += `body [data-ns-noshadow]{text-shadow:none !important;}\n`;
    if (this.s.hideUpsells) {
      css += `[class*="premiumPromo"],[class*="nitroUpsell"],[class*="upsell"]{display:none !important;}\n`;
    }
    for (const p of HIDE_PARTS) {
      if (this.s.hideParts?.[p.key]) css += `:is(${p.sel}){display:none !important;}\n`;
    }
    css += `body.ns-blur [data-ns-mask],body.ns-blur [data-ns-mask] *:not(button):not(button *){color:transparent !important;-webkit-text-fill-color:transparent !important;text-shadow:0 0 13px rgba(255,255,255,.5) !important;user-select:none !important;}\n`;
    css += `body.ns-blur [data-ns-mask] :is(img,canvas,video,svg,[style*="background-image"],[class*="avatar"],[class*="banner"],[class*="wishlist" i]){filter:blur(16px) brightness(.35) !important;}\n`;
    css += `.ns-badge{width:22px;height:22px;margin-left:2px;object-fit:contain;vertical-align:middle;}\n`;

    const blurSel = [
      '[class*="username_"]', '[class*="messageContent_"]', '[class*="avatar_"]',
      '[class*="channelName_"]', '[class*="guildIcon"]', '[class*="markup_"]',
      '[class*="embedWrapper"]', '[class*="imageWrapper"]'
    ].join(",");
    css += `body.ns-blur :is(${blurSel}){filter:blur(7px);transition:filter .15s;}\n`;
    css += `body.ns-blur :is(${blurSel}):hover{filter:none;}\n`;

    css += `
.ns-overlay{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;}
.ns-panel{--ns-bg:var(--background-surface-high,var(--background-secondary,#2b2d31));--ns-bg2:var(--background-base-lower,var(--background-tertiary,#1e1f22));--ns-text:var(--text-default,var(--text-normal,#dbdee1));--ns-muted:var(--text-muted,#949ba4);--ns-head:var(--header-primary,#fff);--ns-border:rgba(255,255,255,.08);
  width:min(840px,92vw);height:min(660px,86vh);display:flex;flex-direction:column;background:var(--ns-bg);color:var(--ns-text);border-radius:10px;box-shadow:0 8px 40px rgba(0,0,0,.5);font-size:14px;}
.ns-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;border-bottom:1px solid var(--ns-border);}
.ns-tabs{display:flex;gap:6px;flex-wrap:wrap;}
.ns-tab,.ns-btn{background:var(--ns-bg2);color:var(--ns-text);border:1px solid var(--ns-border);border-radius:6px;padding:5px 12px;cursor:pointer;font-size:13px;}
.ns-tab:hover,.ns-btn:hover{filter:brightness(1.25);}
.ns-tab[data-active="1"]{background:var(--brand-500,#5865f2);color:#fff;border-color:transparent;}
.ns-danger{color:#f04747;}
.ns-body{flex:1;overflow:auto;padding:14px;}
.ns-card{background:var(--ns-bg2);border-radius:8px;padding:10px 12px;margin-bottom:8px;display:flex;flex-direction:column;gap:3px;}
.ns-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px;}
.ns-muted{color:var(--ns-muted);font-size:12px;}
.ns-strong{color:var(--ns-head);font-weight:600;}
.ns-pre{white-space:pre-wrap;word-break:break-word;}
.ns-code{background:rgba(0,0,0,.25);padding:8px;border-radius:6px;max-height:300px;overflow:auto;font-family:monospace;font-size:12px;}
.ns-tag{margin-left:8px;padding:1px 6px;border-radius:4px;background:rgba(255,255,255,.1);font-size:11px;font-weight:500;}
.ns-input{background:var(--ns-bg2);color:var(--ns-text);border:1px solid var(--ns-border);border-radius:6px;padding:6px 10px;}
.ns-panel a{color:var(--text-link,#00a8fc);}
`;

    BdApi.DOM.removeStyle(NAME);
    BdApi.DOM.addStyle(NAME, css);
    this.updateBlur();
  }

  applyTextColor() {
    const id = `${NAME}-textcolor`;
    BdApi.DOM.removeStyle(id);
    const hex = String(this.s.textColor || "");
    if (!this.s.textColorOn || !/^#[0-9a-f]{6}$/i.test(hex)) return;
    const n = parseInt(hex.slice(1), 16);
    const rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
    const dim = this.s.textColorDim ? `rgba(${rgb},.62)` : hex;
    const faint = this.s.textColorDim ? `rgba(${rgb},.42)` : hex;
    let css = "";
    if (this.s.textColorTarget !== "chat") {
      css += `body,body :is(.theme-dark,.theme-darker,.theme-midnight,.theme-light){` +
        `--text-default:${hex} !important;--text-normal:${hex} !important;--text-strong:${hex} !important;--header-primary:${hex} !important;` +
        `--text-muted:${dim} !important;--text-secondary:${dim} !important;--header-secondary:${dim} !important;--channels-default:${dim} !important;--text-subtle:${faint} !important;` +
        `--interactive-text-default:${hex} !important;--interactive-text-hover:${hex} !important;--interactive-text-active:${hex} !important;` +
        `--interactive-normal:${hex} !important;--interactive-hover:${hex} !important;--interactive-active:${hex} !important;--interactive-muted:${dim} !important;}\n`;
      css += `body :is(${HOVER_SEL}),body :is(${HOVER_SEL}) *:not(svg):not(path){color:${hex} !important;-webkit-text-fill-color:${hex} !important;text-shadow:none !important;}\n`;
    }
    css += `body:not(.ns-blur) :is([id^="message-content-"],[class*="markup_"],[class*="messageContent_"]){color:${hex} !important;}\n`;
    BdApi.DOM.addStyle(id, css);
  }

  async measureBackground(url, key) {
    if (!url) { this.bgLuma = null; this.bgLumaSig = ""; return; }
    if (this.bgLumaSig === url) return;
    this.bgLumaSig = url;
    try {
      let blob = null;
      try { if (key && BdApi.Files?.getBlob) blob = await BdApi.Files.getBlob(key); } catch {}
      if (!blob) blob = await (await fetch(url)).blob();
      const bmp = await createImageBitmap(blob);
      const c = new OffscreenCanvas(32, 32);
      const g = c.getContext("2d");
      g.drawImage(bmp, 0, 0, 32, 32);
      bmp.close?.();
      const d = g.getImageData(0, 0, 32, 32).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (this.bgLumaSig !== url) return;
      this.bgLuma = sum / (1024 * 255);
      this.applyCss();
    } catch (e) { console.warn(NAME, "couldn't measure the background brightness:", e); }
  }

  panelAlpha() {
    const d = Math.min(100, Math.max(0, Number(this.s.panelDark) || 0));
    return (d / 100 * 0.8).toFixed(2);
  }

  hexLuma(hex) {
    const n = parseInt(String(hex).slice(1), 16);
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  }

  resetKeybinds() {
    Object.assign(this.s, KEYBIND_DEFAULTS);
    this.save();
    this.pushConfig();
    this.publishKeys();
    this.toast("Keybinds reset to defaults. Reopen settings to see them.", "success");
  }

  publishKeys() {
    const get = (id) => (this.s && accelValid(this.s[id]) ? this.s[id] : KEYBIND_DEFAULTS[id]);
    window.OPSEC_KEYS = {
      match: (e, id) => !!KEYBIND_DEFAULTS[id] && accelMatchEvent(e, get(id)),
      label: (id) => (KEYBIND_DEFAULTS[id] ? get(id).replace(/^Control/i, "Ctrl").replace(/\+Control/gi, "+Ctrl") : ""),
      accel: get
    };
  }

  addHotkeys() {
    this.publishKeys();
    const onKey = (e) => {
      if (!e.ctrlKey && !e.altKey && !e.metaKey && !/^F\d/.test(e.key || "")) return;
      if (accelMatchEvent(e, this.s.blurKey)) {
        e.preventDefault();
        this.s.blurMode = !this.s.blurMode;
        this.save();
        this.updateBlur();
      } else if (accelMatchEvent(e, this.s.centerKey)) {
        e.preventDefault();
        this.overlay ? this.closeCenter() : this.openCenter("log");
      }
    };
    document.addEventListener("keydown", onKey, true);
    this.listeners.push(["keydown", onKey]);
  }

  updateBlur() {
    const auto = this.autoBlur && this.autoBlur.size > 0;
    document.body.classList.toggle("ns-blur", !!this.s.blurMode || !!auto);
  }

  setAutoBlur(reason, on) {
    if (!this.autoBlur) this.autoBlur = new Set();
    if (on) this.autoBlur.add(reason); else this.autoBlur.delete(reason);
    this.updateBlur();
  }

  patchNotifications() {
    const Orig = window.Notification;
    if (!Orig || window.__nsNotifOrig) return;
    const self = this;
    window.__nsNotifOrig = Orig;
    window.Notification = new Proxy(Orig, {
      construct(target, args) {
        if (self.s.redactNotifications) {
          const opts = Object.assign({}, args[1] || {});
          args = ["OpsexCord", Object.assign(opts, { body: "New message", icon: undefined, image: undefined, badge: undefined })];
        }
        return Reflect.construct(target, args);
      }
    });
  }

  restoreNotifications() {
    if (window.__nsNotifOrig) {
      window.Notification = window.__nsNotifOrig;
      delete window.__nsNotifOrig;
    }
  }

  get bridge() { return window.OPSEC; }

  pushConfig() {
    const b = this.bridge;
    if (!b) return Promise.resolve(null);
    const s = this.s;
    return b.setConfig({
      panicEnabled: s.panicEnabled, panicKey: s.panicKey, lockKey: s.lockKey, linkKey: s.linkKey, panicHide: s.panicHide, panicQuit: s.panicQuit,
      contentProtection: s.contentProtection, watchdog: s.watchdog, watchdogMB: s.watchdogMB
    }).then((res) => {
      if (res && res.panicKeyOk === false) this.toast("Panic hotkey couldn't be registered (invalid format or already used by another app).", "warning");
      return res;
    }).catch(() => null);
  }

  reportState() {
    try {
      const inCall = !!this.SelectedChannelStore?.getVoiceChannelId?.();
      this.bridge?.setState({ inCall, sharing: !!this.sharing });
    } catch {}
  }

  muteMic() {
    try {
      const store = BdApi.Webpack.getStore("MediaEngineStore");
      const actions = BdApi.Webpack.getByKeys("toggleSelfMute");
      if (store && actions && !store.isSelfMute()) actions.toggleSelfMute();
    } catch (err) { console.warn(NAME, "couldn't mute mic:", err); }
  }

  doPanic() {
    this.s.blurMode = true;
    this.save();
    this.updateBlur();
    if (this.s.panicMute) this.muteMic();
  }

  startPrivacy() {
    this.autoBlur = new Set();
    this.privacyCleanup = [];
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      this.privacyCleanup.push(() => target.removeEventListener(type, fn, opts));
    };

    this.pushConfig();
    this.bridge?.onPanic(() => this.doPanic());

    on(window, "blur", () => { if (this.s.autoBlurUnfocus) this.setAutoBlur("unfocus", true); });
    on(window, "focus", () => this.setAutoBlur("unfocus", false));

    let last = Date.now();
    const bump = () => { last = Date.now(); if (this.autoBlur.has("idle")) this.setAutoBlur("idle", false); };
    for (const t of ["mousemove", "mousedown", "keydown", "wheel", "touchstart"]) on(document, t, bump, { capture: true, passive: true });
    const idleTimer = setInterval(() => {
      const m = this.s.autoBlurIdleMin;
      if (m > 0 && Date.now() - last > m * 60000) this.setAutoBlur("idle", true);
    }, 10000);
    this.privacyCleanup.push(() => clearInterval(idleTimer));

    const onShare = (e) => {
      this.sharing = !!(e.detail && e.detail.active);
      this.setAutoBlur("share", this.sharing && !!this.s.autoBlurShare);
      this.reportState();
    };
    on(window, "opsec-share", onShare);
    if (window.__nsSharing) onShare({ detail: { active: true } });

    this.reportState();
    const stateTimer = setInterval(() => this.reportState(), 10000);
    this.privacyCleanup.push(() => clearInterval(stateTimer));
  }

  stopPrivacy() {
    for (const fn of this.privacyCleanup || []) { try { fn(); } catch {} }
    this.privacyCleanup = [];
    this.bridge?.onPanic(null);
    this.restoreNotifications();
  }

  onPrivacyChange(key) {
    if (["panicEnabled", "panicKey", "lockKey", "linkKey", "panicHide", "panicQuit", "contentProtection", "watchdog", "watchdogMB"].includes(key)) this.pushConfig();
    if (key === "blurMode") this.updateBlur();
    if (key === "autoBlurShare") this.setAutoBlur("share", this.sharing && !!this.s.autoBlurShare);
    if (key === "autoBlurUnfocus" && !this.s.autoBlurUnfocus) this.setAutoBlur("unfocus", false);
    if (key === "autoBlurIdleMin" && !(this.s.autoBlurIdleMin > 0)) this.setAutoBlur("idle", false);
  }

  parseBadges() {
    const presets = PRESET_BADGES
      .filter((b) => this.s.badgePresets?.[b.key])
      .map((b) => ({ title: b.name, icon: BADGE_CDN + b.hash + ".png" }));

    const custom = String(this.s.badges || "")
      .split(/\s*;\s*|\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [title, icon] = l.split("|").map((x) => x.trim());
        return { title, icon };
      })
      .filter((b) => b.icon);

    const seen = new Set();
    return [...presets, ...custom].filter((b) => !seen.has(b.icon) && seen.add(b.icon));
  }

  checkFill(el, force) {
    if (!el || el.nodeType !== 1) return;
    if (this.s.readOutline === false && this.s.readGlow === false) return;
    if (document.body.classList.contains("ns-blur")) return;
    const seen = this.fillSeen || (this.fillSeen = new WeakSet());
    if (!force && seen.has(el)) return;
    seen.add(el);
    const cs = getComputedStyle(el);
    const clear = (c) => c === "rgba(0, 0, 0, 0)" || c === "transparent";
    el.toggleAttribute("data-ns-noshadow", clear(cs.webkitTextFillColor) || clear(cs.color) || cs.backgroundClip === "text" || cs.webkitBackgroundClip === "text");
  }

  recheckHover(root) {
    if (!root || !root.querySelectorAll) return;
    let n = 0;
    for (const el of root.querySelectorAll("span,div,h1,h2,h3,a,strong")) {
      if (n >= 150) break;
      const own = [...el.childNodes].some((c) => c.nodeType === 3 && c.nodeValue.trim() && c.nodeValue.length <= 60);
      if (!own) continue;
      n++;
      this.checkFill(el, true);
    }
  }

  startHoverCheck() {
    let last = null;
    const onOver = (e) => {
      const t = e.target;
      if (!t || !t.closest) return;
      const root = t.closest('[id^="chat-messages-"]') || t.closest("section") || t.closest("li");
      if (!root || root === last) return;
      last = root;
      const run = () => { try { this.recheckHover(root); } catch (err) { console.error(NAME, "hover check failed", err); } };
      requestAnimationFrame(run);
      setTimeout(run, 150);
      setTimeout(run, 450);
    };
    const onLeave = () => { last = null; };
    document.addEventListener("mouseover", onOver, true);
    document.addEventListener("mouseleave", onLeave, true);
    this.listeners.push(["mouseover", onOver], ["mouseleave", onLeave]);
  }

  tagLandmarks(scope = document.body) {
    if (!scope) return;
    const tag = (el, ...attrs) => { for (const a of attrs) if (!el.hasAttribute(a)) el.setAttribute(a, ""); };
    const w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    const panelHits = [], introHits = [];
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = n.nodeValue;
      if (!t || t.length > 120) continue;
      this.checkFill(n.parentElement);
      const v = t.trim();
      if (v === "View Full Profile" || v === "Member Since") panelHits.push(n.parentElement);
      else if (v.includes("beginning of your direct message history")) introHits.push(n.parentElement);
    }

    for (const start of panelHits) {
      let el = start, found = null;
      while (el && el !== document.body) {
        const r = el.getBoundingClientRect();
        if (r.width > 480) break;
        if (r.width >= 250 && r.height >= window.innerHeight * 0.5) found = el;
        el = el.parentElement;
      }
      if (found) tag(found, "data-ns-panel", "data-ns-mask");
    }

    for (const start of introHits) {
      let el = start, depth = 0;
      while (el.parentElement && el.parentElement !== document.body && depth++ < 8) {
        const p = el.parentElement;
        if (p.querySelector('[id^="chat-messages-"],[data-list-id="chat-messages"],[role="textbox"],textarea,form')) break;
        el = p;
      }
      tag(el, "data-ns-mask");
    }

    if (scope === document.body) this.tagAccountArea();
  }

  clearCheck(el) {
    if (el.nodeType !== 1 || el.hasAttribute("data-ns-clear")) return;
    if (!/^(DIV|SECTION|NAV|ASIDE|MAIN|HEADER|UL|OL|FORM)$/.test(el.tagName)) return;
    if (!el.closest("#app-mount")) return;
    if (el.closest('[class*="layerContainer"],[role="dialog"],[class*="popout"],[class*="modal"],[class*="tooltip"],[class*="menu"],[id^="popout"]')) return;
    const r = el.getBoundingClientRect();
    const column = r.width >= 48 && r.width < 200 && r.height >= window.innerHeight * 0.5;
    if (!column && (r.width < 200 || r.height < 36)) return;
    if (!column && r.width < 600 && r.width * r.height < 40000) return;
    const cs = getComputedStyle(el);
    const img = cs.backgroundImage;
    if (img !== "none") {
      if (img.includes("url(") || !img.includes("gradient")) return;
      el.setAttribute("data-ns-clear", "");
      return;
    }
    const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
    if (!m) return;
    const parts = m[1].split(",").map(Number);
    if ((parts.length > 3 ? parts[3] : 1) < (column ? 0.05 : 0.9)) return;
    el.setAttribute("data-ns-clear", "");
  }

  clearOpaque() {
    const root = document.getElementById("app-mount");
    if (!root || !document.body.classList.contains("ns-bg-on")) return;
    for (const el of root.querySelectorAll("div,section,nav,aside,main,header,ul,ol,form")) this.clearCheck(el);
  }

  tagAccountArea() {
    const root = document.getElementById("app-mount");
    const btn = root && root.querySelector('[aria-label="User Settings"],[aria-label="Mute"],[aria-label="Unmute"],[aria-label="Deafen"],[aria-label="Undeafen"]');
    if (!btn) return;
    let el = btn.parentElement, last = null;
    while (el && el !== root) {
      const r = el.getBoundingClientRect();
      if (r.height > 100 || r.width > 420) break;
      el.setAttribute("data-ns-flat", "");
      last = el;
      el = el.parentElement;
    }
    if (!el || !last || el === root) return;
    if (el.getBoundingClientRect().height > 400 || el.querySelector('[data-list-item-id^="private-channels"]')) return;
    for (const child of el.children) {
      if (child === last) break;
      const isVoice = child.querySelector('[aria-label="Disconnect"]') || /connected/i.test(child.textContent || "");
      if (!isVoice) child.setAttribute("data-ns-quest", "");
    }
  }

  startTagObserver() {
    const run = () => { this.timers.tag = null; try { this.tagLandmarks(); } catch (e) { console.error(NAME, "tagLandmarks failed", e); } };
    this.tagObs = new MutationObserver((recs) => {
      for (const rec of recs) {
        for (const n of rec.addedNodes) {
          try { this.tagLandmarks(n.nodeType === 1 ? n : n.parentElement); } catch (e) { console.error(NAME, "tagLandmarks failed", e); }
        }
      }
      if (!this.timers.tag) this.timers.tag = setTimeout(run, 400);
    });
    this.tagObs.observe(document.body, { childList: true, subtree: true });
    const clear = () => { this.timers.clear = null; try { this.clearOpaque(); } catch (e) { console.error(NAME, "clearOpaque failed", e); } };
    this.clearSoon = (ms = 1200) => { if (!this.timers.clear) this.timers.clear = setTimeout(clear, ms); };
    this.clearObs = new MutationObserver((recs) => {
      if (!document.body.classList.contains("ns-bg-on")) return;
      let attrChecks = 0;
      for (const rec of recs) {
        if (rec.type === "attributes") { if (attrChecks++ < 40) this.clearCheck(rec.target); continue; }
        for (const n of rec.addedNodes) {
          if (n.nodeType !== 1) continue;
          this.clearCheck(n);
          for (const d of n.querySelectorAll("div,section,nav,aside,main,header,ul,ol,form")) this.clearCheck(d);
        }
      }
      this.clearSoon();
    });
    this.clearObs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    window.addEventListener("resize", this.clearSoon);
    run();
    this.clearSoon(300);
  }

  startBadgeObserver() {
    this.observer = new MutationObserver(() => {
      if (this.rafPending) return;
      this.rafPending = true;
      requestAnimationFrame(() => {
        this.rafPending = false;
        this.injectBadges();
      });
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  injectBadges() {
    if (!this.s.badgesEnabled) return;
    const me = this.UserStore.getCurrentUser()?.id;
    if (!me) return;
    const badges = this.parseBadges();
    if (!badges.length) return;

    document.querySelectorAll('[aria-label="User Badges"], [class*="profileBadges"]').forEach((c) => {
      if (c.querySelector("[data-ns-badge]")) return;
      const root = c.closest('[role="dialog"], [class*="userPopout"], [class*="userProfile"]') || c.parentElement?.parentElement;
      if (!root || !root.querySelector(`img[src*="/avatars/${me}/"], img[src*="${me}"]`)) return;
      for (const b of badges) {
        const img = document.createElement("img");
        img.className = "ns-badge";
        img.src = b.icon;
        img.title = b.title || "";
        img.setAttribute("data-ns-badge", "1");
        c.appendChild(img);
      }
    });
  }

  removeBadges() {
    document.querySelectorAll("[data-ns-badge]").forEach((n) => n.remove());
  }

  getSettingsPanel() {
    return BdApi.UI.buildSettingsPanel({
      settings: [
        HIDE_CATEGORY(this.s),
        {
          type: "category", id: "nitro", name: "Nitro-style features", collapsible: true, shown: true,
          settings: [
            { type: "switch", id: "fakePremium", name: "Unlock Nitro UI (client-side)", note: "Bigger text box, emoji picker, etc. Server-side checks are not changed.", value: this.s.fakePremium },
            { type: "switch", id: "emojiLinks", name: "Emoji everywhere", note: "Converts other-server/animated emoji into image links when sending.", value: this.s.emojiLinks },
            { type: "switch", id: "splitLongMessages", name: "Long messages (up to 4000 chars)", note: "Auto-splits into multiple 2000-char messages.", value: this.s.splitLongMessages },
            { type: "switch", id: "hideUpsells", name: "Hide Nitro upsells", value: this.s.hideUpsells }
          ]
        },
        {
          type: "category", id: "uploads", name: "Big file uploads", collapsible: true, shown: false,
          settings: [
            { type: "switch", id: "bigUploads", name: "Upload big files to external host", note: "Files over the threshold go to Catbox/Litterbox and the link is sent.", value: this.s.bigUploads },
            { type: "number", id: "maxNativeMB", name: "Threshold (MB)", note: "Free Discord limit is 10 MB.", value: this.s.maxNativeMB },
            {
              type: "dropdown", id: "uploadHost", name: "Host", value: this.s.uploadHost,
              options: [
                { label: "Litterbox (temporary, up to 1GB)", value: "litterbox" },
                { label: "Catbox (permanent, up to 200MB)", value: "catbox" }
              ]
            },
            {
              type: "dropdown", id: "litterboxTime", name: "Litterbox expiry", value: this.s.litterboxTime,
              options: [
                { label: "1 hour", value: "1h" },
                { label: "12 hours", value: "12h" },
                { label: "24 hours", value: "24h" },
                { label: "72 hours", value: "72h" }
              ]
            }
          ]
        },
        {
          type: "category", id: "custom", name: "Custom image / GIF", collapsible: true, shown: false,
          settings: [
            { type: "file", id: "avatarUrl", fileKey: "avatar", name: "Your avatar (image or GIF)", note: "Only you see it. Leave blank to disable.", value: this.s.avatarUrl },
            { type: "file", id: "backgroundUrl", fileKey: "background", name: "App background (image or GIF)", note: "Covers the whole app, behind all icons and text. Only you see it.", value: this.s.backgroundUrl },
            {
              type: "dropdown", id: "bgFit", name: "Background fit", value: this.s.bgFit,
              note: "Fit shows the whole image (empty space is filled with a blurred copy). Fill zooms in to cover the window and crops the edges. Stretch squashes it to the window.",
              options: [
                { label: "Fit: show the whole image", value: "fit" },
                { label: "Fill: zoom to cover (crops)", value: "fill" },
                { label: "Stretch to window", value: "stretch" }
              ]
            },
            { type: "switch", id: "bgSharp", name: "Sharp background rendering", note: "Draws the background with a high-quality scaler instead of the browser's basic one, so small or low-resolution GIFs look much less blurry. Switches itself off if your graphics can't do it.", value: this.s.bgSharp },
            { type: "number", id: "bgSmooth", name: "Background smoothing (0 to 100)", note: "How smooth an enlarged image looks. Higher = silkier but softer, lower = crisper. 35 is a good start.", value: this.s.bgSmooth },
            { type: "number", id: "bgSharpen", name: "Background sharpening (0 to 100)", note: "Adds a little edge detail back after smoothing. Keep it low (0 to 30).", value: this.s.bgSharpen }
          ]
        },
        {
          type: "category", id: "readCat", name: "Text readability", collapsible: true, shown: true,
          settings: [
            { type: "number", id: "panelDark", name: "Panel darkness (0 to 100)", note: "How dark the panels behind the text are over your background image. 0 = fully see-through, higher = darker.", value: this.s.panelDark },
            { type: "switch", id: "readOutline", name: "Outline text on a background image", note: "A thin outline around text so it stays readable on busy or bright backgrounds. Only used when you have a background image.", value: this.s.readOutline },
            { type: "number", id: "readOutlineAmt", name: "Outline strength (0 to 100)", value: this.s.readOutlineAmt },
            { type: "switch", id: "readGlow", name: "Glow text a little", note: "Every piece of text glows softly in its own color, with or without a background image.", value: this.s.readGlow },
            { type: "number", id: "readGlowAmt", name: "Glow strength (0 to 100)", note: "30 is subtle. Above 60 text starts to look fuzzy.", value: this.s.readGlowAmt }
          ]
        },
        {
          type: "category", id: "textcolor", name: "Text color", collapsible: true, shown: false,
          settings: [
            { type: "switch", id: "textColorOn", name: "Use a custom text color", note: "Off = Discord's normal colors. Links, mentions and role-colored names keep their own colors.", value: this.s.textColorOn },
            { type: "color", id: "textColor", name: "Text color", note: "Click a dot, use the color picker, or type a hex code.", value: this.s.textColor, colors: ["#ffffff", "#e8e6ff", "#7c5cff", "#4fd1c5", "#7ee787", "#ffd166", "#ff7eb6", "#ff6b6b"] },
            {
              type: "dropdown", id: "textColorTarget", name: "Apply to", value: this.s.textColorTarget,
              options: [
                { label: "Whole app (messages, channels, menus)", value: "all" },
                { label: "Chat messages only", value: "chat" }
              ]
            },
            { type: "switch", id: "textColorDim", name: "Keep secondary text dimmer", note: "Timestamps, hints and section labels use a softer shade of your color so the layout still reads clearly.", value: this.s.textColorDim }
          ]
        },
        {
          type: "category", id: "badgeCat", name: "Client-side badges", collapsible: true, shown: false,
          settings: [
            { type: "switch", id: "badgesEnabled", name: "Show custom badges on my profile", value: this.s.badgesEnabled },
            ...PRESET_BADGES.map((b) => ({
              type: "switch", id: `badge_${b.key}`, name: b.name, value: !!this.s.badgePresets?.[b.key]
            })),
            { type: "text", id: "badges", name: "Extra custom badges", note: "Optional. Format: Name|IconURL. Separate multiple badges with semicolons. Only you see them.", value: this.s.badges }
          ]
        },
        {
          type: "category", id: "keybinds", name: "Keybinds (view only)", collapsible: true, shown: true,
          settings: [
            ...[
              ["panicKey", "Hides the window, mutes and blurs. Works even when Discord isn't focused."],
              ["blurKey", ""], ["centerKey", ""],
              ["lockKey", "Set / change / remove your PIN."],
              ["linkKey", "Checks the link you copied."],
              ["musicKey", "Music plugin."], ["recKey", "Recorder plugin. Also stops a recording in progress."],
              ["fxToggle", "Ambience plugin."], ["fxTetris", "Ambience plugin."]
            ].map(([id, note]) => ({ type: "button", id: "kb_" + id, name: KEYBIND_LABELS[id], note, label: KEYBIND_DEFAULTS[id].replace("Control", "Ctrl"), onClick: () => {} })),
            ...[
              ["Settings (Ambience)", "Ctrl+Alt+S"], ["Reload Discord", "Ctrl+R"], ["Music play / pause", "Media Play/Pause key"],
              ["Music next / previous", "Media Next / Previous keys"], ["Discord quick switcher", "Ctrl+K"], ["Tetris pause / exit", "P / Esc"]
            ].map(([name, key]) => ({ type: "button", id: "kbf_" + key, name, label: key, onClick: () => {} }))
          ]
        },
        {
          type: "category", id: "privacy", name: "Privacy", collapsible: true, shown: false,
          settings: [
            { type: "switch", id: "blockTelemetry", name: "Block telemetry & crash reports", note: "Blocks Discord analytics and Sentry requests. Reload Discord (Ctrl+R) after changing.", value: this.s.blockTelemetry },
            { type: "switch", id: "hideTyping", name: "Hide my typing indicator", value: this.s.hideTyping },
            { type: "switch", id: "stripLinkTrackers", name: "Strip tracking from links I send", note: "Removes utm_*, fbclid, gclid, igshid, YouTube/Spotify \"si\", etc.", value: this.s.stripLinkTrackers },
            { type: "switch", id: "stripExif", name: "Strip image metadata before upload", note: "Removes EXIF/GPS/camera info from JPEG, PNG, WebP. JPEG/WebP are re-compressed slightly.", value: this.s.stripExif },
            { type: "switch", id: "randomizeFilenames", name: "Randomize image filenames", value: this.s.randomizeFilenames },
            { type: "switch", id: "blurMode", name: "Blur mode", note: "Blurs names, messages, avatars and images until you hover.", value: this.s.blurMode },
            { type: "switch", id: "blockReadAck", name: "Don't mark channels as read on Discord's servers", note: "Channels show as unread again after a restart and on your other devices. If unread badges act strange, switch it off.", value: this.s.blockReadAck },
            { type: "switch", id: "redactNotifications", name: "Redact notification text", note: "Shows \"OpsexCord: New message\" instead of the sender and the message.", value: this.s.redactNotifications },
            { type: "switch", id: "contentProtection", name: "Hide window from screenshots & screen capture", note: "The window shows up black in captures, including your own \"share entire screen\". Needs the updated main.js + preload.js.", value: this.s.contentProtection },
            { type: "switch", id: "panicEnabled", name: "Panic hotkey (hide + mute + blur)", note: "Works even when the window isn't focused. Press it again (or click the tray icon) to bring the window back.", value: this.s.panicEnabled },
            { type: "switch", id: "panicMute", name: "Panic: mute my mic", note: "Panic also turns blur mode on, and it stays on until you switch it off.", value: this.s.panicMute },
            { type: "switch", id: "panicHide", name: "Panic: hide window to the tray", note: "Off = just minimize it.", value: this.s.panicHide },
            { type: "switch", id: "panicQuit", name: "Panic: close the app instead", note: "Overrides hide / minimize.", value: this.s.panicQuit },
            { type: "button", id: "testPanic", name: "Test panic now", note: "Use the hotkey or the tray icon to get the window back.", label: "Test", onClick: () => (window.OPSEC ? window.OPSEC.panic() : this.doPanic()) },
            { type: "switch", id: "autoBlurUnfocus", name: "Auto-blur when the window loses focus", value: this.s.autoBlurUnfocus },
            { type: "number", id: "autoBlurIdleMin", name: "Auto-blur after being idle (minutes)", note: "0 = off. Max 240.", value: this.s.autoBlurIdleMin },
            { type: "switch", id: "autoBlurShare", name: "Auto-blur while screen sharing", note: "Turns on as a share starts and off when it ends, so viewers don't see names or avatars.", value: this.s.autoBlurShare }
          ]
        },
        {
          type: "category", id: "memory", name: "Memory", collapsible: true, shown: false,
          settings: [
            { type: "switch", id: "watchdog", name: "Memory watchdog", note: "Reloads the Discord page when it grows past the limit, but only while the window is hidden, minimized or unfocused, and never during a call or screen share. An unsent draft could be lost.", value: this.s.watchdog },
            { type: "number", id: "watchdogMB", name: "Limit (MB)", note: "Memory used by the Discord page. 500 to 8000.", value: this.s.watchdogMB },
            {
              type: "button", id: "showMemory", name: "Current memory use", note: "Shows the Discord page and the whole app.", label: "Check",
              onClick: () => {
                if (!window.OPSEC) return this.toast("Desktop bridge not loaded. Update main.js and preload.js.", "warning");
                window.OPSEC.getMemory().then((m) => m && this.toast(`${m.rendererMB} MB Discord page, ${m.totalMB} MB whole app`)).catch(() => {});
              }
            },
            { type: "button", id: "reloadNow", name: "Reload Discord now", label: "Reload", onClick: () => (window.OPSEC ? window.OPSEC.reload() : location.reload()) }
          ]
        },
        {
          type: "category", id: "inspector", name: "Inspector", collapsible: true, shown: true,
          settings: [
            { type: "switch", id: "logDeleted", name: "Keep deleted messages", note: "Deleted messages you had loaded stay visible (marked red) and are saved to the log.", value: this.s.logDeleted },
            { type: "switch", id: "logEdits", name: "Log message edits", value: this.s.logEdits },
            { type: "switch", id: "ignoreSelf", name: "Ignore my own messages", value: this.s.ignoreSelf },
            { type: "switch", id: "ignoreBots", name: "Ignore bot messages", value: this.s.ignoreBots },
            { type: "switch", id: "ghostPingAlerts", name: "Ghost ping alerts", note: "Shows a notice when someone pings you and deletes the message.", value: this.s.ghostPingAlerts },
            { type: "switch", id: "persistLog", name: "Save log to disk", note: "Off by default. When on, logged messages are stored as plain text in your BetterDiscord data folder.", value: this.s.persistLog },
            { type: "number", id: "maxLogEntries", name: "Max log entries", value: this.s.maxLogEntries }
          ]
        }
      ],
      onChange: (_, id, value) => {
        if (id.startsWith("hide_")) {
          this.s.hideParts = { ...this.s.hideParts, [id.slice(5)]: value };
          this.save();
          this.tagLandmarks();
          this.applyCss();
          return;
        }
        if (id.startsWith("badge_")) {
          this.s.badgePresets = { ...this.s.badgePresets, [id.slice(6)]: value };
          this.save();
          this.removeBadges();
          this.injectBadges();
          return;
        }
        if (id.startsWith("read")) {
          if (id.endsWith("Amt")) value = Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
          this.s[id] = value;
          this.save();
          this.applyCss();
          return;
        }
        if (id.startsWith("textColor")) {
          if (id === "textColor" && !/^#[0-9a-f]{6}$/i.test(String(value))) return;
          this.s[id] = value;
          this.save();
          this.applyTextColor();
          return;
        }
        if (id === "bgSharpen" || id === "bgSmooth" || id === "panelDark") value = Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
        if (id === "autoBlurIdleMin") value = Math.min(240, Math.max(0, Math.round(value)));
        if (id === "watchdogMB") value = Math.min(8000, Math.max(500, Math.round(value)));
        if (KEYBIND_DEFAULTS[id]) {
          value = String(value).trim();
          if (!accelValid(value)) return;
          const clash = Object.keys(KEYBIND_DEFAULTS).find((k) => k !== id && accelNorm(this.s[k]) === accelNorm(value));
          if (clash) { this.toast(value + " is already used for \"" + KEYBIND_LABELS[clash] + "\".", "warning"); return; }
        }
        this.s[id] = value;
        this.save();
        if (KEYBIND_DEFAULTS[id]) this.publishKeys();
        this.onPrivacyChange(id);
        if (id === "avatarUrl" || id === "backgroundUrl") this.refreshLocal().then(() => this.applyCss());
        else if (["hideUpsells", "blurMode", "bgFit", "bgSharp", "bgSmooth", "bgSharpen", "panelDark"].includes(id)) this.applyCss();
        if (id === "badges" || id === "badgesEnabled") {
          this.removeBadges();
          this.injectBadges();
        }
        if (id === "persistLog") {
          if (value) BdApi.Data.save(NAME, "log", this.log);
          else BdApi.Data.delete(NAME, "log");
        }
      }
    });
  }
};