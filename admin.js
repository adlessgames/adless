// Editor UI, loaded only on /admin
window.renderAdmin = function (root) {
  const h = window.h;
  const KEY = "adless_admin_pw";
  let pw = "";
  try { pw = sessionStorage.getItem(KEY) || ""; } catch {}
  let data = null;      // working copy
  let dirty = false;
  let tab = "items";
  let typeFilter = "game", query = "", onlyMissing = false;
  let imgs = null;

  const style = h("style", {}, `
  .ad{max-width:1000px;margin:0 auto;font-size:15px}
  .ad h1{font-size:32px;line-height:44px}
  .ad .tabs{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin:18px 0}
  .ad .tabs button{background:#111;color:#fff;border:1px solid #444;padding:8px 16px;cursor:pointer;font:600 14px Poppins,sans-serif}
  .ad .tabs button.on{background:#ebe0d7;color:#1c1c1c;border-color:#ebe0d7}
  .ad input,.ad select,.ad textarea{background:#111;color:#fff;border:1px solid #444;padding:9px 11px;font:400 15px Poppins,sans-serif;width:100%}
  .ad textarea{min-height:110px;resize:vertical}
  .ad label{display:block;margin:12px 0 4px;color:#bbb;font-size:13px}
  .ad .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  .ad .row>*{flex:1;min-width:140px;width:auto}
  .ad .b{background:#ebe0d7;color:#1c1c1c;border:0;padding:9px 18px;font:600 14px Poppins,sans-serif;cursor:pointer;flex:none;width:auto;min-width:0}
  .ad .b.g{background:#222;color:#fff;border:1px solid #555}
  .ad .b.r{background:#5a1d1d;color:#fff}
  .ad .item{display:flex;gap:12px;align-items:center;border-bottom:1px solid #222;padding:8px 4px}
  .ad .item .th{width:64px;height:40px;background:#222 center/cover;flex:none}
  .ad .item .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ad .ok{color:#7ddc8f;font-size:12px;flex:none}.ad .no{color:#e7a35b;font-size:12px;flex:none}
  .ad .save{position:sticky;top:0;z-index:15;background:#000;border-bottom:1px solid #333;padding:10px 0;display:flex;gap:12px;align-items:center;justify-content:center}
  .ad .msg{font-size:14px}.ad .err{color:#ff8b8b}.ad .good{color:#7ddc8f}
  .ad .modal{position:fixed;inset:0;background:#000c;z-index:50;overflow:auto;padding:20px}
  .ad .panel{background:#0d0d0d;border:1px solid #444;max-width:640px;margin:0 auto;padding:22px}
  .ad .imgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-top:14px}
  .ad .imgs div{background:#111;border:1px solid #333;padding:6px;font-size:12px}
  .ad .imgs img{width:100%;aspect-ratio:16/10;object-fit:cover;display:block;cursor:pointer}
  .ad .chk{display:flex;flex-wrap:wrap;gap:6px 16px}.ad .chk label{display:flex;gap:6px;align-items:center;margin:0;color:#ddd;font-size:14px}.ad .chk input{width:auto}
  .ad .hint{color:#999;font-size:13px;margin:4px 0 0}
  `);
  const mount = (...kids) => root.replaceChildren(style, h("div", { class: "ad" }, ...kids));

  async function call(path, opts = {}) {
    const r = await fetch(path, { ...opts, headers: { "x-admin-password": pw, ...(opts.headers || {}) } });
    let j = {};
    try { j = await r.json(); } catch {}
    if (!r.ok) throw new Error(j.error || "Request failed (" + r.status + ")");
    return j;
  }

  function login(note) {
    const p = h("input", { type: "password", placeholder: "Password", autocomplete: "current-password" });
    const msg = h("p", { class: "msg err" }, note || "");
    const go = async () => {
      pw = p.value;
      msg.textContent = "";
      try {
        const r = await call("/api/login", { method: "POST" });
        try { sessionStorage.setItem(KEY, pw); } catch {}
        data = JSON.parse(JSON.stringify(window.getSite()));
        if (!r.kv) alert("Heads up: the KV storage isn't connected yet, so you can look around but saving won't work. See the setup steps.");
        show();
      } catch (e) { msg.textContent = e.message; }
    };
    p.addEventListener("keydown", (e) => e.key === "Enter" && go());
    mount(h("h1", {}, "Editor"), h("div", { style: "max-width:340px;margin:30px auto" }, h("label", {}, "Password"), p, h("div", { style: "height:14px" }), h("button", { class: "b", onclick: go }, "Log in"), msg));
    p.focus();
  }

  const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  const mark = () => { dirty = true; };

  async function save(msg) {
    msg.className = "msg"; msg.textContent = "Saving…";
    try {
      const r = await call("/api/site", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      dirty = false;
      window.setSite(JSON.parse(JSON.stringify(data)));
      msg.className = "msg good"; msg.textContent = "Saved (" + r.items + " items). Live now.";
    } catch (e) { msg.className = "msg err"; msg.textContent = e.message; }
  }

  async function uploadFile(file) {
    let blob = file, type = file.type;
    if (type !== "image/gif" && /^image\//.test(type)) {
      const bmp = await createImageBitmap(file);
      if (bmp.width > 1600 || file.size > 1.5 * 1024 * 1024) {
        const k = Math.min(1, 1600 / bmp.width);
        const c = document.createElement("canvas");
        c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
        c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
        blob = await new Promise((res) => c.toBlob(res, "image/webp", 0.85));
        type = "image/webp";
      }
    }
    return call("/api/img", { method: "POST", headers: { "content-type": type, "x-filename": encodeURIComponent(file.name) }, body: blob });
  }

  async function pickImage() {
    // returns chosen image url or null
    if (!imgs) { try { imgs = await call("/api/imgs"); } catch { imgs = []; } }
    return new Promise((resolve) => {
      const done = (v) => { m.remove(); resolve(v); };
      const grid = h("div", { class: "imgs" });
      const draw = () => grid.replaceChildren(...imgs.map((i) => h("div", {}, h("img", { src: i.url, onclick: () => done(i.url) }), i.name || i.id)));
      draw();
      const file = h("input", { type: "file", accept: "image/*", multiple: "", style: "display:none", onchange: async () => {
        for (const f of file.files) { try { const r = await uploadFile(f); imgs.unshift({ id: r.id, url: r.url, name: f.name }); } catch (e) { alert(e.message); } }
        draw();
      } });
      const m = h("div", { class: "ad modal" }, h("div", { class: "panel" }, h("h2", { style: "margin:0 0 10px" }, "Pick a picture"),
        h("div", { class: "row" }, h("button", { class: "b", onclick: () => file.click() }, "Upload new"), file, h("button", { class: "b g", onclick: () => done(null) }, "Cancel")), grid));
      root.querySelector(".ad").append(m);
    });
  }

  function editItem(it, isNew) {
    const f = { ...it, genres: [...(it.genres || [])] };
    const err = h("p", { class: "msg err" });
    const title = h("input", { value: f.title });
    const sl = h("input", { value: f.slug });
    const type = h("select", {}, Object.entries(window.SEC).map(([k, v]) => h("option", { value: k, ...(k === f.type ? { selected: "" } : {}) }, v[0])));
    const url = h("input", { value: f.url, placeholder: "https://… (the game's embed link)" });
    const img = h("input", { value: f.img, placeholder: "Picture URL (optional)" });
    const prev = h("div", { class: "th", style: "width:120px;height:75px;background:#222 center/cover;margin-top:8px" });
    const setPrev = () => { prev.style.backgroundImage = img.value ? `url("${img.value.replace(/"/g, "%22")}")` : "none"; };
    setPrev(); img.addEventListener("input", setPrev);
    let slugTouched = !isNew;
    sl.addEventListener("input", () => { slugTouched = true; });
    title.addEventListener("input", () => { if (!slugTouched) sl.value = slugify(title.value); });
    url.addEventListener("change", () => {
      const m = url.value.match(/src\s*=\s*["']([^"']+)["']/i);
      if (m) url.value = m[1];
    });
    const chks = data.genres.map((g) => { const c = h("input", { type: "checkbox", ...(f.genres.includes(g) ? { checked: "" } : {}) }); return [g, c]; });
    const close = () => m.remove();
    const m = h("div", { class: "ad modal" }, h("div", { class: "panel" },
      h("h2", { style: "margin:0 0 6px" }, isNew ? "Add new" : "Edit"),
      h("label", {}, "Type"), type,
      h("label", {}, "Title"), title,
      h("label", {}, "Link slug (the end of the page address)"), sl,
      h("label", {}, "Game / embed URL"), url,
      h("p", { class: "hint" }, "Paste the link that opens the game. You can also paste the whole <iframe> code and I'll pull the link out."),
      h("label", {}, "Picture"), h("div", { class: "row" }, img, h("button", { class: "b g", onclick: async () => { const u = await pickImage(); if (u) { img.value = u; setPrev(); } } }, "Choose / upload")), prev,
      data.genres.length ? [h("label", {}, "Genres"), h("div", { class: "chk" }, chks.map(([g, c]) => h("label", {}, c, g)))] : null,
      err,
      h("div", { class: "row", style: "margin-top:16px" },
        h("button", { class: "b", onclick: () => {
          const s = slugify(sl.value || title.value);
          if (!title.value.trim() || !s) { err.textContent = "Needs a title."; return; }
          if (url.value.trim() && !/^https?:\/\//i.test(url.value.trim())) { err.textContent = "The URL has to start with https://"; return; }
          if (data.items.some((x) => x !== it && x.type === type.value && x.slug === s)) { err.textContent = "Another entry already uses that slug."; return; }
          Object.assign(it, { type: type.value, title: title.value.trim(), slug: s, url: url.value.trim(), img: img.value.trim(), genres: chks.filter(([, c]) => c.checked).map(([g]) => g) });
          if (!it.id) it.id = type.value[0] + "-" + s;
          if (isNew) data.items.push(it);
          mark(); close(); show();
        } }, "Done"),
        h("button", { class: "b g", onclick: close }, "Cancel"),
        isNew ? null : h("button", { class: "b r", onclick: () => { if (confirm("Delete " + it.title + "?")) { data.items.splice(data.items.indexOf(it), 1); mark(); close(); show(); } } }, "Delete"))));
    root.querySelector(".ad").append(m);
    title.focus();
  }

  function itemsTab() {
    const list = data.items.filter((i) => i.type === typeFilter && i.title.toLowerCase().includes(query.toLowerCase()) && (!onlyMissing || !i.url))
      .sort((a, b) => a.title.localeCompare(b.title));
    const missing = data.items.filter((i) => i.type === typeFilter && !i.url).length;
    const q = h("input", { value: query, placeholder: "Search…", oninput: (e) => { query = e.target.value; const pos = e.target.selectionStart; show(); const n = root.querySelector(".ad input[placeholder='Search…']"); n.focus(); n.setSelectionRange(pos, pos); } });
    return [
      h("div", { class: "row" },
        h("select", { onchange: (e) => { typeFilter = e.target.value; show(); } }, Object.entries(window.SEC).map(([k, v]) => h("option", { value: k, ...(k === typeFilter ? { selected: "" } : {}) }, v[0] + " (" + data.items.filter((i) => i.type === k).length + ")"))),
        q,
        h("button", { class: "b", onclick: () => editItem({ type: typeFilter, title: "", slug: "", url: "", img: "", genres: [] }, true) }, "+ Add new")),
      h("label", { style: "display:flex;gap:8px;align-items:center" }, h("input", { type: "checkbox", style: "width:auto", ...(onlyMissing ? { checked: "" } : {}), onchange: (e) => { onlyMissing = e.target.checked; show(); } }), "Only show ones with no link yet (" + missing + ")"),
      h("div", { style: "margin-top:10px" }, list.map((i) => h("div", { class: "item" },
        h("div", { class: "th", style: i.img ? `background-image:url("${i.img.replace(/"/g, "%22")}")` : "" }),
        h("div", { class: "nm" }, i.title),
        i.url ? h("span", { class: "ok" }, "has link") : h("span", { class: "no" }, "no link"),
        h("button", { class: "b g", onclick: () => editItem(i, false) }, "Edit")))),
      list.length ? null : h("p", { class: "empty" }, "Nothing here."),
    ];
  }

  function bulkTab() {
    const t = h("select", {}, Object.entries(window.SEC).map(([k, v]) => h("option", { value: k, ...(k === "game" ? { selected: "" } : {}) }, v[0])));
    const ta = h("textarea", { style: "min-height:220px", placeholder: "Slope 2 | https://example.com/slope2/\nCookie Clicker | https://example.com/cookie/\nBrand New Game | https://example.com/new/" });
    const out = h("p", { class: "msg" });
    return [h("p", {}, "Paste one per line as ", h("b", {}, "Title | link"), ". Titles that already exist get their link updated; new titles get added. Press the Save button at the top afterwards."),
      h("label", {}, "Type"), t, h("label", {}, "List"), ta,
      h("div", { style: "margin-top:12px" }, h("button", { class: "b", onclick: () => {
        let upd = 0, add = 0, bad = [];
        for (const line of ta.value.split("\n")) {
          if (!line.trim()) continue;
          const i = line.lastIndexOf("|");
          if (i < 0) { bad.push(line); continue; }
          const title = line.slice(0, i).trim(), u = line.slice(i + 1).trim();
          if (!title || !/^https?:\/\//i.test(u)) { bad.push(line); continue; }
          const s = slugify(title);
          const ex = data.items.find((x) => x.type === t.value && (x.slug === s || x.title.toLowerCase() === title.toLowerCase()));
          if (ex) { ex.url = u; upd++; }
          else { data.items.push({ id: t.value[0] + "-" + s, type: t.value, slug: s, title, url: u, img: "", genres: [] }); add++; }
        }
        if (upd || add) mark();
        out.className = bad.length ? "msg err" : "msg good";
        out.textContent = `${upd} updated, ${add} added.` + (bad.length ? ` ${bad.length} line(s) skipped (need "Title | https://link"): ${bad.slice(0, 3).join(" / ")}` : "");
        if (upd || add) { ta.value = bad.join("\n"); }
      } }, "Apply"), out)];
  }

  function genresTab() {
    const wrap = h("div", {});
    const draw = () => {
      wrap.replaceChildren(...data.genres.map((g, i) => h("div", { class: "row", style: "margin-bottom:8px" },
        h("input", { value: g, onchange: (e) => { const nv = e.target.value.trim(); if (!nv) return; data.items.forEach((x) => { x.genres = x.genres.map((y) => (y === g ? nv : y)); }); data.genres[i] = nv; mark(); draw(); } }),
        h("button", { class: "b r", onclick: () => { if (confirm("Delete genre " + g + "?")) { data.genres.splice(i, 1); data.items.forEach((x) => { x.genres = x.genres.filter((y) => y !== g); }); mark(); draw(); } } }, "Delete"))));
    };
    draw();
    const n = h("input", { placeholder: "New genre name" });
    return [h("p", {}, "Tick which games belong to a genre from each game's Edit window."), wrap, h("div", { class: "row" }, n, h("button", { class: "b", onclick: () => { const v = n.value.trim(); if (v && !data.genres.includes(v)) { data.genres.push(v); mark(); n.value = ""; draw(); } } }, "Add genre"))];
  }

  function updatesTab() {
    const wrap = h("div", {});
    const draw = () => {
      wrap.replaceChildren(...data.updates.map((u, i) => h("div", { style: "border:1px solid #333;padding:12px;margin-bottom:12px" },
        h("div", { class: "row" }, h("input", { value: u.date, placeholder: "Date", oninput: (e) => { u.date = e.target.value; mark(); } }),
          h("button", { class: "b g", onclick: () => { if (i > 0) { [data.updates[i - 1], data.updates[i]] = [data.updates[i], data.updates[i - 1]]; mark(); draw(); } } }, "Up"),
          h("button", { class: "b r", onclick: () => { if (confirm("Delete this update?")) { data.updates.splice(i, 1); mark(); draw(); } } }, "Delete")),
        h("textarea", { oninput: (e) => { u.text = e.target.value; mark(); } }, u.text))));
    };
    draw();
    return [h("button", { class: "b", onclick: () => { const d = new Date(); data.updates.unshift({ date: d.toLocaleString("en-US", { month: "numeric", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }), text: "" }); mark(); draw(); } }, "+ New update"), h("div", { style: "height:14px" }), wrap,
      h("label", {}, "Discord link"), h("input", { value: data.discord || "", oninput: (e) => { data.discord = e.target.value.trim(); mark(); } })];
  }

  function creditsTab() {
    const wrap = h("div", {});
    const draw = () => {
      wrap.replaceChildren(...data.credits.map((c, i) => h("div", { class: "row", style: "margin-bottom:8px" },
        h("input", { value: c.name, placeholder: "@name", oninput: (e) => { c.name = e.target.value; mark(); } }),
        h("input", { value: c.youtube, placeholder: "YouTube video ID or link", onchange: (e) => { const m = e.target.value.match(/(?:v=|embed\/|youtu\.be\/)([\w-]{6,20})/); c.youtube = m ? m[1] : e.target.value.trim(); e.target.value = c.youtube; mark(); } }),
        h("button", { class: "b r", onclick: () => { data.credits.splice(i, 1); mark(); draw(); } }, "Delete"))));
    };
    draw();
    return [wrap, h("button", { class: "b", onclick: () => { data.credits.push({ name: "", youtube: "" }); mark(); draw(); } }, "+ Add credit"),
      h("h2", {}, "Form links"),
      h("label", {}, "Suggest a game / report a bug form"), h("input", { value: data.addGameForm || "", oninput: (e) => { data.addGameForm = e.target.value.trim(); mark(); } }),
      h("label", {}, "Add a movie form"), h("input", { value: data.addMovieForm || "", oninput: (e) => { data.addMovieForm = e.target.value.trim(); mark(); } })];
  }

  function picturesTab() {
    const grid = h("div", { class: "imgs" });
    const draw = () => grid.replaceChildren(...(imgs || []).map((i) => h("div", {}, h("img", { src: i.url, title: "Click to copy link", onclick: () => navigator.clipboard?.writeText(location.origin + i.url) }), h("div", { style: "overflow:hidden;text-overflow:ellipsis;white-space:nowrap" }, i.name || i.id),
      h("button", { class: "b r", style: "margin-top:6px;padding:4px 10px", onclick: async () => { if (!confirm("Delete this picture? Anything using it will lose its image.")) return; try { await call("/api/img/" + i.id, { method: "DELETE" }); imgs = imgs.filter((x) => x !== i); draw(); } catch (e) { alert(e.message); } } }, "Delete"))));
    const file = h("input", { type: "file", accept: "image/*", multiple: "", style: "display:none", onchange: async () => {
      msg.className = "msg"; msg.textContent = "Uploading…";
      try { for (const f of file.files) { const r = await uploadFile(f); imgs.unshift({ id: r.id, url: r.url, name: f.name }); } msg.className = "msg good"; msg.textContent = "Uploaded."; } catch (e) { msg.className = "msg err"; msg.textContent = e.message; }
      draw();
    } });
    const msg = h("p", { class: "msg" });
    if (!imgs) call("/api/imgs").then((r) => { imgs = r; draw(); }).catch((e) => { msg.className = "msg err"; msg.textContent = e.message; imgs = []; });
    else draw();
    return [h("p", {}, "Upload pictures here, then pick them when you edit a game. Big pictures are shrunk automatically. Click a picture to copy its link."),
      h("button", { class: "b", onclick: () => file.click() }, "Upload pictures"), file, msg, grid];
  }

  function show() {
    const msg = h("span", { class: "msg" }, dirty ? "Unsaved changes" : "");
    const tabs = { items: ["Games & more", itemsTab], bulk: ["Bulk add links", bulkTab], genres: ["Genres", genresTab], updates: ["Updates", updatesTab], credits: ["Credits & links", creditsTab], pics: ["Pictures", picturesTab] };
    mount(
      h("h1", {}, "Editor"),
      h("div", { class: "save" }, msg, h("button", { class: "b", onclick: () => save(msg) }, "Save"), h("button", { class: "b g", onclick: () => { try { sessionStorage.removeItem(KEY); } catch {} pw = ""; login(); } }, "Log out"), h("a", { class: "b g", href: "/", style: "text-decoration:none" }, "View site")),
      h("div", { class: "tabs" }, Object.entries(tabs).map(([k, [label]]) => h("button", { class: k === tab ? "on" : "", onclick: () => { tab = k; show(); } }, label))),
      tabs[tab][1]());
  }

  addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  if (pw) {
    call("/api/login", { method: "POST" }).then(() => { data = JSON.parse(JSON.stringify(window.getSite())); show(); }).catch((e) => login(e.message === "Wrong password" ? "" : e.message));
  } else login();
};
