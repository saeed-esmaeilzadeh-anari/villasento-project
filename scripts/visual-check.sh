#!/usr/bin/env bash
# Visual verification of the region/map features (single session: server + browser together)
set -u
cd /home/z/my-project
mkdir -p /tmp/render

pkill -f "standalone/server.js" 2>/dev/null; sleep 2
export AUTH_SECRET=$(openssl rand -hex 24)
export NODE_ENV=production
export PORT=3000
setsid node .next/standalone/server.js > /tmp/vs-server.log 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:3000/ && break; sleep 1; done
echo "server ready"

agent-browser close 2>/dev/null
agent-browser set viewport 1366 900 >/dev/null 2>&1

echo "--- 1. HOME page (main regions section) ---"
agent-browser open http://localhost:3000/ >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1 || true
agent-browser wait 3000 >/dev/null 2>&1
agent-browser eval "window.scrollTo(0, document.querySelector('section h2') ? 0 : 0)" >/dev/null 2>&1
agent-browser screenshot /tmp/render/01-home-top.png >/dev/null 2>&1
# scroll to main regions section
agent-browser eval "const h=[...document.querySelectorAll('h2')].find(x=>x.textContent.includes('محدوده‌های اصلی')); if(h) h.scrollIntoView({block:'start'}); h? 'found':'missing'" 2>&1 | head -1
agent-browser wait 800 >/dev/null 2>&1
agent-browser screenshot /tmp/render/02-home-regions.png >/dev/null 2>&1

echo "--- 2. REGION page (SSR, razaviyeh) ---"
agent-browser open http://localhost:3000/region/razaviyeh >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1 || true
agent-browser wait 1500 >/dev/null 2>&1
agent-browser screenshot /tmp/render/03-region-razaviyeh.png >/dev/null 2>&1
agent-browser get title 2>&1 | head -1

echo "--- 3. REGION page unverified (ghader-abad) ---"
agent-browser open http://localhost:3000/region/ghader-abad >/dev/null 2>&1
agent-browser wait 1200 >/dev/null 2>&1
agent-browser screenshot /tmp/render/04-region-unverified.png >/dev/null 2>&1

echo "--- 4. SEARCH map view (corridor focus) ---"
agent-browser open "http://localhost:3000/#/search?view=map" >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1 || true
agent-browser wait 4000 >/dev/null 2>&1
agent-browser screenshot /tmp/render/05-search-map.png >/dev/null 2>&1
# check the map is on the corridor (not whole Iran)
agent-browser eval "const m=document.querySelector('.leaflet-container'); m? 'leaflet mounted':'no map'" 2>&1 | head -1

echo "--- 5. LISTING FORM step 3: combobox over map test ---"
agent-browser open "http://localhost:3000/#/new-listing" >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1 || true
agent-browser wait 2000 >/dev/null 2>&1
# login wall may appear → login via demo owner
agent-browser snapshot -i -c 2>/dev/null | head -30
