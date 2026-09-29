#!/usr/bin/env python3
"""Chooses the forecast smoothing parameters without touching the reported holdout.

Selection window: fit on days 0-91, forecast days 92-105, score WAPE (contracts/forecast.md).
The app's backtest holdout (days 106-119) is scored only for the report, never for the choice.

Usage: python3 tools/tune_forecast.py   (needs chromium or google-chrome on PATH; run ./build.sh first)
"""
import functools, http.server, json, os, re, shutil, subprocess, tempfile, threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BROWSER = next((b for b in ("chromium", "google-chrome-stable", "google-chrome", "chromium-browser") if shutil.which(b)), None)
ALPHAS = [0.05, 0.1, 0.15, 0.2, 0.3, 0.4]
BETAS = [0, 0.02, 0.05, 0.08]

PROBE = """<script>
setTimeout(() => {
  const T = window.__AG_TEST, ALPHAS = %s, BETAS = %s;
  // WAPE of the model and of a 28-day mean when fitting on days [0, fitN) and scoring days [fitN, fitN + 14)
  const score = (fitN, alpha, beta) => {
    let em = 0, en = 0, act = 0;
    T.PHCS.forEach(p => T.MEDS.forEach(m => {
      const raw = p.hist[m.id].slice(0, fitN + 14);
      const cl = T.cleanSeries(raw);                      // skip mask from data up to the end of this window only
      const bad = new Set([...cl.censored, ...cl.outliers].map(c => c.t));
      const fit = T.baseForecast(raw.slice(0, fitN), alpha, beta);
      for (let k = 0; k < 14; k++) {
        const t = fitN + k; if (bad.has(t)) continue;
        em += Math.abs(fit.f[k] - raw[t]); en += Math.abs(fit.naive - raw[t]); act += raw[t];
      }
    }));
    return { model: em / act, naive: en / act };
  };
  const grid = [];
  for (const a of ALPHAS) for (const b of BETAS) grid.push({ alpha: a, beta: b, sel: score(T.HIST - 28, a, b).model });
  const best = grid.slice().sort((x, y) => x.sel - y.sel || x.beta - y.beta || y.alpha - x.alpha)[0];
  const out = { grid, best, naiveSel: score(T.HIST - 28, 0.3, 0).naive,
    holdoutBest: score(T.HIST - 14, best.alpha, best.beta), holdoutCurrent: score(T.HIST - 14, T.ALPHA, T.BETA), current: { alpha: T.ALPHA, beta: T.BETA } };
  const pre = document.createElement("pre"); pre.id = "TUNE"; pre.textContent = JSON.stringify(out); document.body.appendChild(pre);
}, 1200);
</script>
"""


def main():
    work = tempfile.mkdtemp(prefix="ag-tune-")
    try:
        shutil.copytree(os.path.join(ROOT, "vendor"), os.path.join(work, "vendor"))
        page = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
        page = page.replace("</body>", PROBE % (json.dumps(ALPHAS), json.dumps(BETAS)) + "</body>", 1)
        open(os.path.join(work, "index.html"), "w", encoding="utf-8").write(page)
        class Quiet(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *a): pass
        handler = functools.partial(Quiet, directory=work)
        srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        prof = tempfile.mkdtemp(prefix="ag-prof-")
        out = subprocess.run([BROWSER, "--headless=new", "--disable-gpu", "--no-first-run", f"--user-data-dir={prof}", "--virtual-time-budget=60000",
                              "--dump-dom", f"http://127.0.0.1:{srv.server_address[1]}/index.html#stock"], capture_output=True, text=True, timeout=300).stdout
        shutil.rmtree(prof, ignore_errors=True)
        srv.shutdown()
        r = json.loads(re.search(r'<pre id="TUNE">(.*?)</pre>', out, re.S).group(1))
        print("Selection window: fit days 0-91, score days 92-105 (WAPE, lower is better)")
        print("alpha  " + "  ".join(f"beta={b:<5}" for b in BETAS))
        for a in ALPHAS:
            print(f"{a:<5}  " + "  ".join(f"{next(g['sel'] for g in r['grid'] if g['alpha'] == a and g['beta'] == b) * 100:9.2f}%" for b in BETAS))
        print(f"28-day average on the same window: {r['naiveSel'] * 100:.2f}%")
        b = r["best"]
        print(f"\nChosen: alpha={b['alpha']} beta={b['beta']} (selection WAPE {b['sel'] * 100:.2f}%)")
        print(f"Reported holdout, days 106-119 (not used for the choice):")
        print(f"  chosen   model {r['holdoutBest']['model'] * 100:.2f}%   28-day average {r['holdoutBest']['naive'] * 100:.2f}%")
        print(f"  current  model {r['holdoutCurrent']['model'] * 100:.2f}%   (alpha={r['current']['alpha']} beta={r['current']['beta']} in the build)")
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
