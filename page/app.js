// The page: loads live.js (what the gateway hook wrote) again every few
// seconds, works out each agent's status (model.js), and draws the office
// (scene.js) or the list. It reads nothing of magpie's but its own options,
// and has no network: live.js is one of its own files.
(async () => {
  const M = globalThis.AgentOfficeModel
  const I = globalThis.AgentOfficeIcons
  const { Scene } = globalThis.AgentOfficeScene
  const $ = (id) => document.getElementById(id)
  const theme = await magpie.ready
  let lang = theme.lang
  let opts = {}
  try { opts = (await magpie.options.get()) || {} } catch {}
  const view = {
    mode: opts.mode === "list" ? "list" : "office",
    dim: opts.dim === "2d" ? "2d" : "3d",
    demo: opts.demo === true,
    showDone: opts.showDone !== false,
    hideAfter: M.HIDE[opts.hideAfter] !== undefined ? opts.hideAfter : M.DEFAULTS.hideAfter,
    approvalAfterSec: Number(opts.approvalAfterSec) > 0 ? Number(opts.approvalAfterSec) : M.DEFAULTS.approvalAfterSec,
  }
  const state = { snap: null, loaded: false, list: [], open: "", pinned: false }

  // ---- words -----------------------------------------------------------
  function words() {
    const t = M.text(lang)
    document.querySelectorAll("[data-t]").forEach((e) => { e.textContent = t[e.dataset.t] })
    $("pip").textContent = floatHome ? t.pipOn : t.pip
    document.documentElement.lang = lang || "en"
    legends()
  }

  function legends() {
    const t = M.text(lang)
    $("statusLegend").replaceChildren(...M.STATUSES.map((s) => {
      const e = document.createElement("span")
      e.className = "lg"
      const dot = document.createElement("i")
      dot.style.background = M.COLORS[s]
      e.append(dot, document.createTextNode(t[s]))
      return e
    }))
    // the agents magpie has marks for, then any other one at work here
    const ids = [...M.LEGEND]
    for (const a of state.list) if (!ids.some((id) => M.brand(id).name === a.brand.name)) ids.push(a.agent)
    $("brandLegend").replaceChildren(...ids.map((id) => {
      const b = M.brand(id)
      const e = document.createElement("span")
      e.className = "lg"
      e.append(I.mark(b, 18), document.createTextNode(b.name))
      return e
    }))
  }

  // ---- reading live.js ---------------------------------------------------
  let loading = false
  function load() {
    if (loading) return
    loading = true
    const s = document.createElement("script")
    s.src = "live.js?t=" + Date.now()
    const done = () => { loading = false; s.remove() }
    s.onload = () => {
      state.snap = globalThis.AgentOfficeLive || null
      state.loaded = true
      done()
      refresh()
    }
    s.onerror = () => { state.loaded = true; done(); refresh() }
    document.head.append(s)
  }

  function snapshot(now) {
    if (!view.demo) return state.snap
    state.demoSnap ??= M.demo(now)
    // beside what is really happening, not instead of it
    return M.merge(state.snap, state.demoSnap)
  }

  // ---- the office ------------------------------------------------------
  const scene = new Scene($("office"), { dim: view.dim, onFrame: place })
  const tags = new Map()

  function tagFor(a) {
    let el = tags.get(a.key)
    if (!el) {
      el = document.createElement("button")
      el.type = "button"
      el.className = "tag"
      el.dataset.key = a.key
      el.addEventListener("mouseenter", () => { if (!state.pinned) show(a.key) })
      el.addEventListener("mouseleave", () => { if (!state.pinned) hideSoon() })
      el.addEventListener("click", (e) => { e.stopPropagation(); pin(a.key) })
      $("tags").append(el)
      tags.set(a.key, el)
    }
    const sig = [a.brand.icon, a.brand.name, a.title, a.status].join("|")
    if (el.dataset.sig !== sig) {
      el.dataset.sig = sig
      const name = document.createElement("span")
      name.className = "tn"
      name.textContent = a.title
      const dot = document.createElement("i")
      dot.className = "td"
      dot.style.background = M.COLORS[a.status]
      el.replaceChildren(I.mark(a.brand, 14), name, dot)
      el.dataset.status = a.status
      el.title = `${a.brand.name} · ${M.text(lang)[a.status]}`
    }
    return el
  }

  // each frame: the tags follow their workers, the card its tag
  function place(anchors) {
    const seen = new Set()
    // a window of its own has no room for every name tag: the ones that
    // need you stay, and the one under the pointer, whose card says the rest
    const few = floatHome
      ? new Set(state.list.filter((a) => a.status === "waiting" || a.status === "error" || a.key === state.open).map((a) => a.key))
      : null
    for (const p of anchors) {
      const el = tags.get(p.key)
      if (!el) continue
      seen.add(p.key)
      el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`
    }
    for (const [k, el] of tags) el.hidden = !seen.has(k) || (few ? !few.has(k) : false)
    if (state.open) {
      const p = anchors.find((x) => x.key === state.open)
      if (p) position(p)
    }
  }

  function position(p) {
    const pop = $("pop")
    const st = $("stage").getBoundingClientRect()
    const w = pop.offsetWidth || 360, h = pop.offsetHeight || 220
    let x = p.x + 24, y = p.y - 10
    if (x + w > st.width - 8) x = p.x - w - 24
    if (x < 8) x = Math.max(8, Math.min(st.width - w - 8, p.x - w / 2))
    y = Math.max(8, Math.min(st.height - h - 8, y))
    pop.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
  }

  // ---- the card --------------------------------------------------------
  function card(a) {
    const t = M.text(lang)
    const el = (tag, cls, text) => {
      const e = document.createElement(tag)
      if (cls) e.className = cls
      if (text != null) e.textContent = text
      return e
    }
    const head = el("div", "ph")
    head.append(I.mark(a.brand, 18), el("span", "pa", a.brand.name), el("span", "pt", a.title), el("span", "pw", M.ago(Date.now() - a.at, lang)))
    const body = [head]
    body.push(el("div", "pq", a.query || (state.snap?.text === false && !view.demo ? t.quiet : t.noPrompt)))
    const st = el("div", "ps " + a.status)
    const icon = { done: "✓", error: "×", waiting: "!", thinking: "…", executing: "⟳", replying: "✎" }[a.status]
    st.append(el("span", "pi", icon), el("span", null, t[a.status]))
    if (a.steps || a.turns) st.append(el("span", "pn", [a.turns ? M.fill(t.turns, a.turns) : "", a.steps ? M.fill(t.steps, a.steps) : ""].filter(Boolean).join(" · ")))
    body.push(st)
    if (a.step) body.push(el("div", "pstep", "› " + a.step + (a.status === "executing" ? "  ·  " + M.fill(t.ran, M.duration(a.since, lang)) : "")))
    if (a.hint === "approval") body.push(el("div", "phint", M.fill(t.approval, M.duration(a.since, lang))))
    if (a.reply) body.push(el("div", "pr", "← " + a.reply))
    const foot = el("div", "pf")
    foot.append(el("span", "pm", [a.model, a.project].filter(Boolean).join(" · ")))
    const copy = a.resume || a.session
    if (copy) {
      const b = el("button", "pc", a.resume ? t.copyResume : t.copySession)
      b.type = "button"
      b.dataset.label = b.textContent
      b.addEventListener("click", (e) => { e.stopPropagation(); copyText(copy, b) })
      foot.append(b)
    }
    body.push(foot)
    return body
  }

  function show(key) {
    clearTimeout(hideTimer)
    const a = state.list.find((x) => x.key === key)
    if (!a) return
    state.open = key
    const pop = $("pop")
    pop.replaceChildren(...card(a))
    pop.hidden = false
    for (const [k, el] of tags) el.classList.toggle("on", k === key)
  }
  let hideTimer = null
  function hideSoon() {
    clearTimeout(hideTimer)
    hideTimer = setTimeout(close, 180)
  }
  function close() {
    state.open = ""
    state.pinned = false
    $("pop").hidden = true
    for (const el of tags.values()) el.classList.remove("on")
  }
  function pin(key) {
    if (state.pinned && state.open === key) return close()
    state.pinned = true
    show(key)
  }
  $("pop").addEventListener("mouseenter", () => clearTimeout(hideTimer))
  $("pop").addEventListener("mouseleave", () => { if (!state.pinned) hideSoon() })
  $("pop").addEventListener("click", (e) => e.stopPropagation())

  $("office").addEventListener("mousemove", (e) => {
    if (state.pinned) return
    const r = e.currentTarget.getBoundingClientRect()
    const k = scene.hit(e.clientX - r.left, e.clientY - r.top)
    e.currentTarget.style.cursor = k ? "pointer" : ""
    if (k && k !== state.open) show(k)
    else if (!k && state.open) hideSoon()
  })
  $("office").addEventListener("click", (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const k = scene.hit(e.clientX - r.left, e.clientY - r.top)
    if (k) pin(k)
    else close()
  })

  async function copyText(s, btn) {
    const t = M.text(lang)
    let ok = false
    try { await navigator.clipboard.writeText(s); ok = true } catch {}
    if (!ok) {
      const ta = document.createElement("textarea")
      ta.value = s
      ta.style.position = "fixed"; ta.style.opacity = "0"
      document.body.append(ta)
      ta.select()
      try { ok = document.execCommand("copy") } catch {}
      ta.remove()
    }
    if (ok) {
      btn.textContent = t.copied
      setTimeout(() => { btn.textContent = btn.dataset.label || t.copyResume }, 1400)
    } else {
      // the frame may not reach the clipboard: let the reader copy it
      const box = document.createElement("input")
      box.className = "pcopy"
      box.readOnly = true
      box.value = s
      btn.replaceWith(box)
      box.select()
    }
  }

  // ---- the list --------------------------------------------------------
  function rows() {
    const t = M.text(lang)
    const list = M.sorted(state.list)
    $("emptyList").hidden = list.length > 0
    $("emptyList").textContent = emptyText()
    $("rows").replaceChildren(...list.map((a) => {
      const tr = document.createElement("tr")
      const td = (cls, ...kids) => {
        const c = document.createElement("td")
        if (cls) c.className = cls
        c.append(...kids)
        tr.append(c)
        return c
      }
      const name = document.createElement("span")
      name.textContent = a.brand.name
      td("ag", I.mark(a.brand, 16), name)
      const title = document.createElement("div")
      title.className = "lt"
      title.textContent = a.title
      const sub = document.createElement("div")
      sub.className = "ls"
      sub.textContent = a.status === "waiting" || a.status === "done" ? a.reply || a.query : a.step || a.query
      td("task", title, sub)
      const badge = document.createElement("span")
      badge.className = "badge"
      badge.style.setProperty("--c", M.COLORS[a.status])
      badge.textContent = t[a.status]
      td("", badge)
      td("mono", document.createTextNode(a.project))
      td("mono", document.createTextNode(a.model))
      td("muted", document.createTextNode(M.ago(Date.now() - a.at, lang)))
      tr.tabIndex = 0
      tr.addEventListener("click", () => { setMode("office"); setTimeout(() => pin(a.key), 50) })
      return tr
    }))
  }

  // before the first read: that it is waiting; after one with nothing in
  // it: what to do
  function emptyText() {
    const t = M.text(lang)
    return state.loaded && state.snap ? t.empty : t.noFile
  }

  // ---- everything ------------------------------------------------------
  function refresh() {
    const now = Date.now()
    state.list = M.agents(snapshot(now), now, view)
    const c = M.counts(state.list)
    $("nNeed").textContent = c.needYou
    $("nWork").textContent = c.working
    $("nDone").textContent = c.done
    $("counts").classList.toggle("alert", c.needYou > 0)
    scene.setAgents(state.list)
    const keys = new Set(state.list.map((a) => a.key))
    for (const [k, el] of tags) if (!keys.has(k)) { el.remove(); tags.delete(k) }
    for (const a of state.list) tagFor(a)
    if (state.open && !keys.has(state.open)) close()
    else if (state.open) show(state.open)
    $("empty").hidden = state.list.length > 0
    $("empty").textContent = emptyText()
    $("note").textContent = view.demo ? M.text(lang).demoOn : ""
    $("wm").textContent = state.snap?.written && !view.demo ? M.ago(now - state.snap.written, lang) : ""
    if (view.mode === "list") rows()
    legends()
    document.title = c.needYou ? `(${c.needYou}) ${M.text(lang).title}` : M.text(lang).title
  }

  function select(group, attr, value) {
    $(group).querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset[attr] === value)))
  }

  function setMode(m) {
    view.mode = m
    select("modes", "mode", m)
    $("stage").hidden = m !== "office"
    $("listview").hidden = m !== "list"
    $("dims").classList.toggle("off", m !== "office")
    if (m === "office") { scene.resize(); scene.start() } else { scene.stop(); close() }
    refresh()
  }

  // options can be set once a second: a quick second change is saved with
  // the next one
  // saving restarts the plugin's host (magpie's options do), so a change
  // waits until it has been left alone a moment, and only the keys that
  // differ are written
  let saving = null
  let saved = JSON.stringify(opts)
  function wanted() {
    return { ...opts, mode: view.mode, dim: view.dim, demo: view.demo, showDone: view.showDone, hideAfter: view.hideAfter, text: textOn() }
  }
  function save() {
    if (saving) return
    saving = setTimeout(async () => {
      saving = null
      const next = wanted()
      if (JSON.stringify(next) === saved) return
      try { opts = await magpie.options.set(next); saved = JSON.stringify(opts) } catch {}
    }, 2500)
  }
  // text is the hook's option: whether it keeps prompts and replies
  const textOn = () => $("optText").checked

  $("modes").addEventListener("click", (e) => {
    const m = e.target.closest("button")?.dataset.mode
    if (!m || m === view.mode) return
    setMode(m)
    save()
  })
  $("dims").addEventListener("click", (e) => {
    const d = e.target.closest("button")?.dataset.dim
    if (!d || d === view.dim) return
    view.dim = d
    select("dims", "dim", d)
    scene.setDim(d)
    if (view.mode !== "office") setMode("office")
    save()
  })

  // settings
  const menu = $("settings")
  $("settingsBtn").addEventListener("click", (e) => {
    e.stopPropagation()
    menu.hidden = !menu.hidden
    $("settingsBtn").setAttribute("aria-expanded", String(!menu.hidden))
  })
  document.addEventListener("click", (e) => { if (!menu.hidden && !menu.contains(e.target) && e.target !== $("settingsBtn")) { menu.hidden = true; $("settingsBtn").setAttribute("aria-expanded", "false") } })
  $("optDemo").checked = view.demo
  $("optDone").checked = view.showDone
  $("optText").checked = opts.text !== false
  select("optHide", "hide", view.hideAfter)
  $("optDemo").addEventListener("change", (e) => { view.demo = e.target.checked; state.demoSnap = null; refresh(); save() })
  $("optDone").addEventListener("change", (e) => { view.showDone = e.target.checked; refresh(); save() })
  $("optText").addEventListener("change", () => save())
  $("optHide").addEventListener("click", (e) => {
    const h = e.target.closest("button")?.dataset.hide
    if (!h) return
    view.hideAfter = h
    select("optHide", "hide", h)
    refresh()
    save()
  })

  // picture in picture: the office in a window of the page's own, which no
  // frame can refuse (magpie's frame sets allow="", so the browser's own
  // floating window refuses a sandboxed page: that one was tried and left
  // nothing on screen). It moves, reshapes, and Escape or the bar's ✕ puts
  // it back.
  let floatHome = null
  function openFloat() {
    if (floatHome) return
    const stage = $("stage")
    const ph = document.createElement("div")
    ph.className = "stage-slot"
    ph.textContent = M.text(lang).floating
    stage.parentElement.insertBefore(ph, stage)
    floatHome = { parent: ph.parentElement, ph }
    $("floatslot").append(stage)
    $("float").hidden = false
    $("float").style.cssText = ""
    $("pip").classList.add("on")
    $("pip").textContent = M.text(lang).pipOn
    scene.resize()
  }
  function closeFloat() {
    if (!floatHome) return
    const stage = $("stage")
    floatHome.parent.insertBefore(stage, floatHome.ph)
    floatHome.ph.remove()
    floatHome = null
    $("float").hidden = true
    $("pip").classList.remove("on")
    $("pip").textContent = M.text(lang).pip
    scene.resize()
  }
  $("floatClose").addEventListener("click", closeFloat)
  // the window's bar moves it
  $("floatbar").addEventListener("mousedown", (e) => {
    if (e.target.closest(".fclose")) return
    const box = $("float").getBoundingClientRect()
    const dx = e.clientX - box.left, dy = e.clientY - box.top
    const move = (m) => {
      const x = Math.max(0, Math.min(innerWidth - box.width, m.clientX - dx))
      const y = Math.max(0, Math.min(innerHeight - box.height, m.clientY - dy))
      Object.assign($("float").style, { left: x + "px", top: y + "px", right: "auto", bottom: "auto" })
      scene.resize()
    }
    const up = () => { removeEventListener("mousemove", move); removeEventListener("mouseup", up) }
    addEventListener("mousemove", move)
    addEventListener("mouseup", up)
    e.preventDefault()
  })

  $("pip").addEventListener("click", () => {
    if (floatHome) return closeFloat()
    if (view.mode !== "office") setMode("office")
    openFloat()
  })

  new ResizeObserver(() => scene.resize()).observe($("stage"))
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return
    if (floatHome) { closeFloat(); $("pip").classList.remove("on") }
    close()
  })
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) scene.stop()
    else if (view.mode === "office") scene.start()
  })
  magpie.onTheme((t) => { lang = t.lang; words(); refresh() })

  select("modes", "mode", view.mode)
  select("dims", "dim", view.dim)
  words()
  setMode(view.mode)
  load()
  // what the hook wrote, every few seconds; the clock-made statuses
  // (executing → waiting) and "N min ago" move with it
  setInterval(load, 2500)
})()
