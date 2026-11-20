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
# dump all input placeholders to see the dialog structure
agent-browser eval "(()=>JSON.stringify([...document.querySelectorAll('input')].map(i=>({ph:i.placeholder,type:i.type,id:i.id}))))()" 2>&1 | head -1
agent-browser eval "(()=>{const inputs=[...document.querySelectorAll('input')]; const phone=inputs.find(i=>/موبایل|09/.test(i.placeholder||'')||i.inputMode==='tel'||i.type==='tel'); if(phone){const st=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; st.call(phone,'09120000001'); phone.dispatchEvent(new Event('input',{bubbles:true})); return 'phone-ok';} return 'no-phone';})()" 2>&1 | head -1
agent-browser eval "(()=>{const inputs=[...document.querySelectorAll('input')]; const pw=inputs.find(i=>i.type==='password'); if(pw){const st=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; st.call(pw,'123456'); pw.dispatchEvent(new Event('input',{bubbles:true})); return 'pw-ok';} return 'no-pw';})()" 2>&1 | head -1
agent-browser wait 500 >/dev/null 2>&1
agent-browser eval "(()=>{const btns=[...document.querySelectorAll('button')]; const lb=btns.find(b=>b.textContent.trim()==='ورود'); if(lb&&!lb.disabled){lb.click(); return 'clicked';} return 'state:'+btns.filter(b=>b.textContent.includes('ورود')).map(b=>b.textContent+':'+b.disabled).join(',');})()" 2>&1 | head -1
agent-browser wait 3000 >/dev/null 2>&1
agent-browser eval "(()=>{location.hash='#/admin/regions'; return 'nav';})()" >/dev/null 2>&1
agent-browser wait 3500 >/dev/null 2>&1
agent-browser eval "(()=>{const rows=[...document.querySelectorAll('.divide-y > div')]; const tabs=[...document.querySelectorAll('button')].some(b=>b.textContent.includes('مناطق جغرافیایی')); return JSON.stringify({tabs, rows: rows.length});})()" 2>&1 | head -1
agent-browser screenshot /tmp/render/13-admin-regions.png >/dev/null 2>&1
agent-browser eval "(()=>{const btns=[...document.querySelectorAll('button')]; const eb=btns.filter(b=>b.textContent.includes('ویرایش'))[1]; eb? eb.click():0; return eb? 'edit-opened':'none';})()" >/dev/null 2>&1
agent-browser wait 1200 >/dev/null 2>&1
agent-browser screenshot /tmp/render/15-admin-region-edit.png >/dev/null 2>&1
agent-browser close >/dev/null 2>&1
pkill -f "standalone/server.js" 2>/dev/null
echo done
