#!/bin/sh
# Assembles the GitHub Pages site into _site/ (used by .github/workflows/pages.yml, and locally
# to preview: sh site/build.sh && python3 -m http.server -d _site). The stills and font are
# copied from where the demo keeps them, so the page always shows the current demo.
set -eu
cd "$(dirname "$0")/.."
rm -rf _site
mkdir -p _site/hosted/img _site/hosted/fonts
cp -R site/index.html site/hosted _site/
cp docs/demo/poster.jpg docs/demo/map-frame.jpg docs/demo/photo-frame.jpg _site/hosted/img/
cp remotion/public/fonts/Oswald-Variable.ttf remotion/public/fonts/Oswald-OFL.txt _site/hosted/fonts/
size=$(wc -c < _site/hosted/demo.mp4)
[ "$size" -lt 10000000 ] || { echo "demo.mp4 is $size bytes; keep it under 10 MB" >&2; exit 1; }
echo "Built _site/ (demo.mp4: $size bytes)"
