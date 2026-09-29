#!/bin/sh
# Wraps src/app.html in a full HTML document for static hosting (GitHub Pages, Netlify, Firebase).
# The hosted build loads Chart.js from vendor/ so it works on poor connectivity; the CDN is only a fallback.
cd "$(dirname "$0")"
python3 - <<'PY'
cdn = '<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>'
local = ('<script src="vendor/chart.umd.min.js"></script>\n'
         '<script>window.Chart || document.write(\'<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"><\\/script>\')</script>')
src = open("src/app.html", encoding="utf-8").read()
assert cdn in src
head = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n'
open("index.html", "w", encoding="utf-8").write(head + src.replace(cdn, local) + "\n</body>\n</html>\n")
PY
