#!/usr/bin/env bash
# Admin regions panel verification — real UI login
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

# open auth dialog and login through the real UI
agent-browser eval "(()=>{const btns=[...document.querySelectorAll('button')]; const lb=btns.find(b=>b.textContent.includes('ورود | ثبتنام')); lb? lb.click():0; return lb? 'opened':'no-btn';})()" >/dev/null 2>&1
agent-browser wait 1200 >/dev/null 2>&1
agent-browser eval "(()=>{const tb=[...document.querySelectorAll('input')].find(i=>i.placeholder && i.placeholder.includes('موبایل')); if(!tb) return 'no-input'; const st=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; st.call(tb,'09120000001'); tb.dispatchEvent(new Event('input',{bubbles:true})); return 'phone-ok';})()" 2>&1 | head -1
agent-browser eval "(()=>{const tb=[...document.querySelectorAll('input')].find(i=>i.type==='password'); if(!tb) return 'no-pass'; const st=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; st.call(tb,'123456'); tb.dispatchEvent(new Event('input',{bubbles:true})); return 'pass-ok';})()" 2>&1 | head -1
agent-browser wait 400 >/dev/null 2>&1
agent-browser eval "(()=>{const btns=[...document.querySelectorAll('button')]; const lb=btns.find(b=>b.textContent.trim()==='ورود' && !b.disabled); if(lb){lb.click(); return 'login-clicked';} return 'login-disabled';})()" 2>&1 | head -1
agent-browser wait 2500 >/dev/null 2>&1
# close dialog if still open and go to admin/regions
agent-browser eval "(()=>{const btns=[...document.querySelectorAll('button')]; const cl=btns.find(b=>b.textContent.trim()==='Close' || b.getAttribute('aria-label')==='Close'); cl? cl.click():0; location.hash='#/admin/regions'; return 'nav';})()" >/dev/null 2>&1
agent-browser wait 3500 >/dev/null 2>&1
agent-browser eval "(()=>{const rows=[...document.querySelectorAll('.divide-y > div')]; const side=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('مناطق جغرافیایی')); return JSON.stringify({tabFound: !!side, rows: rows.length});})()" 2>&1 | head -1
agent-browser screenshot /tmp/render/13-admin-regions.png >/dev/null 2>&1
agent-browser eval "window.scrollTo(0,250)" >/dev/null 2>&1
agent-browser wait 400 >/dev/null 2>&1
agent-browser screenshot /tmp/render/14-admin-regions-list.png >/dev/null 2>&1
# open the edit dialog for رضویه
agent-browser eval "(()=>{const btns=[...document.querySelectorAll('button')]; const eb=btns.find(b=>b.textContent.includes('ویرایش') && b.closest('div')?.textContent.includes('رضویه')); if(eb){eb.click(); return 'edit-open';} return 'no-edit-btn';})()" 2>&1 | head -1
agent-browser wait 1200 >/dev/null 2>&1
agent-browser screenshot /tmp/render/15-admin-region-edit.png >/dev/null 2>&1
agent-browser close >/dev/null 2>&1
pkill -f "standalone/server.js" 2>/dev/null
echo done
