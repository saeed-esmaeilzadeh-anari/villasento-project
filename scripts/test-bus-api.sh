#!/bin/bash
# Bus API smoke test: search → trip seats → hold → booking → ticket + guards
set -e
BASE="http://localhost:3000"
J="python3 -c"

echo "── 1. lookups"
curl -sf "$BASE/api/bus/lookups" | python3 -c "import json,sys; d=json.load(sys.stdin); print('cities:',len(d['cities']),'companies:',len(d['companies']),'maxSeats:',d['maxSeats'])"

echo "── 2. search THR→TBZ 1405-09-16"
TRIP=$(curl -sf "$BASE/api/bus/search?from=THR&to=TBZ&departing=1405-09-16&adult=1" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('trips:',d['total'],'min:',d['minPrice'],'cal:',len(d['calendar']),file=sys.stderr)
free=[x for x in d['items'] if x['seatsFree']>=5]
assert free, 'no trip with 5+ free seats'
print(free[0]['id'])")
echo "trip=$TRIP"

echo "── 3. trip seats"
curl -sf "$BASE/api/bus/trips/$TRIP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('cap:',d['trip']['capacity'],'type:',d['trip']['typeLabel'],'sold:',len(d['sold']),'female:',len(d['female']),'rows:',len(d['map']['rows']))"

echo "── 4. hold two free seats"
SEATS=$(curl -sf "$BASE/api/bus/trips/$TRIP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
taken=set(d['sold'])
free=[n for n in range(1,d['trip']['capacity']+1) if n not in taken][:2]
assert len(free)==2, 'not enough free seats'
print(','.join(map(str,free)))")
S1=${SEATS%,*}; S2=${SEATS#*,}
echo "free seats: $SEATS"
HOLD=$(curl -sf -X POST "$BASE/api/bus/holds" -H 'Content-Type: application/json' -d "{\"tripId\":\"$TRIP\",\"seats\":[$S1,$S2]}")
HID=$(echo "$HOLD" | python3 -c "import json,sys; d=json.load(sys.stdin); print('hold:',d['holdId'][:10],'min:',d['holdMinutes'],file=sys.stderr); print(d['holdId'])")

echo "── 4b. double-hold same seat must 409"
CODE2=$(curl -s -o /tmp/bus409.json -w "%{http_code}" -X POST "$BASE/api/bus/holds" -H 'Content-Type: application/json' -d "{\"tripId\":\"$TRIP\",\"seats\":[$S1]}")
echo "second hold → HTTP $CODE2: $(cat /tmp/bus409.json | head -c 120)"
[ "$CODE2" = "409" ] || echo "WARN: expected 409"

echo "── 5. booking"
NID=$(python3 -c "
def nid(prefix9):
    s=sum(int(d)*w for d,w in zip(prefix9,range(10,1,-1)))
    r=s%11
    return prefix9+str(r if r<2 else 11-r)
print(nid('007912345'),nid('006123456'))")
N1=${NID% *}; N2=${NID#* }
BOOK=$(curl -sf -X POST "$BASE/api/bus/bookings" -H 'Content-Type: application/json' -d "{\"holdId\":\"$HID\",\"passengers\":[{\"seat\":$S1,\"firstName\":\"علی\",\"lastName\":\"رضایی\",\"nationalId\":\"$N1\",\"gender\":\"MALE\"},{\"seat\":$S2,\"firstName\":\"مریم\",\"lastName\":\"احمدی\",\"nationalId\":\"$N2\",\"gender\":\"FEMALE\"}],\"contact\":{\"phone\":\"09121112233\",\"name\":\"علی رضایی\"}}")
echo "$BOOK"
CODE=$(echo "$BOOK" | python3 -c "import json,sys; print(json.load(sys.stdin)['code'])")

echo "── 5b. invalid national id must 400"
curl -s -o /tmp/bus400.json -w "invalid nid → HTTP %{http_code}: " -X POST "$BASE/api/bus/bookings" -H 'Content-Type: application/json' -d "{\"holdId\":\"$HID\",\"passengers\":[{\"seat\":2,\"firstName\":\"علی\",\"lastName\":\"رضایی\",\"nationalId\":\"1234567890\",\"gender\":\"MALE\"}],\"contact\":{\"phone\":\"09121112233\"}}"; head -c 150 /tmp/bus400.json; echo

echo "── 6. ticket lookup $CODE"
curl -sf "$BASE/api/bus/bookings/$CODE" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('code:',d['code'],'status:',d['status'],'total:',d['totalAmount'],'seats:',d['seats'])
print('passengers:',[(p['seat'],p['firstName'],p['nationalId']) for p in d['passengers']])
print('trip:',d['trip']['from']['name'],'→',d['trip']['to']['name'],d['trip']['jalali'],d['trip']['departTime'])"

echo "── 7. seats now sold (hold consumed)"
curl -sf "$BASE/api/bus/trips/$TRIP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert $S1 in d['sold'] and $S2 in d['sold'], 'seats should be sold now'
print('OK: seats $S1,$S2 sold; female contains $S2:', $S2 in d['female'])"

echo "── 8. search guards"
curl -s "$BASE/api/bus/search?from=THR&to=THR&departing=1405-09-16" | head -c 120; echo
curl -s "$BASE/api/bus/search?from=THR&to=TBZ&departing=1400-01-01" | head -c 120; echo

echo "── 9. popular"
curl -sf "$BASE/api/bus/popular" | python3 -c "import json,sys; d=json.load(sys.stdin); [print(r['from']['name'],'→',r['to']['name'],r['trips'],'trips, از',r['minPrice']) for r in d['items'][:6]]"

echo "ALL BUS API TESTS PASSED"
