// Each agent's mark, as small SVG: the legend, the name tags and the card
// use them. Fixed markup only; an agent magpie has no mark for gets its
// initial (set with textContent by the caller). A classic script: it sets
// globalThis.AgentOfficeIcons.
(() => {
  const SVG = {
    claude: '<svg viewBox="0 0 24 24"><g fill="#d97757">' +
      Array.from({ length: 10 }, (_, i) => `<rect x="11" y="2" width="2.2" height="9" rx="1.1" transform="rotate(${i * 36} 12 12)"/>`).join("") +
      "</g></svg>",
    codex: '<svg viewBox="0 0 24 24"><defs><linearGradient id="cx" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a5b4fc"/><stop offset="1" stop-color="#4f46e5"/></linearGradient></defs>' +
      '<path d="M12 2.5c2.3 0 3.6 1.4 4.3 2.6 1.4.1 3.2.8 4 2.8.8 2-.1 3.7-.9 4.6.4 1.3.4 3.2-1.2 4.6-1.6 1.4-3.5 1.3-4.7.9-.8 1.1-2.4 2.2-4.5 1.9-2.2-.3-3.2-2-3.5-3.3-1.3-.4-3-1.4-3.4-3.5-.4-2.1.8-3.6 1.8-4.3-.1-1.4.4-3.2 2.2-4.2C9.9 3 11 2.5 12 2.5z" fill="url(#cx)"/>' +
      '<path d="M8.5 10l2.4 2-2.4 2M12.5 14.5h3" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    gemini: '<svg viewBox="0 0 24 24"><defs><linearGradient id="gm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1c7df0"/><stop offset=".5" stop-color="#8c63e8"/><stop offset="1" stop-color="#f5a623"/></linearGradient></defs>' +
      '<path d="M12 2c.6 5.2 4.8 9.4 10 10-5.2.6-9.4 4.8-10 10-.6-5.2-4.8-9.4-10-10C7.2 11.4 11.4 7.2 12 2z" fill="url(#gm)"/></svg>',
    grok: '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#111"/><path d="M6 18L18 6M9.5 6.5c-3 2.5-3.4 6.5-1 9M14.5 17.5c3-2.5 3.4-6.5 1-9" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
    antigravity: '<svg viewBox="0 0 24 24"><path d="M12 4c-2.2 0-3.4 4.6-5.2 9.8C6 16.2 4.8 19 4 20" stroke="#3b82f6" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M12 4c2.2 0 3.4 4.6 5.2 9.8.8 2.4 2 5.2 2.8 6.2" stroke="#ef4444" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M8.6 14.5c1.3-.8 5.5-.8 6.8 0" stroke="#f6b400" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>',
  }

  // an element with the agent's mark; each copy's gradients get ids of
  // their own, since a gradient whose first copy is hidden paints nothing
  let n = 0
  function mark(brand, size = 16) {
    const s = document.createElement("span")
    s.className = "mark"
    s.style.width = s.style.height = size + "px"
    const svg = SVG[brand.icon]
    if (svg) {
      const k = "m" + ++n
      s.innerHTML = svg.replace(/id="(\w+)"/g, `id="$1${k}"`).replace(/url\(#(\w+)\)/g, `url(#$1${k})`)
    }
    else {
      s.classList.add("letter")
      s.style.background = brand.color
      s.style.fontSize = Math.round(size * 0.62) + "px"
      s.textContent = String(brand.name || "?").trim().charAt(0).toUpperCase()
    }
    return s
  }

  globalThis.AgentOfficeIcons = { SVG, mark }
})()
