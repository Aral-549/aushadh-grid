#!/usr/bin/env python3
"""Runs the golden cases in tests/golden/*.js against the real built index.html in headless Chromium.

Usage: python3 tests/run_golden.py   (needs chromium or google-chrome on PATH)
Exit code is non-zero if any case fails.
"""
import functools, http.server, json, os, re, shutil, subprocess, sys, tempfile, threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BROWSER = next((b for b in ("chromium", "google-chrome-stable", "google-chrome", "chromium-browser") if shutil.which(b)), None)

PRE = """<script>
window.__errs = [];
addEventListener("error", e => __errs.push(e.message));
(() => {
  const mode = new URLSearchParams(location.search).get("mode") || "default";
  if (mode === "blocked") { Object.defineProperty(window, "localStorage", { get() { throw new DOMException("denied", "SecurityError"); } }); return; }
  localStorage.clear();
  if (mode === "done") localStorage.setItem("ag-tour-done", "1");
  if (mode === "storedlight") localStorage.setItem("ag-theme", "light");
})();
window.__GOLDEN_BASELINE = %s;
</script>
"""

FRAME = """<!doctype html><meta charset="utf-8"><body style="margin:0">
<iframe id="f" src="index.html?mode=narrow" style="width:%dpx;height:740px;border:0"></iframe>
<script>setTimeout(() => { const p = document.getElementById("f").contentDocument.getElementById("GOLDEN"); const o = document.createElement("pre"); o.id = "GOLDEN"; o.textContent = p ? p.textContent : "{}"; document.body.appendChild(o); }, 4000);</script>
"""

# (label, path, extra chromium flags)
RUNS = [
    ("default, OS light, 1440px", "index.html?mode=default", ["--blink-settings=preferredColorScheme=1", "--window-size=1440,1000"]),
    ("tour already done", "index.html?mode=done", ["--window-size=1280,900"]),
    ("storage blocked", "index.html?mode=blocked", ["--window-size=1280,900"]),
    ("deep link #stock", "index.html?mode=deeplink#stock", ["--window-size=1280,900"]),
    ("unknown hash #foo", "index.html?mode=badhash#foo", ["--window-size=1280,900"]),
    ("stored light, OS dark", "index.html?mode=storedlight", ["--blink-settings=preferredColorScheme=0", "--window-size=1280,900"]),
    ("plan impact, runs, orders, backtest", "index.html?mode=impact", ["--window-size=1440,1000"]),
    ("forecast", "index.html?mode=forecast", ["--window-size=1440,1000"]),
    ("phone 360px", "frame360.html", ["--window-size=900,800"]),
    ("phone 390px", "frame390.html", ["--window-size=900,800"]),
]


def main():
    if not BROWSER:
        sys.exit("No chromium/chrome found on PATH")
    work = tempfile.mkdtemp(prefix="ag-golden-")
    try:
        shutil.copytree(os.path.join(ROOT, "vendor"), os.path.join(work, "vendor"))
        page = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
        base = json.load(open(os.path.join(ROOT, "tests/golden/engine_baseline.json"), encoding="utf-8"))
        cases = "\n".join(open(os.path.join(ROOT, "tests/golden", f), encoding="utf-8").read() for f in ("ui_cases.js", "impact_cases.js", "forecast_cases.js"))
        page = page.replace("<head>\n", "<head>\n" + PRE % json.dumps(base), 1)
        page = page.replace("</body>", "<script>\n" + cases + "\n</script>\n</body>", 1)
        open(os.path.join(work, "index.html"), "w", encoding="utf-8").write(page)
        for w in (360, 390):
            open(os.path.join(work, f"frame{w}.html"), "w", encoding="utf-8").write(FRAME % w)

        class Quiet(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *a): pass
        handler = functools.partial(Quiet, directory=work)
        srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        port = srv.server_address[1]

        failed = total = 0
        for label, path, flags in RUNS:
            out = ""
            for attempt in (1, 2):  # a headless browser occasionally hangs; retry once, then report it as a failure
                prof = tempfile.mkdtemp(prefix="ag-prof-")
                try:
                    out = subprocess.run([BROWSER, "--headless=new", "--disable-gpu", "--no-first-run", f"--user-data-dir={prof}",
                                          "--virtual-time-budget=9000", "--dump-dom", *flags, f"http://127.0.0.1:{port}/{path}"],
                                         capture_output=True, text=True, timeout=120).stdout
                    break
                except subprocess.TimeoutExpired:
                    print(f"  (browser timed out, attempt {attempt})")
                finally:
                    shutil.rmtree(prof, ignore_errors=True)
            # each case file appends its own GOLDEN block; merge them (later files win on a shared id such as no-js-errors)
            res = {}
            for block in re.findall(r'<pre id="GOLDEN">(.*?)</pre>', out, re.S):
                res.update(json.loads(block.replace("&gt;", ">").replace("&lt;", "<").replace("&amp;", "&")))
            if not re.search(r'<pre id="GOLDEN">', out):
                res = {"harness-no-result": [False, "page produced no GOLDEN block"]}
            if not res:
                res = {"harness-empty": [False, "no cases ran"]}
            print(f"\n== {label}")
            for cid, (ok, detail) in res.items():
                total += 1
                failed += not ok
                print(f"  {'PASS' if ok else 'FAIL'}  {cid}" + ("" if ok else f"   -> {detail}"))
        srv.shutdown()
        print(f"\n{total - failed}/{total} passed")
        sys.exit(1 if failed else 0)
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
