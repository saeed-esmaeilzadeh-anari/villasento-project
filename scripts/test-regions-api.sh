#!/usr/bin/env bash
# VillaSento region-feature API test suite (self-contained: starts server, tests, kills server)
set -u
cd /home/z/my-project

pkill -f "standalone/server.js" 2>/dev/null; sleep 2
export AUTH_SECRET=$(openssl rand -hex 24)
export NODE_ENV=production
export PORT=3000
setsid node .next/standalone/server.js > /tmp/vs-server.log 2>&1 &
SERVER_PID=$!
for i in $(seq 1 30); do
  curl -s -o /dev/null http://localhost:3000/ && break
  sleep 1
done
echo "== server up (pid $SERVER_PID) =="

pass=0; fail=0
ok()  { pass=$((pass+1)); echo "✅ $1"; }
bad() { fail=$((fail+1)); echo "❌ $1 — got: $(echo "$2" | head -c 220)"; }

# ── 1. public regions API ──
r=$(curl -s "http://localhost:3000/api/regions")
echo "$r" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['total']==31 and d['bbox']" 2>/dev/null && ok "GET /api/regions tree (31 regions + bbox)" || bad "GET /api/regions tree" "$r"

r=$(curl -s "http://localhost:3000/api/regions?q=%D9%82%D9%84%D8%B9%D9%87%20%D8%B3%DB%8C%D8%A7%D9%87")
echo "$r" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['items'][0]['name']=='رضویه'" 2>/dev/null && ok "search by alt name «قلعه سیاه» → رضویه" || bad "alt-name search" "$r"

r=$(curl -s "http://localhost:3000/api/regions?q=%D8%B3%D9%86%D8%AA%D9%88")
echo "$r" | python3 -c "import json,sys; d=json.load(sys.stdin); assert any(i['nameEn']=='santoo-road' for i in d['items'])" 2>/dev/null && ok "search «سنتو» → جاده سنتو" || bad "santoo search" "$r"

r=$(curl -s "http://localhost:3000/api/regions?featured=1")
echo "$r" | python3 -c "import json,sys; d=json.load(sys.stdin); assert len(d['items'])==4" 2>/dev/null && ok "featured main regions = 4" || bad "featured regions" "$r"

# ── 2. owner creates listing with regionId ──
rm -f /tmp/owner.jar
r=$(curl -s -c /tmp/owner.jar -X POST http://localhost:3000/api/auth/password-login -H "Content-Type: application/json" -d '{"phone":"09120000005","password":"123456"}')
echo "$r" | rg -q '"ok":true' && ok "owner login 09120000005" || bad "owner login" "$r"

REG_ID=$(curl -s "http://localhost:3000/api/regions?q=razaviyeh" | python3 -c "import json,sys; print(json.load(sys.stdin)['items'][0]['id'])")
r=$(curl -s -b /tmp/owner.jar -X POST http://localhost:3000/api/properties -H "Content-Type: application/json" -d "{
  \"title\":\"باغ‌ویلای ۴۵۰ متری حاشیه جاده سنتو رضویه\",\"type\":\"GARDEN_VILLA\",\"transactionType\":\"SALE\",
  \"description\":\"زمین ۴۵۰ متری با باغ‌ویلای یک‌طبقه، انار و انگور، درب برقی و چاه آب — در رضویه حاشیه جاده سنتو. سند تک‌برگ و آماده انتقال.\",
  \"regionId\":\"$REG_ID\",\"landArea\":450,\"buildArea\":110,\"bedrooms\":2,\"salePrice\":5800000000,
  \"images\":[\"/villas/villa2.jpg\"],\"submit\":true}")
PID=$(echo "$r" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)
[ -n "$PID" ] && ok "listing created with regionId (id=$PID)" || bad "listing create" "$r"

# invalid region must be rejected
r=$(curl -s -b /tmp/owner.jar -X POST http://localhost:3000/api/properties -H "Content-Type: application/json" -d '{"title":"تست منطقه نامعتبر ۱۲۳۴","type":"LAND","transactionType":"SALE","description":"توضیحات تست کافی برای اعتبارسنجی سرور — بدون منطقه واقعی","regionId":"__fake__","salePrice":1,"images":["/villas/villa1.jpg"],"submit":true}')
echo "$r" | rg -q "منطقه انتخابی نامعتبر است" && ok "invalid regionId rejected server-side" || bad "invalid region rejection" "$r"

# ── 3. admin approves + region search ──
rm -f /tmp/admin.jar
r=$(curl -s -c /tmp/admin.jar -X POST http://localhost:3000/api/auth/password-login -H "Content-Type: application/json" -d '{"phone":"09120000001","password":"123456"}')
echo "$r" | rg -q '"ok":true' && ok "admin login 09120000001" || bad "admin login" "$r"

r=$(curl -s -b /tmp/admin.jar -X POST http://localhost:3000/api/admin/properties -H "Content-Type: application/json" -d "{\"action\":\"approve\",\"id\":\"$PID\"}")
echo "$r" | rg -q '"ok"' && ok "admin approved the region listing" || bad "admin approve" "$r"

r=$(curl -s "http://localhost:3000/api/properties?regions=razaviyeh")
echo "$r" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert d['total']>=1, d
it=d['items'][0]
assert it['region']['name']=='رضویه' and it['slug'], it
" 2>/dev/null && ok "search ?regions=razaviyeh finds the listing (region link + SEO slug)" || bad "region search razaviyeh" "$r"

r=$(curl -s "http://localhost:3000/api/properties?regions=santoo-road")
echo "$r" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['total']>=1" 2>/dev/null && ok "parent region santoo-road includes descendants (رضویه)" || bad "descendant search" "$r"

r=$(curl -s "http://localhost:3000/api/properties?regions=__unknown__")
echo "$r" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['total']==0" 2>/dev/null && ok "unknown region → 0 results (no unrelated leakage)" || bad "unknown region" "$r"

# ── 4. admin region CRUD + duplicate prevention ──
r=$(curl -s -b /tmp/admin.jar -X POST http://localhost:3000/api/admin/regions -H "Content-Type: application/json" -d '{"action":"upsert","data":{"name":"تست موقت","nameEn":"test-temp-region","type":"VILLAGE","parentId":"'"$REG_ID"'","lat":"36.48","lng":"59.41","geoStatus":"VERIFIED"}}')
TEST_ID=$(echo "$r" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)
[ -n "$TEST_ID" ] && ok "admin created test region" || bad "admin region create" "$r"

r=$(curl -s -b /tmp/admin.jar -X POST http://localhost:3000/api/admin/regions -H "Content-Type: application/json" -d '{"action":"upsert","data":{"name":"رضویه","nameEn":"duplicate-check","type":"VILLAGE"}}')
echo "$r" | rg -q "از قبل ثبت شده است" && ok "duplicate region name blocked" || bad "duplicate prevention" "$r"

r=$(curl -s -b /tmp/admin.jar -X POST http://localhost:3000/api/admin/regions -H "Content-Type: application/json" -d '{"action":"upsert","id":"'"$TEST_ID"'","data":{"name":"تست موقت","altNames":"تست جایگزین","type":"VILLAGE","lat":"36.48","lng":"59.41","geoStatus":"VERIFIED","description":"برای حذف"}}')
echo "$r" | rg -q "$TEST_ID" && ok "admin updated test region" || bad "admin region update" "$r"

r=$(curl -s -b /tmp/admin.jar -X POST http://localhost:3000/api/admin/regions -H "Content-Type: application/json" -d "{\"action\":\"delete\",\"id\":\"$TEST_ID\"}")
echo "$r" | rg -q '"ok":true' && ok "admin deleted test region" || bad "admin region delete" "$r"

# non-admin forbidden
r=$(curl -s -b /tmp/owner.jar -X POST http://localhost:3000/api/admin/regions -H "Content-Type: application/json" -d '{"action":"upsert","data":{"name":"هک","nameEn":"hack-attempt","type":"AREA"}}')
echo "$r" | rg -q "مدیران" && ok "non-admin region create → 403" || bad "authorization check" "$r"

r=$(curl -s http://localhost:3000/api/admin/regions)
echo "$r" | rg -q "وارد حساب" && ok "anonymous admin regions → 401" || bad "auth check" "$r"

# ── 5. SSR pages ──
code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/region/razaviyeh)
[ "$code" = "200" ] && ok "SSR /region/razaviyeh → 200" || bad "SSR region page (verified)" "$code"
curl -s http://localhost:3000/region/razaviyeh | rg -q 'املاک رضویه' && ok "region page contains real content" || bad "region page content" ""

curl -s http://localhost:3000/region/razaviyeh | rg -q 'no index' -i; curl -s http://localhost:3000/region/razaviyeh | rg -q 'application/ld\+json' && ok "region page has JSON-LD breadcrumb" || bad "region JSON-LD" ""

code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/region/ghader-abad)
[ "$code" = "200" ] && ok "SSR /region/ghader-abad (unverified) → 200" || bad "SSR unverified region" "$code"
curl -s http://localhost:3000/region/ghader-abad | rg -q "نیازمند بررسی" && ok "unverified page shows needs-review notice" || bad "unverified notice" ""

r=$(curl -s http://localhost:3000/sitemap.xml)
echo "$r" | rg -q "/region/razaviyeh" && ok "sitemap includes /region/razaviyeh" || bad "sitemap regions" "$r"

r=$(curl -s http://localhost:3000/api/home)
echo "$r" | python3 -c "import json,sys; d=json.load(sys.stdin); assert len(d['mainRegions'])==4 and d['regionBbox']" 2>/dev/null && ok "home API includes mainRegions + regionBbox" || bad "home regions" "$r"

r=$(curl -s "http://localhost:3000/api/properties/$PID")
echo "$r" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['region']['name']=='رضویé' or d['region']['name']=='رضویه'; assert d['city']=='مشهد'" 2>/dev/null && ok "detail: region attached + legacy city مشهد derived" || bad "detail region" "$r"

echo ""
echo "=== RESULT: pass=$pass fail=$fail ==="
kill -- -$SERVER_PID 2>/dev/null; pkill -f "standalone/server.js" 2>/dev/null
exit 0
