(() => {
const h = (tag, attrs, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};
window.h = h;
const app = document.getElementById("app");
const SEC = { game: ["Games", "/all-games/games/"], app: ["Apps", "/apps/"], movie: ["Movies", "/cinema/movies/"], show: ["Shows", "/cinema/shows/"], anime: ["Anime", "/cinema/anime/"] };
const itemPath = (it) => SEC[it.type][1] + it.slug + "/";
window.itemPath = itemPath;
window.SEC = SEC;
let SITE = null;
window.getSite = () => SITE;
window.setSite = (s) => { SITE = s; };

const trimDate = (d) => (d || "").split(",")[0].split("/").map((x) => String(parseInt(x, 10) || x)).join("/");
const linkify = (t) => {
  const out = [];
  let last = 0;
  for (const m of t.matchAll(/https?:\/\/[^\s<>"']+/g)) {
    out.push(t.slice(last, m.index));
    out.push(h("a", { href: m[0], target: "_blank", rel: "noopener" }, m[0]));
    last = m.index + m[0].length;
  }
  out.push(t.slice(last));
  return out;
};
const initials = (t) => t.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "★";
const card = (it) => h("a", { class: "card", href: itemPath(it) },
  h("div", { class: "pic", style: it.img ? `background-image:url("${it.img.replace(/"/g, "%22")}")` : null }, it.img ? "" : initials(it.title)),
  h("div", { class: "t" }, it.title));
const btn = (label, href, ext) => h("a", { class: "btn", href, ...(ext ? { target: "_blank", rel: "noopener" } : {}) }, label);

function player(it) {
  if (!it.url) return h("p", { class: "empty" }, "This one isn't set up yet. Check back soon.");
  const f = h("iframe", { src: it.url, allow: "fullscreen; gamepad; autoplay; clipboard-write", allowfullscreen: "", referrerpolicy: "no-referrer", title: it.title });
  return h("div", { class: "player" }, f,
    h("div", { class: "bar" },
      h("button", { class: "btn", onclick: () => (f.requestFullscreen || f.webkitRequestFullscreen || (() => {})).call(f) }, "Fullscreen"),
      h("a", { class: "btn", href: it.url, target: "_blank", rel: "noopener noreferrer" }, "Open in new tab")));
}

const pages = {
  home() {
    const latest = SITE.updates[0] ? trimDate(SITE.updates[0].date) : "";
    return h("div", { class: "hero" },
      h("h1", {}, "Welcome to", h("br"), "Adless"),
      h("p", { class: "lead", style: "margin-top:34px" }, "some games won't work report it", h("br"), "We used to have 100% adless games but now its like 90% and 10% :c"),
      h("p", { class: "lead", style: "margin:20px 0 90px" }, "when it happens Also I can't add roblox sry :("),
      h("div", { class: "btnrow two" }, btn("Games", "/all-games/"), btn("UPDATES." + (latest ? " Latest: " + latest : ""), "/updates/")),
      h("div", { class: "btnrow three" }, btn("ADD A GAME", "/add-a-game/"), btn("Cinema", "/cinema/"), btn("APPS", "/apps/")));
  },
  updates() {
    return h("div", {}, h("h1", {}, "UPDATES"), h("div", { style: "height:30px" }),
      SITE.updates.map((u) => h("div", { class: "upd" }, h("b", {}, u.date), h("p", {}, linkify(u.text)))),
      SITE.discord ? h("div", { class: "upd" }, h("b", {}, "Community"), h("p", {}, "Discord for updates, announcements and suggestions: ", h("a", { href: SITE.discord, target: "_blank", rel: "noopener" }, SITE.discord))) : null);
  },
  allGames(genre) {
    const games = SITE.items.filter((i) => i.type === "game").sort((a, b) => a.title.localeCompare(b.title));
    const grid = h("div", { class: "grid" });
    const f = h("input", { class: "filter", type: "search", placeholder: "Filter games…", "aria-label": "Filter games" });
    const draw = () => {
      const v = f.value.trim().toLowerCase();
      const list = games.filter((g) => (!genre || g.genres.includes(genre)) && g.title.toLowerCase().includes(v));
      grid.replaceChildren(...(list.length ? list.map(card) : [h("p", { class: "empty" }, "No games found.")]));
    };
    f.addEventListener("input", draw);
    draw();
    return h("div", {}, h("h1", {}, genre || "ALL GAMES"),
      h("div", { class: "pills" },
        h("a", { class: "pill" + (genre ? "" : " on"), href: "/all-games/" }, "All"),
        SITE.genres.map((g) => h("a", { class: "pill" + (g === genre ? " on" : ""), href: "/all-games/genres/" + slug(g) + "/" }, g))),
      f, grid);
  },
  genres() {
    return h("div", {}, h("h1", {}, "Select Genre"),
      h("div", { class: "list" }, SITE.genres.map((g) => btn(g, "/all-games/genres/" + slug(g) + "/"))));
  },
  apps() {
    return h("div", {}, h("h1", {}, "APPS"),
      h("div", { class: "grid" }, SITE.items.filter((i) => i.type === "app").map(card)));
  },
  addGame() {
    return h("div", { class: "hero" }, h("h1", {}, "ADD A GAME/Report a Bug"), h("div", { style: "height:40px" }),
      h("div", { class: "btnrow", style: "max-width:520px" }, btn("SUGGEST A GAME/REPORT A BUG", SITE.addGameForm || "#", true)));
  },
  cinema() {
    const sec = (title, type) => {
      const l = SITE.items.filter((i) => i.type === type);
      return l.length ? [h("h2", {}, title), h("div", { class: "grid" }, l.map(card))] : null;
    };
    return h("div", {}, h("h1", {}, "Cinema"),
      SITE.addMovieForm ? h("div", { class: "btnrow", style: "max-width:260px;margin:20px auto 0" }, btn("Add a Movie", SITE.addMovieForm, true)) : null,
      sec("MOVIES", "movie"), sec("SHOWS", "show"), sec("Anime", "anime"));
  },
  credits() {
    return h("div", {}, h("h1", {}, "Credits"), h("div", { style: "height:30px" }),
      SITE.credits.map((c) => h("div", { class: "credit" }, h("h2", {}, c.name),
        c.youtube ? h("iframe", { src: "https://www.youtube-nocookie.com/embed/" + c.youtube, allowfullscreen: "", loading: "lazy", title: c.name }) : null)));
  },
  item(it) {
    return h("div", {}, h("h1", {}, it.title), player(it));
  },
};
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function route() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  document.querySelectorAll("nav a[data-p]").forEach((a) => {
    const p = a.dataset.p;
    a.classList.toggle("on", p === "/" ? path === "/" : path === p || path.startsWith(p + "/"));
  });
  document.getElementById("nav").classList.remove("open");
  let el, title = "Adless Games (Reborn)";
  if (path === "/admin") {
    app.replaceChildren(h("p", { class: "empty" }, "Loading editor…"));
    const go = () => window.renderAdmin(app);
    if (window.renderAdmin) go();
    else { const s = h("script", { src: "/admin.js" }); s.onload = go; document.body.append(s); }
    document.title = "Editor - " + title;
    return;
  }
  const m = (re) => path.match(re);
  let r;
  if (path === "/" || path === "/home") el = pages.home();
  else if (path === "/updates") el = pages.updates();
  else if (path === "/all-games") el = pages.allGames();
  else if (path === "/all-games/genres") el = pages.genres();
  else if ((r = m(/^\/all-games\/genres\/([^/]+)$/))) {
    const g = SITE.genres.find((x) => slug(x) === r[1]);
    el = g ? pages.allGames(g) : null;
  } else if (path === "/apps") el = pages.apps();
  else if (path === "/add-a-game") el = pages.addGame();
  else if (path === "/cinema" || /^\/cinema\/(movies|shows|anime)$/.test(path)) el = pages.cinema();
  else if (path === "/credits") el = pages.credits();
  else {
    const hit = SITE.items.find((i) => itemPath(i).replace(/\/$/, "") === path.replace(/^(\/)adm\//, "/"));
    if (hit) { el = pages.item(hit); title = hit.title + " - " + title; }
  }
  if (!el) el = h("div", {}, h("h1", {}, "Page not found"), h("p", { class: "empty" }, "That page doesn't exist. ", h("a", { href: "/" }, "Go home")));
  app.replaceChildren(el);
  document.title = title;
  window.scrollTo(0, 0);
}
window.route = route;

document.addEventListener("click", (e) => {
  const a = e.target.closest("a[href]");
  if (!a || a.target || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  e.preventDefault();
  history.pushState(null, "", u.pathname + u.search);
  route();
});
addEventListener("popstate", route);

// search
const sbtn = document.getElementById("sbtn"), box = document.getElementById("search"), q = document.getElementById("q"), res = document.getElementById("results");
const closeSearch = () => { box.classList.remove("open"); res.style.display = "none"; q.value = ""; };
sbtn.onclick = () => { box.classList.add("open"); q.focus(); };
document.getElementById("sx").onclick = closeSearch;
addEventListener("keydown", (e) => { if (e.key === "Escape") closeSearch(); });
q.addEventListener("input", () => {
  const v = q.value.trim().toLowerCase();
  if (!v || !SITE) { res.style.display = "none"; return; }
  const hits = SITE.items.filter((i) => i.title.toLowerCase().includes(v)).slice(0, 12);
  res.replaceChildren(...(hits.length ? hits.map((i) => h("a", { href: itemPath(i), onclick: closeSearch }, i.title, h("small", {}, SEC[i.type][0]))) : [h("a", { href: "#", onclick: (e) => e.preventDefault() }, "No results")]));
  res.style.display = "block";
});
document.getElementById("mbtn").onclick = () => document.getElementById("nav").classList.toggle("open");

fetch("/api/site").then((r) => r.json()).then((s) => { SITE = s; route(); })
  .catch(() => { app.replaceChildren(h("p", { class: "empty" }, "Couldn't load the site. Refresh to try again.")); });
})();
