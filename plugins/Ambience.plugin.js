/**
 * @name OpsexCord
 * @author @geofeed on discord
 */

const NAME = "Ambience";
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const FX_KEY_DEFAULTS = { fxToggle: "Control+Alt+E", fxTetris: "Control+Alt+T" };
const fxKeyHit = (e, id) => {
  const K = window.OPSEC_KEYS;
  if (K && typeof K.match === "function") return K.match(e, id);
  const key = FX_KEY_DEFAULTS[id].split("+").pop().toLowerCase();
  return e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey && String(e.key).toLowerCase() === key;
};
const fxKeyLabel = (id) => {
  const K = window.OPSEC_KEYS;
  return K && typeof K.label === "function" ? K.label(id) : FX_KEY_DEFAULTS[id].replace("Control", "Ctrl");
};
const fxText = (s) => String(s).replace(/\[\[(\w+)\]\]/g, (_, id) => (FX_KEY_DEFAULTS[id] ? fxKeyLabel(id) : _));
const lerp = (a, b, t) => a + (b - a) * t;

const hexRgb = (hex) => {
  let s = String(hex || "#ffffff").replace("#", "");
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  const n = parseInt(s, 16);
  if (Number.isNaN(n)) return [255, 255, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgba = (hex, a) => { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; };

const spriteCache = new Map();
const glowSprite = (hex) => {
  let c = spriteCache.get(hex);
  if (c) return c;
  if (spriteCache.size > 40) spriteCache.clear();
  c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, rgba(hex, 1));
  grad.addColorStop(0.25, rgba(hex, 0.55));
  grad.addColorStop(1, rgba(hex, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  spriteCache.set(hex, c);
  return c;
};

const h = (tag, attrs, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === "class") e.className = v;
    else if (k === "style") e.style.cssText = v;
    else if (k === "value" || k === "checked") e[k] = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
};

const R = (k, label, note, min, max, step, unit = "") => ({ type: "range", k, label, note, min, max, step, unit });
const S = (k, label, note) => ({ type: "switch", k, label, note });
const C = (k, label, note) => ({ type: "color", k, label, note });
const O = (k, label, options, note) => ({ type: "select", k, label, options, note });

const COLOR_MODE = O("colorMode", "Color mode", [["palette", "Mixed palette"], ["single", "Single color"]], "Use the built-in mixed colors, or one color of your choice.");

const FX = {
  rain: {
    name: "Rain",
    blurb: "Streaks of rain with depth, splashes where they land, and optional lightning.",
    defaults: { enabled: false, amount: 380, speed: 1000, speedVar: 0.3, length: 28, thickness: 1.3, opacity: 0.5, color: "#b9d3ff", depth: 0.55, ground: 0.12, splashes: true, splashSize: 1, lightning: false, lightningRate: 5, lightningPower: 0.6, bolts: true },
    controls: [
      R("amount", "Amount", "Raindrops on screen (at 1080p, scales with window size).", 0, 2500, 10),
      R("speed", "Fall speed", "How fast drops fall.", 200, 3000, 25, "px/s"),
      R("speedVar", "Speed variation", "Random spread so drops don't move in lockstep.", 0, 1, 0.05),
      R("length", "Streak length", "Length of each streak.", 4, 120, 1, "px"),
      R("thickness", "Thickness", "Line width of the nearest drops.", 0.3, 5, 0.1, "px"),
      R("opacity", "Opacity", "", 0, 1, 0.05),
      C("color", "Color"),
      R("depth", "Depth variation", "Higher = more small, slow, faint drops in the back.", 0, 0.9, 0.05),
      R("ground", "Landing spread", "Far drops land higher up the screen, like a floor in the distance. 0 = all land at the bottom edge.", 0, 0.5, 0.01),
      S("splashes", "Splashes", "Rings and tiny droplets where the rain lands."),
      R("splashSize", "Splash size", "", 0.3, 3, 0.1, "x"),
      S("lightning", "Lightning", "Random flashes of light. Needs Rain turned on."),
      R("lightningRate", "Lightning frequency", "Average strikes per minute.", 0.5, 30, 0.5, "/min"),
      R("lightningPower", "Flash brightness", "", 0.1, 1, 0.05),
      S("bolts", "Show bolts", "Draw the visible bolt, not just the flash.")
    ]
  },
  glass: {
    name: "Glass droplets",
    blurb: "Water droplets that cling to your screen, grow, and run down leaving trails, like a rainy window.",
    defaults: { enabled: false, amount: 70, spawnRate: 4, sizeMin: 3, sizeMax: 11, slideChance: 0.45, slideSpeed: 90, trails: true, trailOpacity: 0.3, opacity: 0.85, tint: "#cfe3ff", life: 35, highlight: true },
    controls: [
      R("amount", "Max droplets", "Most droplets on screen at once.", 0, 400, 5),
      R("spawnRate", "New droplets per second", "How quickly new drops appear.", 0.2, 40, 0.2, "/s"),
      R("sizeMin", "Smallest size", "", 1.5, 12, 0.5, "px"),
      R("sizeMax", "Largest size", "Droplets grow toward this size.", 4, 30, 0.5, "px"),
      R("slideChance", "Slide chance", "Chance a droplet gets heavy and runs down the screen.", 0, 1, 0.05),
      R("slideSpeed", "Slide speed", "", 10, 400, 5, "px/s"),
      S("trails", "Trails", "Wet streaks left behind by running droplets."),
      R("trailOpacity", "Trail opacity", "", 0, 1, 0.05),
      R("opacity", "Opacity", "", 0, 1, 0.05),
      C("tint", "Tint", "Slight color of the water."),
      R("life", "Lifetime", "How long a droplet stays before drying up.", 3, 120, 1, "s"),
      S("highlight", "Glassy highlights", "Shine and shadow so droplets look like real water.")
    ]
  },
  snow: {
    name: "Snow",
    blurb: "Drifting snowflakes with depth, swaying, and optional crystal shapes.",
    defaults: { enabled: false, amount: 220, speed: 90, size: 3, sizeVar: 0.6, opacity: 0.85, color: "#ffffff", sway: 28, swaySpeed: 1, spin: 1, depth: 0.5, shape: "mixed", glow: true },
    controls: [
      R("amount", "Amount", "", 0, 1500, 5),
      R("speed", "Fall speed", "", 10, 600, 5, "px/s"),
      R("size", "Size", "", 1, 12, 0.25, "px"),
      R("sizeVar", "Size variation", "", 0, 1, 0.05),
      R("opacity", "Opacity", "", 0, 1, 0.05),
      C("color", "Color"),
      R("sway", "Sway", "How much flakes drift side to side.", 0, 150, 1, "px/s"),
      R("swaySpeed", "Sway speed", "", 0.1, 5, 0.1, "x"),
      R("spin", "Spin", "Rotation speed of crystal flakes.", 0, 4, 0.1, "x"),
      R("depth", "Depth variation", "", 0, 0.9, 0.05),
      O("shape", "Flake shape", [["dots", "Round dots"], ["crystals", "Crystals"], ["mixed", "Mixed"]]),
      S("glow", "Soft glow", "A faint halo around larger flakes.")
    ]
  },
  sakura: {
    name: "Sakura petals",
    blurb: "Cherry blossom petals that tumble and flip as they fall.",
    defaults: { enabled: false, amount: 55, speed: 70, size: 9, sizeVar: 0.5, opacity: 0.9, colorMode: "palette", color: "#ffb7d0", sway: 40, swaySpeed: 0.8, spin: 1.2, depth: 0.5 },
    controls: [
      R("amount", "Amount", "", 0, 400, 5),
      R("speed", "Fall speed", "", 10, 400, 5, "px/s"),
      R("size", "Size", "", 3, 30, 0.5, "px"),
      R("sizeVar", "Size variation", "", 0, 1, 0.05),
      R("opacity", "Opacity", "", 0, 1, 0.05),
      COLOR_MODE,
      C("color", "Color", "Used when Color mode is Single color."),
      R("sway", "Sway", "", 0, 200, 1, "px/s"),
      R("swaySpeed", "Sway speed", "", 0.1, 5, 0.1, "x"),
      R("spin", "Tumble", "Rotation and flipping speed.", 0, 4, 0.1, "x"),
      R("depth", "Depth variation", "", 0, 0.9, 0.05)
    ]
  },
  leaves: {
    name: "Autumn leaves",
    blurb: "Falling leaves in warm autumn colors.",
    defaults: { enabled: false, amount: 40, speed: 85, size: 12, sizeVar: 0.5, opacity: 0.95, colorMode: "palette", color: "#d9822b", sway: 55, swaySpeed: 0.9, spin: 1.5, depth: 0.5 },
    controls: [
      R("amount", "Amount", "", 0, 300, 5),
      R("speed", "Fall speed", "", 10, 400, 5, "px/s"),
      R("size", "Size", "", 4, 36, 0.5, "px"),
      R("sizeVar", "Size variation", "", 0, 1, 0.05),
      R("opacity", "Opacity", "", 0, 1, 0.05),
      COLOR_MODE,
      C("color", "Color", "Used when Color mode is Single color."),
      R("sway", "Sway", "", 0, 200, 1, "px/s"),
      R("swaySpeed", "Sway speed", "", 0.1, 5, 0.1, "x"),
      R("spin", "Tumble", "", 0, 4, 0.1, "x"),
      R("depth", "Depth variation", "", 0, 0.9, 0.05)
    ]
  },
  embers: {
    name: "Embers",
    blurb: "Glowing sparks that rise from the bottom of the screen, flicker, and fade out.",
    defaults: { enabled: false, amount: 90, speed: 90, size: 3, sizeVar: 0.7, opacity: 0.9, colorMode: "palette", color: "#ff8a3d", sway: 30, swaySpeed: 1.5, depth: 0.5, life: 6, flicker: 1 },
    controls: [
      R("amount", "Amount", "", 0, 600, 5),
      R("speed", "Rise speed", "", 10, 500, 5, "px/s"),
      R("size", "Size", "", 1, 14, 0.25, "px"),
      R("sizeVar", "Size variation", "", 0, 1, 0.05),
      R("opacity", "Brightness", "", 0, 1, 0.05),
      COLOR_MODE,
      C("color", "Color", "Used when Color mode is Single color."),
      R("sway", "Wobble", "", 0, 150, 1, "px/s"),
      R("swaySpeed", "Wobble speed", "", 0.1, 6, 0.1, "x"),
      R("life", "Lifetime", "How long an ember burns before it dies out.", 1, 20, 0.5, "s"),
      R("flicker", "Flicker", "", 0, 2, 0.05),
      R("depth", "Depth variation", "", 0, 0.9, 0.05)
    ]
  },
  fireflies: {
    name: "Fireflies",
    blurb: "Softly pulsing lights that wander around the screen.",
    defaults: { enabled: false, amount: 35, speed: 32, size: 3.5, sizeVar: 0.5, opacity: 0.9, color: "#d7ff6a", pulseSpeed: 1.1, wander: 1, glowSize: 6, depth: 0.4 },
    controls: [
      R("amount", "Amount", "", 0, 300, 1),
      R("speed", "Wander speed", "", 2, 200, 1, "px/s"),
      R("size", "Core size", "", 1, 10, 0.25, "px"),
      R("sizeVar", "Size variation", "", 0, 1, 0.05),
      R("opacity", "Brightness", "", 0, 1, 0.05),
      C("color", "Color"),
      R("pulseSpeed", "Pulse speed", "How fast they blink.", 0.1, 5, 0.1, "x"),
      R("wander", "Wander", "How twisty their paths are.", 0, 3, 0.1, "x"),
      R("glowSize", "Glow size", "", 2, 14, 0.5, "x"),
      R("depth", "Depth variation", "", 0, 0.9, 0.05)
    ]
  },
  bubbles: {
    name: "Bubbles",
    blurb: "Translucent bubbles that float upward and wobble.",
    defaults: { enabled: false, amount: 45, speed: 60, size: 14, sizeVar: 0.8, opacity: 0.6, color: "#bfe7ff", sway: 22, swaySpeed: 1.2, depth: 0.5 },
    controls: [
      R("amount", "Amount", "", 0, 300, 5),
      R("speed", "Rise speed", "", 10, 400, 5, "px/s"),
      R("size", "Size", "", 3, 60, 0.5, "px"),
      R("sizeVar", "Size variation", "", 0, 1, 0.05),
      R("opacity", "Opacity", "", 0, 1, 0.05),
      C("color", "Color"),
      R("sway", "Sway", "", 0, 150, 1, "px/s"),
      R("swaySpeed", "Sway speed", "", 0.1, 5, 0.1, "x"),
      R("depth", "Depth variation", "", 0, 0.9, 0.05)
    ]
  },
  stars: {
    name: "Stars",
    blurb: "A twinkling star field with occasional shooting stars.",
    defaults: { enabled: false, amount: 160, size: 1.6, sizeVar: 0.7, opacity: 0.9, color: "#ffffff", twinkle: 1, twinkleSpeed: 1.2, sparkles: true, shooting: true, shootRate: 4, shootSpeed: 900, shootTrail: 160 },
    controls: [
      R("amount", "Amount", "Number of stars (at 1080p).", 0, 1200, 5),
      R("size", "Size", "", 0.5, 6, 0.1, "px"),
      R("sizeVar", "Size variation", "", 0, 1, 0.05),
      R("opacity", "Brightness", "", 0, 1, 0.05),
      C("color", "Color"),
      R("twinkle", "Twinkle amount", "", 0, 1, 0.05),
      R("twinkleSpeed", "Twinkle speed", "", 0.1, 5, 0.1, "x"),
      S("sparkles", "Sparkle crosses", "Bigger stars get a small cross-shaped glint."),
      S("shooting", "Shooting stars"),
      R("shootRate", "Shooting star frequency", "Average per minute.", 0.2, 40, 0.2, "/min"),
      R("shootSpeed", "Shooting star speed", "", 300, 2500, 25, "px/s"),
      R("shootTrail", "Shooting star trail", "", 40, 500, 5, "px")
    ]
  },
  confetti: {
    name: "Confetti",
    blurb: "Colorful paper pieces that flutter down.",
    defaults: { enabled: false, amount: 100, speed: 190, size: 7, sizeVar: 0.5, opacity: 1, colorMode: "palette", color: "#ff4d6d", sway: 60, swaySpeed: 2.5, spin: 2, depth: 0.4, burst: 160 },
    controls: [
      R("amount", "Amount", "Continuous falling confetti.", 0, 600, 5),
      R("speed", "Fall speed", "", 20, 700, 5, "px/s"),
      R("size", "Size", "", 2, 24, 0.5, "px"),
      R("sizeVar", "Size variation", "", 0, 1, 0.05),
      R("opacity", "Opacity", "", 0, 1, 0.05),
      COLOR_MODE,
      C("color", "Color", "Used when Color mode is Single color."),
      R("sway", "Flutter", "", 0, 200, 1, "px/s"),
      R("swaySpeed", "Flutter speed", "", 0.1, 8, 0.1, "x"),
      R("spin", "Spin", "", 0, 5, 0.1, "x"),
      R("depth", "Depth variation", "", 0, 0.9, 0.05),
      R("burst", "Burst size", "Pieces fired in a burst.", 20, 600, 10)
    ]
  },
  matrix: {
    name: "Matrix code",
    blurb: "Falling columns of glowing characters. Lower the opacity if it covers too much of Discord.",
    defaults: { enabled: false, amount: 45, speed: 190, size: 16, trail: 16, opacity: 0.8, color: "#33ff77", headColor: "#e8fff0", charset: "katakana", changeRate: 0.15 },
    controls: [
      R("amount", "Columns", "Active columns of code (at 1080p).", 0, 300, 1),
      R("speed", "Speed", "", 40, 800, 5, "px/s"),
      R("size", "Character size", "", 8, 40, 1, "px"),
      R("trail", "Trail length", "Characters per column.", 4, 50, 1),
      R("opacity", "Opacity", "", 0, 1, 0.05),
      C("color", "Trail color"),
      C("headColor", "Head color", "The bright leading character."),
      O("charset", "Characters", [["katakana", "Katakana + digits"], ["binary", "Binary"], ["digits", "Digits"], ["symbols", "Code symbols"]]),
      R("changeRate", "Character flicker", "How often characters change.", 0, 1, 0.01)
    ]
  },
  hearts: {
    name: "Hearts",
    blurb: "Hearts that float up and sway.",
    defaults: { enabled: false, amount: 28, speed: 55, size: 12, sizeVar: 0.6, opacity: 0.85, colorMode: "palette", color: "#ff4d79", sway: 30, swaySpeed: 1, spin: 0.6, depth: 0.5 },
    controls: [
      R("amount", "Amount", "", 0, 200, 1),
      R("speed", "Rise speed", "", 10, 300, 5, "px/s"),
      R("size", "Size", "", 4, 40, 0.5, "px"),
      R("sizeVar", "Size variation", "", 0, 1, 0.05),
      R("opacity", "Opacity", "", 0, 1, 0.05),
      COLOR_MODE,
      C("color", "Color", "Used when Color mode is Single color."),
      R("sway", "Sway", "", 0, 150, 1, "px/s"),
      R("swaySpeed", "Sway speed", "", 0.1, 5, 0.1, "x"),
      R("spin", "Tilt", "", 0, 3, 0.1, "x"),
      R("depth", "Depth variation", "", 0, 0.9, 0.05)
    ]
  },
  crypto: {
    name: "Crypto rain",
    blurb: "Spinning BTC, ETH, SOL, DOGE and LTC coins falling from the sky. They flip in 3D, glint in the light and bounce when they land.",
    defaults: { enabled: false, amount: 70, speed: 170, size: 15, sizeVar: 0.45, opacity: 0.95, coinSet: "all", sway: 28, swaySpeed: 0.8, spin: 1.6, depth: 0.5, glints: true, glow: true, bounce: true, burstSize: 160 },
    controls: [
      R("amount", "Amount", "Coins falling at once.", 0, 600, 5),
      R("speed", "Fall speed", "Terminal speed of the coins.", 40, 900, 5, "px/s"),
      R("size", "Coin size", "Radius of the nearest coins.", 6, 40, 0.5, "px"),
      R("sizeVar", "Size variation", "", 0, 1, 0.05),
      R("opacity", "Opacity", "", 0, 1, 0.05),
      O("coinSet", "Coins", [["all", "All coins"], ["btc", "Bitcoin only"], ["eth", "Ethereum only"], ["sol", "Solana only"], ["doge", "Dogecoin only"], ["ltc", "Litecoin only"], ["bte", "Bitcoin + Ethereum"]], "Which coins fall."),
      R("sway", "Sway", "", 0, 150, 1, "px/s"),
      R("swaySpeed", "Sway speed", "", 0.1, 5, 0.1, "x"),
      R("spin", "Coin flip speed", "How fast coins spin on their edge.", 0, 4, 0.1, "x"),
      R("depth", "Depth variation", "Higher = more small, slow coins in the back.", 0, 0.9, 0.05),
      S("glints", "Glints", "Sparkles when a coin catches the light face-on."),
      S("glow", "Soft glow", "A faint colored halo around each coin."),
      S("bounce", "Bounce on landing", "Coins hit the floor, bounce, then fade."),
      R("burstSize", "Burst size", "Coins in a \"Make it rain\" burst.", 20, 600, 10)
    ]
  },
  nyan: {
    name: "Nyan cat",
    blurb: "Pixel cats with a pastry body fly across the screen trailing a rainbow and twinkling stars.",
    defaults: { enabled: false, amount: 2, speed: 380, size: 4, sizeVar: 0.25, opacity: 1, trail: 520, wave: true, sparkles: true, bob: 10, direction: "right", gap: 2.5 },
    controls: [
      R("amount", "Cats at once", "", 1, 10, 1),
      R("speed", "Flight speed", "", 80, 1400, 10, "px/s"),
      R("size", "Pixel size", "How big each pixel of the cat is.", 2, 10, 0.5, "px"),
      R("sizeVar", "Size variation", "", 0, 0.8, 0.05),
      R("opacity", "Opacity", "", 0.1, 1, 0.05),
      R("trail", "Rainbow length", "", 60, 1400, 10, "px"),
      S("wave", "Rainbow wiggle", "The classic zig-zag in the trail."),
      S("sparkles", "Star sparkles", "Twinkling stars left behind the cat."),
      R("bob", "Vertical bob", "How much the cat bounces up and down.", 0, 40, 1, "px"),
      O("direction", "Direction", [["right", "Left to right"], ["left", "Right to left"], ["both", "Either way"]]),
      R("gap", "Time between cats", "Average gap before a new cat takes off.", 0.2, 20, 0.1, "s")
    ]
  },
  blocks: {
    name: "Falling blocks",
    blurb: "Pixel-textured isometric cubes (grass, dirt, stone, planks, ores, TNT, glowstone) tumbling down like a creative-mode rain.",
    defaults: { enabled: false, amount: 32, speed: 110, size: 34, sizeVar: 0.4, opacity: 1, blockSet: "all", sway: 22, swaySpeed: 0.7, spin: 0.5, depth: 0.5 },
    controls: [
      R("amount", "Amount", "", 0, 300, 2),
      R("speed", "Fall speed", "", 20, 600, 5, "px/s"),
      R("size", "Block size", "Width of the nearest blocks.", 12, 90, 1, "px"),
      R("sizeVar", "Size variation", "", 0, 1, 0.05),
      R("opacity", "Opacity", "", 0, 1, 0.05),
      O("blockSet", "Blocks", [["all", "Everything"], ["terrain", "Terrain (grass, dirt, stone, planks)"], ["ores", "Ores (diamond, gold, redstone)"], ["tnt", "TNT"], ["glow", "Glowstone"]]),
      R("sway", "Sway", "", 0, 150, 1, "px/s"),
      R("swaySpeed", "Sway speed", "", 0.1, 5, 0.1, "x"),
      R("spin", "Tumble", "", 0, 3, 0.1, "x"),
      R("depth", "Depth variation", "", 0, 0.9, 0.05)
    ]
  },
  xp: {
    name: "XP orbs",
    blurb: "Glowing green-yellow experience orbs that drift upward and pulse. Optionally they fly to your cursor and get collected.",
    defaults: { enabled: false, amount: 45, speed: 55, size: 6, sizeVar: 0.5, opacity: 0.95, sway: 35, swaySpeed: 1, depth: 0.5, pulse: 1, attract: true, attractRadius: 260 },
    controls: [
      R("amount", "Amount", "", 0, 400, 5),
      R("speed", "Rise speed", "", 10, 400, 5, "px/s"),
      R("size", "Orb size", "", 2, 20, 0.5, "px"),
      R("sizeVar", "Size variation", "", 0, 1, 0.05),
      R("opacity", "Opacity", "", 0, 1, 0.05),
      R("sway", "Sway", "", 0, 150, 1, "px/s"),
      R("swaySpeed", "Sway speed", "", 0.1, 5, 0.1, "x"),
      R("depth", "Depth variation", "", 0, 0.9, 0.05),
      R("pulse", "Pulse speed", "Color shift between green and yellow.", 0, 4, 0.1, "x"),
      S("attract", "Orbs chase the cursor", "Nearby orbs fly to your mouse and get collected."),
      R("attractRadius", "Chase radius", "", 60, 700, 10, "px")
    ]
  },
  nether: {
    name: "Nether",
    blurb: "Square-pixel particles from the Nether biomes: embers and ash, soul flames, crimson and warped spores. Includes a colored glow rising from the bottom of the screen.",
    defaults: { enabled: false, amount: 140, speed: 60, size: 4, sizeVar: 0.5, opacity: 0.9, biome: "wastes", sway: 24, haze: 0.2, flicker: true },
    controls: [
      O("biome", "Biome", [["wastes", "Nether wastes (embers + ash)"], ["soul", "Soul sand valley"], ["crimson", "Crimson forest"], ["warped", "Warped forest"], ["basalt", "Basalt deltas (ash)"]]),
      R("amount", "Amount", "", 0, 900, 5),
      R("speed", "Drift speed", "", 10, 300, 5, "px/s"),
      R("size", "Particle size", "Pixel square size.", 2, 14, 1, "px"),
      R("sizeVar", "Size variation", "", 0, 1, 0.05),
      R("opacity", "Opacity", "", 0, 1, 0.05),
      R("sway", "Sway", "", 0, 120, 1, "px/s"),
      R("haze", "Bottom glow", "Biome-colored glow rising from the bottom edge.", 0, 0.7, 0.02),
      S("flicker", "Flicker", "Embers and flames flicker as they rise.")
    ]
  },
  end: {
    name: "The End",
    blurb: "Purple and teal portal motes drifting up through the dark, with optional Enderman eyes that blink open in the void.",
    defaults: { enabled: false, amount: 120, speed: 38, size: 3, sizeVar: 0.5, opacity: 0.9, sway: 30, twinkle: 0.6, eyes: true, eyeRate: 5, eyeSize: 5 },
    controls: [
      R("amount", "Amount", "", 0, 800, 5),
      R("speed", "Drift speed", "", 5, 250, 1, "px/s"),
      R("size", "Particle size", "", 1, 12, 1, "px"),
      R("sizeVar", "Size variation", "", 0, 1, 0.05),
      R("opacity", "Opacity", "", 0, 1, 0.05),
      R("sway", "Sway", "", 0, 120, 1, "px/s"),
      R("twinkle", "Twinkle", "", 0, 1, 0.05),
      S("eyes", "Enderman eyes", "Pairs of purple eyes blink open somewhere on screen, then vanish."),
      R("eyeRate", "Eye frequency", "Average appearances per minute.", 0.5, 40, 0.5, "/min"),
      R("eyeSize", "Eye size", "", 2, 14, 1, "px")
    ]
  },
  storm: {
    name: "The Storm",
    blurb: "A purple storm closing in from the screen edges: pulsing wall, drifting motes and purple lightning, battle-royale style.",
    defaults: { enabled: false, amount: 70, speed: 40, size: 3, opacity: 0.8, color: "#8f2cff", edge: 0.5, pulse: 0.8, lightning: true, lightningRate: 6, lightningPower: 0.7 },
    controls: [
      R("edge", "Storm reach", "How far the storm wall creeps in from the edges.", 0.1, 1, 0.02),
      R("opacity", "Storm density", "", 0.05, 1, 0.05),
      C("color", "Storm color"),
      R("pulse", "Pulse speed", "How fast the wall breathes in and out.", 0, 4, 0.1, "x"),
      R("amount", "Motes", "Floating storm particles.", 0, 500, 5),
      R("speed", "Mote speed", "", 5, 250, 1, "px/s"),
      R("size", "Mote size", "", 1, 10, 0.5, "px"),
      S("lightning", "Lightning", "Purple bolts crackle in from the edges."),
      R("lightningRate", "Lightning frequency", "", 0.5, 30, 0.5, "/min"),
      R("lightningPower", "Flash brightness", "", 0.1, 1, 0.05)
    ]
  },
  tetris: {
    name: "Tetris",
    blurb: "A Tetris board that plays itself in the corner: pieces fall, stack up, clear lines, and when the stack gets too high the board wipes and starts over. Press [[fxTetris]] (or the Play button) to take over and play it with your mouse: move to slide, left click rotates, right click hard drops, wheel down soft drops, wheel up rotates back, middle click holds. P pauses, Esc exits.",
    defaults: { enabled: false, cols: 10, rows: 20, cell: 26, opacity: 0.6, speed: 4, skill: 0.8, position: "right", panel: false, ghost: true },
    controls: [
      R("cols", "Board width", "Columns in the board (10 is classic).", 6, 30, 1),
      R("rows", "Board height", "Rows in the board.", 12, 30, 1),
      R("cell", "Block size", "Size of each block in auto mode. The board grows while you play.", 12, 60, 1, "px"),
      R("opacity", "Opacity", "Auto mode only.", 0.1, 1, 0.05),
      R("speed", "Auto fall speed", "How fast pieces fall while the board plays itself.", 1, 20, 0.5, "rows/s"),
      R("skill", "Auto-player skill", "Low = sloppy, the stack piles up and wipes more often. High = tidy, keeps clearing lines.", 0, 1, 0.05),
      O("position", "Auto board position", [["right", "Bottom right"], ["left", "Bottom left"], ["center", "Bottom center"]]),
      S("panel", "Faint backdrop and grid", "Show the board outline behind the blocks in auto mode."),
      S("ghost", "Ghost piece", "Outline of where the piece will land while you play.")
    ]
  },
  candles: {
    name: "Candlestick chart",
    blurb: "A green and red candlestick chart scrolling across the screen, with an optional moving average, price line and ticker label.",
    defaults: { enabled: false, position: "bottom", height: 0.3, width: 10, speed: 60, volatility: 1, trend: "random", opacity: 0.55, ma: true, priceLine: true, label: true },
    controls: [
      O("position", "Position", [["top", "Top"], ["middle", "Middle"], ["bottom", "Bottom"], ["full", "Full screen"]]),
      R("height", "Chart height", "Fraction of the screen the chart fills (ignored for full screen).", 0.1, 0.9, 0.05),
      R("width", "Candle width", "", 3, 40, 1, "px"),
      R("speed", "Scroll speed", "", 10, 400, 5, "px/s"),
      R("volatility", "Volatility", "How wild the price swings are.", 0.2, 3, 0.1, "x"),
      O("trend", "Market mood", [["random", "Sideways"], ["bull", "Bull run"], ["bear", "Bear market"]]),
      R("opacity", "Opacity", "", 0.1, 1, 0.05),
      S("ma", "Moving average line", "A smoothed line through the closes."),
      S("priceLine", "Price line", "Dashed line and tag at the latest price."),
      S("label", "Ticker label", "BTC/USD price and change in the corner of the chart.")
    ]
  },
  gems: {
    name: "Diamond hands",
    blurb: "Faceted gems that tumble down and catch the light with a sparkle. Diamond hands only.",
    defaults: { enabled: false, amount: 40, speed: 75, size: 13, sizeVar: 0.5, opacity: 0.95, colorMode: "palette", color: "#7ee8ff", sway: 30, swaySpeed: 0.9, spin: 1, depth: 0.5, sparkle: true, glow: true },
    controls: [
      R("amount", "Amount", "", 0, 300, 1),
      R("speed", "Fall speed", "", 10, 500, 5, "px/s"),
      R("size", "Gem size", "", 4, 50, 0.5, "px"),
      R("sizeVar", "Size variation", "", 0, 1, 0.05),
      R("opacity", "Opacity", "", 0, 1, 0.05),
      COLOR_MODE,
      C("color", "Color", "Used when Color mode is Single color."),
      R("sway", "Sway", "", 0, 150, 1, "px/s"),
      R("swaySpeed", "Sway speed", "", 0.1, 5, 0.1, "x"),
      R("spin", "Tumble", "", 0, 4, 0.1, "x"),
      R("depth", "Depth variation", "", 0, 0.9, 0.05),
      S("sparkle", "Sparkle", "Cross-shaped glints that flash across each gem."),
      S("glow", "Soft glow", "A faint colored halo around each gem.")
    ]
  },
  pacman: {
    name: "Pac-Man",
    blurb: "Pac-Man and his ghosts march across the screen along a row of pellets. Sometimes the ghosts chase him, sometimes they run scared.",
    defaults: { enabled: false, amount: 2, speed: 170, size: 20, opacity: 0.9, gap: 5, ghosts: 4, mode: "mixed", pellets: true, pacman: true, direction: "both" },
    controls: [
      R("amount", "Lanes at once", "", 1, 6, 1),
      R("speed", "Speed", "", 40, 800, 5, "px/s"),
      R("size", "Size", "Radius of Pac-Man and the ghosts.", 8, 60, 1, "px"),
      R("opacity", "Opacity", "", 0.1, 1, 0.05),
      R("gap", "Time between runs", "Average gap before another lane starts.", 0.2, 30, 0.2, "s"),
      R("ghosts", "Ghosts per lane", "", 1, 4, 1),
      O("mode", "Who chases who", [["mixed", "Mixed"], ["chase", "Ghosts chase Pac-Man"], ["power", "Pac-Man chases scared ghosts"]]),
      S("pacman", "Include Pac-Man", "Off = just ghosts drifting by."),
      S("pellets", "Pellet trail", "A row of pellets that Pac-Man eats as he passes."),
      O("direction", "Direction", [["right", "Left to right"], ["left", "Right to left"], ["both", "Either way"]])
    ]
  },
  cursor: {
    name: "Cursor trails",
    blurb: "A trail that follows your mouse: a rainbow ribbon, fire, stars or coins. It reacts to you instead of running on its own. Trails are drawn on the effects overlay, so keep Layer set to 'In front of everything' in General.",
    defaults: { enabled: false, style: "rainbow", size: 10, length: 0.9, density: 1, opacity: 0.9, glow: true, idle: false, coinSet: "all" },
    controls: [
      O("style", "Trail style", [["rainbow", "Rainbow"], ["fire", "Fire"], ["stars", "Stars"], ["coins", "Coins"]]),
      R("size", "Size", "Ribbon thickness, flame size, star size or coin size.", 4, 30, 0.5, "px"),
      R("length", "Trail length", "How long the trail lasts after you move.", 0.2, 2.5, 0.05, "s"),
      R("density", "Density", "How many particles per distance moved (not used by rainbow).", 0.2, 3, 0.1, "x"),
      R("opacity", "Opacity", "", 0.1, 1, 0.05),
      S("glow", "Soft glow", "Halo around stars and coins."),
      S("idle", "Keep emitting when still", "Fire, stars and coins keep spawning while the cursor rests."),
      O("coinSet", "Coins", [["all", "All coins"], ["btc", "Bitcoin only"], ["eth", "Ethereum only"], ["doge", "Dogecoin only"], ["sol", "Solana only"], ["ltc", "Litecoin only"]], "Which coins pop out of the coin trail.")
    ]
  }
};
const FX_KEYS = Object.keys(FX);

const GENERAL_DEFAULTS = {
  master: true, layer: "front", timeScale: 1, globalOpacity: 1,
  mouse: false, mouseRadius: 140, mouseForce: 500,
  scaleByWindow: true, maxParticles: 3000, fpsCap: 60, renderScale: 1, pauseOnBlur: true, showFps: false
};

const PRESETS = {
  "Light rain": { fx: { rain: { amount: 220, speed: 850 }, glass: { amount: 35, spawnRate: 2 } } },
  "Heavy rain": { fx: { rain: { amount: 900, speed: 1400, length: 36 }, glass: { amount: 110, spawnRate: 9 } } },
  "Thunderstorm": { fx: { rain: { amount: 1100, speed: 1500, length: 38, thickness: 1.5, lightning: true, lightningRate: 7, lightningPower: 0.7 }, glass: { amount: 120, spawnRate: 10 } } },
  "Cozy window": { fx: { rain: { amount: 160, speed: 700, opacity: 0.35 }, glass: { amount: 90, spawnRate: 3, life: 50 } } },
  "Snowfall": { fx: { snow: { amount: 260 } } },
  "Blizzard": { fx: { snow: { amount: 1000, speed: 230, size: 2.6, sway: 60 } } },
  "Sakura breeze": { fx: { sakura: { amount: 70 } } },
  "Autumn leaves": { fx: { leaves: { amount: 45 } } },
  "Campfire embers": { fx: { embers: { amount: 110 } } },
  "Summer night": { fx: { fireflies: { amount: 45 }, stars: { amount: 140, shooting: false } } },
  "Starry night": { fx: { stars: { amount: 260, shootRate: 8 } } },
  "Underwater": { fx: { bubbles: { amount: 70 } } },
  "Party": { fx: { confetti: { amount: 140 } } },
  "Cyber rain": { fx: { matrix: { amount: 70 } } },
  "Valentine": { fx: { hearts: { amount: 36 } } },
  "Crypto rain": { fx: { crypto: { amount: 120 } } },
  "To the moon": { fx: { crypto: { amount: 60, coinSet: "btc" }, stars: { amount: 220, shootRate: 10 } } },
  "Nyan party": { fx: { nyan: { amount: 3 }, stars: { amount: 90, shooting: false } } },
  "Creative mode": { fx: { blocks: { amount: 36 }, xp: { amount: 30 } } },
  "Nether": { fx: { nether: { amount: 180 } } },
  "Soul sand valley": { fx: { nether: { biome: "soul", amount: 160, haze: 0.25 } } },
  "The End": { fx: { end: { amount: 140 }, stars: { amount: 70, shooting: false } } },
  "Storm closing in": { fx: { storm: { amount: 90 } } },
  "Tetris stacking": { fx: { tetris: {} } },
  "Diamond hands": { fx: { gems: { amount: 55 }, stars: { amount: 120, shooting: false } } },
  "Candle chart": { fx: { candles: {}, stars: { amount: 90, shooting: false } } },
  "Arcade": { fx: { pacman: {}, tetris: {} } },
  "Rainbow cursor": { only: true, fx: { cursor: { style: "rainbow" } } },
  "Fire cursor": { only: true, fx: { cursor: { style: "fire" } } },
  "Star cursor": { only: true, fx: { cursor: { style: "stars" } } },
  "Coin cursor": { only: true, fx: { cursor: { style: "coins" } } }
};

const PALETTES = {
  sakura: ["#ffc6d9", "#ffb3cc", "#ffd9e6", "#ff9fbd", "#ffe3ec"],
  leaves: ["#d9822b", "#c2571a", "#e8a33d", "#a63d14", "#8c6a1f", "#b8431f"],
  embers: ["#ff6a1f", "#ff9a3d", "#ffc34d", "#ff4d1a", "#ffd98a"],
  hearts: ["#ff4d79", "#ff7aa2", "#ff2e63", "#ff9db8", "#e8336d"],
  confetti: ["#ff4d6d", "#ffd166", "#06d6a0", "#118ab2", "#9b5de5", "#f15bb5", "#ffffff"]
};
const CHARSETS = {
  katakana: "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789".split(""),
  binary: "01".split(""),
  digits: "0123456789".split(""),
  symbols: "<>[]{}/\\|+-=*#$%&@;:".split("")
};

const KINDS = {
  snow: {
    dir: 1,
    draw(ctx, p, c, col) {
      const r = p.s;
      const crystal = c.shape === "crystals" || (c.shape === "mixed" && p.kv > 0.7 && r > 2.4);
      if (crystal) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(0.6, r * 0.18);
        ctx.lineCap = "round";
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3, ca = Math.cos(a), sa = Math.sin(a);
          ctx.moveTo(0, 0);
          ctx.lineTo(ca * r * 1.6, sa * r * 1.6);
          const bx = ca * r, by = sa * r, b = r * 0.5;
          ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a + 0.9) * b, by + Math.sin(a + 0.9) * b);
          ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a - 0.9) * b, by + Math.sin(a - 0.9) * b);
        }
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.fillStyle = col;
        if (c.glow && r > 1.8) {
          const a0 = ctx.globalAlpha;
          ctx.globalAlpha = a0 * 0.28;
          ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.9, 0, TAU); ctx.fill();
          ctx.globalAlpha = a0;
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
      }
    }
  },
  sakura: {
    dir: 1, palette: PALETTES.sakura,
    draw(ctx, p, c, col) {
      const s = p.s;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.max(0.15, Math.abs(Math.cos(p.flip))));
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s * 0.95, -s * 0.7, s * 0.8, s * 0.75, 0, s);
      ctx.bezierCurveTo(-s * 0.8, s * 0.75, -s * 0.95, -s * 0.7, 0, -s * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha *= 0.35;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(0.5, s * 0.07);
      ctx.beginPath(); ctx.moveTo(0, -s * 0.4); ctx.lineTo(0, s * 0.7); ctx.stroke();
      ctx.restore();
    }
  },
  leaves: {
    dir: 1, palette: PALETTES.leaves,
    draw(ctx, p, c, col) {
      const s = p.s;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(Math.max(0.2, Math.abs(Math.cos(p.flip))), 1);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s * 0.9, -s * 0.3, s * 0.7, s * 0.6, 0, s);
      ctx.bezierCurveTo(-s * 0.7, s * 0.6, -s * 0.9, -s * 0.3, 0, -s);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.35)";
      ctx.lineWidth = Math.max(0.5, s * 0.07);
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.8); ctx.lineTo(0, s * 1.25);
      ctx.moveTo(0, -s * 0.1); ctx.lineTo(s * 0.4, -s * 0.4);
      ctx.moveTo(0, s * 0.2); ctx.lineTo(-s * 0.4, -s * 0.1);
      ctx.moveTo(0, s * 0.45); ctx.lineTo(s * 0.35, s * 0.2);
      ctx.stroke();
      ctx.restore();
    }
  },
  embers: {
    dir: -1, life: true, add: true, palette: PALETTES.embers,
    alpha(p, c, t) {
      const lr = clamp(p.life / p.ml, 0, 1);
      const fl = 1 - c.flicker * 0.45 * (0.5 + 0.5 * Math.sin(t * p.fs * 3 + p.ph));
      return Math.min(1, lr * 1.6) * Math.min(1, (p.ml - p.life) * 2) * fl;
    },
    draw(ctx, p, c, col) {
      const lr = clamp(p.life / p.ml, 0, 1);
      const r = p.s * (0.4 + 0.6 * lr);
      ctx.drawImage(glowSprite(col), p.x - r * 3.2, p.y - r * 3.2, r * 6.4, r * 6.4);
      ctx.fillStyle = "#fff4d0";
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.45, 0, TAU); ctx.fill();
    }
  },
  bubbles: {
    dir: -1,
    draw(ctx, p, c, col, a) {
      const r = p.s, w = 1 + 0.06 * Math.sin(a.t * 3 + p.ph);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = col;
      ctx.globalAlpha *= 0.12;
      ctx.beginPath(); ctx.ellipse(0, 0, r * w, r / w, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha /= 0.12;
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(0.8, r * 0.07);
      ctx.beginPath(); ctx.ellipse(0, 0, r * w, r / w, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.globalAlpha = Math.min(1, ctx.globalAlpha * 1.6);
      ctx.lineWidth = Math.max(0.8, r * 0.1);
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(0, 0, r * 0.68, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
      ctx.restore();
    }
  },
  hearts: {
    dir: -1, palette: PALETTES.hearts,
    draw(ctx, p, c, col) {
      const s = p.s * 0.8;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.sin(p.rot) * 0.45);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.9);
      ctx.bezierCurveTo(-s * 1.6, -s * 0.1, -s * 0.9, -s * 1.2, 0, -s * 0.4);
      ctx.bezierCurveTo(s * 0.9, -s * 1.2, s * 1.6, -s * 0.1, 0, s * 0.9);
      ctx.fill();
      ctx.restore();
    }
  },
  confetti: {
    dir: 1, palette: PALETTES.confetti,
    draw(ctx, p, c, col) {
      const s = p.s;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.flip));
      ctx.fillStyle = col;
      ctx.fillRect(-s * 0.8, -s * 0.4, s * 1.6, s * 0.8);
      ctx.restore();
    }
  }
};

class Layer {
  constructor(app, key) { this.app = app; this.key = key; this.p = []; }
  get c() { return this.app.s.fx[this.key]; }
  count() {
    const c = this.c;
    if (!c.enabled) return 0;
    const f = this.app.s.scaleByWindow ? clamp((this.app.W * this.app.H) / 2073600, 0.25, 3) : 1;
    return Math.min(this.app.s.maxParticles, Math.round(c.amount * f));
  }
  leftovers() { return false; }
  active() { return !!this.c.enabled || this.leftovers(); }
  base() { return this.c.opacity * this.app.s.globalOpacity; }
  pushAway(p, dt) {
    const a = this.app, s = a.s;
    if (!s.mouse || !a.mouse.on) return;
    const dx = p.x - a.mouse.x, dy = p.y - a.mouse.y, r = s.mouseRadius, d2 = dx * dx + dy * dy;
    if (d2 > r * r || d2 < 0.01) return;
    const d = Math.sqrt(d2), f = (1 - d / r) * s.mouseForce * dt;
    p.x += (dx / d) * f; p.y += (dy / d) * f;
  }
  fill(n, makeFn) {
    while (this.p.length < n) this.p.push(makeFn(true));
    if (this.p.length > n) this.p.length = n;
  }
}

class Flow extends Layer {
  constructor(app, key, kind) { super(app, key); this.kind = kind || key; this.K = KINDS[this.kind]; }
  make(first) {
    const c = this.c;
    const z = 1 - c.depth * Math.random();
    const p = {
      z, ph: rand(0, TAU), rot: rand(0, TAU), rv: rand(-1, 1), flip: rand(0, TAU), fs: rand(1.5, 4),
      sv: rand(0.75, 1.25), ci: (Math.random() * 16) | 0, kv: Math.random(), life: 0, ml: 0, x: 0, y: 0, vx: 0
    };
    p.s = c.size * lerp(1 - c.sizeVar, 1, Math.random()) * (0.55 + 0.45 * z);
    p.a = 0.45 + 0.55 * z;
    this.place(p, first);
    return p;
  }
  place(p, first) {
    const a = this.app, c = this.c, K = this.K, m = 40 + p.s * 2;
    p.x = rand(-m, a.W + m);
    if (K.dir > 0) p.y = first ? rand(-m, a.H) : -m - rand(0, 60);
    else p.y = first ? rand(0, a.H + m) : a.H + m + rand(0, 60);
    if (K.life) { p.ml = c.life * rand(0.6, 1.2); p.life = first ? rand(0.1, p.ml) : p.ml; }
  }
  tick(dt) {
    const a = this.app, c = this.c, K = this.K, t = a.t, W = a.W, H = a.H;
    this.fill(this.count(), (f) => this.make(f));
    const spin = c.spin ?? 0.3;
    for (const p of this.p) {
      const sw = Math.cos(p.ph + t * c.swaySpeed) * c.sway * p.z;
      p.x += sw * dt;
      p.y += K.dir * c.speed * p.z * p.sv * dt;
      p.rot += p.rv * spin * dt * 2;
      p.flip += p.fs * dt * Math.max(0.2, spin);
      this.pushAway(p, dt);
      if (K.life) { p.life -= dt; if (p.life <= 0) { this.place(p, false); continue; } }
      const m = 60 + p.s * 2;
      if (K.dir > 0 ? p.y > H + m : p.y < -m) this.place(p, false);
      if (p.x > W + m) p.x = -m; else if (p.x < -m) p.x = W + m;
    }
  }
  colorOf(p) {
    const c = this.c, pal = this.K.palette;
    return pal && c.colorMode === "palette" ? pal[p.ci % pal.length] : c.color;
  }
  draw(ctx) {
    const a = this.app, c = this.c, K = this.K, base = this.base();
    if (K.add) ctx.globalCompositeOperation = "lighter";
    for (const p of this.p) {
      const al = base * p.a * (K.alpha ? K.alpha(p, c, a.t) : 1);
      if (al <= 0.003) continue;
      ctx.globalAlpha = Math.min(1, al);
      K.draw(ctx, p, c, this.colorOf(p), a);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
}

class ConfettiLayer extends Flow {
  constructor(app) { super(app, "confetti", "confetti"); this.b = []; }
  leftovers() { return this.b.length > 0; }
  burst(n) {
    const a = this.app, c = this.c, count = n || c.burst;
    for (let i = 0; i < count; i++) {
      const left = i % 2 === 0;
      const ang = rand(0.55, 1.4);
      const sp = rand(700, 1500);
      this.b.push({
        x: left ? a.W * 0.04 : a.W * 0.96, y: a.H * 0.97,
        vx: Math.cos(ang) * sp * (left ? 1 : -1), vy: -Math.sin(ang) * sp,
        rot: rand(0, TAU), rv: rand(-8, 8), flip: rand(0, TAU), fs: rand(5, 12),
        s: c.size * rand(0.7, 1.3), ci: (Math.random() * 16) | 0, life: rand(3, 6)
      });
    }
  }
  tick(dt) {
    super.tick(dt);
    const a = this.app;
    for (let i = this.b.length - 1; i >= 0; i--) {
      const p = this.b[i];
      p.vy += 900 * dt;
      p.vx *= 1 - Math.min(1, 1.6 * dt);
      p.vy *= 1 - Math.min(1, 0.7 * dt);
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.rv * dt; p.flip += p.fs * dt; p.life -= dt;
      if (p.life <= 0 || p.y > a.H + 50) this.b.splice(i, 1);
    }
  }
  draw(ctx) {
    super.draw(ctx);
    const c = this.c, base = this.app.s.globalOpacity * Math.max(0.6, c.opacity);
    for (const p of this.b) {
      ctx.globalAlpha = clamp(base * Math.min(1, p.life), 0, 1);
      KINDS.confetti.draw(ctx, p, c, c.colorMode === "palette" ? PALETTES.confetti[p.ci % PALETTES.confetti.length] : c.color, this.app);
    }
    ctx.globalAlpha = 1;
  }
}

class RainLayer extends Layer {
  constructor(app) { super(app, "rain"); this.sp = []; this.fl = null; this.nextBolt = rand(3, 10); }
  leftovers() { return this.sp.length > 0 || !!this.fl; }
  make(first) {
    const a = this.app, c = this.c;
    const z = 1 - c.depth * Math.random();
    const p = { z, x: 0, y: 0, v: 0, l: 0, w: 0, g: 0 };
    p.v = c.speed * z * lerp(1 - c.speedVar, 1 + c.speedVar * 0.4, Math.random());
    p.l = c.length * (0.5 + 0.5 * z) * rand(0.8, 1.2);
    p.w = c.thickness * (0.5 + 0.5 * z);
    this.place(p, first);
    return p;
  }
  place(p, first) {
    const a = this.app, c = this.c;
    p.x = rand(-60, a.W + 60);
    p.g = a.H - (1 - p.z) * c.ground * a.H * rand(0.5, 1.4) - rand(0, 8);
    p.y = first ? rand(-50, p.g) : -rand(20, 200);
  }
  strike() {
    const a = this.app;
    this.fl = { t: 0, bolt: this.makeBolt(a.W, a.H) };
  }
  makeBolt(W, H) {
    const pts = [], branches = [];
    let x = rand(W * 0.1, W * 0.9), y = 0;
    const endY = rand(H * 0.45, H * 0.85);
    pts.push([x, y]);
    while (y < endY) {
      y += rand(18, 42); x += rand(-34, 34);
      pts.push([x, y]);
      if (Math.random() < 0.18 && branches.length < 4) {
        const br = [[x, y]]; let bx = x, by = y, dir = Math.random() < 0.5 ? -1 : 1;
        const n = 3 + ((Math.random() * 5) | 0);
        for (let i = 0; i < n; i++) { bx += dir * rand(8, 30); by += rand(14, 34); br.push([bx, by]); }
        branches.push(br);
      }
    }
    return { pts, branches };
  }
  flashAt(t) { return t < 0.06 ? 1 : t < 0.12 ? 0.15 : t < 0.2 ? 0.85 : 0.85 * Math.exp(-(t - 0.2) * 5); }
  tick(dt) {
    const a = this.app, c = this.c, H = a.H;
    this.fill(this.count(), (f) => this.make(f));
    for (const p of this.p) {
      p.y += p.v * dt;
      this.pushAway(p, dt);
      if (p.y > p.g) {
        if (c.splashes && this.sp.length < 260 && Math.random() < 0.55) {
          const r = c.splashSize * (2.5 + 5 * p.z);
          this.sp.push({ x: p.x, y: p.g, t: 0, r, z: p.z, d: [rand(-1, 1), rand(-1, 1), rand(-1, 1)].map((k) => ({ vx: k * 55, vy: -rand(40, 110) })) });
        }
        this.place(p, false);
      }
    }
    for (let i = this.sp.length - 1; i >= 0; i--) { this.sp[i].t += dt / 0.4; if (this.sp[i].t >= 1) this.sp.splice(i, 1); }
    if (c.enabled && c.lightning) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0 && !this.fl) { this.strike(); this.nextBolt = -Math.log(1 - Math.random()) * (60 / Math.max(0.1, c.lightningRate)); }
    }
    if (this.fl) { this.fl.t += dt; if (this.fl.t > 1.4) this.fl = null; }
  }
  draw(ctx) {
    const a = this.app, c = this.c, base = this.base();
    ctx.lineCap = "round";
    ctx.strokeStyle = c.color;
    for (const p of this.p) {
      const vy = p.v, ux = 0, uy = 1;
      ctx.globalAlpha = Math.min(1, base * (0.35 + 0.65 * p.z));
      ctx.lineWidth = p.w;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - ux * p.l, p.y - uy * p.l); ctx.stroke();
    }
    for (const s of this.sp) {
      const k = s.t, r = s.r * (0.3 + k);
      ctx.globalAlpha = Math.min(1, base * (1 - k) * (0.4 + 0.6 * s.z));
      ctx.lineWidth = Math.max(0.5, 1.1 * s.z);
      ctx.beginPath(); ctx.ellipse(s.x, s.y, r, r * 0.35, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = c.color;
      for (const d of s.d) {
        const tt = k * 0.4, x = s.x + d.vx * tt, y = s.y + d.vy * tt + 260 * tt * tt;
        ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, 0.9 * s.z), 0, TAU); ctx.fill();
      }
    }
    if (this.fl) {
      const f = this.flashAt(this.fl.t) * c.lightningPower;
      ctx.globalAlpha = clamp(f * 0.4 * this.app.s.globalOpacity, 0, 1);
      ctx.fillStyle = "#dfe8ff";
      ctx.fillRect(0, 0, a.W, a.H);
      if (c.bolts && this.fl.t < 0.3) {
        const bf = this.flashAt(this.fl.t);
        ctx.globalAlpha = clamp(bf * this.app.s.globalOpacity, 0, 1);
        ctx.shadowColor = "#a9c4ff"; ctx.shadowBlur = 22;
        const draw = (pts, w) => {
          ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
          ctx.lineWidth = w; ctx.stroke();
        };
        ctx.strokeStyle = "#bcd0ff"; ctx.lineJoin = "round";
        draw(this.fl.bolt.pts, 5); for (const b of this.fl.bolt.branches) draw(b, 2.5);
        ctx.shadowBlur = 0; ctx.strokeStyle = "#ffffff";
        draw(this.fl.bolt.pts, 2); for (const b of this.fl.bolt.branches) draw(b, 1);
      }
    }
    ctx.globalAlpha = 1;
  }
}

class GlassLayer extends Layer {
  constructor(app) { super(app, "glass"); this.tr = []; this.acc = 0; }
  active() { return !!this.c.enabled; }
  spawn() {
    const a = this.app, c = this.c;
    const lo = Math.min(c.sizeMin, c.sizeMax), hi = Math.max(c.sizeMin, c.sizeMax);
    this.p.push({
      x: rand(0, a.W), y: rand(0, a.H * 0.94), r: rand(lo * 0.35, lo), target: rand(lo, hi), gr: rand(0.4, 1.4),
      age: 0, slider: Math.random() < c.slideChance, sliding: false, vy: 0, moving: true, timer: rand(0.2, 0.8), ty: 0
    });
  }
  endTrail(d) {
    if (this.app.s.fx.glass.trails && this.tr.length < 140 && d.sliding) this.tr.push({ x: d.x, y1: d.ty, y2: d.y, w: Math.max(1, d.r * 0.55), life: 5, max: 5 });
  }
  tick(dt) {
    const a = this.app, c = this.c;
    const lim = Math.min(c.amount, a.s.maxParticles);
    const lo = Math.min(c.sizeMin, c.sizeMax), hi = Math.max(c.sizeMin, c.sizeMax);
    this.acc += dt * c.spawnRate;
    while (this.acc >= 1) { this.acc -= 1; if (this.p.length < lim) this.spawn(); }
    while (this.p.length > lim) this.p.shift();
    for (let i = this.p.length - 1; i >= 0; i--) {
      const d = this.p[i];
      d.age += dt;
      if (d.age > c.life) { this.endTrail(d); this.p.splice(i, 1); continue; }
      if (!d.sliding) {
        if (d.r < d.target) d.r = Math.min(d.target, d.r + dt * d.gr);
        else if (d.slider) { d.sliding = true; d.ty = d.y; }
      } else {
        d.timer -= dt;
        if (d.timer <= 0) { d.moving = !d.moving; d.timer = d.moving ? rand(0.3, 1.1) : rand(0.1, 0.6); }
        const goal = d.moving ? c.slideSpeed * (0.4 + 0.6 * (d.r / hi)) : 0;
        d.vy += (goal - d.vy) * Math.min(1, dt * 5);
        d.y += d.vy * dt;
        d.r -= dt * (0.05 + 0.5 * (d.vy / Math.max(10, c.slideSpeed))) ;
        if (d.r < Math.max(1, lo * 0.45) || d.y > a.H + 12) { this.endTrail(d); this.p.splice(i, 1); }
      }
    }
    for (let i = this.tr.length - 1; i >= 0; i--) { this.tr[i].life -= dt; if (this.tr[i].life <= 0) this.tr.splice(i, 1); }
    if (!c.trails) this.tr.length = 0;
  }
  draw(ctx) {
    const c = this.c, base = this.base();
    ctx.lineCap = "round";
    if (c.trails) {
      ctx.strokeStyle = rgba(c.tint, 1);
      for (const t of this.tr) {
        ctx.globalAlpha = clamp(base * c.trailOpacity * (t.life / t.max), 0, 1);
        ctx.lineWidth = t.w;
        ctx.beginPath(); ctx.moveTo(t.x, t.y1); ctx.lineTo(t.x, t.y2); ctx.stroke();
      }
      for (const d of this.p) {
        if (!d.sliding) continue;
        ctx.globalAlpha = clamp(base * c.trailOpacity, 0, 1);
        ctx.lineWidth = Math.max(1, d.r * 0.55);
        ctx.beginPath(); ctx.moveTo(d.x, d.ty); ctx.lineTo(d.x, d.y); ctx.stroke();
      }
    }
    for (const d of this.p) {
      const fade = Math.min(1, d.age * 2) * Math.min(1, (c.life - d.age) / 3);
      const r = d.r, ry = r * (d.sliding && d.moving ? 1.25 : 1);
      ctx.globalAlpha = clamp(base * fade, 0, 1);
      ctx.fillStyle = rgba(c.tint, 0.16);
      ctx.beginPath(); ctx.ellipse(d.x, d.y, r * 0.92, ry, 0, 0, TAU); ctx.fill();
      if (c.highlight) {
        ctx.lineWidth = Math.max(0.6, r * 0.13);
        ctx.strokeStyle = "rgba(0,0,0,.3)";
        ctx.beginPath(); ctx.ellipse(d.x, d.y, r * 0.92, ry, 0, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,.4)";
        ctx.beginPath(); ctx.ellipse(d.x, d.y, r * 0.92, ry, 0, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,.8)";
        ctx.beginPath(); ctx.ellipse(d.x - r * 0.3, d.y - ry * 0.35, r * 0.27, r * 0.17, -0.6, 0, TAU); ctx.fill();
      } else {
        ctx.strokeStyle = rgba(c.tint, 0.5); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(d.x, d.y, r * 0.92, ry, 0, 0, TAU); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
}

class FireflyLayer extends Layer {
  constructor(app) { super(app, "fireflies"); }
  make() {
    const a = this.app, c = this.c;
    return { x: rand(0, a.W), y: rand(0, a.H), z: 1 - c.depth * Math.random(), ang: rand(0, TAU), turn: 0, ph: rand(0, TAU), ps: rand(0.6, 1.4), s: c.size * lerp(1 - c.sizeVar, 1, Math.random()) };
  }
  tick(dt) {
    const a = this.app, c = this.c;
    this.fill(this.count(), () => this.make());
    for (const p of this.p) {
      p.turn = lerp(p.turn, rand(-1, 1) * c.wander * 2.5, Math.min(1, dt * 2));
      p.ang += p.turn * dt;
      const sp = c.speed * p.z;
      p.x += Math.cos(p.ang) * sp * dt;
      p.y += Math.sin(p.ang) * sp * dt;
      this.pushAway(p, dt);
      if (p.x > a.W + 30) p.x = -30; else if (p.x < -30) p.x = a.W + 30;
      if (p.y > a.H + 30) p.y = -30; else if (p.y < -30) p.y = a.H + 30;
    }
  }
  draw(ctx) {
    const a = this.app, c = this.c, base = this.base();
    ctx.globalCompositeOperation = "lighter";
    const sprite = glowSprite(c.color);
    for (const p of this.p) {
      const pulse = 0.5 + 0.5 * Math.sin(a.t * c.pulseSpeed * p.ps * 2 + p.ph);
      const al = (Math.pow(pulse, 2) * 0.9 + 0.1) * (0.5 + 0.5 * p.z);
      const r = p.s * c.glowSize;
      ctx.globalAlpha = clamp(base * al, 0, 1);
      ctx.drawImage(sprite, p.x - r, p.y - r, r * 2, r * 2);
      ctx.globalAlpha = clamp(base * al * 1.6, 0, 1);
      ctx.fillStyle = c.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.8, p.s * 0.5), 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
}

class StarLayer extends Layer {
  constructor(app) { super(app, "stars"); this.sh = []; }
  leftovers() { return this.sh.length > 0; }
  shoot() {
    const a = this.app, c = this.c, dir = Math.random() < 0.5 ? 1 : -1, ang = rand(0.35, 0.8);
    const life = rand(0.6, 1.1);
    this.sh.push({
      x: dir > 0 ? rand(0, a.W * 0.6) : rand(a.W * 0.4, a.W), y: rand(0, a.H * 0.45),
      vx: Math.cos(ang) * c.shootSpeed * dir, vy: Math.sin(ang) * c.shootSpeed, life, max: life
    });
  }
  tick(dt) {
    const c = this.c;
    this.fill(this.count(), () => ({ u: Math.random(), v: Math.random(), ps: rand(0.5, 1.6), ph: rand(0, TAU), k: Math.random() }));
    if (c.enabled && c.shooting && Math.random() < (dt * c.shootRate) / 60) this.shoot();
    for (let i = this.sh.length - 1; i >= 0; i--) {
      const s = this.sh[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.life <= 0) this.sh.splice(i, 1);
    }
  }
  draw(ctx) {
    const a = this.app, c = this.c, base = this.base();
    ctx.fillStyle = c.color; ctx.strokeStyle = c.color; ctx.lineCap = "round";
    for (const p of this.p) {
      const tw = 1 - c.twinkle * 0.75 * (0.5 + 0.5 * Math.sin(a.t * c.twinkleSpeed * p.ps * 2 + p.ph));
      const s = c.size * lerp(1 - c.sizeVar, 1, p.k);
      const x = p.u * a.W, y = p.v * a.H;
      ctx.globalAlpha = clamp(base * tw * (0.5 + 0.5 * p.k), 0, 1);
      ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
      if (c.sparkles && s > 1.8) {
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(x - s * 3, y); ctx.lineTo(x + s * 3, y); ctx.moveTo(x, y - s * 3); ctx.lineTo(x, y + s * 3); ctx.stroke();
      }
    }
    for (const s of this.sh) {
      const d = Math.hypot(s.vx, s.vy), ux = s.vx / d, uy = s.vy / d, len = c.shootTrail;
      const f = Math.sin(Math.PI * clamp(s.life / s.max, 0, 1));
      const g = ctx.createLinearGradient(s.x, s.y, s.x - ux * len, s.y - uy * len);
      g.addColorStop(0, rgba(c.color, 1)); g.addColorStop(1, rgba(c.color, 0));
      ctx.globalAlpha = clamp(base * f, 0, 1);
      ctx.strokeStyle = g; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - ux * len, s.y - uy * len); ctx.stroke();
      ctx.fillStyle = c.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, 2.2, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

class MatrixLayer extends Layer {
  constructor(app) { super(app, "matrix"); }
  chars() { return CHARSETS[this.c.charset] || CHARSETS.katakana; }
  make(first) {
    const a = this.app, c = this.c, cs = this.chars(), fs = c.size;
    const len = Math.max(3, Math.round(c.trail * rand(0.6, 1.2)));
    const col = { x: Math.floor(Math.random() * Math.max(1, a.W / fs)) * fs + fs / 2, y: first ? rand(-a.H * 0.2, a.H) : -rand(0, a.H * 0.6), v: c.speed * rand(0.6, 1.4), len, ch: [], step: 0 };
    for (let i = 0; i < len; i++) col.ch.push(pick(cs));
    col.step = Math.floor(col.y / fs);
    return col;
  }
  tick(dt) {
    const a = this.app, c = this.c, fs = c.size, cs = this.chars();
    this.fill(this.count(), (f) => this.make(f));
    for (let i = 0; i < this.p.length; i++) {
      const col = this.p[i];
      col.y += col.v * dt;
      const st = Math.floor(col.y / fs);
      while (col.step < st) { col.step++; col.ch.unshift(pick(cs)); col.ch.pop(); }
      if (Math.random() < c.changeRate) col.ch[(Math.random() * col.ch.length) | 0] = pick(cs);
      if (col.y - col.len * fs > a.H) this.p[i] = this.make(false);
    }
  }
  draw(ctx) {
    const a = this.app, c = this.c, base = this.base(), fs = c.size;
    ctx.font = `${fs}px monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const col of this.p) {
      for (let i = 0; i < col.ch.length; i++) {
        const y = col.y - i * fs;
        if (y < -fs || y > a.H + fs) continue;
        ctx.globalAlpha = clamp(base * (i === 0 ? 1 : Math.pow(1 - i / col.len, 1.6)), 0, 1);
        ctx.fillStyle = i === 0 ? c.headColor : c.color;
        ctx.fillText(col.ch[i], col.x, y);
      }
    }
    ctx.globalAlpha = 1;
  }
}

const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const nz = (pal, r) => pal[(r() * pal.length) | 0];
const mkCanvas = (w, hh) => { const c = document.createElement("canvas"); c.width = w; c.height = hh; return c; };

const COINS = {
  btc: { c1: "#ffc766", c2: "#f7931a", edge: "#a8630a", glow: "#ffb347" },
  eth: { c1: "#9fb1f6", c2: "#627eea", edge: "#364695", glow: "#8fa4ff" },
  sol: { c1: "#2b1a52", c2: "#0c0716", edge: "#9945ff", glow: "#9a6bff" },
  doge: { c1: "#f0d868", c2: "#c2a633", edge: "#7a6618", glow: "#f0d95a" },
  ltc: { c1: "#e6e6e6", c2: "#a3a3a3", edge: "#686868", glow: "#dcdcdc" }
};
const coinCache = new Map();
const coinSprite = (type, back) => {
  const key = type + (back ? "b" : "f");
  let c = coinCache.get(key);
  if (c) return c;
  const d = COINS[type];
  c = mkCanvas(96, 96);
  const g = c.getContext("2d");
  g.scale(0.75, 0.75);
  const circle = (r) => { g.beginPath(); g.arc(64, 64, r, 0, TAU); };
  const grad = g.createLinearGradient(10, 10, 118, 118);
  grad.addColorStop(0, d.c1); grad.addColorStop(1, d.c2);
  g.fillStyle = grad; circle(62); g.fill();
  g.strokeStyle = d.edge; g.lineWidth = 4; circle(60); g.stroke();
  g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 3; circle(50); g.stroke();
  g.strokeStyle = "rgba(0,0,0,.2)"; g.lineWidth = 2; circle(47); g.stroke();
  g.fillStyle = "rgba(255,255,255,.16)";
  g.beginPath(); g.ellipse(46, 36, 34, 18, -0.6, 0, TAU); g.fill();
  if (back) {
    g.fillStyle = "rgba(255,255,255,.55)";
    for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU; g.beginPath(); g.arc(64 + Math.cos(a) * 55, 64 + Math.sin(a) * 55, 1.8, 0, TAU); g.fill(); }
    g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 4; g.beginPath();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU - Math.PI / 2; const x = 64 + Math.cos(a) * 24, y = 64 + Math.sin(a) * 24; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.closePath(); g.stroke();
    coinCache.set(key, c);
    return c;
  }
  g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 4; g.shadowOffsetY = 2;
  g.fillStyle = "rgba(255,255,255,.96)";
  g.textAlign = "center"; g.textBaseline = "middle";
  if (type === "btc") {
    g.font = "bold 74px Arial, Helvetica, sans-serif";
    g.fillText("B", 64, 68);
    g.fillRect(55, 29, 5, 14); g.fillRect(67, 29, 5, 14); g.fillRect(55, 93, 5, 14); g.fillRect(67, 93, 5, 14);
  } else if (type === "eth") {
    g.beginPath(); g.moveTo(64, 20); g.lineTo(94, 65); g.lineTo(64, 80); g.lineTo(34, 65); g.closePath(); g.fill();
    g.fillStyle = "rgba(255,255,255,.72)";
    g.beginPath(); g.moveTo(34, 72); g.lineTo(64, 88); g.lineTo(94, 72); g.lineTo(64, 108); g.closePath(); g.fill();
  } else if (type === "sol") {
    const bg = g.createLinearGradient(30, 100, 98, 36);
    bg.addColorStop(0, "#14f195"); bg.addColorStop(1, "#9945ff");
    g.fillStyle = bg; g.shadowBlur = 0; g.shadowOffsetY = 0;
    [[36, 1], [57, -1], [78, 1]].forEach(([y, dir]) => {
      g.beginPath();
      if (dir > 0) { g.moveTo(40, y); g.lineTo(98, y); g.lineTo(88, y + 14); g.lineTo(30, y + 14); }
      else { g.moveTo(30, y); g.lineTo(88, y); g.lineTo(98, y + 14); g.lineTo(40, y + 14); }
      g.closePath(); g.fill();
    });
  } else if (type === "doge") {
    g.font = "bold 80px Arial, Helvetica, sans-serif";
    g.fillText("\u00D0", 64, 70);
  } else {
    g.font = "bold 78px Arial, Helvetica, sans-serif";
    g.fillText("\u0141", 64, 70);
  }
  coinCache.set(key, c);
  return c;
};

class CryptoLayer extends Layer {
  constructor(app) { super(app, "crypto"); this.b = []; }
  leftovers() { return this.b.length > 0; }
  types() {
    const s = this.c.coinSet;
    return s === "all" ? ["btc", "eth", "sol", "doge", "ltc"] : s === "bte" ? ["btc", "eth"] : [s];
  }
  make(first, burst) {
    const a = this.app, c = this.c;
    const z = 1 - c.depth * Math.random();
    const s = c.size * lerp(1 - c.sizeVar, 1, Math.random()) * (0.5 + 0.5 * z);
    const p = {
      type: pick(this.types()), z, s, a: 0.5 + 0.5 * z, ph: rand(0, TAU), flip: rand(0, TAU), fs: rand(2, 5),
      rot: rand(-0.3, 0.3), vy: 0, sv: rand(0.8, 1.2), x: rand(-20, a.W + 20),
      y: first ? rand(-40, a.H) : -s * 2 - rand(0, 80),
      g: a.H - s - (1 - z) * rand(0, 90), state: 0, bn: 0, fade: 1, gl: 0, burst: !!burst
    };
    if (burst) { p.y = -s * 2 - rand(0, a.H * 0.45); p.vy = rand(100, 400); }
    return p;
  }
  step(p, dt) {
    const a = this.app, c = this.c;
    if (p.state === 2) { p.fade -= dt * 1.3; p.fs *= 0.96; p.flip += p.fs * dt * 0.5; return p.fade > 0; }
    const term = c.speed * p.z * p.sv * (p.burst ? 1.6 : 1);
    if (p.bn === 0) p.vy = Math.min(term, p.vy + 700 * dt); else p.vy += 1100 * dt;
    p.y += p.vy * dt;
    p.x += Math.cos(p.ph + a.t * c.swaySpeed) * c.sway * p.z * dt;
    p.flip += p.fs * dt * c.spin;
    p.gl = Math.max(0, p.gl - dt);
    if (c.glints && p.gl <= 0 && Math.abs(Math.cos(p.flip)) > 0.97 && Math.random() < 0.35) p.gl = 0.35;
    this.pushAway(p, dt);
    if (c.bounce) {
      if (p.y >= p.g && p.vy > 0) {
        if (p.bn < 2 && p.vy > 90) { p.y = p.g; p.vy = -p.vy * 0.42; p.bn++; p.fs *= 0.6; p.gl = 0.3; }
        else { p.y = p.g; p.vy = 0; p.state = 2; }
      }
    } else if (p.y > a.H + p.s * 2) return false;
    return true;
  }
  tick(dt) {
    this.fill(this.count(), (f) => this.make(f));
    for (let i = 0; i < this.p.length; i++) if (!this.step(this.p[i], dt)) this.p[i] = this.make(false);
    for (let i = this.b.length - 1; i >= 0; i--) if (!this.step(this.b[i], dt)) this.b.splice(i, 1);
  }
  burst(n) {
    const count = n || this.c.burstSize;
    for (let i = 0; i < count; i++) this.b.push(this.make(false, true));
  }
  drawCoin(ctx, p, base) {
    const c = this.c, al = clamp(base * p.a * p.fade, 0, 1);
    if (al < 0.01) return;
    const cs = Math.cos(p.flip), ac = Math.abs(cs), s = p.s, d = COINS[p.type];
    ctx.globalAlpha = al;
    if (c.glow) {
      const gs = s * 2.6;
      ctx.globalAlpha = al * 0.32; ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(glowSprite(d.glow), p.x - gs, p.y - gs, gs * 2, gs * 2);
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = al;
    }
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillStyle = d.edge;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.16 * (1 - ac) + 0.6, s, 0, 0, TAU); ctx.fill();
    ctx.scale(Math.max(ac, 0.02), 1);
    ctx.drawImage(coinSprite(p.type, cs < 0), -s, -s, s * 2, s * 2);
    ctx.fillStyle = `rgba(0,0,0,${(1 - ac) * 0.4})`;
    ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
    ctx.restore();
    if (c.glints && p.gl > 0) {
      const k = p.gl / 0.35, r = s * (0.6 + 0.9 * Math.sin(Math.PI * (1 - k))), gx = p.x - s * 0.35, gy = p.y - s * 0.4;
      ctx.globalAlpha = clamp(al * Math.sin(Math.PI * (1 - k)) * 1.2, 0, 1);
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(gx - r, gy); ctx.lineTo(gx + r, gy); ctx.moveTo(gx, gy - r); ctx.lineTo(gx, gy + r); ctx.stroke();
    }
  }
  draw(ctx) {
    const base = this.base();
    for (const p of this.p) this.drawCoin(ctx, p, base);
    for (const p of this.b) this.drawCoin(ctx, p, Math.max(0.7, base));
    ctx.globalAlpha = 1;
  }
}

const NYAN_BANDS = ["#ff0000", "#ff9900", "#ffff00", "#33ff00", "#0099ff", "#6633ff"];
const NYAN_W = 36, NYAN_H = 24;
const nyanFrames = [];
const nyanSprite = (f) => {
  if (nyanFrames[f]) return nyanFrames[f];
  const c = mkCanvas(NYAN_W, NYAN_H), g = c.getContext("2d");
  const r = (x, y, w, hh, col) => { g.fillStyle = col; g.fillRect(x, y, w, hh); };
  r(0, 10 + f, 6, 4, "#000"); r(1, 11 + f, 5, 2, "#999");
  const lx = f ? [8, 13, 20, 25] : [7, 12, 21, 26];
  for (const x of lx) { r(x, 19, 4, 4, "#000"); r(x + 1, 19, 2, 3, "#999"); }
  r(4, 3, 22, 17, "#000"); r(5, 4, 20, 15, "#ffcc99"); r(7, 6, 16, 11, "#ff99ff");
  for (const [x, y] of [[9, 8], [13, 7], [17, 9], [11, 12], [15, 13], [20, 11], [21, 14], [9, 15], [19, 7], [14, 10], [18, 15]]) r(x, y, 1, 1, "#ff3399");
  r(21, 8 + f, 13, 11, "#000"); r(22, 9 + f, 11, 9, "#999");
  r(22, 5 + f, 4, 4, "#000"); r(23, 6 + f, 2, 2, "#999");
  r(30, 5 + f, 4, 4, "#000"); r(31, 6 + f, 2, 2, "#999");
  r(24, 12 + f, 2, 2, "#000"); r(24, 12 + f, 1, 1, "#fff");
  r(30, 12 + f, 2, 2, "#000"); r(30, 12 + f, 1, 1, "#fff");
  r(23, 15 + f, 2, 2, "#ff9999"); r(31, 15 + f, 2, 2, "#ff9999");
  r(26, 16 + f, 4, 1, "#000"); r(26, 15 + f, 1, 1, "#000"); r(29, 15 + f, 1, 1, "#000");
  nyanFrames[f] = c;
  return c;
};

class NyanLayer extends Layer {
  constructor(app) { super(app, "nyan"); this.st = []; this.timer = 0; }
  leftovers() { return this.p.length > 0 || this.st.length > 0; }
  launch() {
    const a = this.app, c = this.c;
    const dir = c.direction === "left" ? -1 : c.direction === "both" ? (Math.random() < 0.5 ? 1 : -1) : 1;
    const s = c.size * lerp(1 - c.sizeVar, 1, Math.random());
    const w = NYAN_W * s, hh = NYAN_H * s;
    this.p.push({
      dir, s, w, h: hh, v: c.speed * rand(0.85, 1.15), ph: rand(0, TAU),
      x: dir > 0 ? -w - 20 : a.W + 20, y: rand(a.H * 0.06, Math.max(a.H * 0.1, a.H * 0.88 - hh)), sp: 0
    });
  }
  tick(dt) {
    const a = this.app, c = this.c;
    if (c.enabled) {
      this.timer -= dt;
      if (this.p.length < c.amount && this.timer <= 0) { this.launch(); this.timer = rand(0.5, 1.5) * c.gap; }
    }
    for (let i = this.p.length - 1; i >= 0; i--) {
      const p = this.p[i];
      p.x += p.dir * p.v * dt;
      if (c.sparkles) {
        p.sp += dt * 16;
        while (p.sp >= 1) {
          p.sp -= 1;
          const backX = p.dir > 0 ? p.x + 4 * p.s : p.x + p.w - 4 * p.s;
          this.st.push({ x: backX - p.dir * rand(0, c.trail * 0.9), y: p.y + p.h / 2 + rand(-p.h * 0.9, p.h * 0.9), life: 0, max: rand(0.5, 1.2), s: Math.max(2, Math.round(p.s * rand(0.6, 1.1))) });
        }
      }
      const gone = p.dir > 0 ? p.x - c.trail > a.W : p.x + p.w + c.trail < 0;
      if (gone) this.p.splice(i, 1);
    }
    for (let i = this.st.length - 1; i >= 0; i--) { const s = this.st[i]; s.life += dt; if (s.life >= s.max) this.st.splice(i, 1); }
  }
  draw(ctx) {
    const a = this.app, c = this.c, base = this.base();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#ffffff";
    for (const st of this.st) {
      const k = Math.sin(Math.PI * (st.life / st.max)), u = Math.max(1, Math.round(st.s * k));
      if (k <= 0.05) continue;
      ctx.globalAlpha = clamp(base * k, 0, 1);
      const x = Math.round(st.x), y = Math.round(st.y);
      ctx.fillRect(x - u, y, u * 3, u); ctx.fillRect(x, y - u, u, u * 3);
    }
    const frame = Math.floor(a.t * 8);
    for (const p of this.p) {
      const bob = Math.sin(a.t * 6 + p.ph) * c.bob;
      const y = p.y + bob, s = p.s;
      const cw = s * 3, n = Math.ceil(c.trail / cw), bh = s * 2;
      const backX = p.dir > 0 ? p.x + 4 * s : p.x + p.w - 4 * s;
      const top = y + 11 * s - bh * 3;
      for (let b = 0; b < 6; b++) {
        ctx.fillStyle = NYAN_BANDS[b];
        for (let i = 0; i < n; i++) {
          const off = c.wave && (((i + frame) >> 1) & 1) ? s : 0;
          ctx.globalAlpha = clamp(base * (1 - (i / n) * 0.45), 0, 1);
          const x = p.dir > 0 ? backX - (i + 1) * cw : backX + i * cw;
          ctx.fillRect(Math.round(x), Math.round(top + b * bh + off), Math.ceil(cw) + 1, Math.ceil(bh));
        }
      }
      ctx.globalAlpha = clamp(base, 0, 1);
      ctx.save();
      if (p.dir > 0) ctx.translate(p.x, y); else { ctx.translate(p.x + p.w, y); ctx.scale(-1, 1); }
      ctx.drawImage(nyanSprite(frame & 1), 0, 0, p.w, p.h);
      ctx.restore();
    }
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 1;
  }
}

const MCP = {
  stone: ["#7d7d7d", "#858585", "#767676", "#8b8b8b", "#707070"],
  dirt: ["#866043", "#79553a", "#8f6a4b", "#6f4d34", "#7d5a3e"],
  grass: ["#5fa83a", "#6bb844", "#559a32", "#78c24c", "#4f8d2e"],
  plank: ["#a98a54", "#a08250", "#b0905a", "#9b7d4a"],
  glow: ["#f7d36a", "#e8b84a", "#fbe590", "#d9a63a", "#ffeaa6"]
};
const ORE_SPOTS = [[3, 3], [4, 3], [3, 4], [4, 4], [9, 5], [10, 5], [10, 6], [6, 10], [7, 10], [7, 11], [12, 11], [12, 10], [2, 12], [13, 3]];
const oreFn = (cols, dx) => {
  const set = new Set(ORE_SPOTS.map(([x, y]) => ((x + dx) & 15) + "," + y));
  return (x, y, r) => set.has(x + "," + y) ? nz(cols, r) : nz(MCP.stone, r);
};
const plankFn = (x, y, r) => {
  if (y % 4 === 3) return "#6d5330";
  if ((y % 8 < 4 ? x === 7 : x === 15)) return "#7a5e36";
  return nz(MCP.plank, r);
};
const TNT_GLYPH = { T: ["111", "010", "010", "010", "010"], N: ["101", "111", "111", "101", "101"] };
const tntSide = (x, y, r) => {
  if (y >= 4 && y <= 10) {
    const ly = y - 5, glyphs = [["T", 2], ["N", 6], ["T", 10]];
    if (ly >= 0 && ly < 5) for (const [ch, gx] of glyphs) if (x >= gx && x < gx + 3 && TNT_GLYPH[ch][ly][x - gx] === "1") return "#2b2b2b";
    return nz(["#e4e0d4", "#dcd8cb", "#eae6da"], r);
  }
  return nz(["#d4392b", "#c8321f", "#dc4434", "#bf2e22"], r);
};
const BLOCKS = {
  grass: { top: (x, y, r) => nz(MCP.grass, r), side: (x, y, r) => y < 2 + (((x * 5 + 1) % 4 === 0) ? 2 : (x * 3) % 2) ? nz(MCP.grass, r) : nz(MCP.dirt, r) },
  dirt: { top: (x, y, r) => nz(MCP.dirt, r), side: (x, y, r) => nz(MCP.dirt, r) },
  stone: { top: (x, y, r) => nz(MCP.stone, r), side: (x, y, r) => nz(MCP.stone, r) },
  planks: { top: plankFn, side: plankFn },
  diamond: { top: oreFn(["#4de3d6", "#7ff5ea", "#2bbdb0"], 0), side: oreFn(["#4de3d6", "#7ff5ea", "#2bbdb0"], 3) },
  gold: { top: oreFn(["#f7d23a", "#ffe86b", "#d9aa1c"], 5), side: oreFn(["#f7d23a", "#ffe86b", "#d9aa1c"], 8) },
  redstone: { top: oreFn(["#d9261c", "#ff4a3a", "#a31510"], 9), side: oreFn(["#d9261c", "#ff4a3a", "#a31510"], 12) },
  tnt: { top: (x, y, r) => (x > 4 && x < 11 && y > 4 && y < 11) ? "#3a2f22" : nz(["#a89c82", "#9c9078", "#b0a58c"], r), side: tntSide },
  glowstone: { top: (x, y, r) => nz(MCP.glow, r), side: (x, y, r) => nz(MCP.glow, r) }
};
const BLOCK_SETS = {
  all: ["grass", "dirt", "stone", "planks", "diamond", "gold", "redstone", "tnt", "glowstone"],
  terrain: ["grass", "dirt", "stone", "planks"],
  ores: ["diamond", "gold", "redstone"],
  tnt: ["tnt"],
  glow: ["glowstone"]
};
const blockCache = new Map();
const blockSprite = (key) => {
  let c = blockCache.get(key);
  if (c) return c;
  const def = BLOCKS[key];
  const tex = (fn, seed) => {
    const t = mkCanvas(16, 16), tg = t.getContext("2d"), r = mulberry32(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { tg.fillStyle = fn(x, y, r); tg.fillRect(x, y, 1, 1); }
    return t;
  };
  let seed = 1234; for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) | 0;
  const top = tex(def.top, seed), side = tex(def.side, seed + 7);
  c = mkCanvas(64, 72);
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  const face = (t, ox, oy, ux, uy, vx, vy, shade) => {
    g.save();
    g.setTransform(ux / 16, uy / 16, vx / 16, vy / 16, ox, oy);
    g.drawImage(t, 0, 0);
    g.restore();
    if (shade > 0) {
      g.fillStyle = `rgba(0,0,0,${shade})`;
      g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + ux, oy + uy); g.lineTo(ox + ux + vx, oy + uy + vy); g.lineTo(ox + vx, oy + vy); g.closePath(); g.fill();
    }
  };
  face(top, 4, 20, 28, -16, 28, 16, 0);
  face(side, 4, 20, 28, 16, 0, 32, 0.24);
  face(side, 32, 36, 28, -16, 0, 32, 0.44);
  g.strokeStyle = "rgba(0,0,0,.4)"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(32, 4.5); g.lineTo(60, 20); g.lineTo(60, 52); g.lineTo(32, 68); g.lineTo(4, 52); g.lineTo(4, 20); g.closePath();
  g.moveTo(4, 20); g.lineTo(32, 36); g.lineTo(60, 20); g.moveTo(32, 36); g.lineTo(32, 68); g.stroke();
  blockCache.set(key, c);
  return c;
};
KINDS.blocks = {
  dir: 1,
  draw(ctx, p, c) {
    const list = BLOCK_SETS[c.blockSet] || BLOCK_SETS.all;
    const spr = blockSprite(list[p.ci % list.length]);
    const w = p.s, hh = p.s * 72 / 64;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.sin(p.rot * 0.5) * 0.55 * Math.min(1, c.spin));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spr, -w / 2, -hh / 2, w, hh);
    ctx.restore();
  }
};

KINDS.xp = {
  dir: -1,
  draw(ctx, p, c, col, a) {
    const m = 0.5 + 0.5 * Math.sin(a.t * 3 * c.pulse + p.ph), r = p.s, a0 = ctx.globalAlpha, gs = r * 4.2;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = a0 * (1 - m) * 0.85; ctx.drawImage(glowSprite("#8cff2e"), p.x - gs, p.y - gs, gs * 2, gs * 2);
    ctx.globalAlpha = a0 * m * 0.85; ctx.drawImage(glowSprite("#f2ff3a"), p.x - gs, p.y - gs, gs * 2, gs * 2);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = a0;
    ctx.fillStyle = `rgb(${Math.round(lerp(120, 240, m))},255,${Math.round(lerp(40, 60, m))})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(20,90,0,.5)"; ctx.lineWidth = Math.max(0.8, r * 0.22);
    ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.9, 0, TAU); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.78)";
    ctx.beginPath(); ctx.arc(p.x - r * 0.3, p.y - r * 0.32, r * 0.3, 0, TAU); ctx.fill();
  }
};
class XPLayer extends Flow {
  constructor(app) { super(app, "xp", "xp"); this.pings = []; }
  leftovers() { return this.pings.length > 0; }
  tick(dt) {
    super.tick(dt);
    const a = this.app, c = this.c;
    if (c.enabled && c.attract && a.mouse.on) {
      const R2 = c.attractRadius;
      for (const p of this.p) {
        const dx = a.mouse.x - p.x, dy = a.mouse.y - p.y, d = Math.hypot(dx, dy);
        if (d > R2) continue;
        if (d < 12) { this.pings.push({ x: p.x, y: p.y, t: 0 }); this.place(p, false); continue; }
        const sp = lerp(140, 950, 1 - d / R2) * dt;
        p.x += (dx / d) * sp; p.y += (dy / d) * sp;
      }
    }
    for (let i = this.pings.length - 1; i >= 0; i--) { this.pings[i].t += dt * 2.4; if (this.pings[i].t >= 1) this.pings.splice(i, 1); }
  }
  draw(ctx) {
    super.draw(ctx);
    const base = this.base();
    ctx.strokeStyle = "#caff4a"; ctx.lineWidth = 1.5;
    for (const q of this.pings) {
      ctx.globalAlpha = clamp(base * (1 - q.t), 0, 1);
      ctx.beginPath(); ctx.arc(q.x, q.y, this.c.size * (1 + q.t * 4), 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

const BIOMES = {
  wastes: { rise: ["#ff6a1f", "#ff9a3d", "#ffc34d", "#ff4d1a"], fall: ["#8a8a8a", "#5e5e5e", "#b0b0b0"], mix: 0.5, haze: "#ff5a1a" },
  soul: { rise: ["#2bd9d9", "#6ff0f0", "#1a8f9a", "#a8ffff"], fall: ["#3a5a66", "#2a4350"], mix: 0.8, haze: "#26c6d0" },
  crimson: { rise: ["#e0344f", "#ff5a6e", "#a01834", "#ff8a98"], fall: ["#a01834"], mix: 1, haze: "#d02a46" },
  warped: { rise: ["#2fd6a8", "#5fffd2", "#1a8f7a", "#9affe6"], fall: ["#1a8f7a"], mix: 1, haze: "#20c9a0" },
  basalt: { rise: ["#777777"], fall: ["#9a9a9a", "#666666", "#3a3a3a", "#c4c4c4"], mix: 0.12, haze: "#777777" }
};
class NetherLayer extends Layer {
  constructor(app) { super(app, "nether"); this.lastBiome = null; }
  make(first) {
    const a = this.app, c = this.c, B = BIOMES[c.biome] || BIOMES.wastes;
    const rise = Math.random() < B.mix, z = rand(0.4, 1);
    return {
      rise, z, col: pick(rise ? B.rise : B.fall), ph: rand(0, TAU), v: rand(0.6, 1.3),
      s: Math.max(1, Math.round(c.size * lerp(1 - c.sizeVar, 1, Math.random()) * (0.5 + 0.5 * z))),
      x: rand(0, a.W), y: first ? rand(0, a.H) : (rise ? a.H + 10 : -10)
    };
  }
  tick(dt) {
    const a = this.app, c = this.c;
    if (this.lastBiome !== c.biome) { this.p.length = 0; this.lastBiome = c.biome; }
    this.fill(this.count(), (f) => this.make(f));
    for (let i = 0; i < this.p.length; i++) {
      const p = this.p[i];
      p.y += (p.rise ? -1 : 0.7) * c.speed * p.z * p.v * dt;
      p.x += Math.sin(p.ph + a.t * (p.rise ? 2.2 : 0.9)) * c.sway * p.z * dt;
      this.pushAway(p, dt);
      if (p.y < -14 || p.y > a.H + 14) this.p[i] = this.make(false);
    }
  }
  draw(ctx) {
    const a = this.app, c = this.c, B = BIOMES[c.biome] || BIOMES.wastes, base = this.base();
    if (c.haze > 0) {
      const g = ctx.createLinearGradient(0, a.H, 0, a.H * 0.45);
      g.addColorStop(0, rgba(B.haze, c.haze * a.s.globalOpacity)); g.addColorStop(1, rgba(B.haze, 0));
      ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, a.H * 0.45, a.W, a.H * 0.55);
    }
    for (const p of this.p) {
      let al = base * (0.35 + 0.65 * p.z);
      if (p.rise) {
        if (c.flicker) al *= 0.55 + 0.45 * Math.sin(a.t * 14 + p.ph * 5);
        al *= clamp(p.y / (a.H * 0.3), 0, 1);
      } else al *= clamp(p.y / 60, 0, 1);
      if (al <= 0.01) continue;
      ctx.globalAlpha = clamp(al, 0, 1);
      ctx.fillStyle = p.col;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
    ctx.globalAlpha = 1;
  }
}

const END_PAL = ["#c96bff", "#7b3fe4", "#3ee0d0", "#f0b3ff", "#ffffff", "#5a2dbf"];
class EndLayer extends Layer {
  constructor(app) { super(app, "end"); this.eyes = []; }
  leftovers() { return this.eyes.length > 0; }
  make(first) {
    const a = this.app, c = this.c, z = rand(0.4, 1);
    return {
      z, x: rand(0, a.W), y: first ? rand(0, a.H) : a.H + 8, col: pick(END_PAL), ph: rand(0, TAU), tw: rand(1.5, 4),
      s: Math.max(1, Math.round(c.size * lerp(1 - c.sizeVar, 1, Math.random()) * (0.5 + 0.5 * z)))
    };
  }
  tick(dt) {
    const a = this.app, c = this.c;
    this.fill(this.count(), (f) => this.make(f));
    for (let i = 0; i < this.p.length; i++) {
      const p = this.p[i];
      p.y -= c.speed * p.z * dt;
      p.x += Math.sin(p.ph + a.t * 0.8) * c.sway * p.z * dt;
      this.pushAway(p, dt);
      if (p.y < -10) this.p[i] = this.make(false);
    }
    if (c.enabled && c.eyes && Math.random() < (dt * c.eyeRate) / 60) {
      this.eyes.push({ x: rand(a.W * 0.05, a.W * 0.95), y: rand(a.H * 0.1, a.H * 0.9), life: 0, max: rand(1.6, 2.8) });
    }
    for (let i = this.eyes.length - 1; i >= 0; i--) { this.eyes[i].life += dt; if (this.eyes[i].life >= this.eyes[i].max) this.eyes.splice(i, 1); }
  }
  draw(ctx) {
    const a = this.app, c = this.c, base = this.base();
    for (const p of this.p) {
      const tw = 1 - c.twinkle * (0.5 + 0.5 * Math.sin(a.t * p.tw + p.ph));
      ctx.globalAlpha = clamp(base * tw * (0.35 + 0.65 * p.z), 0, 1);
      ctx.fillStyle = p.col;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
    for (const e of this.eyes) {
      const f = e.life / e.max;
      let k = f < 0.15 ? f / 0.15 : f > 0.8 ? (1 - f) / 0.2 : 1;
      const blink = f > 0.45 && f < 0.52;
      const s = c.eyeSize, w = s, hh = blink ? 1 : Math.max(2, Math.ceil(s * 0.5)), gap = Math.round(s * 1.0);
      const x = Math.round(e.x), y = Math.round(e.y);
      const gs = s * 4.5;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = clamp(base * k * 0.45, 0, 1);
      ctx.drawImage(glowSprite("#b100ff"), x - gs, y - gs, gs * 2, gs * 2);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = clamp(base * k, 0, 1);
      for (const ex of [x - gap / 2 - w, x + gap / 2]) {
        ctx.fillStyle = "#b100ff"; ctx.fillRect(Math.round(ex), y, w, hh);
        ctx.fillStyle = "#ff8cff"; ctx.fillRect(Math.round(ex) + (ex < x ? Math.floor(w / 2) : 0), y, Math.ceil(w / 2), hh);
      }
    }
    ctx.globalAlpha = 1;
  }
}

class StormLayer extends Layer {
  constructor(app) { super(app, "storm"); this.bolts = []; this.flash = 0; this.next = rand(2, 6); }
  leftovers() { return this.bolts.length > 0 || this.flash > 0.01; }
  strike() {
    const a = this.app, c = this.c, left = Math.random() < 0.5;
    const x0 = left ? rand(0, a.W * 0.25) : rand(a.W * 0.75, a.W);
    const x1 = left ? rand(0, a.W * 0.3) : rand(a.W * 0.7, a.W), y1 = rand(a.H * 0.3, a.H * 0.85);
    const mk = (xa, ya, xb, yb, n, jit) => {
      const pts = [];
      for (let i = 0; i <= n; i++) { const t = i / n; pts.push([lerp(xa, xb, t) + (i > 0 && i < n ? rand(-jit, jit) : 0), lerp(ya, yb, t)]); }
      return pts;
    };
    const pts = mk(x0, -10, x1, y1, 14, 30);
    const branches = [];
    for (let i = 0; i < 2; i++) {
      const q = pts[(3 + Math.random() * 8) | 0];
      branches.push(mk(q[0], q[1], q[0] + rand(-120, 120), q[1] + rand(60, 180), 6, 16));
    }
    this.bolts.push({ pts, branches, life: 0.4, max: 0.4 });
    this.flash = c.lightningPower;
  }
  tick(dt) {
    const a = this.app, c = this.c;
    this.fill(this.count(), (first) => {
      const u = Math.random(), e = Math.pow(Math.random(), 2) * 0.4;
      return { x: a.W * (u < 0.5 ? e : 1 - e), y: first ? rand(0, a.H) : a.H + 6, z: rand(0.4, 1), ph: rand(0, TAU) };
    });
    for (let i = 0; i < this.p.length; i++) {
      const p = this.p[i];
      p.y -= c.speed * p.z * dt;
      p.x += Math.sin(p.ph + a.t) * 14 * p.z * dt;
      if (p.y < -8) { p.y = a.H + 6; const u = Math.random(), e = Math.pow(Math.random(), 2) * 0.4; p.x = a.W * (u < 0.5 ? e : 1 - e); }
    }
    if (c.enabled && c.lightning) {
      this.next -= dt;
      if (this.next <= 0) { this.strike(); this.next = rand(0.5, 1.5) * 60 / c.lightningRate; }
    }
    this.flash = Math.max(0, this.flash - dt * 2.2);
    for (let i = this.bolts.length - 1; i >= 0; i--) { this.bolts[i].life -= dt; if (this.bolts[i].life <= 0) this.bolts.splice(i, 1); }
  }
  draw(ctx) {
    const a = this.app, c = this.c, W = a.W, H = a.H, base = this.base(), go = a.s.globalOpacity;
    const cx = W / 2, cy = H / 2, R = Math.hypot(cx, cy);
    if (c.enabled) {
      const pulse = 1 + 0.06 * Math.sin(a.t * c.pulse * 1.7) + 0.04 * Math.sin(a.t * c.pulse * 0.7 + 1);
      const inner = R * clamp(1 - c.edge * 1.15 * pulse, 0.02, 0.97);
      const g = ctx.createRadialGradient(cx, cy, inner, cx, cy, R);
      g.addColorStop(0, rgba(c.color, 0));
      g.addColorStop(0.55, rgba(c.color, 0.3 * base));
      g.addColorStop(1, rgba(c.color, 0.85 * base));
      ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      const gs = c.size * 5;
      for (const p of this.p) {
        ctx.globalAlpha = clamp(base * (0.3 + 0.7 * p.z) * (0.6 + 0.4 * Math.sin(a.t * 2 + p.ph)), 0, 1);
        ctx.drawImage(glowSprite(c.color), p.x - gs, p.y - gs, gs * 2, gs * 2);
      }
      ctx.globalCompositeOperation = "source-over";
    }
    if (this.flash > 0.01) {
      const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
      g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, rgba("#d9b8ff", this.flash * 0.6 * go));
      ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.1 * go})`; ctx.fillRect(0, 0, W, H);
    }
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    const line = (pts, w) => { ctx.lineWidth = w; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); };
    for (const b of this.bolts) {
      const f = clamp(b.life / b.max, 0, 1) * go;
      ctx.strokeStyle = rgba(c.color, 0.55 * f); line(b.pts, 8);
      for (const br of b.branches) line(br, 4);
      ctx.strokeStyle = `rgba(255,255,255,${f})`; line(b.pts, 2.2);
      for (const br of b.branches) line(br, 1.2);
    }
    ctx.globalAlpha = 1;
  }
}

const TETROS = {
  I: { c: "#22d3ee", m: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] },
  O: { c: "#facc15", m: [[1, 1], [1, 1]] },
  T: { c: "#a855f7", m: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] },
  S: { c: "#4ade80", m: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
  Z: { c: "#f87171", m: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] },
  J: { c: "#60a5fa", m: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] },
  L: { c: "#fb923c", m: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] }
};
const TETRO_KEYS = Object.keys(TETROS);
const TET_KICKS = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1]];
const TET_PTS = [0, 100, 300, 500, 800];
const TET_MOUSE = ["mousedown", "mouseup", "click", "dblclick", "auxclick", "contextmenu", "pointerdown", "pointerup"];
const TET_KEYS_EV = ["keydown", "keyup", "keypress"];
const tRot = (m, dir) => { const n = m.length; return m.map((_, y) => m.map((__, x) => (dir > 0 ? m[n - 1 - x][y] : m[x][n - 1 - y]))); };
const tBounds = (m) => {
  let lo = 9, hi = -1, top = 9;
  m.forEach((r, y) => r.forEach((v, x) => { if (v) { if (x < lo) lo = x; if (x > hi) hi = x; if (y < top) top = y; } }));
  return { lo, hi, top };
};
const ease = (t) => t * t * (3 - 2 * t);
const tCell = (ctx, x, y, s, col) => {
  const g = Math.max(1, s * 0.06), b = s * 0.14, x0 = x + g / 2, y0 = y + g / 2, w = s - g;
  ctx.fillStyle = col; ctx.fillRect(x0, y0, w, w);
  ctx.fillStyle = "rgba(255,255,255,.32)"; ctx.fillRect(x0, y0, w, b); ctx.fillRect(x0, y0, b, w);
  ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.fillRect(x0, y0 + w - b, w, b); ctx.fillRect(x0 + w - b, y0, b, w);
};

class TetrisLayer extends Layer {
  constructor(app) {
    super(app, "tetris");
    this.play = false; this.paused = false; this.pa = 0;
    this.grid = null; this.cols = 0; this.rows = 0;
    this.fx = []; this.bag = []; this.q = [];
    this.state = "run"; this.stateT = 0; this.cur = null; this.plan = null; this.clearRows = [];
    this.hold = null; this.canHold = true; this.score = 0; this.lines = 0; this.level = 0;
    this.gAcc = 0; this.lockT = 0; this.resets = 0; this.aiT = 0; this.mvT = 0; this.stuck = 0; this.wheel = 0;
    this.newBest = false; this.bound = false;
    this.vis = { x: 0, y: 0, s: 20 };
    try { this.best = Number(BdApi.Data.load(NAME, "tetrisBest")) || 0; } catch { this.best = 0; }

    this.onMouse = (e) => {
      e.stopImmediatePropagation();
      if (e.type !== "pointerdown" && e.type !== "pointerup") e.preventDefault();
      if (e.type === "mousedown") this.press(e.button);
    };
    this.onWheel = (e) => {
      e.preventDefault(); e.stopImmediatePropagation();
      this.wheel += e.deltaY * (e.deltaMode === 1 ? 20 : 1);
      const T = 70;
      while (this.wheel >= T) { this.wheel -= T; if (this.canAct()) this.softDrop(); }
      while (this.wheel <= -T) { this.wheel += T; if (this.canAct()) this.rotate(-1); }
    };
    this.onKey = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.type !== "keydown") return;
      if (e.key === "Escape") this.setPlay(false);
      else if (e.key === "p" || e.key === "P") this.paused = !this.paused;
    };
  }
  leftovers() { return this.fx.length > 0; }
  canAct() { return this.play && !this.paused && this.state === "run" && !!this.cur; }

  bind() {
    if (this.bound) return; this.bound = true;
    for (const t of TET_MOUSE) window.addEventListener(t, this.onMouse, true);
    window.addEventListener("wheel", this.onWheel, { capture: true, passive: false });
    for (const t of TET_KEYS_EV) window.addEventListener(t, this.onKey, true);
  }
  unbind() {
    if (!this.bound) return; this.bound = false;
    for (const t of TET_MOUSE) window.removeEventListener(t, this.onMouse, true);
    window.removeEventListener("wheel", this.onWheel, true);
    for (const t of TET_KEYS_EV) window.removeEventListener(t, this.onKey, true);
  }
  setPlay(on) {
    if (on === this.play) return;
    this.play = on; this.paused = false;
    const app = this.app;
    if (on) {
      this.c.enabled = true;
      this.reset();
      this.bind();
      try { BdApi.DOM.addStyle(NAME + "-tetris", "html.amb-tetris-play,html.amb-tetris-play *{cursor:crosshair !important}"); } catch {}
      document.documentElement.classList.add("amb-tetris-play");
    } else {
      this.unbind();
      document.documentElement.classList.remove("amb-tetris-play");
      try { BdApi.DOM.removeStyle(NAME + "-tetris"); } catch {}
      if (this.grid) this.reset();
    }
    app.save(); app.refreshNav(); app.syncPanel(); app.kick(true);
  }
  togglePlay() { this.setPlay(!this.play); }

  bagNext() {
    if (!this.bag.length) {
      this.bag = TETRO_KEYS.slice();
      for (let i = this.bag.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]]; }
    }
    return this.bag.pop();
  }
  reset() {
    const c = this.c;
    this.cols = c.cols; this.rows = c.rows;
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
    this.bag = []; this.q = [];
    for (let i = 0; i < 4; i++) this.q.push(this.bagNext());
    this.score = 0; this.lines = 0; this.level = 0; this.hold = null; this.canHold = true; this.newBest = false;
    this.state = "run"; this.stateT = 0; this.cur = null; this.plan = null; this.clearRows = []; this.gAcc = 0;
  }
  fits(m, px, py) {
    for (let y = 0; y < m.length; y++) for (let x = 0; x < m.length; x++) {
      if (!m[y][x]) continue;
      const gx = px + x, gy = py + y;
      if (gx < 0 || gx >= this.cols || gy >= this.rows) return false;
      if (gy >= 0 && this.grid[gy][gx]) return false;
    }
    return true;
  }
  stackTop() {
    for (let y = 0; y < this.rows; y++) if (this.grid[y].some(Boolean)) return y;
    return this.rows;
  }
  spawn() { const t = this.q.shift(); this.q.push(this.bagNext()); return this.newPiece(t); }
  newPiece(t) {
    const m = TETROS[t].m.map((r) => r.slice()), b = tBounds(m);
    const x = Math.floor((this.cols - m.length) / 2), y = -b.top;
    this.plan = null; this.gAcc = 0; this.lockT = 0; this.resets = 0; this.stuck = 0;
    if (!this.fits(m, x, y)) { this.cur = null; this.over(); return false; }
    this.cur = { t, m, x, y, rx: x, ry: y - 2 };
    return true;
  }
  move(dx, dy) {
    const cur = this.cur;
    if (!cur || !this.fits(cur.m, cur.x + dx, cur.y + dy)) return false;
    const wasGrounded = dx !== 0 && !this.fits(cur.m, cur.x, cur.y + 1);
    cur.x += dx; cur.y += dy;
    if (wasGrounded && this.resets < 15) { this.lockT = 0; this.resets++; }
    return true;
  }
  rotate(dir) {
    const cur = this.cur; if (!cur) return false;
    const m = tRot(cur.m, dir);
    for (const [kx, ky] of TET_KICKS) {
      if (!this.fits(m, cur.x + kx, cur.y + ky)) continue;
      const wasGrounded = !this.fits(cur.m, cur.x, cur.y + 1);
      cur.m = m; cur.x += kx; cur.y += ky;
      if (wasGrounded && this.resets < 15) { this.lockT = 0; this.resets++; }
      return true;
    }
    return false;
  }
  softDrop() { if (this.move(0, 1)) this.score += 1; }
  hardDrop() {
    const cur = this.cur; if (!cur) return;
    const y0 = cur.y; let d = 0;
    while (this.fits(cur.m, cur.x, cur.y + 1)) { cur.y++; d++; }
    this.score += d * 2;
    if (d > 0) this.trail(cur, y0);
    this.lock();
  }
  holdPiece() {
    if (!this.cur || !this.canHold) return;
    const t = this.cur.t, h = this.hold;
    this.hold = t; this.canHold = false;
    if (h) this.newPiece(h); else { this.cur = null; this.spawn(); }
  }
  lock() {
    const cur = this.cur; if (!cur) return;
    let overflow = false;
    for (let y = 0; y < cur.m.length; y++) for (let x = 0; x < cur.m.length; x++) {
      if (!cur.m[y][x]) continue;
      const gy = cur.y + y, gx = cur.x + x;
      if (gy < 0) overflow = true; else this.grid[gy][gx] = TETROS[cur.t].c;
    }
    this.cur = null; this.canHold = true;
    if (overflow) { this.over(); return; }
    const rows = [];
    for (let y = 0; y < this.rows; y++) if (this.grid[y].every(Boolean)) rows.push(y);
    if (rows.length) {
      this.lines += rows.length;
      this.score += TET_PTS[Math.min(4, rows.length)] * (this.level + 1);
      this.level = Math.floor(this.lines / 10);
      this.clearRows = rows; this.state = "clear"; this.stateT = 0;
      this.burst(rows, 2);
    } else if (!this.play && this.stackTop() <= Math.max(2, Math.floor(this.rows * 0.15))) {
      this.startWipe();
    }
  }
  collapse() {
    const rs = new Set(this.clearRows);
    const keep = this.grid.filter((_, y) => !rs.has(y));
    while (keep.length < this.rows) keep.unshift(Array(this.cols).fill(null));
    this.grid = keep; this.clearRows = [];
  }
  over() {
    this.cur = null;
    if (!this.play) { this.startWipe(); return; }
    this.state = "over"; this.stateT = 0;
    if (this.score > this.best) {
      this.best = this.score; this.newBest = true;
      try { BdApi.Data.save(NAME, "tetrisBest", this.best); } catch {}
    }
  }
  startWipe() {
    this.state = "wipe"; this.stateT = 0;
    const v = this.vis;
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
      if (!this.grid[y][x] || Math.random() > 0.4 || this.fx.length > 450) continue;
      this.fx.push({ x: v.x + (x + 0.5) * v.s, y: v.y + (y + 0.5) * v.s, vx: rand(-160, 160), vy: rand(-260, 40), s: rand(2, 5) * (v.s / 26), life: rand(0.5, 1), max: 1, col: this.grid[y][x] });
    }
  }
  burst(rows, per) {
    const v = this.vis;
    for (const r of rows) for (let x = 0; x < this.cols; x++) for (let k = 0; k < per; k++) {
      if (this.fx.length > 450) return;
      this.fx.push({ x: v.x + (x + 0.5) * v.s, y: v.y + (r + 0.5) * v.s, vx: rand(-240, 240), vy: rand(-420, -40), s: rand(2, 5) * (v.s / 26), life: rand(0.4, 0.9), max: 0.9, col: this.grid[r][x] || "#ffffff" });
    }
  }
  trail(cur, y0) {
    const v = this.vis, b = tBounds(cur.m), col = TETROS[cur.t].c;
    for (let x = b.lo; x <= b.hi; x++) for (let k = 0; k < 3; k++) {
      if (this.fx.length > 450) return;
      this.fx.push({ x: v.x + (cur.x + x + rand(0.1, 0.9)) * v.s, y: v.y + (rand(y0, cur.y) + b.top + 1) * v.s, vx: rand(-30, 30), vy: rand(-40, 20), s: rand(2, 4) * (v.s / 26), life: rand(0.2, 0.4), max: 0.4, col });
    }
  }
  press(b) {
    if (this.state === "over") { if (b === 0) this.reset(); return; }
    if (!this.canAct()) return;
    if (b === 0) this.rotate(1); else if (b === 2) this.hardDrop(); else if (b === 1) this.holdPiece();
  }

  evalPlace(m, px, py) {
    const R = this.rows, C = this.cols;
    const g = this.grid.map((r) => r.map((v) => (v ? 1 : 0)));
    for (let y = 0; y < m.length; y++) for (let x = 0; x < m.length; x++) if (m[y][x] && py + y >= 0) g[py + y][px + x] = 1;
    const keep = []; let lines = 0;
    for (const r of g) if (r.every(Boolean)) lines++; else keep.push(r);
    while (keep.length < R) keep.unshift(Array(C).fill(0));
    let agg = 0, holes = 0, bump = 0, prev = 0;
    for (let x = 0; x < C; x++) {
      let h = 0, seen = false;
      for (let y = 0; y < R; y++) { if (keep[y][x]) { if (!seen) { h = R - y; seen = true; } } else if (seen) holes++; }
      agg += h; if (x) bump += Math.abs(h - prev); prev = h;
    }
    return -0.51 * agg + 0.76 * lines - 0.36 * holes - 0.18 * bump;
  }
  makePlan() {
    const cur = this.cur, noise = (1 - this.c.skill) * 8, seen = new Set();
    let best = null, m = cur.m;
    for (let r = 0; r < 4; r++) {
      const key = m.map((row) => row.join("")).join("|");
      if (!seen.has(key)) {
        seen.add(key);
        const b = tBounds(m);
        for (let x = -b.lo; x <= this.cols - 1 - b.hi; x++) {
          if (!this.fits(m, x, cur.y)) continue;
          let y = cur.y; while (this.fits(m, x, y + 1)) y++;
          const sc = this.evalPlace(m, x, y) + (Math.random() * 2 - 1) * noise;
          if (!best || sc > best.sc) best = { sc, rot: r, x };
        }
      }
      m = tRot(m, 1);
    }
    return best || { sc: 0, rot: 0, x: cur.x };
  }
  ai(dt) {
    const cur = this.cur;
    if (!this.plan) this.plan = this.makePlan();
    const p = this.plan;
    this.aiT -= dt; if (this.aiT > 0) return;
    this.aiT = rand(0.05, 0.1);
    if (p.rot > 0) { this.rotate(1); p.rot--; return; }
    const dx = Math.sign(p.x - cur.x);
    if (dx && !this.move(dx, 0) && ++this.stuck > 2) p.x = cur.x;
  }
  follow(dt) {
    const a = this.app, cur = this.cur;
    if (!a.mouse.on) return;
    this.mvT -= dt; if (this.mvT > 0) return;
    this.mvT = 0.022;
    const v = this.vis, b = tBounds(cur.m);
    const cc = (a.mouse.x - v.x) / v.s, ctr = (b.lo + b.hi + 1) / 2;
    const tx = clamp(Math.round(cc - ctr), -b.lo, this.cols - 1 - b.hi);
    if (tx < cur.x) this.move(-1, 0); else if (tx > cur.x) this.move(1, 0);
  }

  layout() {
    const a = this.app, c = this.c, W = a.W, H = a.H, pa = ease(this.pa);
    const sA = Math.max(8, Math.min(c.cell, Math.floor((H - 8) / this.rows), Math.floor((W * 0.4) / this.cols)));
    const sP = Math.max(8, Math.min(Math.round(c.cell * 1.35), Math.floor((H - 70) / this.rows), Math.floor(W / (this.cols + 13))));
    const s = lerp(sA, sP, pa), bw = this.cols * s, bh = this.rows * s;
    const ax = c.position === "left" ? 24 : c.position === "center" ? (W - bw) / 2 : W - bw - 24;
    this.vis = { s, x: lerp(ax, (W - bw) / 2, pa), y: lerp(H - bh, (H - bh) / 2, pa) };
  }
  tick(dt) {
    const c = this.c;
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const p = this.fx[i];
      p.life -= dt; p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0) this.fx.splice(i, 1);
    }
    if (!c.enabled) { if (this.play) this.setPlay(false); return; }
    if (!this.grid || this.cols !== c.cols || this.rows !== c.rows) this.reset();
    this.pa += ((this.play ? 1 : 0) - this.pa) * Math.min(1, dt * 6);
    if (!this.play && this.pa < 0.003) this.pa = 0;
    this.layout();
    if (this.play && this.paused) return;

    if (this.state === "clear") {
      this.stateT += dt;
      if (this.stateT >= 0.3) { this.collapse(); this.state = "run"; }
      return;
    }
    if (this.state === "wipe") { this.stateT += dt; if (this.stateT >= 1) this.reset(); return; }
    if (this.state === "over") return;

    if (!this.cur) { this.spawn(); return; }
    const cur = this.cur;
    cur.rx += (cur.x - cur.rx) * Math.min(1, dt * 28);
    cur.ry += (cur.y - cur.ry) * Math.min(1, dt * 40);
    if (this.play) this.follow(dt); else this.ai(dt);
    if (!this.cur) return;

    let g;
    if (this.play) g = 1 / Math.max(0.07, 0.8 * Math.pow(0.86, this.level));
    else g = this.plan && this.plan.rot === 0 && cur.x === this.plan.x ? 28 : c.speed;
    this.gAcc += g * dt;
    while (this.gAcc >= 1) { this.gAcc -= 1; if (!this.move(0, 1)) { this.gAcc = 0; break; } }
    if (!this.fits(cur.m, cur.x, cur.y + 1)) {
      this.lockT += dt;
      if (this.lockT >= (this.play ? 0.5 : 0.12)) this.lock();
    } else this.lockT = 0;
  }

  txt(ctx, str, x, y, size, col, align, weight) {
    ctx.font = `${weight || 700} ${Math.round(size)}px system-ui, sans-serif`;
    ctx.fillStyle = col; ctx.textAlign = align || "left"; ctx.textBaseline = "top";
    ctx.fillText(str, x, y);
  }
  mini(ctx, t, x, y, s) {
    const m = TETROS[t].m, b = tBounds(m);
    let hi = 0; m.forEach((r, yy) => r.forEach((v, xx) => { if (v && yy > hi) hi = yy; }));
    const w = (b.hi - b.lo + 1) * s, h = (hi - b.top + 1) * s, ox = x + (4 * s - w) / 2, oy = y + (2 * s - h) / 2;
    for (let yy = b.top; yy <= hi; yy++) for (let xx = b.lo; xx <= b.hi; xx++) if (m[yy][xx]) tCell(ctx, ox + (xx - b.lo) * s, oy + (yy - b.top) * s, s, TETROS[t].c);
  }
  draw(ctx) {
    const go = this.app.s.globalOpacity;
    if (this.c.enabled && this.grid) this.drawBoard(ctx, go);
    for (const p of this.fx) {
      ctx.globalAlpha = clamp(go * (p.life / p.max), 0, 1);
      ctx.fillStyle = p.col; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
    ctx.globalAlpha = 1;
  }
  drawBoard(ctx, go) {
    const c = this.c, v = this.vis, s = v.s, bx = v.x, by = v.y, bw = this.cols * s, bh = this.rows * s;
    const pa = ease(this.pa), al = lerp(this.base(), go, pa);
    const pA = Math.max(pa * 0.8, c.panel ? 0.45 * this.base() : 0);
    if (pA > 0.01) {
      ctx.globalAlpha = clamp(pA, 0, 1); ctx.fillStyle = "#0b0d14"; ctx.fillRect(bx, by, bw, bh);
      ctx.globalAlpha = clamp(pA * 0.14, 0, 1); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 1; x < this.cols; x++) { ctx.moveTo(bx + x * s + 0.5, by); ctx.lineTo(bx + x * s + 0.5, by + bh); }
      for (let y = 1; y < this.rows; y++) { ctx.moveTo(bx, by + y * s + 0.5); ctx.lineTo(bx + bw, by + y * s + 0.5); }
      ctx.stroke();
      ctx.globalAlpha = clamp(pA * 0.55, 0, 1); ctx.lineWidth = 2; ctx.strokeRect(bx - 1, by - 1, bw + 2, bh + 2);
    }
    const wf = this.state === "wipe" ? 1 - clamp(this.stateT / 0.9, 0, 1) : 1;
    ctx.globalAlpha = clamp(al * wf, 0, 1);
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) { const col = this.grid[y][x]; if (col) tCell(ctx, bx + x * s, by + y * s, s, col); }
    if (this.state === "clear") {
      ctx.fillStyle = "#ffffff";
      for (const r of this.clearRows) { ctx.globalAlpha = clamp(al * (0.45 + 0.45 * Math.sin(this.stateT * 45)), 0, 1); ctx.fillRect(bx, by + r * s, bw, s); }
    }
    if (this.state === "run" && this.cur) {
      const cur = this.cur, m = cur.m, col = TETROS[cur.t].c;
      ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
      if (this.play && c.ghost) {
        let gy = cur.y; while (this.fits(m, cur.x, gy + 1)) gy++;
        ctx.globalAlpha = clamp(go * 0.4, 0, 1); ctx.strokeStyle = col; ctx.lineWidth = 2;
        for (let y = 0; y < m.length; y++) for (let x = 0; x < m.length; x++) if (m[y][x]) ctx.strokeRect(bx + (cur.x + x) * s + 2, by + (gy + y) * s + 2, s - 4, s - 4);
      }
      ctx.globalAlpha = clamp(al, 0, 1);
      for (let y = 0; y < m.length; y++) for (let x = 0; x < m.length; x++) if (m[y][x]) tCell(ctx, bx + (cur.rx + x) * s, by + (cur.ry + y) * s, s, col);
      ctx.restore();
    }
    if (pa > 0.05) {
      const f = Math.max(10, s * 0.5), hp = clamp(pa * go, 0, 1), rx = bx + bw + s * 0.9, lx = bx - s * 5.4;
      ctx.globalAlpha = hp;
      this.txt(ctx, "NEXT", rx, by, f, "rgba(255,255,255,.6)");
      for (let i = 0; i < 3; i++) if (this.q[i]) this.mini(ctx, this.q[i], rx, by + f * 1.7 + i * s * 2.5, s * 0.62);
      let y = by + f * 1.7 + 3 * s * 2.5 + s * 0.3;
      for (const [lab, val] of [["SCORE", this.score], ["LINES", this.lines], ["LEVEL", this.level + 1], ["BEST", Math.max(this.best, this.score)]]) {
        this.txt(ctx, lab, rx, y, f * 0.75, "rgba(255,255,255,.55)");
        this.txt(ctx, String(val), rx, y + f * 0.95, f * 1.2, "#ffffff");
        y += f * 2.5;
      }
      this.txt(ctx, "HOLD", lx, by, f, "rgba(255,255,255,.6)");
      if (this.hold) { ctx.globalAlpha = hp * (this.canHold ? 1 : 0.4); this.mini(ctx, this.hold, lx, by + f * 1.7, s * 0.62); ctx.globalAlpha = hp; }
      const tips = ["Move: mouse", "Rotate: left click", "Hard drop: right click", "Soft drop: wheel down", "Rotate back: wheel up", "Hold: middle click", "Pause: P", "Exit: Esc"];
      tips.forEach((t, i) => this.txt(ctx, t, lx, by + s * 6 + i * f * 1.1, f * 0.68, "rgba(255,255,255,.5)", "left", 500));
      if (this.state === "over" || this.paused) {
        ctx.globalAlpha = hp * 0.65; ctx.fillStyle = "#000"; ctx.fillRect(bx, by, bw, bh);
        ctx.globalAlpha = hp; const cx = bx + bw / 2, cy = by + bh / 2 - s * 1.5;
        if (this.paused) this.txt(ctx, "PAUSED", cx, cy, s * 0.95, "#fff", "center");
        else {
          this.txt(ctx, "GAME OVER", cx, cy, s * 0.95, "#fff", "center");
          this.txt(ctx, `Score ${this.score}`, cx, cy + s * 1.4, s * 0.62, "#fff", "center");
          if (this.newBest) this.txt(ctx, "New best!", cx, cy + s * 2.2, s * 0.55, "#facc15", "center");
          this.txt(ctx, "Click to play again", cx, cy + s * 3.1, s * 0.5, "rgba(255,255,255,.75)", "center", 500);
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}

const GEM_PAL = ["#7ee8ff", "#9ad1ff", "#c6a4ff", "#ff9be6", "#9dffd0", "#ffffff"];
KINDS.gems = {
  dir: 1, palette: GEM_PAL,
  draw(ctx, p, c, col, a) {
    const s = p.s, a0 = ctx.globalAlpha;
    if (c.glow) {
      const gs = s * 2.4;
      ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a0 * 0.3;
      ctx.drawImage(glowSprite(col), p.x - gs, p.y - gs, gs * 2, gs * 2);
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = a0;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.sin(p.rot * 0.6) * 0.35);
    ctx.scale(0.8 + 0.2 * Math.cos(p.flip), 1);
    const tl = [-0.5, -0.7], tr = [0.5, -0.7], lg = [-1, -0.2], rg = [1, -0.2], cu = [0, 1], gl = [-0.33, -0.2], gr = [0.33, -0.2];
    const poly = (pts, fill) => {
      ctx.fillStyle = fill; ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)));
      ctx.closePath(); ctx.fill();
    };
    poly([tl, tr, rg, cu, lg], col);
    poly([tl, tr, rg, lg], "rgba(255,255,255,.28)");
    poly([tl, lg, gl], "rgba(255,255,255,.22)");
    poly([tl, tr, gr, gl], "rgba(255,255,255,.35)");
    poly([lg, gl, cu], "rgba(255,255,255,.12)");
    poly([gl, gr, cu], "rgba(0,0,0,.08)");
    poly([rg, gr, cu], "rgba(0,0,0,.25)");
    ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = Math.max(0.7, s * 0.06); ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(tl[0] * s, tl[1] * s); ctx.lineTo(tr[0] * s, tr[1] * s); ctx.lineTo(rg[0] * s, rg[1] * s); ctx.lineTo(cu[0] * s, cu[1] * s); ctx.lineTo(lg[0] * s, lg[1] * s); ctx.closePath();
    ctx.moveTo(lg[0] * s, lg[1] * s); ctx.lineTo(rg[0] * s, rg[1] * s);
    ctx.moveTo(tl[0] * s, tl[1] * s); ctx.lineTo(gl[0] * s, gl[1] * s);
    ctx.moveTo(tr[0] * s, tr[1] * s); ctx.lineTo(gr[0] * s, gr[1] * s);
    ctx.moveTo(gl[0] * s, gl[1] * s); ctx.lineTo(cu[0] * s, cu[1] * s);
    ctx.moveTo(gr[0] * s, gr[1] * s); ctx.lineTo(cu[0] * s, cu[1] * s);
    ctx.stroke();
    if (c.sparkle) {
      const g = Math.pow(Math.max(0, Math.sin(a.t * 1.4 * (0.6 + p.fs * 0.2) + p.ph)), 14);
      if (g > 0.03) {
        const r = s * (0.4 + 1.4 * g), gx = -0.35 * s, gy = -0.5 * s;
        ctx.globalAlpha = Math.min(1, a0 * g * 1.5);
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = Math.max(0.8, s * 0.07); ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(gx - r, gy); ctx.lineTo(gx + r, gy); ctx.moveTo(gx, gy - r); ctx.lineTo(gx, gy + r);
        ctx.moveTo(gx - r * 0.45, gy - r * 0.45); ctx.lineTo(gx + r * 0.45, gy + r * 0.45);
        ctx.moveTo(gx - r * 0.45, gy + r * 0.45); ctx.lineTo(gx + r * 0.45, gy - r * 0.45);
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.globalAlpha = a0;
  }
};

const CANDLE_UP = "#22d68a", CANDLE_DOWN = "#ff4d5f";
class CandlesLayer extends Layer {
  constructor(app) { super(app, "candles"); this.k = []; this.price = 100; this.off = 0; this.lo = 95; this.hi = 105; this.ready = false; }
  gen() {
    const vol = this.c.volatility, trend = this.c.trend;
    const drift = trend === "bull" ? 0.22 : trend === "bear" ? -0.22 : 0;
    const noise = (Math.random() + Math.random() + Math.random() - 1.5) * 1.1;
    const spike = Math.random() < 0.04 ? rand(1.8, 3) : 1;
    const o = this.price, pct = (drift + noise * spike) * vol * 0.9, cl = o * (1 + pct / 100);
    const wk = (Math.abs(pct) * rand(0.1, 0.8) + 0.12 * vol * rand(0.2, 1)) / 100;
    this.price = cl;
    return { o, c: cl, h: Math.max(o, cl) * (1 + wk * rand(0.3, 1)), l: Math.min(o, cl) * (1 - wk * rand(0.3, 1)) };
  }
  tick(dt) {
    const a = this.app, c = this.c, st = c.width * 1.7, n = Math.ceil(a.W / st) + 4;
    while (this.k.length < n) this.k.push(this.gen());
    if (this.k.length > n) this.k.splice(0, this.k.length - n);
    this.off += c.speed * dt;
    while (this.off >= st) { this.off -= st; this.k.shift(); this.k.push(this.gen()); }
    let lo = Infinity, hi = -Infinity;
    this.k.forEach((q, i) => { const x = i * st - this.off; if (x > -st && x < a.W + st) { if (q.l < lo) lo = q.l; if (q.h > hi) hi = q.h; } });
    if (!isFinite(lo)) return;
    const pad = (hi - lo) * 0.1 || 1; lo -= pad; hi += pad;
    if (!this.ready) { this.lo = lo; this.hi = hi; this.ready = true; }
    const k = Math.min(1, dt * 2);
    this.lo += (lo - this.lo) * k; this.hi += (hi - this.hi) * k;
  }
  draw(ctx) {
    const a = this.app, c = this.c, base = this.base(), W = a.W, H = a.H, st = c.width * 1.7, w = c.width;
    const bh = c.position === "full" ? H : H * c.height;
    const y0 = c.position === "top" ? 10 : c.position === "middle" ? (H - bh) / 2 : c.position === "full" ? 0 : H - bh - 10;
    const range = (this.hi - this.lo) || 1;
    const yOf = (v) => y0 + bh - ((v - this.lo) / range) * bh;
    const edge = W * 0.08;
    const fade = (x) => clamp(Math.min(x / edge, (W - x) / edge), 0, 1);
    ctx.lineCap = "butt";
    this.k.forEach((q, i) => {
      const x = i * st - this.off + w / 2;
      if (x < -w || x > W + w) return;
      const up = q.c >= q.o;
      ctx.globalAlpha = clamp(base * fade(x), 0, 1);
      ctx.fillStyle = ctx.strokeStyle = up ? CANDLE_UP : CANDLE_DOWN;
      ctx.lineWidth = Math.max(1, w * 0.14);
      ctx.beginPath(); ctx.moveTo(x, yOf(q.h)); ctx.lineTo(x, yOf(q.l)); ctx.stroke();
      const yt = yOf(Math.max(q.o, q.c)), yb = yOf(Math.min(q.o, q.c));
      ctx.fillRect(x - w / 2, yt, w, Math.max(1.5, yb - yt));
    });
    if (c.ma) {
      ctx.strokeStyle = "#ffd166"; ctx.lineWidth = 1.6; ctx.lineJoin = "round"; ctx.beginPath();
      let first = true;
      for (let i = 4; i < this.k.length; i++) {
        const x = i * st - this.off + w / 2;
        if (x < -st || x > W + st) continue;
        let sum = 0; for (let j = 0; j < 5; j++) sum += this.k[i - j].c;
        const y = yOf(sum / 5);
        if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
      }
      ctx.globalAlpha = clamp(base * 0.7, 0, 1); ctx.stroke();
    }
    const li = clamp(Math.floor((W * 0.9 + this.off) / st), 0, this.k.length - 1), last = this.k[li];
    const up = last.c >= last.o, col = up ? CANDLE_UP : CANDLE_DOWN;
    const priceStr = (v) => (v * 650).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (c.priceLine) {
      const y = yOf(last.c);
      ctx.globalAlpha = clamp(base * 0.5, 0, 1); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.setLineDash([]);
      const tag = priceStr(last.c);
      ctx.font = "600 12px monospace"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
      const tw = ctx.measureText(tag).width + 12;
      ctx.globalAlpha = clamp(base, 0, 1); ctx.fillStyle = col; ctx.fillRect(W - tw - 6, y - 9, tw, 18);
      ctx.fillStyle = "#06120c"; ctx.fillText(tag, W - 12, y);
    }
    if (c.label) {
      let firstO = this.k[0].o;
      for (let i = 0; i < this.k.length; i++) { if (i * st - this.off > 0) { firstO = this.k[i].o; break; } }
      const pct = ((last.c - firstO) / firstO) * 100;
      ctx.globalAlpha = clamp(base, 0, 1); ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.font = "700 14px system-ui, sans-serif"; ctx.fillStyle = "#ffffff"; ctx.fillText("BTC/USD", 18, y0 + 8);
      ctx.font = "600 13px monospace"; ctx.fillStyle = pct >= 0 ? CANDLE_UP : CANDLE_DOWN;
      ctx.fillText(`${priceStr(last.c)}  ${pct >= 0 ? "\u25B2" : "\u25BC"} ${Math.abs(pct).toFixed(2)}%`, 18, y0 + 26);
    }
    ctx.globalAlpha = 1;
  }
}

const PAC_GHOSTS = ["#ff0000", "#ffb8ff", "#00ffff", "#ffb852"];
const drawGhost = (ctx, x, y, r, dir, col, scared, flash, t, ph) => {
  y += Math.sin(t * 7 + ph) * r * 0.07;
  ctx.fillStyle = scared ? (flash ? "#ffffff" : "#2121de") : col;
  ctx.beginPath();
  ctx.moveTo(x - r, y + r); ctx.lineTo(x - r, y); ctx.arc(x, y, r, Math.PI, 0); ctx.lineTo(x + r, y + r);
  const n = 6, fr = Math.floor(t * 8) & 1;
  for (let k = 1; k <= n; k++) ctx.lineTo(x + r - (k * 2 * r) / n, y + r - ((k + fr) % 2 === 1 ? r * 0.25 : 0));
  ctx.closePath(); ctx.fill();
  if (scared) {
    const ec = flash ? "#e03a3a" : "#ffb8ae";
    ctx.fillStyle = ec; ctx.strokeStyle = ec; ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.beginPath(); ctx.arc(x - r * 0.33, y - r * 0.2, r * 0.12, 0, TAU); ctx.arc(x + r * 0.33, y - r * 0.2, r * 0.12, 0, TAU); ctx.fill();
    ctx.beginPath();
    for (let k = 0; k <= 6; k++) { const px = x - r * 0.6 + (k * r * 1.2) / 6, py = y + r * 0.35 + (k % 2 ? -r * 0.12 : 0); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke();
  } else {
    ctx.fillStyle = "#ffffff";
    for (const sx of [-0.33, 0.33]) { ctx.beginPath(); ctx.ellipse(x + r * sx + dir * r * 0.08, y - r * 0.15, r * 0.26, r * 0.33, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = "#1a1aff";
    for (const sx of [-0.33, 0.33]) { ctx.beginPath(); ctx.arc(x + r * sx + dir * r * 0.2, y - r * 0.12, r * 0.14, 0, TAU); ctx.fill(); }
  }
};
const drawPac = (ctx, x, y, r, dir, t) => {
  const m = (0.04 + 0.26 * (0.5 + 0.5 * Math.sin(t * 14))) * Math.PI, base = dir > 0 ? 0 : Math.PI;
  ctx.fillStyle = "#ffe600";
  ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, base + m, base + TAU - m); ctx.closePath(); ctx.fill();
};
class PacLayer extends Layer {
  constructor(app) { super(app, "pacman"); this.timer = 0; }
  leftovers() { return this.p.length > 0; }
  launch() {
    const a = this.app, c = this.c;
    const dir = c.direction === "left" ? -1 : c.direction === "both" ? (Math.random() < 0.5 ? 1 : -1) : 1;
    const s = c.size * rand(0.85, 1.15), gN = clamp(Math.round(c.ghosts), 1, 4);
    const gh = []; for (let i = 0; i < gN; i++) gh.push({ k: "g", i });
    const pac = c.pacman ? [{ k: "p" }] : [];
    const mode = !pac.length ? "chase" : c.mode === "mixed" ? (Math.random() < 0.5 ? "chase" : "power") : c.mode;
    this.p.push({ dir, s, mode, mem: mode === "chase" ? [...pac, ...gh] : [...gh, ...pac], y: rand(a.H * 0.08, a.H * 0.9), x: dir > 0 ? -s : a.W + s, v: c.speed * rand(0.9, 1.15), sp: s * 2.7, ph: rand(0, TAU), t: 0 });
  }
  tick(dt) {
    const a = this.app, c = this.c;
    if (c.enabled) {
      this.timer -= dt;
      if (this.p.length < c.amount && this.timer <= 0) { this.launch(); this.timer = rand(0.6, 1.4) * c.gap; }
    }
    for (let i = this.p.length - 1; i >= 0; i--) {
      const l = this.p[i];
      l.x += l.dir * l.v * dt; l.t += dt;
      const tail = l.x - l.dir * (l.mem.length - 1) * l.sp;
      if (l.dir > 0 ? tail > a.W + l.s * 2 : tail < -l.s * 2) this.p.splice(i, 1);
    }
  }
  draw(ctx) {
    const a = this.app, c = this.c, base = this.base(), W = a.W;
    for (const l of this.p) {
      const s = l.s, fade = Math.min(1, l.t / 0.7);
      const pi = l.mem.findIndex((m) => m.k === "p"), pacX = pi >= 0 ? l.x - l.dir * pi * l.sp : null;
      if (c.pellets && pacX != null) {
        const gap = s * 1.4, eat = pacX + l.dir * s * 0.4;
        const k0 = l.dir > 0 ? Math.max(0, Math.ceil(eat / gap)) : 0, k1 = l.dir > 0 ? Math.floor(W / gap) : Math.min(Math.floor(W / gap), Math.floor(eat / gap));
        ctx.fillStyle = "#ffd9b3";
        for (let k = k0; k <= k1; k++) {
          const px = k * gap;
          if (k % 9 === 4) {
            ctx.globalAlpha = clamp(base * fade * (0.55 + 0.45 * Math.sin(a.t * 8)), 0, 1);
            ctx.beginPath(); ctx.arc(px, l.y, s * 0.3, 0, TAU); ctx.fill();
          } else { ctx.globalAlpha = clamp(base * fade * 0.9, 0, 1); ctx.fillRect(px - s * 0.1, l.y - s * 0.1, s * 0.2, s * 0.2); }
        }
      }
      const prog = l.dir > 0 ? clamp(l.x / W, 0, 1) : clamp(1 - l.x / W, 0, 1);
      ctx.globalAlpha = clamp(base * fade, 0, 1);
      l.mem.forEach((m, i) => {
        const x = l.x - l.dir * i * l.sp;
        if (x < -s * 2 || x > W + s * 2) return;
        if (m.k === "p") drawPac(ctx, x, l.y, s, l.dir, a.t);
        else { const scared = l.mode === "power"; drawGhost(ctx, x, l.y, s, l.dir, PAC_GHOSTS[m.i % 4], scared, scared && prog > 0.7 && (Math.floor(a.t * 6) & 1) === 1, a.t, l.ph + i); }
      });
    }
    ctx.globalAlpha = 1;
  }
}

const CUR_STAR = ["#fff6a8", "#ffd34d", "#ffffff", "#ffb3f0", "#9be7ff"];
const CUR_COINS = { all: ["btc", "eth", "doge", "sol", "ltc"], btc: ["btc"], eth: ["eth"], doge: ["doge"], sol: ["sol"], ltc: ["ltc"] };
const starPath = (ctx, x, y, R, rot) => {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? R * 0.45 : R, an = rot + (i * Math.PI) / 5 - Math.PI / 2, px = x + Math.cos(an) * r, py = y + Math.sin(an) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
};
class CursorLayer extends Layer {
  constructor(app) { super(app, "cursor"); this.pts = []; this.pt = []; this.lx = null; this.ly = null; this.acc = 0; this.idleT = 0; this.style = null; }
  leftovers() { return this.pts.length > 0 || this.pt.length > 0; }
  spacing() { const c = this.c; return Math.max(3, (c.style === "fire" ? 9 : c.style === "stars" ? 16 : 22) / c.density); }
  emit(x, y) {
    const c = this.c, L = c.length;
    if (this.pt.length > 700) return;
    let life;
    if (c.style === "fire") {
      life = L * rand(0.4, 0.9);
      this.pt.push({ x: x + rand(-3, 3), y: y + rand(-3, 3), vx: rand(-30, 30), vy: rand(-110, -30), s: c.size * rand(0.5, 1.1), life, max: life, ph: 0, rot: 0, rv: 0, col: "" });
    } else if (c.style === "stars") {
      life = L * rand(0.6, 1.2);
      this.pt.push({ x: x + rand(-4, 4), y: y + rand(-4, 4), vx: rand(-45, 45), vy: rand(-30, 50), s: c.size * rand(0.5, 1), life, max: life, ph: rand(0, TAU), rot: rand(0, TAU), rv: rand(-4, 4), col: pick(CUR_STAR) });
    } else {
      life = L * rand(1.2, 1.8);
      this.pt.push({ x, y, vx: rand(-120, 120), vy: -rand(80, 260), s: c.size * 0.85, life, max: life, ph: rand(0, TAU), rot: 0, rv: rand(5, 12), col: pick(CUR_COINS[c.coinSet] || CUR_COINS.all) });
    }
  }
  tick(dt) {
    const a = this.app, c = this.c, m = a.mouse;
    if (this.style !== c.style) { this.style = c.style; this.pts.length = 0; this.pt.length = 0; }
    if (c.enabled && m.on) {
      if (this.lx == null) { this.lx = m.x; this.ly = m.y; }
      const dx = m.x - this.lx, dy = m.y - this.ly, d = Math.hypot(dx, dy);
      if (c.style === "rainbow") {
        if (d >= 2) { this.pts.push({ x: m.x, y: m.y, age: 0 }); this.lx = m.x; this.ly = m.y; }
      } else if (d >= 1) {
        if (d < 700) {
          const sp = this.spacing();
          let pos = sp - this.acc, last = -this.acc;
          while (pos <= d) { this.emit(lerp(this.lx, m.x, pos / d), lerp(this.ly, m.y, pos / d)); last = pos; pos += sp; }
          this.acc = d - last;
        }
        this.lx = m.x; this.ly = m.y; this.idleT = 0;
      } else if (c.idle) {
        this.idleT += dt;
        const iv = c.style === "fire" ? 0.03 : 0.09;
        while (this.idleT >= iv) { this.idleT -= iv; this.emit(m.x, m.y); }
      }
    } else if (!m.on) this.lx = null;
    for (let i = this.pts.length - 1; i >= 0; i--) { this.pts[i].age += dt; if (this.pts[i].age > c.length) this.pts.splice(i, 1); }
    for (let i = this.pt.length - 1; i >= 0; i--) {
      const p = this.pt[i];
      p.life -= dt;
      if (c.style === "stars") p.vy += 110 * dt; else if (c.style === "coins") { p.vy += 1000 * dt; p.vx *= 1 - Math.min(1, dt * 1.2); }
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.rv * dt;
      if (p.life <= 0) this.pt.splice(i, 1);
    }
  }
  draw(ctx) {
    const a = this.app, c = this.c, base = this.base(), L = c.length;
    if (c.style === "rainbow") {
      const n = this.pts.length;
      if (n < 2) return;
      const bw = c.size * 0.32;
      ctx.lineCap = "butt";
      for (let i = 1; i < n; i++) {
        const p0 = this.pts[i - 1], p1 = this.pts[i], f = 1 - p1.age / L;
        if (f <= 0) continue;
        const dx = p1.x - p0.x, dy = p1.y - p0.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, w = bw * (0.4 + 0.6 * f);
        ctx.globalAlpha = clamp(base * f, 0, 1); ctx.lineWidth = w + 0.6;
        for (let k = 0; k < 6; k++) {
          const o = (k - 2.5) * w;
          ctx.strokeStyle = NYAN_BANDS[k];
          ctx.beginPath(); ctx.moveTo(p0.x + nx * o, p0.y + ny * o); ctx.lineTo(p1.x + nx * o, p1.y + ny * o); ctx.stroke();
        }
      }
    } else if (c.style === "fire") {
      ctx.globalCompositeOperation = "lighter";
      for (const p of this.pt) {
        const lr = clamp(p.life / p.max, 0, 1), r = p.s * (0.6 + 0.8 * lr), gs = r * 2.2;
        ctx.globalAlpha = clamp(base * lr * 1.1, 0, 1);
        ctx.drawImage(glowSprite(lr > 0.66 ? "#fff1a8" : lr > 0.33 ? "#ff9d1a" : "#ff3b1a"), p.x - gs, p.y - gs, gs * 2, gs * 2);
      }
      ctx.globalCompositeOperation = "source-over";
    } else if (c.style === "stars") {
      for (const p of this.pt) {
        const lr = clamp(p.life / p.max, 0, 1), R = p.s * (0.5 + 0.5 * lr), tw = 0.7 + 0.3 * Math.sin(a.t * 14 + p.ph);
        if (c.glow) {
          const gs = R * 2.6;
          ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = clamp(base * lr * 0.4, 0, 1);
          ctx.drawImage(glowSprite(p.col), p.x - gs, p.y - gs, gs * 2, gs * 2);
          ctx.globalCompositeOperation = "source-over";
        }
        ctx.globalAlpha = clamp(base * lr * tw, 0, 1); ctx.fillStyle = p.col;
        starPath(ctx, p.x, p.y, R, p.rot); ctx.fill();
      }
    } else {
      for (const p of this.pt) {
        const lr = clamp(p.life / p.max, 0, 1), cs = Math.cos(p.rot), ac = Math.abs(cs), s = p.s;
        const al = clamp(base * Math.min(1, lr * 3.3), 0, 1);
        if (c.glow) {
          const gs = s * 2;
          ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = al * 0.28;
          ctx.drawImage(glowSprite(COINS[p.col].glow), p.x - gs, p.y - gs, gs * 2, gs * 2);
          ctx.globalCompositeOperation = "source-over";
        }
        ctx.globalAlpha = al;
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(Math.max(ac, 0.08), 1);
        ctx.drawImage(coinSprite(p.col, cs < 0), -s, -s, s * 2, s * 2);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
}

const EXTRA_LAYERS = { candles: CandlesLayer, pacman: PacLayer, cursor: CursorLayer, tetris: TetrisLayer, crypto: CryptoLayer, nyan: NyanLayer, xp: XPLayer, nether: NetherLayer, end: EndLayer, storm: StormLayer };

const PANEL_CSS = `
.amb-range{display:flex;align-items:center;gap:12px;width:330px;max-width:58%}
.amb-range input{flex:1;min-width:0;accent-color:var(--nsx-accent,#f4f4f5);cursor:pointer}
.amb-val{min-width:68px;text-align:right;font-variant-numeric:tabular-nums;color:var(--nsx-muted,#7e7e87);font-size:12.5px}
.amb-color{width:46px;height:30px;padding:2px;border:1px solid var(--nsx-line,rgba(255,255,255,.1));border-radius:8px;background:transparent;cursor:pointer}
.amb-note{color:var(--nsx-muted,#7e7e87);font-size:12.5px;padding:2px 2px 12px;line-height:1.5}
.amb-btns{display:flex;flex-wrap:wrap;gap:8px;padding:16px 0 4px}
.amb-on{color:#7cf0a4}
.amb-navlabel{padding:16px 12px 4px;font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--nsx-muted,#7e7e87);pointer-events:none}
`;

module.exports = class Ambience {
  constructor() {
    this.s = this.load();
    this.t = 0; this.W = 0; this.H = 0; this.last = 0; this.raf = 0;
    this.mouse = { x: 0, y: 0, on: false };
    this.layers = [];
    this.fps = 0; this.fpsAcc = 0; this.fpsN = 0;
    this.frame = this.frame.bind(this);
    this.page = "general";
    this.ui = null;
  }

  defaults() {
    const s = JSON.parse(JSON.stringify(GENERAL_DEFAULTS));
    s.fx = {};
    for (const k of FX_KEYS) s.fx[k] = { ...FX[k].defaults };
    return s;
  }
  load() {
    const d = this.defaults();
    let saved = null;
    try { saved = BdApi.Data.load(NAME, "settings"); } catch {}
    if (!saved || typeof saved !== "object") return d;
    for (const k of Object.keys(GENERAL_DEFAULTS)) if (typeof saved[k] === typeof d[k]) d[k] = saved[k];
    for (const k of FX_KEYS) {
      const sv = saved.fx && saved.fx[k];
      if (!sv) continue;
      for (const key of Object.keys(d.fx[k])) if (typeof sv[key] === typeof d.fx[k][key]) d.fx[k][key] = sv[key];
    }
    return d;
  }
  save() {
    clearTimeout(this.saveT);
    this.saveT = setTimeout(() => { try { BdApi.Data.save(NAME, "settings", this.s); } catch {} }, 250);
  }

  start() {
    this.canvas = document.createElement("canvas");
    this.canvas.id = "ambience-canvas";
    this.canvas.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;";
    document.body.append(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    const mk = (k) => k === "rain" ? new RainLayer(this) : k === "glass" ? new GlassLayer(this) : k === "fireflies" ? new FireflyLayer(this)
      : k === "stars" ? new StarLayer(this) : k === "matrix" ? new MatrixLayer(this) : k === "confetti" ? new ConfettiLayer(this) : EXTRA_LAYERS[k] ? new EXTRA_LAYERS[k](this) : new Flow(this, k);
    this.layers = FX_KEYS.map(mk);
    this.byKey = Object.fromEntries(this.layers.map((l) => [l.key, l]));
    const order = ["stars", "candles", "storm", "end", "matrix", "fireflies", "bubbles", "nether", "snow", "sakura", "leaves", "hearts", "embers", "blocks", "xp", "gems", "crypto", "tetris", "pacman", "nyan", "confetti", "rain", "glass", "cursor"];
    this.layers.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

    this.onResize = () => this.resize();
    this.onMove = (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.on = true; };
    this.onLeave = () => { this.mouse.on = false; };
    this.onKey = (e) => {
      if (fxKeyHit(e, "fxToggle")) {
        e.preventDefault();
        this.s.master = !this.s.master;
        this.save(); this.kick(); this.syncPanel();
      } else if (fxKeyHit(e, "fxTetris")) {
        e.preventDefault();
        this.byKey.tetris.togglePlay();
        this.kick(true);
      }
    };
    window.addEventListener("resize", this.onResize);
    document.addEventListener("mousemove", this.onMove, true);
    document.addEventListener("mouseleave", this.onLeave, true);
    document.addEventListener("keydown", this.onKey, true);
    this.resize();
    this.applyLayer();
    this.kick();
  }

  stop() {
    try { this.byKey.tetris.setPlay(false); } catch {}
    cancelAnimationFrame(this.raf); this.raf = 0;
    clearTimeout(this.saveT);
    try { BdApi.Data.save(NAME, "settings", this.s); } catch {}
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("mousemove", this.onMove, true);
    document.removeEventListener("mouseleave", this.onLeave, true);
    document.removeEventListener("keydown", this.onKey, true);
    this.canvas?.remove();
    try { BdApi.DOM.removeStyle(NAME); BdApi.DOM.removeStyle(NAME + "-layer"); } catch {}
  }

  resize() {
    this.W = window.innerWidth; this.H = window.innerHeight;
    const k = (window.devicePixelRatio || 1) * this.s.renderScale;
    this.k = k;
    this.canvas.width = Math.max(1, Math.round(this.W * k));
    this.canvas.height = Math.max(1, Math.round(this.H * k));
  }

  applyLayer() {
    const behind = this.s.layer === "behind";
    this.canvas.style.zIndex = behind ? "-1" : "99990";
    try {
      BdApi.DOM.removeStyle(NAME + "-layer");
      if (behind) BdApi.DOM.addStyle(NAME + "-layer", "body.ns-bg-on::before{z-index:-3 !important}body.ns-bg-on::after{z-index:-2 !important}");
    } catch {}
  }

  shouldRun() { return this.s.master && this.layers.some((l) => l.active()); }
  clear() { this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
  kick(force) {
    if (!this.canvas.isConnected) document.body.append(this.canvas);
    if (this.shouldRun() || force) { if (!this.raf) { this.last = 0; this.raf = requestAnimationFrame(this.frame); } }
    else { cancelAnimationFrame(this.raf); this.raf = 0; this.clear(); }
  }

  frame(ts) {
    this.raf = 0;
    if (!this.shouldRun()) { this.clear(); return; }
    this.raf = requestAnimationFrame(this.frame);
    if (document.hidden || (this.s.pauseOnBlur && !document.hasFocus())) { this.last = 0; return; }
    const cap = this.s.fpsCap;
    if (this.last && cap && ts - this.last < 1000 / cap - 1.5) return;
    const raw = this.last ? (ts - this.last) / 1000 : 1 / 60;
    this.last = ts;
    const dt = clamp(raw, 0, 0.05) * this.s.timeScale;
    this.t += dt;
    const s = this.s;

    const ctx = this.ctx;
    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    let total = 0;
    for (const l of this.layers) {
      if (!l.active()) continue;
      l.tick(dt);
      l.draw(ctx);
      total += l.p.length;
    }
    if (s.showFps) {
      this.fpsAcc += raw; this.fpsN++;
      if (this.fpsAcc >= 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(10, this.H - 34, 170, 24);
      ctx.fillStyle = "#7cf0a4"; ctx.font = "12px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(`${this.fps} fps | ${total} particles`, 18, this.H - 22);
    }
  }

  applyPreset(name) {
    const p = PRESETS[name];
    if (!p) return;
    const d = this.defaults();
    for (const k of FX_KEYS) {
      const listed = !!(p.fx && p.fx[k]);
      if (p.only ? !listed : k === "cursor" && !listed) continue;
      this.s.fx[k] = d.fx[k];
    }
    for (const [k, over] of Object.entries(p.fx || {})) Object.assign(this.s.fx[k], over, { enabled: true });
    this.s.master = true;
    this.save(); this.kick(); this.render(); this.refreshNav();
  }

  getSettingsPanel() {
    try { BdApi.DOM.addStyle(NAME, PANEL_CSS); } catch {}
    const nav = h("nav", { class: "nsx-nav" });
    const content = h("div", { class: "nsx-content" });
    const root = h("div", { class: "nsx" }, h("aside", { class: "nsx-side" }, nav), content);
    this.ui = { nav, content, tabs: {} };
    const pages = [["general", "General"], ["--", "Reacts to you"], ["cursor", FX.cursor.name], ["--", "Ambience"], ...FX_KEYS.filter((k) => k !== "cursor").map((k) => [k, FX[k].name])];
    for (const [id, name] of pages) {
      if (id === "--") { nav.append(h("div", { class: "amb-navlabel" }, name)); continue; }
      const count = h("span", { class: "nsx-count" });
      const tab = h("button", { class: "nsx-tab", onclick: () => { this.page = id; this.render(true); } }, h("span", {}, name), count);
      this.ui.tabs[id] = { tab, count };
      nav.append(tab);
    }
    this.render(true);
    this.refreshNav();
    return root;
  }

  refreshNav() {
    if (!this.ui) return;
    for (const k of FX_KEYS) {
      const t = this.ui.tabs[k]; if (!t) continue;
      t.count.textContent = this.s.fx[k].enabled ? "on" : "";
      t.count.style.display = this.s.fx[k].enabled ? "" : "none";
    }
    this.ui.tabs.general.count.style.display = "none";
  }
  syncPanel() { if (this.ui && this.ui.content.isConnected) this.render(); }
  changed() { this.save(); this.kick(); }

  row(label, note, ctrl, toggle) {
    const lab = h("div", { class: "nsx-label" }, h("div", { class: "nsx-name" }, label));
    if (note) lab.append(h("div", { class: "nsx-note" }, fxText(note)));
    const r = h("div", { class: "nsx-row" }, lab, ctrl);
    if (toggle) { r.classList.add("is-toggle"); lab.addEventListener("click", () => toggle.click()); }
    return r;
  }
  switchCtl(get, set) {
    const input = h("input", { type: "checkbox" });
    input.checked = !!get();
    input.addEventListener("change", () => set(input.checked));
    return { node: h("label", { class: "nsx-switch" }, input, h("span", { class: "nsx-knob" })), input };
  }
  rangeCtl(get, set, def, ctl) {
    const fmt = (v) => { const dec = (String(ctl.step).split(".")[1] || "").length; return Number(v).toFixed(dec) + (ctl.unit ? " " + ctl.unit : ""); };
    const val = h("span", { class: "amb-val" }, fmt(get()));
    const input = h("input", { type: "range", min: ctl.min, max: ctl.max, step: ctl.step, value: get() });
    input.addEventListener("input", () => { const v = Number(input.value); set(v); val.textContent = fmt(v); });
    input.addEventListener("dblclick", () => { input.value = def; set(def); val.textContent = fmt(def); });
    return h("div", { class: "amb-range" }, input, val);
  }
  selectCtl(get, set, options) {
    const sel = h("select", { class: "nsx-input" });
    for (const [v, l] of options) sel.append(h("option", { value: String(v) }, l));
    sel.value = String(get());
    sel.addEventListener("change", () => set(sel.value));
    return sel;
  }
  colorCtl(get, set) {
    const inp = h("input", { type: "color", class: "amb-color" });
    inp.value = get();
    inp.addEventListener("input", () => set(inp.value));
    return inp;
  }
  buildControl(obj, ctl, defs) {
    const get = () => obj[ctl.k], set = (v) => { obj[ctl.k] = v; this.changed(); };
    if (ctl.type === "range") return this.row(ctl.label, ctl.note, this.rangeCtl(get, set, defs[ctl.k], ctl));
    if (ctl.type === "color") return this.row(ctl.label, ctl.note, this.colorCtl(get, set));
    if (ctl.type === "select") return this.row(ctl.label, ctl.note, this.selectCtl(get, set, ctl.options));
    if (ctl.type === "switch") { const sw = this.switchCtl(get, set); return this.row(ctl.label, ctl.note, sw.node, sw.input); }
    return h("div");
  }
  section(title, ...rows) {
    return h("section", { class: "nsx-section" }, h("div", { class: "nsx-sec-head" }, h("h2", {}, title)), h("div", { class: "nsx-rows" }, ...rows));
  }
  btn(label, fn, ghost) { return h("button", { class: "nsx-btn" + (ghost ? " is-ghost" : ""), onclick: fn }, label); }

  render(resetScroll) {
    if (!this.ui) return;
    const { content, tabs } = this.ui;
    for (const [id, t] of Object.entries(tabs)) t.tab.classList.toggle("is-active", id === this.page);
    content.replaceChildren();
    content.append(this.page === "general" ? this.generalPage() : this.effectPage(this.page));
    if (resetScroll) content.scrollTop = 0;
  }

  effectPage(key) {
    const def = FX[key], obj = this.s.fx[key];
    const sw = this.switchCtl(() => obj.enabled, (v) => { obj.enabled = v; this.changed(); this.refreshNav(); });
    const rows = [this.row("Enable " + def.name.toLowerCase(), "Turn this effect on or off.", sw.node, sw.input)];
    for (const ctl of def.controls) rows.push(this.buildControl(obj, ctl, def.defaults));
    const btns = h("div", { class: "amb-btns" },
      this.btn("Reset this effect", () => { Object.assign(obj, def.defaults, { enabled: obj.enabled }); this.changed(); this.render(); }, true));
    if (key === "rain") btns.append(this.btn("Trigger lightning now", () => { this.byKey.rain.strike(); this.kick(true); }));
    if (key === "crypto") btns.append(this.btn("Make it rain", () => { this.byKey.crypto.burst(); this.kick(true); }));
    if (key === "nyan") btns.append(this.btn("Launch a cat", () => { this.byKey.nyan.launch(); this.kick(true); }));
    if (key === "pacman") btns.append(this.btn("Send Pac-Man across", () => { this.byKey.pacman.launch(); this.kick(true); }));
    if (key === "tetris") {
      btns.append(this.btn(this.byKey.tetris.play ? "Stop playing" : `Play with mouse (${fxKeyLabel("fxTetris")})`, () => { this.byKey.tetris.togglePlay(); }));
      btns.append(this.btn("New auto game", () => { this.byKey.tetris.reset(); this.kick(true); }, true));
    }
    if (key === "storm") btns.append(this.btn("Strike lightning now", () => { this.byKey.storm.strike(); this.kick(true); }));
    const sec = this.section(def.name, ...rows);
    return h("div", {}, h("div", { class: "amb-note", style: "padding-top:14px" }, fxText(def.blurb) + " Tip: double-click any slider to reset it."), sec, btns);
  }

  generalPage() {
    const s = this.s, d = GENERAL_DEFAULTS;
    const num = (k, label, note, min, max, step, unit) => this.row(label, note, this.rangeCtl(() => s[k], (v) => { s[k] = v; if (k === "renderScale") this.resize(); this.changed(); }, d[k], R(k, label, note, min, max, step, unit)));
    const toggle = (k, label, note) => { const c = this.switchCtl(() => s[k], (v) => { s[k] = v; this.changed(); }); return this.row(label, note, c.node, c.input); };

    const presetSel = h("select", { class: "nsx-input" }, h("option", { value: "" }, "Choose a preset..."), ...Object.keys(PRESETS).map((n) => h("option", { value: n }, n)));
    presetSel.addEventListener("change", () => { if (presetSel.value) this.applyPreset(presetSel.value); });

    const layerSel = this.selectCtl(() => s.layer, (v) => { s.layer = v; this.applyLayer(); this.changed(); }, [["front", "In front of everything"], ["behind", "Behind the UI (needs a background image)"]]);
    const fpsSel = this.selectCtl(() => String(s.fpsCap), (v) => { s.fpsCap = Number(v); this.changed(); }, [["30", "30 fps"], ["60", "60 fps"], ["90", "90 fps"], ["120", "120 fps"], ["144", "144 fps"], ["0", "Match display"]]);

    const btns = h("div", { class: "amb-btns" },
      this.btn("Trigger lightning", () => { this.byKey.rain.strike(); this.kick(true); }),
      this.btn("Turn every effect off", () => { for (const k of FX_KEYS) s.fx[k].enabled = false; this.changed(); this.render(); this.refreshNav(); }, true),
      this.btn("Reset everything", () => { this.s = this.defaults(); this.resize(); this.applyLayer(); this.changed(); this.render(); this.refreshNav(); }, true));

    return h("div", {},
      this.section("Master",
        toggle("master", `Enable effects (${fxKeyLabel("fxToggle")})`, "Turns every effect on or off without losing your settings."),
        this.row("Presets", "Applies a ready-made combination. This replaces your current effect settings.", presetSel),
        this.row("Layer", "Where the effects are drawn. They never block clicks.", layerSel),
        num("timeScale", "Global speed", "Slow everything down or speed it up.", 0.1, 3, 0.05, "x"),
        num("globalOpacity", "Global opacity", "Fades every effect together.", 0.05, 1, 0.05)),
      this.section("Cursor",
        toggle("mouse", "Particles dodge the cursor", "Your mouse pointer pushes nearby particles away."),
        num("mouseRadius", "Push radius", "", 40, 400, 5, "px"),
        num("mouseForce", "Push strength", "", 50, 1500, 10)),
      this.section("Performance",
        toggle("scaleByWindow", "Scale amount with window size", "Keeps density the same on small and large windows."),
        num("maxParticles", "Max particles per effect", "Hard cap to protect your framerate.", 200, 6000, 100),
        this.row("Frame rate limit", "Lower uses less CPU and GPU.", fpsSel),
        num("renderScale", "Render resolution", "Lower is faster and slightly softer.", 0.4, 1, 0.05, "x"),
        toggle("pauseOnBlur", "Pause when the window isn't focused", "Saves power in the background."),
        toggle("showFps", "Show FPS counter", "Small readout in the bottom-left corner.")),
      btns);
  }
};