#!/usr/bin/env bash
# Final visual pass: search map view + cleanup of API-test listings
set -u
cd /home/z/my-project
pkill -f "standalone/server.js" 2>/dev/null; sleep 2
export AUTH_SECRET=$(openssl rand -hex 24)
export NODE_ENV=production
export PORT=3000
setsid node .next/standalone/server.js > /tmp/vs-server.log 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:3000/ && break; sleep 1; done
echo "server ready"

echo "--- search page → click نقشه toggle ---"
agent-browser open "http://localhost:3000/#/search" >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1 || true
agent-browser wait 2500 >/dev/null 2>&1
agent-browser eval "(()=>{const btns=[...document.querySelectorAll('button')]; const mb=btns.find(b=>b.textContent.trim()==='نقشه'); if(mb){mb.click(); return 'map-view-on';} return 'no-toggle';})()" 2>&1 | head -1
agent-browser wait 4500 >/dev/null 2>&1
agent-browser eval "(()=>{const map=document.querySelector('.leaflet-container'); const clusters=document.querySelectorAll('.vs-cluster').length; const markers=document.querySelectorAll('.vs-marker').length; const search=document.querySelector('input[aria-label=جستجوی منطقه روی نقشه]')? 'yes':'no'; return JSON.stringify({map: map?'mounted':'none', clusters, markers, regionSearch: search});})()" 2>&1 | head -1
agent-browser screenshot /tmp/render/09-search-map-view.png >/dev/null 2>&1

# map region search: type سنتو → fly to corridor
agent-browser eval "(()=>{const inp=document.querySelector('input[aria-label=جستجوی منطقه روی نقشه]'); if(inp){const st=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; st.call(inp,'سنتو'); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'typed-santoo';} return 'no-input';})()" 2>&1 | head -1
agent-browser wait 2000 >/dev/null 2>&1
agent-browser screenshot /tmp/render/10-map-region-search.png >/dev/null 2>&1

echo "--- mobile viewport test (390x844) ---"
agent-browser set viewport 390 844 >/dev/null 2>&1
agent-browser open "http://localhost:3000/region/razaviyeh" >/dev/null 2>&1
agent-browser wait 2000 >/dev/null 2>&1
agent-browser eval "(()=>{return JSON.stringify({hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2, width: document.documentElement.scrollWidth});})()" 2>&1 | head -1
agent-browser screenshot /tmp/render/11-region-mobile.png >/dev/null 2>&1
agent-browser close >/dev/null 2>&1

echo "--- cleanup test listings created by the API test runs ---"
node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const del=await p.property.deleteMany({ where: { title: { contains: 'باغ‌ویلای ۴۵۰ متری حاشیه جاده سنتو رضویه' } } });
  console.log('deleted test listings:', del.count);
  const fake=await p.property.deleteMany({ where: { title: { contains: 'تست منطقه نامعتبر' } } });
  console.log('deleted invalid-region drafts:', fake.count);
  console.log('remaining published:', await p.property.count({ where: { status: 'PUBLISHED' } }));
  await p.\$disconnect();
})()"

echo "--- final DB sanity ---"
node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  console.log('regions:', await p.region.count(), '| cities:', await p.city.count(), '| provinces:', await p.province.count(), '| users:', await p.user.count(), '| properties:', await p.property.count());
  await p.\$disconnect();
})()"
pkill -f "standalone/server.js" 2>/dev/null
echo done
