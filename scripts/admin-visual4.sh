#!/usr/bin/env bash
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
agent-browser open "http://localhost:3000/#/admin/regions" >/dev/null 2>&1
agent-browser wait 3000 >/dev/null 2>&1
agent-browser snapshot -i -c 2>/dev/null > /tmp/snap.txt
PHONE_REF=$(rg -o '@e[0-9]+\)' /tmp/snap.txt | head -1)
# use native fill via refs discovered in snapshot
agent-browser find label "شماره موبایل" fill "09120000001" 2>&1 | head -1
agent-browser find label "رمز عبور" fill "123456" 2>&1 | head -1 || agent-browser find role textbox fill "123456" --name "رمز عبور" 2>&1 | head -1
agent-browser wait 400 >/dev/null 2>&1
agent-browser find role button click --name "ورود" 2>&1 | head -1
agent-browser wait 3500 >/dev/null 2>&1
agent-browser eval "location.hash='#/admin/regions'" >/dev/null 2>&1
agent-browser wait 3500 >/dev/null 2>&1
agent-browser eval "(()=>{const rows=[...document.querySelectorAll('.divide-y > div')]; const tabs=[...document.querySelectorAll('button')].some(b=>b.textContent.includes('مناطق جغرافیایی')); return JSON.stringify({tabs, rows: rows.length});})()" 2>&1 | head -1
agent-browser screenshot /tmp/render/13-admin-regions.png >/dev/null 2>&1
agent-browser eval "(()=>{const btns=[...document.querySelectorAll('button')]; const eb=btns.filter(b=>b.textContent.includes('ویرایش'))[1]; eb? eb.click():0; return eb? 'edit-opened':'none';})()" 2>&1 | head -1
agent-browser wait 1200 >/dev/null 2>&1
agent-browser screenshot /tmp/render/15-admin-region-edit.png >/dev/null 2>&1
agent-browser close >/dev/null 2>&1
pkill -f "standalone/server.js" 2>/dev/null
echo done
