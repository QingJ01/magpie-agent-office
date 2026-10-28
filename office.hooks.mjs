// The gateway side of Agent Office: magpie calls onRequest before it routes
// each agent request, and onResponse once its reply is whole
// (docs/subsystems/gateway-request-hooks.md). It changes nothing: it returns
// no body, so every request goes on as it came. It only notes which session
// is at work and how its last reply ended, and writes that to page/live.js,
// a file beside the page that the page loads again every few seconds (the
// page has no network, but it may load its own files).
//
// What it writes stays on this computer, in the plugin's own folder: the
// agent, the session id, the folder's name, the model, the last thing asked
// and the start of the last answer (both off with {"text": false}), never a
// key, a header or a whole conversation.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createTracker } from "./lib/track.mjs"

const here = dirname(fileURLToPath(import.meta.url))
// the page's folder, where live.js goes; a test points this elsewhere so it
// never touches a real install's
const PAGE = process.env.MAGPIE_AGENT_OFFICE_PAGE || join(here, "page")
const LIVE = join(PAGE, "live.js")
const PREFIX = "globalThis.AgentOfficeLive = "

let tracker = null
let timer = null

function load(options) {
  const opts = { text: options?.text !== false, remote: options?.remote === true }
  if (tracker && tracker.options.text === opts.text && tracker.options.remote === opts.remote) return tracker
  const was = tracker
  tracker = createTracker(opts)
  if (was) {
    for (const [k, s] of was.sessions) tracker.sessions.set(k, s)
  } else {
    try {
      const src = readFileSync(LIVE, "utf8")
      if (src.startsWith(PREFIX)) tracker.restore(JSON.parse(src.slice(PREFIX.length).replace(/;\s*$/, "")), Date.now())
    } catch {}
  }
  return tracker
}

export function write() {
  timer = null
  if (!tracker) return
  try {
    mkdirSync(PAGE, { recursive: true })
    const tmp = LIVE + ".tmp"
    writeFileSync(tmp, PREFIX + JSON.stringify(tracker.snapshot(Date.now())) + ";\n")
    renameSync(tmp, LIVE)
  } catch {}
}

// a burst of requests (a tool loop) is one write
function soon() {
  if (timer) return
  timer = setTimeout(write, 250)
  timer.unref?.()
}

export async function onRequest(body, ctx) {
  const t = load(ctx.options)
  const key = t.request(body, ctx, Date.now())
  ctx.state.office = key
  if (key) soon()
  ctx.report?.("skipped")
  return undefined
}

export async function onResponse(reply, ctx) {
  if (!ctx.state?.office) return
  const t = load(ctx.options)
  if (t.response(reply, ctx, Date.now(), ctx.success === true)) soon()
}
