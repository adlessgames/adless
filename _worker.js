// Cloudflare Pages worker: static site + tiny admin API.
// Bindings needed (Pages > Settings > Bindings / Variables):
//   SITE            KV namespace (stores site data + uploaded pictures)
//   ADMIN_PASSWORD  Secret (the editor password)

const MAX_IMG = 4 * 1024 * 1024;
const MAX_SITE = 2 * 1024 * 1024;
const IMG_TYPES = { "image/png": 1, "image/jpeg": 1, "image/webp": 1, "image/gif": 1 };
const SAFE_URL = /^https?:\/\/[^\s"'<>]+$/i;
const SAFE_IMG = /^(https?:\/\/[^\s"'<>]+|\/api\/img\/[a-f0-9]{16})$/i;
const TYPES = ["game", "app", "movie", "show", "anime"];

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...extra },
  });

async function sha(s) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}
async function authed(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const given = request.headers.get("x-admin-password") || "";
  const [a, b] = await Promise.all([sha(given), sha(env.ADMIN_PASSWORD)]);
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");

function clean(body) {
  if (!body || typeof body !== "object") throw new Error("Bad data");
  const out = { genres: [], items: [], updates: [], credits: [] };
  out.genres = (Array.isArray(body.genres) ? body.genres : []).slice(0, 100).map((g) => str(g, 60)).filter(Boolean);
  const seen = new Set();
  for (const it of (Array.isArray(body.items) ? body.items : []).slice(0, 3000)) {
    const type = TYPES.includes(it.type) ? it.type : "game";
    const slug = str(it.slug, 120).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!slug || seen.has(type + "/" + slug)) continue;
    seen.add(type + "/" + slug);
    const url = str(it.url, 2000).trim();
    const img = str(it.img, 2000).trim();
    if (url && !SAFE_URL.test(url)) throw new Error(`"${slug}": game URL must start with http(s)://`);
    if (img && !SAFE_IMG.test(img)) throw new Error(`"${slug}": bad picture URL`);
    out.items.push({
      id: str(it.id, 80) || `${type[0]}-${slug}`,
      type, slug,
      title: str(it.title, 200) || slug,
      url, img,
      genres: (Array.isArray(it.genres) ? it.genres : []).slice(0, 20).map((g) => str(g, 60)).filter((g) => out.genres.includes(g)),
    });
  }
  out.updates = (Array.isArray(body.updates) ? body.updates : []).slice(0, 500).map((u) => ({ date: str(u.date, 80), text: str(u.text, 5000) }));
  out.credits = (Array.isArray(body.credits) ? body.credits : []).slice(0, 100).map((c) => ({
    name: str(c.name, 100),
    youtube: /^[\w-]{6,20}$/.test(c.youtube || "") ? c.youtube : "",
  }));
  for (const k of ["discord", "addGameForm", "addMovieForm"]) {
    const v = str(body[k], 500).trim();
    if (v && !SAFE_URL.test(v)) throw new Error(`${k} must be an http(s) link`);
    out[k] = v;
  }
  return out;
}

async function loadSite(env, request) {
  if (env.SITE) {
    const v = await env.SITE.get("site", "json");
    if (v) return v;
  }
  const r = await env.ASSETS.fetch(new URL("/seed.json", request.url));
  return r.json();
}

async function api(request, env, url) {
  const path = url.pathname;
  const method = request.method;

  if (path === "/api/site" && method === "GET") {
    return json(await loadSite(env, request));
  }
  if (path === "/api/login" && method === "POST") {
    if (!env.ADMIN_PASSWORD) return json({ error: "ADMIN_PASSWORD is not set on the server yet." }, 503);
    if (await authed(request, env)) return json({ ok: true, kv: !!env.SITE });
    await new Promise((r) => setTimeout(r, 700));
    return json({ error: "Wrong password" }, 401);
  }
  if (path.startsWith("/api/img/") && method === "GET") {
    if (!env.SITE) return new Response("Not found", { status: 404 });
    const id = path.slice(9);
    if (!/^[a-f0-9]{16}$/.test(id)) return new Response("Not found", { status: 404 });
    const { value, metadata } = await env.SITE.getWithMetadata("img:" + id, "arrayBuffer");
    if (!value) return new Response("Not found", { status: 404 });
    return new Response(value, {
      headers: {
        "content-type": metadata?.type || "application/octet-stream",
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'",
      },
    });
  }

  // everything below needs the password
  if (!(await authed(request, env))) {
    await new Promise((r) => setTimeout(r, 700));
    return json({ error: "Not allowed" }, 401);
  }
  if (!env.SITE) return json({ error: "KV namespace 'SITE' is not bound to this project yet." }, 503);

  if (path === "/api/site" && method === "PUT") {
    const raw = await request.text();
    if (raw.length > MAX_SITE) return json({ error: "Too much data" }, 413);
    let data;
    try { data = clean(JSON.parse(raw)); } catch (e) { return json({ error: e.message }, 400); }
    await env.SITE.put("site", JSON.stringify(data));
    return json({ ok: true, items: data.items.length });
  }
  if (path === "/api/img" && method === "POST") {
    const type = (request.headers.get("content-type") || "").split(";")[0].trim();
    if (!IMG_TYPES[type]) return json({ error: "Only PNG, JPG, WebP or GIF pictures" }, 400);
    const buf = await request.arrayBuffer();
    if (buf.byteLength > MAX_IMG) return json({ error: "Picture is over 4 MB" }, 413);
    if (!buf.byteLength) return json({ error: "Empty file" }, 400);
    const id = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const name = str(decodeURIComponent(request.headers.get("x-filename") || ""), 120);
    await env.SITE.put("img:" + id, buf, { metadata: { type, name, size: buf.byteLength, at: Date.now() } });
    return json({ ok: true, id, url: "/api/img/" + id });
  }
  if (path === "/api/imgs" && method === "GET") {
    const out = [];
    let cursor;
    do {
      const l = await env.SITE.list({ prefix: "img:", cursor });
      for (const k of l.keys) out.push({ id: k.name.slice(4), url: "/api/img/" + k.name.slice(4), ...(k.metadata || {}) });
      cursor = l.list_complete ? undefined : l.cursor;
    } while (cursor);
    return json(out.sort((a, b) => (b.at || 0) - (a.at || 0)));
  }
  if (path.startsWith("/api/img/") && method === "DELETE") {
    const id = path.slice(9);
    if (!/^[a-f0-9]{16}$/.test(id)) return json({ error: "Bad id" }, 400);
    await env.SITE.delete("img:" + id);
    return json({ ok: true });
  }
  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try { return await api(request, env, url); }
      catch (e) { return json({ error: "Server error: " + e.message }, 500); }
    }
    let res = await env.ASSETS.fetch(request);
    // single-page-app fallback: unknown paths without a file extension get the app shell
    if (res.status === 404 && request.method === "GET" && !/\.[a-z0-9]{2,5}$/i.test(url.pathname)) {
      res = await env.ASSETS.fetch(new URL("/index.html", request.url));
    }
    return res;
  },
};
