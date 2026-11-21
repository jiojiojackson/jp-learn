// 日语专注修行 — Cloudflare Worker：静态页面由 assets 提供，/api/state 读写 D1。

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, total INTEGER NOT NULL,
    done INTEGER NOT NULL DEFAULT 0, ms INTEGER NOT NULL DEFAULT 0, pos INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS days (
    date TEXT PRIMARY KEY, ms INTEGER NOT NULL DEFAULT 0, pause_ms INTEGER NOT NULL DEFAULT 0,
    items INTEGER NOT NULL DEFAULT 0, pts INTEGER NOT NULL DEFAULT 0, sessions INTEGER NOT NULL DEFAULT 0,
    pauses INTEGER NOT NULL DEFAULT 0, best INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
];

let ready = false;
async function init(db) {
  if (ready) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  ready = true;
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function authorized(req, env) {
  const token = env.ACCESS_TOKEN;
  if (!token) return true; // 未设置口令：任何人都可访问
  const h = req.headers.get("Authorization") || "";
  return h.startsWith("Bearer ") && safeEqual(h.slice(7), String(token));
}

const int = (v, max = 1e12) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
const parse = (s, fallback) => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } };

async function getState(env) {
  const db = env.DB;
  const [g, d, k] = await db.batch([
    db.prepare("SELECT id, name, total, done, ms FROM goals ORDER BY pos"),
    db.prepare("SELECT date, ms, pause_ms, items, pts, sessions, pauses, best FROM days"),
    db.prepare("SELECT key, value FROM kv"),
  ]);
  const kv = Object.fromEntries(k.results.map((r) => [r.key, r.value]));
  const days = {};
  for (const r of d.results) {
    days[r.date] = { ms: r.ms, pauseMs: r.pause_ms, items: r.items, pts: r.pts, sessions: r.sessions, pauses: r.pauses, best: r.best };
  }
  return json({
    rev: Number(kv.rev || 0),
    state: {
      goals: g.results,
      days,
      activeId: kv.active_id || null,
      session: parse(kv.session, null),
      badges: parse(kv.badges, {}),
      flags: parse(kv.flags, {}),
    },
  });
}

async function putState(req, env) {
  const db = env.DB;
  let b;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  if (!b || !Array.isArray(b.goals)) return json({ error: "bad body" }, 400);

  // 乐观锁：客户端带上读取时的 rev，其他设备已更新则返回 409
  const row = await db.prepare("SELECT value FROM kv WHERE key = 'rev'").first();
  const cur = Number(row?.value || 0);
  if (Number(b.rev) !== cur) return json({ error: "conflict", rev: cur }, 409);

  const stmts = [];
  const ids = [];
  b.goals.slice(0, 100).forEach((g, i) => {
    const id = String(g?.id || "").slice(0, 40);
    if (!id) return;
    ids.push(id);
    stmts.push(
      db.prepare(
        `INSERT INTO goals (id, name, total, done, ms, pos) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, total=excluded.total, done=excluded.done, ms=excluded.ms, pos=excluded.pos`
      ).bind(id, String(g.name || "").slice(0, 60), int(g.total, 999) || 1, int(g.done, 999), int(g.ms), i)
    );
  });
  stmts.push(
    ids.length
      ? db.prepare(`DELETE FROM goals WHERE id NOT IN (${ids.map(() => "?").join(",")})`).bind(...ids)
      : db.prepare("DELETE FROM goals")
  );

  for (const [date, d] of Object.entries(b.days || {}).slice(0, 400)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !d) continue;
    stmts.push(
      db.prepare(
        `INSERT INTO days (date, ms, pause_ms, items, pts, sessions, pauses, best) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET ms=excluded.ms, pause_ms=excluded.pause_ms, items=excluded.items, pts=excluded.pts,
           sessions=excluded.sessions, pauses=excluded.pauses, best=excluded.best`
      ).bind(date, int(d.ms), int(d.pauseMs), int(d.items, 1e6), int(d.pts, 1e9), int(d.sessions, 1e6), int(d.pauses, 1e6), int(d.best))
    );
  }

  const kvSet = (key, value) =>
    stmts.push(
      db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(key, value)
    );
  const small = (v) => { const s = JSON.stringify(v ?? null); return s.length > 20000 ? "null" : s; };
  kvSet("active_id", String(b.activeId || "").slice(0, 40));
  kvSet("session", small(b.session));
  kvSet("badges", small(b.badges || {}));
  kvSet("flags", small(b.flags || {}));
  kvSet("rev", String(cur + 1));

  await db.batch(stmts);
  return json({ rev: cur + 1 });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    if (url.pathname !== "/api/state") return json({ error: "not found" }, 404);
    if (!authorized(req, env)) return json({ error: "unauthorized" }, 401);
    try {
      await init(env.DB);
      if (req.method === "GET") return await getState(env);
      if (req.method === "PUT") return await putState(req, env);
      return json({ error: "method not allowed" }, 405);
    } catch (e) {
      return json({ error: "server error", detail: String(e?.message || e) }, 500);
    }
  },
};
