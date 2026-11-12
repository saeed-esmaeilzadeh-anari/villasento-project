#!/bin/bash
# VillaSento end-to-end API lifecycle test
BASE=http://localhost:3000
# unique simulated client IP per run (rate limiter is per-IP; back-to-back runs would trip it)
IP="10.77.$((RANDOM % 250)).$((RANDOM % 250))"
CURL="curl -s -H X-Forwarded-For:$IP"
CURLC="curl -s -H X-Forwarded-For:$IP -H Content-Type:application/json"
J1=/tmp/t_customer.txt   # customer
J2=/tmp/t_owner.txt      # owner
J3=/tmp/t_admin.txt      # super admin
P="python3 -c"
pass=0; fail=0
ok(){ echo "✅ $1"; pass=$((pass+1)); }
bad(){ echo "❌ $1 — $2"; fail=$((fail+1)); }

# 1) password login (customer)
R=$($CURL -c $J1 -X POST $BASE/api/auth/password-login -H 'Content-Type: application/json' -d '{"phone":"09123456789","password":"123456"}')
echo "$R" | grep -q '"ok":true' && ok "ورود با رمز عبور (کاربر)" || bad "ورود رمز" "$R"

# 2) owner login
R=$($CURL -c $J2 -X POST $BASE/api/auth/password-login -H 'Content-Type: application/json' -d '{"phone":"09120000005","password":"123456"}')
echo "$R" | grep -q '"ok":true' && ok "ورود مالک" || bad "ورود مالک" "$R"

# 3) admin login
R=$($CURL -c $J3 -X POST $BASE/api/auth/password-login -H 'Content-Type: application/json' -d '{"phone":"09120000001","password":"123456"}')
echo "$R" | grep -q '"ok":true' && ok "ورود مدیر ارشد" || bad "ورود مدیر" "$R"

# 4) wrong password rejected
C=$($CURL -o /dev/null -w "%{http_code}" -X POST $BASE/api/auth/password-login -H 'Content-Type: application/json' -d '{"phone":"09123456789","password":"wrong"}')
[ "$C" = "401" ] && ok "رمز اشتباه → 401" || bad "رمز اشتباه" "$C"

# 5) search: SALE only
R=$($CURL "$BASE/api/properties?tt=SALE&pageSize=50")
N=$(echo "$R" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['total'], all(i['transactionType']=='SALE' for i in d['items']))")
echo "$N" | grep -q "True" && ok "فیلتر نوع معامله SALE (total=$(echo $N | cut -d' ' -f1))" || bad "فیلتر SALE" "$N"

# 6) search: city + price range
R=$($CURL "$BASE/api/properties?cityId=$($CURL $BASE/api/lookups | python3 -c "import json,sys; d=json.load(sys.stdin); print([c['id'] for p in d['provinces'] for c in p['cities'] if c['name']=='لواسان'][0])")")
T=$(echo "$R" | python3 -c "import json,sys; print(json.load(sys.stdin)['total'])")
[ "$T" -ge 1 ] && ok "فیلتر شهر لواسان (total=$T)" || bad "فیلتر شهر" "$T"

# 7) search: amenities filter
R=$($CURL "$BASE/api/properties?amenities=pool")
T=$(echo "$R" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['total'])")
[ "$T" -ge 1 ] && ok "فیلتر امکانات استخر (total=$T)" || bad "فیلتر امکانات" "$T"

# 8) search: sort PRICE_ASC
R=$($CURL "$BASE/api/properties?tt=SALE&sort=PRICE_ASC")
O=$(echo "$R" | python3 -c "import json,sys; d=json.load(sys.stdin); ps=[i['salePrice'] for i in d['items'] if i['salePrice']]; print('OK' if ps==sorted(ps) else 'BAD')")
[ "$O" = "OK" ] && ok "مرتب‌سازی ارزان‌ترین" || bad "مرتب‌سازی" "$O"

# 9) property detail
PID=$($CURL "$BASE/api/properties?tt=SALE&sort=MOST_VIEWED" | python3 -c "import json,sys; print(json.load(sys.stdin)['items'][0]['id'])")
R=$($CURL "$BASE/api/properties/$PID")
echo "$R" | grep -q '"owner"' && ok "جزئیات ملک + مالک/مشاور" || bad "جزئیات ملک" "$(echo $R | head -c 120)"

# 10) similar properties
S=$(echo "$R" | python3 -c "import json,sys; print(len(json.load(sys.stdin)['similar'])>0)")
[ "$S" = "True" ] && ok "املاک مشابه" || bad "املاک مشابه" "$S"

# 11) OTP request (demo) + verify new user
R=$($CURL -c /tmp/t_new.txt -X POST $BASE/api/auth/request-otp -H 'Content-Type: application/json' -d '{"phone":"09351234567"}')
CODE=$(echo "$R" | python3 -c "import json,sys; print(json.load(sys.stdin).get('demoCode',''))")
[ -n "$CODE" ] && ok "درخواست OTP نمایشی" || bad "OTP" "$R"
R=$($CURL -b /tmp/t_new.txt -c /tmp/t_new.txt -X POST $BASE/api/auth/verify -H 'Content-Type: application/json' -d "{\"phone\":\"09351234567\",\"code\":\"$CODE\",\"fullName\":\"تست جدید\"}")
echo "$R" | grep -q '"ok":true' && ok "ثبت‌نام با OTP" || bad "OTP verify" "$R"

# 12) create listing (draft) as new user
R=$($CURL -b /tmp/t_new.txt -X POST $BASE/api/properties -H 'Content-Type: application/json' -d '{
  "title":"ویلای تستی سند شش‌دانگ در کرج","type":"VILLA","transactionType":"SALE","description":"این یک توضیح تستی با طول کافی برای عبور از اعتبارسنجی سرور است و بیشتر از سی نویسه دارد.",
  "cityId":"'"$($CURL $BASE/api/lookups | python3 -c "import json,sys; d=json.load(sys.stdin); print([c['id'] for p in d['provinces'] for c in p['cities'] if c['name']=='کرج'][0])")"'",
  "salePrice":4200000000,"landArea":300,"buildArea":150,"bedrooms":3,"documentStatus":"SIX_DANG","images":["/villas/villa4.jpg"],"amenityKeys":["parking"]}')
DID=$(echo "$R" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))")
[ -n "$DID" ] && ok "ثبت آگهی (پیش‌نویس) → $DID" || bad "ثبت آگهی" "$R"

# 13) role promoted to OWNER
R=$($CURL -b /tmp/t_new.txt $BASE/api/auth/me)
echo "$R" | grep -q '"role":"OWNER"' && ok "ارتقای نقش CUSTOMER→OWNER" || bad "ارتقا نقش" "$R"

# 14) submit for review
R=$($CURL -b /tmp/t_new.txt -X POST $BASE/api/properties/$DID/submit)
echo "$R" | grep -q '"ok":true' && ok "ارسال آگهی برای تأیید" || bad "ارسال تأیید" "$R"

# 15) non-admin cannot approve
C=$($CURL -o /dev/null -w "%{http_code}" -b /tmp/t_new.txt -X POST $BASE/api/admin/properties -H 'Content-Type: application/json' -d '{"action":"approve","id":"'"$DID"'"}')
[ "$C" = "403" ] && ok "دسترسی غیرمدیر به تأیید → 403" || bad "کنترل دسترسی" "$C"

# 16) admin approves → PUBLISHED
R=$($CURL -b $J3 -X POST $BASE/api/admin/properties -H 'Content-Type: application/json' -d '{"action":"set-status","id":"'"$DID"'","to":"PUBLISHED"}')
echo "$R" | grep -q '"ok":true' && ok "تأیید و انتشار توسط مدیر" || bad "انتشار مدیر" "$R"

# 17) now visible in public search
R=$($CURL --get --data-urlencode "q=ویلای تستی" "$BASE/api/properties")
T=$(echo "$R" | python3 -c "import json,sys; print(json.load(sys.stdin)['total'])")
[ "$T" -ge 1 ] && ok "آگهی منتشرشده در جستجو ظاهر شد (total=$T)" || bad "ظهور در جستجو" "$T"

# 18) owner notification about publish
R=$($CURL -b /tmp/t_new.txt $BASE/api/notifications)
echo "$R" | grep -q "وضعیت آگهی" && ok "اعلان تغییر وضعیت برای مالک" || bad "اعلان" "$(echo $R | head -c 100)"

# 19) visit request (public)
R=$($CURL -b $J1 -X POST $BASE/api/properties/$DID/visit -H 'Content-Type: application/json' -d '{"name":"سارا محمدی","phone":"09123456789","note":"بعدازظهر لطفاً"}')
VID=$(echo "$R" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))")
[ -n "$VID" ] && ok "ثبت درخواست بازدید" || bad "درخواست بازدید" "$R"

# 20) owner sees incoming visit
R=$($CURL -b /tmp/t_new.txt "$BASE/api/visits?scope=incoming")
echo "$R" | grep -q "$VID" && ok "درخواست بازدید در پنل مالک" || bad "بازدید دریافتی" "$(echo $R | head -c 100)"

# 21) owner updates visit status
R=$($CURL -b /tmp/t_new.txt -X PATCH $BASE/api/visits -H 'Content-Type: application/json' -d '{"id":"'"$VID"'","status":"IN_PROGRESS"}')
echo "$R" | grep -q '"ok":true' && ok "تغییر وضعیت بازدید توسط مالک" || bad "وضعیت بازدید" "$R"

# 22) favorite toggle
R=$($CURL -b $J1 -X POST $BASE/api/favorites -H 'Content-Type: application/json' -d '{"propertyId":"'"$DID"'"}')
echo "$R" | grep -q '"favorited":true' && ok "افزودن به علاقه‌مندی" || bad "علاقه‌مندی" "$R"

# 23) message owner
R=$($CURL -b $J1 -X POST $BASE/api/messages -H 'Content-Type: application/json' -d '{"propertyId":"'"$DID"'","text":"سلام، امکان بازدید آخر هفته هست؟"}')
echo "$R" | grep -q '"id"' && ok "ارسال پیام به مالک" || bad "پیام" "$R"

# 24) contact message (public)
R=$($CURL -X POST $BASE/api/contact -H 'Content-Type: application/json' -d '{"name":"تست تماس","phone":"09351112233","body":"سلام این یک پیام تستی تماس با ما است"}')
echo "$R" | grep -q '"ok":true' && ok "فرم تماس با ما" || bad "تماس" "$R"

# 25) report listing
R=$($CURL -b $J1 -X POST $BASE/api/properties/$DID/report -H 'Content-Type: application/json' -d '{"reason":"قیمت نامعتبر است"}')
echo "$R" | grep -q '"id"' && ok "گزارش آگهی نامعتبر" || bad "گزارش" "$R"

# 26) track view
R=$($CURL -X POST $BASE/api/track -H 'Content-Type: application/json' -d '{"propertyId":"'"$DID"'"}')
echo "$R" | grep -q '"counted"' && ok "ثبت بازدید آگهی" || bad "بازدید" "$R"

# 27) admin overview stats
R=$($CURL -b $J3 $BASE/api/admin/overview)
echo "$R" | grep -q '"propsTotal"' && ok "آمار داشبورد مدیر" || bad "آمار" "$(echo $R | head -c 100)"

# 28) admin charts
R=$($CURL -b $J3 "$BASE/api/admin/charts?days=30")
echo "$R" | grep -q '"series"' && ok "داده نمودارها" || bad "نمودار" "$R"

# 29) admin users list
R=$($CURL -b $J3 $BASE/api/admin/users)
echo "$R" | grep -q '"items"' && ok "مدیریت کاربران" || bad "کاربران" "$R"

# 30) admin agents performance
R=$($CURL -b $J3 $BASE/api/admin/agents)
echo "$R" | grep -q '"assignedCount"' && ok "عملکرد مشاوران" || bad "مشاوران" "$R"

# 31) admin visits/messages/complaints
R=$($CURL -b $J3 $BASE/api/admin/visits); echo "$R" | grep -q '"items"' && ok "مدیریت درخواست‌های بازدید" || bad "بازدیدها" "$R"
R=$($CURL -b $J3 $BASE/api/admin/messages); echo "$R" | grep -q '"items"' && ok "مدیریت پیام‌های تماس" || bad "پیام‌ها" "$R"
R=$($CURL -b $J3 $BASE/api/admin/complaints); echo "$R" | grep -q '"items"' && ok "مدیریت گزارش‌ها/شکایات" || bad "گزارش‌ها" "$R"

# 32) CMS admin CRUD list
R=$($CURL -b $J3 $BASE/api/admin/articles); echo "$R" | grep -q '"items"' && ok "مدیریت مقالات" || bad "مقالات" "$R"
R=$($CURL -b $J3 $BASE/api/admin/banners); echo "$R" | grep -q '"items"' && ok "مدیریت بنرها" || bad "بنرها" "$R"
R=$($CURL -b $J3 $BASE/api/admin/faqs); echo "$R" | grep -q '"items"' && ok "مدیریت سؤالات متداول" || bad "سؤالات" "$R"
R=$($CURL -b $J3 $BASE/api/admin/cms); echo "$R" | grep -q '"items"' && ok "مدیریت صفحات ثابت" || bad "صفحات" "$R"

# 33) settings + audit
R=$($CURL -b $J3 $BASE/api/admin/settings); echo "$R" | grep -q 'site.name' && ok "تنظیمات سامانه" || bad "تنظیمات" "$R"
R=$($CURL -b $J3 $BASE/api/admin/audit); echo "$R" | grep -q '"items"' && ok "لاگ فعالیت‌ها" || bad "لاگ" "$R"

# 34) CSV export
C=$($CURL -o /dev/null -w "%{http_code}" -b $J3 "$BASE/api/admin/export?entity=listings")
[ "$C" = "200" ] && ok "خروجی CSV آگهی‌ها" || bad "CSV" "$C"

# 35) articles public + detail
R=$($CURL $BASE/api/articles)
SLUG=$(echo "$R" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['items'][0]['slug'] if d['items'] else '')")
[ -n "$SLUG" ] && ok "فهرست مقالات عمومی" || bad "مقالات" "$R"
R=$($CURL "$BASE/api/articles/$SLUG"); echo "$R" | grep -q '"content"' && ok "جزئیات مقاله" || bad "مقاله" "$R"

# 36) agents public
R=$($CURL $BASE/api/agents); echo "$R" | grep -q '"items"' && ok "فهرست مشاوران (عمومی)" || bad "مشاوران" "$R"

# 37) sitemap
C=$($CURL -o /dev/null -w "%{http_code}" $BASE/api/sitemap)
[ "$C" = "200" ] && ok "sitemap.xml" || bad "sitemap" "$C"

# 38) upload (owner) — create tiny png with python then upload
python3 -c "
import struct, zlib
def png(path,w,h):
    def chunk(t,d):
        c=t+d; return struct.pack('>I',len(d))+c+struct.pack('>I',zlib.crc32(c)&0xffffffff)
    raw=b''.join(b'\x00'+b'\x64\x96\x78'*w for _ in range(h))
    open(path,'wb').write(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b''))
png('/tmp/test.png',320,240)
"
R=$($CURL -b $J2 -F "file=@/tmp/test.png" -F "folder=test" $BASE/api/upload)
echo "$R" | grep -q '"url"' && ok "آپلود تصویر + بهینه‌سازی WebP" || bad "آپلود" "$R"
UPURL=$(echo "$R" | python3 -c "import json,sys; print(json.load(sys.stdin).get('url',''))")
[ -n "$UPURL" ] && C=$($CURL -o /dev/null -w "%{http_code}" "$BASE$UPURL") && [ "$C" = "200" ] && ok "سرو تصویر آپلودشده" || bad "سرو فایل" "$UPURL"

# 39) bad upload rejected (text file)
echo "not an image" > /tmp/test.txt
C=$($CURL -o /dev/null -w "%{http_code}" -b $J2 -F "file=@/tmp/test.txt" $BASE/api/upload)
[ "$C" = "400" ] && ok "رد فایل غیرتصویری → 400" || bad "اعتبارسنجی آپلود" "$C"

# 40) set + change password flow (OTP-registered user has no password yet)
R=$($CURL -b /tmp/t_new.txt -X POST $BASE/api/auth/set-password -H 'Content-Type: application/json' -d '{"newPassword":"newpass1"}')
echo "$R" | grep -q '"ok":true' && ok "تنظیم رمز عبور اولیه" || bad "تنظیم رمز" "$R"
R=$($CURL -b /tmp/t_new.txt -X POST $BASE/api/auth/change-password -H 'Content-Type: application/json' -d '{"currentPassword":"newpass1","newPassword":"newpass2"}')
echo "$R" | grep -q '"ok":true' && ok "تغییر رمز عبور" || bad "تغییر رمز" "$R"
R=$($CURL -X POST $BASE/api/auth/password-login -H 'Content-Type: application/json' -d '{"phone":"09351234567","password":"newpass2"}')
echo "$R" | grep -q '"ok":true' && ok "ورود با رمز جدید" || bad "ورود رمز جدید" "$R"

# 41) unauthenticated admin access blocked
C=$($CURL -o /dev/null -w "%{http_code}" $BASE/api/admin/overview)
[ "$C" = "401" ] && ok "داشبورد بدون ورود → 401" || bad "محافظت مسیر" "$C"

# 42) owner listing edit
R=$($CURL -b /tmp/t_new.txt -X PATCH $BASE/api/properties/$DID -H 'Content-Type: application/json' -d '{"title":"ویلای تستی ویرایش‌شده کرج"}')
echo "$R" | grep -q '"ok"\|title' && ok "ویرایش آگهی توسط مالک" || bad "ویرایش" "$R"

# 43) extend expired listing (seeded EXPIRED belongs to owner2)
$CURL -c /tmp/t_o2.txt -X POST $BASE/api/auth/password-login -H 'Content-Type: application/json' -d '{"phone":"09120000007","password":"123456"}' > /dev/null
EP=$($CURL -b /tmp/t_o2.txt $BASE/api/me/listings | python3 -c "import json,sys; d=json.load(sys.stdin); ex=[i for i in d['items'] if i['status']=='EXPIRED']; print(ex[0]['id'] if ex else '')")
if [ -n "$EP" ]; then
  R=$($CURL -b /tmp/t_o2.txt -X POST $BASE/api/properties/$EP/extend)
  echo "$R" | grep -q '"ok":true' && ok "تمدید آگهی منقضی" || bad "تمدید" "$R"
else
  bad "تمدید" "no expired listing found for owner"
fi

# 44) rate limiting on OTP (4th request within 10min → limited)
for i in 1 2 3 4 5; do
  LAST=$($CURL -o /dev/null -w "%{http_code}" -X POST $BASE/api/auth/request-otp -H 'Content-Type: application/json' -d '{"phone":"09359990000"}')
done
{ [ "$LAST" = "429" ] || [ "$LAST" = "400" ]; } && ok "Rate Limiting OTP فعال (کد $LAST)" || bad "Rate limit" "$LAST"

# ── cleanup test artifacts (keep the demo DB tidy) ──
$CURL -b $J3 -X DELETE $BASE/api/properties/$DID > /dev/null
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  await p.user.deleteMany({ where: { phone: { in: ['09351234567', '09359990000'] } } });
  await p.visitRequest.deleteMany({ where: { phone: '09123456789', propertyId: null } }).catch(()=>{});
  await p.contactMessage.deleteMany({ where: { name: 'تست تماس' } });
  await p.complaint.deleteMany({ where: { subject: { contains: 'گزارش آگهی' }, user: { phone: '09123456789' } } });
  await p.\$disconnect();
})();
" > /dev/null 2>&1

echo ""
echo "════════════════════════════"
echo "PASS: $pass | FAIL: $fail"
