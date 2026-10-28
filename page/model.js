// What the page shows, worked out from what the gateway hook wrote
// (live.js: globalThis.AgentOfficeLive) without the DOM, so a test can
// check it. A classic script: it sets globalThis.AgentOfficeModel.
(() => {
  const TEXT = {
    en: {
      title: "What are my agents doing", needYou: "Need you", working: "Working", doneN: "Done",
      office: "Office", list: "List", pip: "Picture in picture", settings: "Settings",
      thinking: "Thinking", executing: "Running tools", replying: "Replying", waiting: "Waiting for you",
      done: "Done", error: "Error", idle: "Idle",
      copyResume: "Copy resume command", copySession: "Copy session id", copied: "Copied", copyFailed: "Select and copy:",
      justNow: "just now", sAgo: "{n}s ago", mAgo: "{n} min ago", hAgo: "{n} h ago", dAgo: "{n} d ago",
      empty: "No agent has worked through magpie yet. Start one whose model is a magpie model, and it walks in here.",
      noFile: "Waiting for magpie's gateway to see a request…",
      demo: "Sample agents", showDone: "Show finished agents", showText: "Show prompts and replies",
      hideAfter: "Leave the office after", h1: "1 hour", h6: "6 hours", h24: "24 hours", never: "Never",
      demoOn: "Showing sample agents", steps: "{n} steps", turns: "{n} turns", noPrompt: "(prompt not recorded)",
      pipFailed: "This window can't float the office; it shrinks into the corner instead.",
      project: "Folder", model: "Model", status: "Status", task: "Task", last: "Last active", agent: "Agent",
      quiet: "Text off: only statuses are kept",
      floating: "The office has its own window here: move it, reshape it, or ✕ it to put it back",
      pipOn: "Put it back",
      approval: "Its tools have run for {n}: most likely it is waiting for your approval",
      ran: "ran {n}",
    },
    zh: {
      title: "我的 Agent 在干嘛", needYou: "需要你", working: "工作中", doneN: "已完成",
      office: "办公室", list: "列表", pip: "画中画", settings: "设置",
      thinking: "思考中", executing: "执行中", replying: "回复中", waiting: "等你回应",
      done: "已完成", error: "错误", idle: "摸鱼中",
      copyResume: "复制续接命令", copySession: "复制会话 ID", copied: "已复制", copyFailed: "请手动复制：",
      justNow: "刚刚", sAgo: "{n}秒前", mAgo: "{n}分钟前", hAgo: "{n}小时前", dAgo: "{n}天前",
      empty: "还没有 Agent 经过 magpie 干活。让某个 Agent 用上 magpie 的模型，它就会走进这间办公室。",
      noFile: "正在等 magpie 网关看到第一个请求…",
      demo: "示例 Agent", showDone: "显示已完成的 Agent", showText: "显示提问和回复",
      hideAfter: "多久后离开办公室", h1: "1 小时", h6: "6 小时", h24: "24 小时", never: "从不",
      demoOn: "正在显示示例 Agent", steps: "{n} 步", turns: "{n} 轮", noPrompt: "（未记录提问）",
      pipFailed: "这个窗口无法悬浮画面，改为缩到角落。",
      project: "目录", model: "模型", status: "状态", task: "任务", last: "最近活动", agent: "Agent",
      quiet: "已关闭文本：只记录状态",
      floating: "办公室在这里的小窗中：可拖动、可缩放，点 ✕ 放回去",
      pipOn: "放回去",
      approval: "工具已经跑了 {n}，多半是在等你批准",
      ran: "已跑 {n}",
    },
  }
  const STATUSES = ["thinking", "executing", "replying", "waiting", "done", "error"]
  const COLORS = { thinking: "#8b6cf6", executing: "#3b82f6", replying: "#10b981", waiting: "#f59e0b", done: "#22a35a", error: "#ef4444", idle: "#9ca3af" }
  const HIDE = { "1h": 3600e3, "6h": 6 * 3600e3, "24h": 24 * 3600e3, never: Infinity }
  const DEFAULTS = { mode: "office", dim: "3d", demo: false, showDone: true, hideAfter: "6h", approvalAfterSec: 90 }

  // the agents magpie knows, as the legend names them; anything else is
  // drawn in a colour of its own from its id
  const BRANDS = {
    claude: { name: "Claude", color: "#d97757", icon: "claude" },
    "claude-desktop": { name: "Claude", color: "#d97757", icon: "claude" },
    codex: { name: "Codex", color: "#6366f1", icon: "codex" },
    gemini: { name: "Gemini", color: "#4285f4", icon: "gemini" },
    grok: { name: "Grok", color: "#111111", icon: "grok" },
    agy: { name: "Antigravity", color: "#3b82f6", icon: "antigravity" },
    antigravity: { name: "Antigravity", color: "#3b82f6", icon: "antigravity" },
    opencode: { name: "OpenCode", color: "#334155", icon: "letter" },
    pi: { name: "Pi", color: "#0f766e", icon: "letter" },
    omp: { name: "omp", color: "#0e7490", icon: "letter" },
    dsh: { name: "DeepSeek Harness", color: "#4d6bfe", icon: "letter" },
    cursor: { name: "Cursor", color: "#1f2937", icon: "letter" },
    kimi: { name: "Kimi", color: "#111827", icon: "letter" },
    qoder: { name: "Qoder", color: "#16a34a", icon: "letter" },
    "qoder-cn": { name: "Qoder", color: "#16a34a", icon: "letter" },
    zcode: { name: "ZCode", color: "#2563eb", icon: "letter" },
    cline: { name: "Cline", color: "#0ea5e9", icon: "letter" },
    droid: { name: "Droid", color: "#f97316", icon: "letter" },
    copilot: { name: "Copilot", color: "#7c3aed", icon: "letter" },
    workbuddy: { name: "WorkBuddy", color: "#0284c7", icon: "letter" },
    codebuddy: { name: "CodeBuddy", color: "#0284c7", icon: "letter" },
    hermes: { name: "Hermes", color: "#a16207", icon: "letter" },
    alma: { name: "Alma", color: "#be185d", icon: "letter" },
  }
  const LEGEND = ["claude", "codex", "gemini", "grok", "agy"]

  function text(lang) {
    return String(lang || "").toLowerCase().startsWith("zh") ? TEXT.zh : TEXT.en
  }
  function fill(s, n) { return s.replace("{n}", n) }

  function hash(s) {
    let h = 2166136261
    for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619)
    return h >>> 0
  }

  function brand(agent) {
    const b = BRANDS[agent]
    if (b) return { id: agent, ...b }
    const id = String(agent || "agent")
    return { id, name: id, color: `hsl(${hash(id) % 360} 55% 45%)`, icon: "letter" }
  }

  // a session's status at now, from the facts the hook kept:
  // thinking/replying while a request is out, executing while its tools
  // run, waiting when it asked (or its tools have sat long enough that it
  // is likely asking for approval), done, error; idle is done long ago
  function status(s, now, opts = {}) {
    const approval = (Number(opts.approvalAfterSec) || DEFAULTS.approvalAfterSec) * 1000
    if (s.inflight > 0) {
      // a reply that has taken a while is being written out
      return now - (s.inflightSince || now) > 8000 ? "replying" : "thinking"
    }
    const l = s.last
    if (!l) return "thinking"
    if (l.outcome === "error") return "error"
    if (l.outcome === "ask") return "waiting"
    if (l.outcome === "tools") return now - l.at > approval ? "waiting" : "executing"
    return "done"
  }

  function ago(ms, lang) {
    const t = text(lang)
    const s = Math.max(0, Math.round(ms / 1000))
    if (s < 10) return t.justNow
    if (s < 60) return fill(t.sAgo, s)
    if (s < 3600) return fill(t.mAgo, Math.floor(s / 60))
    if (s < 86400) return fill(t.hAgo, Math.floor(s / 3600))
    return fill(t.dAgo, Math.floor(s / 86400))
  }

  // 45 000 → "45s"; 130000 → "2m 10s"; 3 900 000 → "1h 5m"
  function duration(ms, lang) {
    const t = text(lang)
    const zh = t === TEXT.zh
    const s = Math.max(0, Math.round(ms / 1000))
    if (s < 60) return (zh ? s + "秒" : s + "s")
    const m = Math.floor(s / 60), r = s % 60
    if (m < 60) return zh ? `${m}分${r ? r + "秒" : ""}` : `${m}m${r ? " " + r + "s" : ""}`
    const h = Math.floor(m / 60), mm = m % 60
    return zh ? `${h}小时${mm ? mm + "分" : ""}` : `${h}h${mm ? " " + mm + "m" : ""}`
  }

  function shellQuote(s) {
    return /^[A-Za-z0-9._:@%+=-]+$/.test(s) ? s : `'${String(s).replace(/'/g, `'\\''`)}'`
  }

  // the command that picks the session up again, where the agent has one
  function resume(s) {
    if (!s.session || s.session.startsWith("cwd:")) return ""
    const id = shellQuote(s.session)
    const cd = s.cwd ? `cd ${shellQuote(s.cwd)} && ` : ""
    switch (s.agent) {
      case "claude": return `${cd}claude --resume ${id}`
      case "codex": return `${cd}codex resume ${id}`
      case "opencode": return `${cd}opencode --session ${id}`
      case "gemini": return `${cd}gemini --resume ${id}`
      case "pi": return `${cd}pi --session ${id}`
      default: return ""
    }
  }

  // the agents to draw: [{ key, agent, brand, title, status, at, … }]
  function agents(snap, now, opts = {}) {
    const o = { ...DEFAULTS, ...opts }
    const hide = HIDE[o.hideAfter] ?? HIDE["6h"]
    const out = []
    for (const s of Array.isArray(snap?.sessions) ? snap.sessions : []) {
      if (!s || typeof s.key !== "string") continue
      const st = status(s, now, o)
      const at = Math.max(s.updated || 0, s.last?.at || 0)
      const quiet = now - at
      if ((st === "done" || st === "error") && quiet > hide) continue
      if (st === "done" && !o.showDone) continue
      const b = brand(s.agent)
      out.push({
        key: s.key, agent: s.agent, brand: b, session: s.session || "", status: st,
        idle: st === "done" && quiet > 20 * 60e3,
        title: s.title || s.project || b.name, project: s.project || "", cwd: s.cwd || "",
        query: s.query || "", step: s.last?.step || "", reply: s.last?.text || "",
        model: s.model || "", at, started: s.started || at, turns: s.turns || 0, steps: s.steps || 0,
        // how long it has sat this way, for the card: a step that has run
        // long is probably an approval prompt
        since: quiet, hint: st === "waiting" && s.last?.outcome === "tools" ? "approval" : "",
        resume: resume(s), seed: hash(s.key),
      })
    }
    return out
  }

  function counts(list) {
    const c = { needYou: 0, working: 0, done: 0 }
    for (const a of list) {
      // an agent that failed needs you as much as one that asked
      if (a.status === "waiting" || a.status === "error") c.needYou++
      else if (a.status === "thinking" || a.status === "executing" || a.status === "replying") c.working++
      else if (a.status === "done") c.done++
    }
    return c
  }

  // the list view's order: what needs you, what works, then the rest, each
  // the latest first
  const RANK = { waiting: 0, error: 1, thinking: 2, executing: 2, replying: 2, done: 3 }
  function sorted(list) {
    return list.slice().sort((a, b) => (RANK[a.status] - RANK[b.status]) || (b.at - a.at))
  }

  // what the page draws: what the hook wrote, and, with example agents on,
  // theirs beside it -- never instead of it, so a real session is never
  // hidden by a sample
  function merge(real, demo) {
    const sessions = [...(Array.isArray(real?.sessions) ? real.sessions : []), ...(Array.isArray(demo?.sessions) ? demo.sessions : [])]
    return { ...(real || {}), sessions, demo: true }
  }

  // sample agents, for a first look and for the screenshot in the README
  function demo(now) {
    const m = 60e3
    const S = (agent, session, cwd, title, query, model, extra) => ({
      key: `${agent}|${session}`, agent, session, cwd, project: cwd.split("/").pop(), title, query, model,
      started: now - 50 * m, updated: now - 1000, turns: 3, steps: 14, tools: true, inflight: 0, inflightSince: 0, turn: "tool", ...extra,
    })
    return { v: 1, written: now, text: true, demo: true, sessions: [
      S("codex", "0199a1f2-demo-4c1e", "/Users/me/blog", "00 X 长文", "用 punk skill 生成文章封面", "gpt-6-astra",
        { updated: now - 28 * m, last: { at: now - 28 * m, outcome: "text", step: "X+1", text: "已用内置生图完成「方块世界」封面，三个工位分别呈现工作中、等审批、已完成。封面 PNG · 1600×900，已放进 assets/cover.png。" } }),
      S("codex", "0199a1f3-demo-77aa", "/Users/me/music", "自动修歌", "把副歌的节拍对齐到 120 BPM", "gpt-6-astra",
        { inflight: 1, inflightSince: now - 3000, last: { at: now - 9000, outcome: "tools", step: "shell · ffmpeg -i chorus.wav -filter:a atempo=1.04", text: "" } }),
      S("codex", "0199a1f4-demo-1b2c", "/Users/me/notes", "有价值的工具、思路、方法整理", "整理这周收藏的工具和思路", "gpt-6-astra",
        { updated: now - 40 * m, last: { at: now - 40 * m, outcome: "text", step: "", text: "整理好了：12 个工具、5 条思路，按「写作 / 编程 / 效率」分组写进 weekly.md。" } }),
      S("claude", "5f3c2a10-demo-oh-my-x", "/Users/me/oh-my-x", "oh-my-x", "给 CLI 加一个 --json 输出", "claude-opus-5",
        { last: { at: now - 4000, outcome: "tools", step: "Bash · bun test", text: "" } }),
      S("claude", "5f3c2a11-demo-topic", "/Users/me/x", "X 选题", "下周发什么？给我 5 个选题", "claude-sonnet-5",
        { last: { at: now - 2 * m, outcome: "ask", step: "", text: "我列了 5 个方向。你更想写工具测评，还是写自己的工作流？" } }),
      S("agy", "agy-demo-long", "/Users/me/blog", "00 X 长文", "把长文拆成 6 条推文", "gemini-3-pro",
        { inflight: 1, inflightSince: now - 20000, last: { at: now - 30000, outcome: "tools", step: "read_file · drafts/long.md", text: "" } }),
      S("agy", "agy-demo-ops", "/Users/me/x-ops", "X 运营", "看看昨天哪条推文表现最好", "gemini-3-flash",
        { last: { at: now - 3 * m, outcome: "tools", step: "browser · analytics.x.com", text: "" } }),
      S("gemini", "gem-demo-err", "/Users/me/site", "站点部署", "部署到 Cloudflare Pages", "gemini-3-pro",
        { last: { at: now - 6 * m, outcome: "error", step: "shell · wrangler pages deploy", text: "" } }),
    ] }
  }

  globalThis.AgentOfficeModel = { TEXT, STATUSES, COLORS, DEFAULTS, HIDE, BRANDS, LEGEND, text, fill, hash, brand, status, ago, duration, resume, agents, counts, sorted, demo, merge }
})()
