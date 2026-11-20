#!/usr/bin/env bash
# Admin regions panel verification (single session)
set -u
cd /home/z/my-project
pkill -f "standalone/server.js" 2>/dev/null; sleep 2
export AUTH_SECRET=$(openssl rand -hex 24)
export NODE_ENV=production
export PORT=3000
setsid node .next/standalone/server.js > /tmp/vs-server.log 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:3000/ && break; sleep 1; done
echo "server ready"

agent-browser close >/dev/null 2>&1
agent-browser open "http://localhost:3000/" >/dev/null 2>&1
agent-browser wait 2500 >/dev/null 2>&1
# login via password API directly in the page context (cookie-based session)
agent-browser eval "
  fetch('/api/auth/password-login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({phone:'09120000001', password:'123456'}) })
    .then(r => r.json())
    .then(d => { window.__login = d.ok ? 'ok' : JSON.stringify(d); if (d.ok) location.hash = '#/admin/regions'; })
" >/dev/null 2>&1
agent-browser wait 3000 >/dev/null 2>&1
agent-browser eval "window.__login" 2>&1 | head -1
agent-browser wait 3500 >/dev/null 2>&1
agent-browser eval "(()=>{const rows=[...document.querySelectorAll('.rounded-2xl.border.bg-card.divide-y > div')]; const h=[...document.querySelectorAll('h1')].find(x=>x.textContent.includes('مدیریت')); return JSON.stringify({adminHeading: !!h, regionRows: rows.length, firstRow: rows[0]?.textContent.slice(0,80)});})()" 2>&1 | head -1
agent-browser screenshot /tmp/render/13-admin-regions.png >/dev/null 2>&1
# scroll a bit and capture the list
agent-browser eval "window.scrollTo(0,300)" >/dev/null 2>&1
agent-browser wait 500 >/dev/null 2>&1
agent-browser screenshot /tmp/render/14-admin-regions-list.png >/dev/null 2>&1
agent-browser close >/dev/null 2>&1
pkill -f "standalone/server.js" 2>/dev/null
echo "done"
