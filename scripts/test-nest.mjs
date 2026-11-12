/**
 * End-to-end lifecycle test for the Vilasa NestJS backend (port 3002).
 * Mirrors the golden path: health → lookups → search → OTP login → booking
 * → coupon → payment start/settle → admin approve → track → favorites → complaints.
 * Run: node scripts/test-nest.mjs
 */
const BASE = process.env.NEST_URL || "http://localhost:3002";

const jars = {}; // named cookie jars
async function call(name, method, path, body) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (name && jars[name]) headers["Cookie"] = jars[name];
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (name) {
    const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (sc.length) jars[name] = sc.map((c) => c.split(";")[0]).join("; ");
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  return { status: res.status, data };
}

let pass = 0;
let fail = 0;
function check(label, cond, extra) {
  if (cond) {
    pass++;
    console.log(`  ✔ ${label}`);
  } else {
    fail++;
    console.log(`  ✘ ${label}${extra ? " → " + JSON.stringify(extra).slice(0, 300) : ""}`);
  }
}

async function main() {
  console.log("═» Vilasa NestJS backend E2E —", BASE);

  // 1) health
  let r = await call(null, "GET", "/api/health");
  check("GET /api/health → ok & db up", r.status === 200 && r.data?.ok && r.data?.db === "up", r);

  // 2) lookups
  r = await call(null, "GET", "/api/lookups");
  check("GET /api/lookups → provinces+amenities+types", r.status === 200 && r.data?.provinces?.length > 0 && r.data?.types?.length === 6, r.data && { n: r.data.provinces.length });

  // 3) public search
  r = await call(null, "GET", "/api/properties?pageSize=24&sort=PRICE_ASC");
  check("GET /api/properties → published items", r.status === 200 && r.data?.items?.length > 0, r.status);
  const props = r.data?.items ?? [];
  const cityId = (await call(null, "GET", "/api/lookups")).data.provinces[0]?.cities?.[0]?.id;

  // 4) OTP login (customer)
  r = await call("cust", "POST", "/api/auth/request-otp", { phone: "09123456789" });
  check("POST /api/auth/request-otp → demoCode", r.status === 200 && !!r.data?.demoCode, r.data);
  r = await call("cust", "POST", "/api/auth/verify", { phone: "09123456789", code: r.data.demoCode });
  check("POST /api/auth/verify → session cookie + user", r.status === 200 && r.data?.user?.phone === "09123456789", r.data);
  r = await call("cust", "GET", "/api/auth/me");
  check("GET /api/auth/me → authenticated", r.status === 200 && r.data?.id, r.data);

  // 5) coupon validate (needs an amount; may be valid:false — both are valid API answers)
  r = await call("cust", "POST", "/api/coupons/validate", { code: "WELCOME", amount: 5000000 });
  check("POST /api/coupons/validate → {valid:bool}", r.status === 200 && typeof r.data?.valid === "boolean", r.data);

  // 6) create booking (retry properties until one is free)
  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  const in10 = new Date(today.getTime() + 10 * 86400000);
  const in13 = new Date(today.getTime() + 13 * 86400000);
  let booking = null;
  for (const p of props) {
    const attempt = await call("cust", "POST", "/api/bookings", {
      propertyId: p.id, checkIn: fmt(in10), checkOut: fmt(in13), adults: 2, children: 1,
      couponCode: "WELCOME",
    });
    if (attempt.status === 200 && attempt.data?.id) {
      booking = attempt.data;
      break;
    }
    if (attempt.status !== 400 || !String(attempt.data?.error ?? "").includes("رزرو شد")) {
      console.log("    (booking attempt failed for", p.id, ")", attempt.data?.error);
    }
  }
  check("POST /api/bookings → created (PENDING_PAYMENT)", !!booking, booking);
  const bid = booking?.id;
  check("booking.code starts with VLS-", /^VLS-/.test(booking?.code ?? ""));

  // double-booking guard on the same property+dates
  if (booking) {
    const dbl = await call("cust", "POST", "/api/bookings", {
      propertyId: booking.propertyId, checkIn: fmt(in10), checkOut: fmt(in13), adults: 1, children: 0,
    });
    check("double-booking rejected (400)", dbl.status === 400, dbl.data);
  }

  // 7) payment start + settle
  let authority = null;
  let settledStatus = null;
  if (bid) {
    r = await call("cust", "POST", "/api/payments", { action: "start", bookingId: bid });
    check("POST /api/payments start → authority", r.status === 200 && !!r.data?.authority, r.data);
    authority = r.data?.authority;
    r = await call("cust", "GET", "/api/payments?authority=" + authority);
    check("GET /api/payments?authority → PENDING", r.status === 200 && r.data?.status === "PENDING", r.data?.status);
    r = await call("cust", "POST", "/api/payments", { action: "settle", authority, result: "success" });
    settledStatus = r.data?.booking?.status;
    check("settle → booking PENDING_APPROVAL or CONFIRMED (instant)",
      settledStatus === "PENDING_APPROVAL" || settledStatus === "CONFIRMED", settledStatus);
  }

  // 8) admin login + approve booking + KPIs + reports
  r = await call("admin", "POST", "/api/auth/request-otp", { phone: "09120000001" });
  r = await call("admin", "POST", "/api/auth/verify", { phone: "09120000001", code: r.data?.demoCode });
  check("admin login → role ADMIN", r.data?.user?.role === "ADMIN", r.data?.user?.role);

  if (bid) {
    if (settledStatus === "PENDING_APPROVAL") {
      r = await call("admin", "PATCH", `/api/bookings/${bid}`, { action: "approve" });
      check("PATCH /api/bookings/:id approve → CONFIRMED", r.status === 200 && r.data?.status === "CONFIRMED", r.data);
    } else {
      r = await call("admin", "PATCH", `/api/bookings/${bid}`, { action: "approve" });
      check("instant booking already CONFIRMED → approve correctly rejected",
        r.status === 400 && String(r.data?.error ?? "").includes("قابل تأیید نیست"), r.data);
    }
  }

  r = await call("admin", "GET", "/api/admin/overview");
  check("GET /api/admin/overview → kpis", r.status === 200 && typeof r.data?.kpis?.users === "number", r.data?.kpis);
  console.log("    kpis:", JSON.stringify(r.data?.kpis));
  r = await call("admin", "GET", "/api/admin/reports?days=14");
  check("GET /api/admin/reports?days=14 → 14-point series", r.data?.series?.length === 14, r.data?.series?.length);
  r = await call("admin", "GET", "/api/admin/settings");
  check("GET /api/admin/settings → commission.rate present", r.data?.["commission.rate"] === "0.12", r.data?.["commission.rate"]);

  // 9) public tracking by code
  if (booking) {
    r = await call(null, "GET", "/api/track?code=" + booking.code);
    check("GET /api/track?code → events timeline", r.status === 200 && r.data?.events?.length >= 2, r.data?.events?.length);
  }

  // 9b) customer cancels → full lifecycle end (also frees the calendar)
  if (bid) {
    r = await call("cust", "PATCH", `/api/bookings/${bid}`, { action: "cancel", reason: "تست خودکار بک‌اند" });
    check("PATCH cancel → CANCELLED (penalty/refund engine)", r.status === 200 && r.data?.status === "CANCELLED", r.data);
  }

  // 10) favorites toggle (flip semantics: second call must invert the first)
  if (props[0]) {
    r = await call("cust", "POST", "/api/favorites", { propertyId: props[0].id });
    const first = r.data?.favorited;
    r = await call("cust", "POST", "/api/favorites", { propertyId: props[0].id });
    check("POST /api/favorites toggle → second call inverts first", r.data?.favorited === !first, { first, second: r.data });
  }

  // 11) complaint create + list
  r = await call("cust", "POST", "/api/complaints", { subject: "تست بک‌اند NestJS", body: "این یک تیکت تستی از سمت بک‌اند NestJS است." });
  check("POST /api/complaints → created", r.status === 200 && !!r.data?.id, r.data);
  r = await call("cust", "GET", "/api/complaints");
  check("GET /api/complaints → list", r.status === 200 && Array.isArray(r.data));

  // 12) messages + notifications
  if (props[0]) {
    r = await call("cust", "POST", "/api/messages", { propertyId: props[0].id, text: "سلام، از NestJS!" });
    check("POST /api/messages → sent", r.status === 200 && !!r.data?.id, r.data);
  }
  r = await call("cust", "GET", "/api/notifications");
  check("GET /api/notifications → items+unread", r.status === 200 && Array.isArray(r.data?.items), r.data?.unread);

  // 13) host view (login host 09120000002)
  r = await call("host", "POST", "/api/auth/request-otp", { phone: "09120000002" });
  r = await call("host", "POST", "/api/auth/verify", { phone: "09120000002", code: r.data?.demoCode });
  check("host login → role HOST", r.data?.user?.role === "HOST", r.data?.user?.role);
  r = await call("host", "GET", "/api/host?view=dashboard");
  check("GET /api/host?view=dashboard → stats", r.status === 200 && typeof r.data?.stats?.propertiesTotal === "number", r.status);
  r = await call("host", "GET", "/api/host?view=earnings");
  check("GET /api/host?view=earnings → totals", r.status === 200 && typeof r.data?.totals?.gross === "number", r.status);
  r = await call("host", "GET", "/api/host?view=properties");
  check("GET /api/host?view=properties → list", r.status === 200 && Array.isArray(r.data), r.status);
  r = await call("host", "GET", "/api/admin/overview");
  check("admin API blocked for host (403)", r.status === 403, r.status);

  // 14) validation error shape
  r = await call("cust", "POST", "/api/bookings", { propertyId: "x" });
  check("ValidationPipe → Persian 400 {error}", r.status === 400 && String(r.data?.error ?? "").startsWith("اعتبارسنجی"), r.data);

  // 15) socket.io handshake
  const sock = await fetch(BASE + "/socket.io/?EIO=4&transport=polling");
  check("socket.io handshake → 200 open packet", sock.status === 200, sock.status);

  // 16) swagger
  const sw = await fetch(BASE + "/docs");
  check("Swagger UI at /docs → 200", sw.status === 200, sw.status);
  const swj = await fetch(BASE + "/docs-json");
  const swaggerJson = await swj.json();
  const pathCount = Object.keys(swaggerJson?.paths ?? {}).length;
  check("OpenAPI JSON paths ≥ 20", pathCount >= 20, pathCount);

  console.log(`\n■ RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
