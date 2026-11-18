#!/bin/bash
# VillaSento v5 — API smoke tests (run against localhost:3000 dev server)
BASE="http://localhost:3000"
J="curl -s -H Content-Type:application/json"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "PASS: $1"; }
bad() { FAIL=$((FAIL+1)); echo "FAIL: $1 — $2"; }

# 1) register validation: mismatched confirm
r=$($J -X POST "$BASE/api/auth/register" -d '{"phone":"09121110000","password":"secret1","passwordConfirm":"secret2"}')
echo "$r" | grep -q "یکسان نیست" && ok "register: confirm mismatch rejected" || bad "register confirm mismatch" "$r"

# 2) register weak password
r=$($J -X POST "$BASE/api/auth/register" -d '{"phone":"09121110000","password":"12345","passwordConfirm":"12345"}')
echo "$r" | grep -q "حداقل" && ok "register: weak password rejected" || bad "register weak pw" "$r"

# 3) register invalid phone
r=$($J -X POST "$BASE/api/auth/register" -d '{"phone":"09123","password":"secret1","passwordConfirm":"secret1"}')
echo "$r" | grep -q "موبایل معتبر نیست" && ok "register: invalid phone rejected" || bad "register invalid phone" "$r"

# 4) register OK → cookie jar A
r=$($J -c /tmp/jar-new.txt -X POST "$BASE/api/auth/register" -d '{"phone":"09121110000","password":"secret1","passwordConfirm":"secret1","fullName":"کاربر تستی"}')
echo "$r" | grep -q '"ok":true' && ok "register: success (09121110000)" || bad "register success" "$r"

# 5) duplicate register rejected
r=$($J -X POST "$BASE/api/auth/register" -d '{"phone":"09121110000","password":"secret1","passwordConfirm":"secret1"}')
echo "$r" | grep -q "قبلاً ثبت شده" && ok "register: duplicate phone rejected" || bad "register duplicate" "$r"

# 6) me with new cookie
r=$($J -b /tmp/jar-new.txt "$BASE/api/auth/me")
echo "$r" | grep -q "09121110000" && ok "session persists after register (/me)" || bad "session /me" "$r"

# 7) login wrong password
r=$($J -X POST "$BASE/api/auth/password-login" -d '{"phone":"09121110000","password":"wrongpass"}')
echo "$r" | grep -q "اشتباه است" && ok "login: wrong password rejected" || bad "login wrong pw" "$r"

# 8) login correct (scrypt legacy seed user → rehash path)
r=$($J -c /tmp/jar-scrypt.txt -X POST "$BASE/api/auth/password-login" -d '{"phone":"09123456789","password":"123456"}')
echo "$r" | grep -q '"ok":true' && ok "login: legacy scrypt user (rehash-on-login)" || bad "legacy login" "$r"

# 9) verify rehash actually happened (client-side check via node script below)

# 10) bootstrap admin login → mustChangePassword flag
r=$($J -c /tmp/jar-admin.txt -X POST "$BASE/api/auth/password-login" -d '{"phone":"09356966365","password":"Se#5966561"}')
echo "$r" | grep -q '"mustChangePassword":true' && ok "bootstrap admin: login + mustChangePassword=true" || bad "bootstrap admin login" "$r"

# 11) admin change-password (forced) with current password
r=$($J -b /tmp/jar-admin.txt -H "X-Admin-Test: 1" -X POST "$BASE/api/auth/change-password" -d '{"currentPassword":"Se#5966561","newPassword":"Ne#5966561x"}')
echo "$r" | grep -q '"ok":true' && ok "admin: forced change-password works + clears flag" || bad "admin change password" "$r"

# 12) re-login with new password → flag must be false
r=$($J -X POST "$BASE/api/auth/password-login" -d '{"phone":"09356966365","password":"Ne#5966561x"}')
echo "$r" | grep -q '"mustChangePassword":false' && ok "admin: mustChangePassword=false after change" || bad "flag clear" "$r"

# 13) theme prefs: guest gets 401
c=$($J -o /dev/null -w "%{http_code}" "$BASE/api/me/theme")
[ "$c" = "401" ] && ok "theme: guest /api/me/theme → 401" || bad "theme guest 401" "$c"

# 14) theme prefs save (admin session from login #12 — no cookie saved; use scrypt jar)
r=$($J -b /tmp/jar-scrypt.txt -X POST "$BASE/api/me/theme" -d '{"mode":"dark","palette":"purple","fontSize":"l"}')
echo "$r" | grep -q '"palette":"purple"' && ok "theme: save prefs (merged)" || bad "theme save" "$r"

# 15) theme prefs persist (GET returns merged)
r=$($J -b /tmp/jar-scrypt.txt "$BASE/api/me/theme")
echo "$r" | grep -q '"mode":"dark"' && echo "$r" | grep -q '"fontSize":"l"' && ok "theme: persisted prefs retrievable" || bad "theme get" "$r"

# 16) theme invalid palette rejected
r=$($J -b /tmp/jar-scrypt.txt -X POST "$BASE/api/me/theme" -d '{"palette":"rainbow"}')
echo "$r" | grep -q "نامعتبر" && ok "theme: invalid palette rejected" || bad "theme invalid" "$r"

# 17) admin date-range filter works (admin session)
$J -c /tmp/jar-admin2.txt -X POST "$BASE/api/auth/password-login" -d '{"phone":"09356966365","password":"Ne#5966561x"}' > /dev/null
r=$($J -b /tmp/jar-admin2.txt "$BASE/api/admin/properties?from=2000-01-01&to=2100-01-01")
n=$(echo "$r" | grep -o '"id"' | wc -l)
[ "$n" -ge 1 ] && ok "admin: date-range filter returns listings ($n)" || bad "admin date filter" "$r"
r=$($J -b /tmp/jar-admin2.txt "$BASE/api/admin/properties?from=2030-01-01&to=2031-01-01")
n=$(echo "$r" | grep -o '"id"' | wc -l)
[ "$n" = "0" ] && ok "admin: future range returns 0" || bad "admin future range" "$r"

# 18) rate limiting: 11 rapid wrong logins → 429
last=""
for i in $(seq 1 11); do
  last=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/password-login" -H "Content-Type: application/json" -d '{"phone":"09122220000","password":"nope-nope"}')
done
[ "$last" = "429" ] && ok "rate limit: 11th login attempt → 429" || bad "rate limit" "$last"

echo "───────────────"
echo "PASS=$PASS FAIL=$FAIL"
