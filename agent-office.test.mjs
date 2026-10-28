import { afterAll, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createTracker, outcomeOf, replyOf, toolLine, turnOf } from "./lib/track.mjs"

const dir = import.meta.dir
const page = join(dir, "page")
const read = (f) => readFileSync(join(page, f), "utf8")
const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"))

// model.js is a classic script, as the page loads it
const scope = {}
new Function("globalThis", read("model.js"))(scope)
const M = scope.AgentOfficeModel

const ctx = (over = {}) => ({ origin: "local", protocol: "anthropic", agent: "claude", session: "s1", cwd: "/Users/me/oh-my-x", model: "claude-opus-5", query: "add --json", ...over })
const tools = [{ name: "Bash", input_schema: {} }]
const user = (text) => ({ model: "m", tools, messages: [{ role: "user", content: text }] })
const toolResult = { model: "m", tools, messages: [{ role: "user", content: "x" }, { role: "assistant", content: [{ type: "tool_use", id: "t", name: "Bash", input: {} }] }, { role: "user", content: [{ type: "tool_result", tool_use_id: "t", content: "ok" }] }] }
const said = (text) => ({ role: "assistant", content: [{ type: "text", text }], stop_reason: "end_turn" })
const called = (name, input) => ({ role: "assistant", content: [{ type: "text", text: "Running it." }, { type: "tool_use", id: "t", name, input }], stop_reason: "tool_use" })

test("a page magpie serves, with a gateway hook and no reads", () => {
  expect(pkg.name).toBe("magpie-agent-office")
  expect(pkg.main).toBeUndefined()
  expect(pkg.exports).toBeUndefined()
  expect(pkg.magpie.page.file).toBe("page/index.html")
  expect(pkg.magpie.page.icon).toBe("page/icon.svg")
  expect(pkg.magpie.hooks).toBe("./office.hooks.mjs")
  expect(pkg.magpie.permissions).toEqual([])
  const html = read("index.html")
  expect(html).toContain('<script src="_magpie/bridge.js"></script>')
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    expect(m[1]).toMatch(/\ssrc="/)
    expect(m[2].trim()).toBe("")
  }
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (m[1].startsWith("_magpie/")) continue
    expect(m[1]).not.toMatch(/^(?:[a-z]+:|\/|\.\.)/i)
    expect(readdirSync(page)).toContain(m[1])
  }
  // every file the page loads ships in the package
  // every file the page loads ships in the package
  for (const f of ["index.html", "style.css", "model.js", "icons.js", "scene.js", "app.js", "icon.svg"]) {
    expect(pkg.files).toContain(`page/${f}`)
  }
  // installable from git: the manifest is at the repo's root, which is how
  // magpie finds a plugin in a repository
  expect(pkg.files).toContain("office.hooks.mjs")
  expect(pkg.files).toContain("lib")
})

test("the page reads nothing of magpie's and reaches no network", () => {
  for (const f of readdirSync(page).filter((f) => f.endsWith(".js") && f !== "live.js")) {
    const src = read(f)
    expect(src).not.toMatch(/magpie\.read\(/)
    expect(src).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|importScripts|new Worker/)
  }
  // the one script it adds is its own live.js, by a relative path
  expect(read("app.js")).toMatch(/s\.src = "live\.js\?t=" \+ Date\.now\(\)/)
})

test("the hook changes no request", async () => {
  // its own folder: a test must not write over a real install's live.js
  const out = mkdtempSync(join(tmpdir(), "agent-office-"))
  process.env.MAGPIE_AGENT_OFFICE_PAGE = out
  const hook = await import("./office.hooks.mjs")
  const c = { ...ctx(), options: { text: true }, state: {}, report() {} }
  expect(await hook.onRequest(user("hi"), c)).toBeUndefined()
  await hook.onResponse(said("Done."), { ...c, success: true })
  hook.write()
  const live = readFileSync(join(out, "live.js"), "utf8")
  expect(live.startsWith("globalThis.AgentOfficeLive = ")).toBe(true)
  const snap = JSON.parse(live.slice("globalThis.AgentOfficeLive = ".length).replace(/;\s*$/, ""))
  expect(snap.sessions.find((s) => s.key === "claude|s1").last.outcome).toBe("text")
  // nothing of the request but what the page shows
  expect(live).not.toMatch(/authorization|x-api-key/i)
})
afterAll(() => {
  if (process.env.MAGPIE_AGENT_OFFICE_PAGE) rmSync(process.env.MAGPIE_AGENT_OFFICE_PAGE, { recursive: true, force: true })
})

test("what a request answers: the user or a tool", () => {
  expect(turnOf(user("hi"), "anthropic")).toBe("user")
  expect(turnOf(toolResult, "anthropic")).toBe("tool")
  expect(turnOf({ messages: [{ role: "user", content: "x" }, { role: "tool", content: "ok" }] }, "chat")).toBe("tool")
  expect(turnOf({ input: [{ type: "message", role: "user", content: "x" }, { type: "function_call_output", output: "ok" }] }, "responses")).toBe("tool")
  expect(turnOf({ input: "x" }, "responses")).toBe("user")
  expect(turnOf({ contents: [{ role: "user", parts: [{ functionResponse: { name: "f" } }] }] }, "gemini")).toBe("tool")
})

test("how a reply ended, in each API", () => {
  expect(replyOf(called("Bash", { command: "bun test" }), "anthropic")).toEqual({ text: "Running it.", tools: [{ name: "Bash", line: "Bash · bun test" }] })
  const chat = { choices: [{ message: { content: "ok", tool_calls: [{ function: { name: "read_file", arguments: '{"path":"a.md"}' } }] } }] }
  expect(replyOf(chat, "chat").tools[0].line).toBe("read_file · a.md")
  const resp = { output: [{ type: "message", content: [{ type: "output_text", text: "Which one?" }] }] }
  expect(outcomeOf(replyOf(resp, "responses"))).toBe("ask")
  expect(outcomeOf(replyOf({ response: { output: [{ type: "function_call", name: "shell", arguments: '{"command":["ls"]}' }] } }, "responses"))).toBe("tools")
  expect(outcomeOf(replyOf(called("AskUserQuestion", { question: "A or B" }), "anthropic"))).toBe("ask")
  expect(outcomeOf(replyOf(said("All done."), "anthropic"))).toBe("text")
  expect(outcomeOf(replyOf(said("你想要哪种风格？"), "anthropic"))).toBe("ask")
  expect(toolLine("Edit", { file_path: "/a/b.ts" })).toBe("Edit · /a/b.ts")
})

test("a session's life: thinking, executing, waiting, done, error", () => {
  const t = createTracker()
  let now = 1_000_000
  t.request(user("add --json"), ctx(), now)
  let s = t.sessions.get("claude|s1")
  expect(M.status(s, now + 1000)).toBe("thinking")
  expect(M.status(s, now + 9000)).toBe("replying")
  t.response(called("Bash", { command: "bun test" }), ctx(), now += 5000, true)
  expect(M.status(s, now + 1000)).toBe("executing")
  // tools out this long: likely waiting for the user's approval
  expect(M.status(s, now + 120_000)).toBe("waiting")
  t.request(toolResult, ctx(), now += 3000)
  expect(s.steps).toBe(1)
  expect(s.turns).toBe(1)
  t.response(said("Added --json. Want me to also add --yaml?"), ctx(), now += 2000, true)
  expect(M.status(s, now)).toBe("waiting")
  t.request(user("no thanks"), ctx({ query: "no thanks" }), now += 60_000)
  t.response(said("Okay."), ctx(), now += 1000, true)
  expect(M.status(s, now)).toBe("done")
  expect(s.title).toBe("add --json")
  expect(s.query).toBe("no thanks")
  expect(s.turns).toBe(2)
  t.request(user("deploy"), ctx({ query: "deploy" }), now += 1000)
  t.response(null, ctx(), now += 1000, false)
  expect(M.status(s, now)).toBe("error")
})

test("side requests, other computers and quiet mode", () => {
  const t = createTracker({ text: false })
  t.request(user("hi"), ctx(), 1)
  // a title request without tools, of a session that has them: not its work
  expect(t.request({ model: "haiku", messages: [{ role: "user", content: "title this" }] }, ctx(), 2)).toBeNull()
  expect(t.sessions.get("claude|s1").inflight).toBe(1)
  // another computer's requests are left out unless asked for
  expect(t.request(user("hi"), ctx({ origin: "remote", session: "s2" }), 3)).toBeNull()
  expect(createTracker({ remote: true }).request(user("hi"), ctx({ origin: "remote" }), 3)).toBe("claude|s1")
  // text off: statuses only
  t.response(said("secret answer?"), ctx(), 4, true)
  const s = t.sessions.get("claude|s1")
  expect(s.query).toBe("")
  expect(s.last.text).toBe("")
  expect(s.last.outcome).toBe("ask")
})

test("a request lost, and the host restarted", () => {
  const t = createTracker()
  t.request(user("hi"), ctx(), 0)
  expect(M.status(t.snapshot(16 * 60_000).sessions[0], 16 * 60_000)).toBe("error")
  const u = createTracker()
  u.request(user("hi"), ctx(), 0)
  const v = createTracker()
  v.restore(JSON.parse(JSON.stringify(u.snapshot(1))), 2)
  expect(v.sessions.get("claude|s1").inflight).toBe(0)
})

test("the office's agents: who shows, the counts, resume commands", () => {
  const now = 10_000_000
  const snap = M.demo(now)
  const list = M.agents(snap, now)
  expect(list.length).toBe(8)
  const c = M.counts(list)
  // two waiting, one failed: three need you
  expect(c).toEqual({ needYou: 3, working: 3, done: 2 })
  expect(list.find((a) => a.title === "X 运营").status).toBe("waiting")
  expect(list.find((a) => a.title === "X 选题").status).toBe("waiting")
  expect(list.find((a) => a.agent === "gemini").status).toBe("error")
  expect(M.agents(snap, now, { showDone: false }).length).toBe(6)
  // a done one leaves the office after hideAfter
  expect(M.agents(snap, now + 7 * 3600e3, { hideAfter: "6h" }).every((a) => a.status !== "done")).toBe(true)
  expect(M.sorted(list)[0].status).toBe("waiting")
  expect(M.resume({ agent: "claude", session: "abc", cwd: "/a b" })).toBe("cd '/a b' && claude --resume abc")
  expect(M.resume({ agent: "codex", session: "019a" })).toBe("codex resume 019a")
  expect(M.resume({ agent: "unknown", session: "x" })).toBe("")
  expect(M.brand("claude").name).toBe("Claude")
  expect(M.brand("my-agent").name).toBe("my-agent")
})

test("a step that has run long is probably an approval prompt", () => {
  const now = 10_000_000
  const snap = { sessions: [{ key: "claude|s", agent: "claude", session: "s", cwd: "/a", project: "a", title: "t", query: "q",
    model: "m", started: now - 600e3, updated: now - 400e3, turns: 1, steps: 2, inflight: 0, inflightSince: 0,
    last: { at: now - 400e3, outcome: "tools", text: "", step: "shell · bun test" } }] }
  const [a] = M.agents(snap, now)
  expect(a.status).toBe("waiting")
  expect(a.hint).toBe("approval")
  expect(a.since).toBe(400e3)
  expect(M.duration(a.since, "zh")).toBe("6分40秒")
  expect(M.duration(45e3, "en")).toBe("45s")
  expect(M.duration(130e3, "en")).toBe("2m 10s")
  // a question is waiting too, but nothing to approve
  const asked = { sessions: [{ ...snap.sessions[0], last: { at: now - 1000, outcome: "ask", text: "A or B?", step: "" } }] }
  expect(M.agents(asked, now)[0].hint).toBe("")
})

test("example agents sit beside real ones, never instead of them", () => {
  const now = 10_000_000
  const real = { v: 1, written: now, text: true, sessions: [{ key: "claude|real", agent: "claude", session: "real", cwd: "/r", project: "r",
    title: "real work", query: "q", model: "m", started: now - 1000, updated: now, turns: 1, steps: 0, inflight: 1, inflightSince: now - 500, last: null }] }
  const demo = M.demo(now)
  const both = M.merge(real, demo)
  expect(both.sessions.length).toBe(real.sessions.length + demo.sessions.length)
  expect(both.sessions[0].key).toBe("claude|real")
  expect(M.agents(both, now).some((a) => a.title === "real work")).toBe(true)
  // nothing real yet: the examples alone
  expect(M.merge(null, demo).sessions.length).toBe(demo.sessions.length)
})

test("words, in English and Chinese", () => {
  expect(M.text("zh-CN").title).toBe("我的 Agent 在干嘛")
  expect(M.text("en").waiting).toBe("Waiting for you")
  expect(Object.keys(M.TEXT.zh).sort()).toEqual(Object.keys(M.TEXT.en).sort())
  expect(M.ago(28 * 60e3, "zh")).toBe("28分钟前")
  expect(M.ago(3000, "en")).toBe("just now")
  for (const e of read("index.html").matchAll(/data-t="([^"]+)"/g)) expect(M.TEXT.en[e[1]]).toBeDefined()
})

test("live.js is no file of the package's, and the tests keep their own", () => {
  expect(pkg.files).not.toContain("page")
  expect(pkg.files.some((f) => f.includes("live"))).toBe(false)
  // the hook's folder, overridable, so no test writes over a real install's
  expect(readFileSync(join(dir, "office.hooks.mjs"), "utf8")).toContain("process.env.MAGPIE_AGENT_OFFICE_PAGE")
  expect(existsSync(join(dir, ".gitignore")) && readFileSync(join(dir, ".gitignore"), "utf8")).toContain("page/live.js")
})
