// @name OpsexCord
// @author @geofeed on discord

(() => {
  if (window.__nitroShieldLoaded) return;
  window.__nitroShieldLoaded = true;

  const toast = (text) => {
    const el = document.createElement("div");
    el.className = "ns-toast";
    el.textContent = text;
    document.body.append(el);
    setTimeout(() => el.remove(), 2000);
  };

  if (!window.__nitroPlugins) document.addEventListener(
    "keydown",
    (e) => {
      if (!(e.ctrlKey && e.altKey)) return;
      if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        document.body.classList.toggle("ns-blur");
      }
    },
    true
  );

  const clearEmptyVideos = () => {
    for (const v of document.querySelectorAll("video")) {
      const empty = v.readyState < 2 && v.paused && !v.poster;
      const box = v.parentElement;
      if (empty && !v.dataset.nsClear) {
        v.dataset.nsClear = "1";
        v.style.visibility = "hidden";
        if (box) box.style.setProperty("background", "transparent", "important");
      } else if (!empty && v.dataset.nsClear) {
        delete v.dataset.nsClear;
        v.style.visibility = "";
        if (box) box.style.removeProperty("background");
      }
    }
  };
  setInterval(clearEmptyVideos, 400);

  console.log("[NitroShield] loaded");
})();