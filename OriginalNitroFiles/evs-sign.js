// @name OpsexCord
// @author @geofeed on discord
const { spawnSync } = require("child_process");

exports.default = async function evsSign(context) {
  if (context.electronPlatformName !== "win32") return;
  const dir = context.appOutDir;
  const run = (py) => spawnSync(py, ["-m", "castlabs_evs.vmp", "sign-pkg", dir], { stdio: "inherit" });
  let r = run("python");
  if (r.error || r.status !== 0) r = run("py");
  if (r.error || r.status !== 0) {
    console.warn("\n[evs] VMP signing did NOT run, so this build is unsigned and Spotify in-app playback may fail.");
    console.warn("[evs] Set it up once: python -m pip install castlabs-evs, then python -m castlabs_evs.account signup\n");
  } else {
    console.log("[evs] VMP-signed " + dir);
  }
};