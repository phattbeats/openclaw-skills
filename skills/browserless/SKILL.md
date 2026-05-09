---
name: browserless
description: Full browser automation reference for direct CDP/Browserless access. Use when describing or implementing browser automation capabilities without OpenClaw, or when needing a comprehensive list of browser actions. Triggers on: "browserless skill", "what can a browser do", "browser automation capabilities", "CDP browser", "headless browser actions", or when asked to document what browserless can do.
---

# Browserless + FlareSolverr — Full Capability Reference

This skill documents everything possible with a headless Chromium browser via CDP (Chrome DevTools Protocol) / Browserless, and FlareSolverr for Cloudflare bypass. Use this when building automation, documenting capabilities, or querying what browser actions are available.

---

## Connection

### Browserless CDP

**PHATT-RAID browserless** is running at `http://10.0.0.100:3000` (CDP WebSocket: `ws://10.0.0.100:3000`). Connect via OpenClaw's browser tool with `profile="browserless"` — it handles session management automatically.

Alternative: run Chromium locally with remote debugging:
```bash
chromium --headless --remote-debugging-port=9222
# then connect to ws://127.0.0.1:9222
```

### FlareSolverr (Cloudflare Bypass)

**FlareSolverr v3.4.6** is running at `http://10.0.0.100:8191`. Use it to bypass JavaScript challenge protection (Cloudflare, PerimeterX, etc.) before scraping.

**API endpoint:** `POST http://10.0.0.100:8191/v1`
**Headers:** `Content-Type: application/json`

```bash
curl -s -X POST http://10.0.0.100:8191/v1   -H "Content-Type: application/json"   -d '{"cmd":"request.get","url":"https://target-site.com","maxTimeout":60000}'
```

**Response structure:**
```json
{
  "status": "ok",
  "solution": {
    "url": "https://target-site.com/page",
    "status": 200,
    "cookies": [{"name": "cf_clearance", "value": "...", "domain": ".target-site.com", ...}],
    "userAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ...",
    "headers": {"Content-Type": "text/html"},
    "response": "<html>...</html>"
  }
}
```

**When to use FlareSolverr vs. browserless:**
- FlareSolverr: Static HTML pages behind Cloudflare challenges. Fast, no browser overhead.
- Browserless: Dynamic pages, interactive JavaScript, multi-step sessions, tab management.
- Stack them: Get cookies + UA from FlareSolverr, then pass to browserless session via CDP for full interaction.

**Recommended stack:**
1. **FlareSolverr** → get clearance cookies + UA
2. **Browserless CDP** → set cookies via `Network.setCookie`, navigate as normal user
3. **Result:** Full browser session that clears Cloudflare without triggering challenges

---

## Navigation

| Action | CDP / Playwright | Notes |
|---|---|---|
| Open URL | `Page.navigate` | Full page load |
| Go back | `Page.goBack` | Browser history |
| Go forward | `Page.goForward` | Browser history |
| Reload | `Page.reload` | Cache-aware reload |

**Stealth flags** (set before navigation):
- `Emulation.setUserAgentOverride` — custom UA string
- `Emulation.setDeviceMetricsOverride` — viewport, mobile sim
- `Network.setCookie` — pre-set auth cookies

---

## Page State

| Action | CDP / Playwright | Notes |
|---|---|---|
| Get full HTML | `Page.getContent` | Raw DOM as string |
| Get computed style | `CSS.getComputedStyle` | Element styling |
| Get all resources | `Page.getResourceTree` | Frames, iframes, assets |
| Get resource content | `Page.getResourceContent` | JS/CSS/images |
| Get viewport screenshot | `Page.captureScreenshot` | PNG bytes |
| Full-page screenshot | same | Scroll + stitch |
| Element screenshot | `Element.screenshot` | Single element |

**Screenshot options:**
- `format`: `png` (default) or `jpeg` (quality可控)
- `quality`: 0–100 for jpeg
- `clip`: `{x, y, width, height}` for partial capture
- `fromSurface`: `true` = capture what GPU renders (ignores viewport)

---

## Content Extraction

| Action | CDP / Playwright | Notes |
|---|---|---|
| DOM snapshot | `Page.captureSnapshot` | Flat text + accessibility tree |
| Accessibility tree | `Accessibility.getFullAXTree` | Full a11y tree |
| Live DOM query | `Runtime.evaluate` | `document.querySelectorAll()` |
| Box model | `DOM.getBoxModel` | Element dimensions + padding/border/margin |
| Scroll position | `Runtime.evaluate` | `window.scrollX`, `window.scrollY` |

**Live DOM access (evaluate JavaScript):**
```javascript
// Anything you can do in browser console, you can do via CDP
Runtime.evaluate({
  expression: `document.querySelector('#main').textContent`,
  returnByValue: true
})

// Multi-step: get links
Runtime.evaluate({
  expression: `[...document.querySelectorAll('a')].map(a => ({text: a.textContent, href: a.href}))`,
  returnByValue: true
})
```

---

## User Interactions

| Action | CDP / Playwright | Notes |
|---|---|---|
| Click | `Input.dispatchMouseEvent` (type=clicked) | x/y from box model |
| Double-click | `Input.dispatchMouseEvent` (type=doubleClicked) | |
| Right-click | `Input.dispatchMouseEvent` (type=rightClicked) | Context menu |
| Hover | `Input.dispatchMouseEvent` (type=mouseMoved) | |
| Drag | `Input.dispatchMouseEvent` (series) | mousedown + moves + mouseup |
| Type text | `Input.insertText` | Raw text, no keyboard events |
| Key press | `Input.dispatchKeyEvent` | keyDown + keyUp |
| Press Enter/Tab | `Input.dispatchKeyEvent` | key: "Enter", "Tab" |
| Scroll element | `Element.scrollIntoViewIfNeeded` | Bring into view |
| Scroll page | `Input.dispatchMouseEvent` + wheel | Page-level scroll |
| Select dropdown | `Element.select` | `<select>` only |
| Check checkbox | Click | Toggle checked state |
| File upload | `DOM.setFileInputFiles` | Set files on `<input type=file>` |

**Click coordinates from box model:**
```
box = DOM.getBoxModel({nodeId})
center_x = (box.content[0].x + box.content[2].x) / 2
center_y = (box.content[0].y + box.content[3].y) / 2
Input.dispatchMouseEvent({type: 'mousePressed', x: cx, y: cy, button: 'left'})
Input.dispatchMouseEvent({type: 'mouseReleased', x: cx, y: cy, button: 'left'})
```

---

## Network Interception

| Action | CDP | Notes |
|---|---|---|
| Capture all requests | `Network.setRequestInterception` | See every resource |
| Block URL | `Network.addInterception` with abort | Block ads, trackers |
| Mock response | `Fetch.takePendingInterception` | Return fake data |
| Get response body | `Network.getResponseBody` | After request completes |
| Get request body | `Network.getRequestPostData` | POST data sent |
| Set header | `Network.setExtraHTTPHeaders` | Add/override headers |
| Auth credentials | `Network.setAuthCredentials` | For basic/digest auth |

**Block resources:**
```javascript
Network.setRequestInterception({patterns: [
  {urlPattern: '*://*.doubleclick.net/*', resourceType: 'image', interception: 'abort'},
  {urlPattern: '*://*.google-analytics.com/*', resourceType: 'script', interception: 'abort'},
  {urlPattern: '*.css', resourceType: 'stylesheet', interception: 'abort'},
]})
```

**Mock API response:**
```javascript
Fetch.enable()
Fetch.requestPaused(async (e) => {
  if (e.request.url.includes('/api/')) {
    Fetch.fulfillRequest({requestId: e.requestId, response: {
      status: 200,
      body: JSON.stringify({mocked: true, data: [1,2,3]}),
      headers: {'Content-Type': 'application/json'}
    }})
  } else {
    Fetch.continueRequest({requestId: e.requestId})
  }
})
```

---

## State & Storage

| Action | CDP / Playwright | Notes |
|---|---|---|
| Get cookies | `Network.getAllCookies` | All cookies |
| Get cookies for URL | `Network.getCookies` | Scope to domain |
| Set cookie | `Network.setCookie` | Persistent cookie |
| Delete cookie | `Network.deleteCookies` | By name + domain |
| localStorage get | `Storage.getOriginStorageKey` | |
| localStorage set | `Storage.setLocalStorage` | |
| sessionStorage | `Storage.getSessionStorageMetadata` | |
| Clear all storage | `Storage.clearData` | Cookies, cache, storage |

---

## Authentication & Sessions

| Action | CDP / Playwright | Notes |
|---|---|---|
| Set cookies for auth | `Network.setCookie` | Pre-login state |
| Inject auth token | `Runtime.evaluate` | `localStorage.setItem('token', ...)` |
| Get current URL | `Page.getFrameTree` | Check if logged in |
| Wait for nav after login | `Page.setLifecycleEvent` | Listen for `networkidle` |
| Take screenshot on auth | Screenshot | Verify login state |

**Login flow example:**
```javascript
// 1. Navigate to login page
Page.navigate({url: 'https://example.com/login'})

// 2. Wait for form
await waitSelector('#username')

// 3. Fill and submit
Input.insertText({text: 'user@example.com'})  // click field first
Runtime.evaluate({expression: "document.querySelector('#username').value='user@example.com'"})
Runtime.evaluate({expression: "document.querySelector('#password').value='secret'"})
Runtime.evaluate({expression: "document.querySelector('form').submit()"})

// 4. Wait for post-login state
Page.setLifecycleEvent({enabled: true})
// or: Network.waitForIdle()
```

---

## Form Handling

| Action | CDP / Playwright | Notes |
|---|---|---|
| Focus element | `Runtime.evaluate` | `el.focus()` |
| Fill text input | Direct value injection | `el.value = 'text'` then `input` event |
| Clear input | `Element.setAttribute` | `el.value = ''` then events |
| Check/Select radio | `Input.dispatchMouseEvent` | Click the radio |
| Check checkbox | Click or `Element.setAttribute` | `checked=true` |
| Select option | `Element.select` | For `<select>` |
| Trigger validation | `Runtime.evaluate` | `el.reportValidity()` |
| Get form values | `Runtime.evaluate` | `Object.fromEntries(new FormData(form))` |

**Robust fill:**
```javascript
Runtime.evaluate({expression: `
  const el = document.querySelector('#input');
  el.focus();
  el.value = 'text';
  el.dispatchEvent(new Event('input', {bubbles: true}));
  el.dispatchEvent(new Event('change', {bubbles: true}));
`})
```

---

## Waiting & Timing

| Action | CDP / Playwright | Notes |
|---|---|---|
| Wait for selector | `Runtime.callFunctionOn` polling | `document.querySelector()` loop |
| Wait for element gone | `DOM.observe` + removal event | |
| Wait for network idle | `Page.setLifecycleEvent` | `networkidle` event |
| Wait for navigation | `Page.setLifecycleEvent` | `load` or `DOMContentLoaded` |
| Wait for response | `Fetch.requestPaused` | Intercept + continue |
| Wait for timeout | `Browser.w` or manual | `setTimeout` equivalent |
| Wait for JS condition | `Runtime.evaluate` with polling | `waitUntil condition is true` |

**Wait for selector:**
```javascript
async function waitForSelector(selector, timeout = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const result = Runtime.evaluate({
      expression: `document.querySelector('${selector}')`,
      returnByValue: true
    })
    if (result.result.value) return result.result.value
    await new Promise(r => setTimeout(r, 200))
  }
  throw new Error(`Timeout waiting for ${selector}`)
}
```

---

## JavaScript Injection

| Use Case | CDP | Notes |
|---|---|---|
| Read DOM | `Runtime.evaluate` | Any JS expression |
| Modify DOM | `Runtime.evaluate` | `el.textContent = '...'`, `el.classList.add(...)` |
| Add script tag | `Page.addScriptTag` | Inject JS into page |
| Add style tag | `Page.addStyleTag` | Inject CSS |
| Remove elements | `Runtime.evaluate` | `el.remove()` |
| Trigger custom event | `Runtime.evaluate` | `el.dispatchEvent(new Event('custom'))` |
| Scroll | `Runtime.evaluate` | `window.scrollTo(x, y)`, `el.scrollIntoView()` |
| Get scroll position | `Runtime.evaluate` | `window.scrollX`, `window.scrollY` |
| Read computed style | `Runtime.evaluate` | `getComputedStyle(el)` |

---

## Device & Environment Emulation

| Action | CDP | Notes |
|---|---|---|
| Set viewport | `Emulation.setDeviceMetricsOverride` | 375×812 for iPhone |
| Set UA | `Emulation.setUserAgentOverride` | Spoof browser |
| Set timezone | `Emulation.setTimezoneOverride` | `America/New_York` |
| Set locale | `Emulation.setLocaleOverride` | `en-US` |
| Set geolocation | `Emulation.setGeolocationOverride` | `lat, long, accuracy` |
| Dark mode | `Emulation.setEmulatedMedia` | `prefers-color-scheme: dark` |
| Block fonts | `Network.setExtraHTTPHeaders` | Block font files |
| Slow GPU | `Rendering.setHardwareConcurrency` | Simulate slow device |

**Mobile emulation:**
```javascript
Emulation.setDeviceMetricsOverride({
  width: 390,          // iPhone 14 width
  height: 844,
  deviceScaleFactor: 3,
  mobile: true
})
Emulation.setTouchEmulationEnabled({enabled: true, maxTouchPoints: 1})
```

---

## Performance & Debugging

| Action | CDP | Notes |
|---|---|---|
| Console messages | `Log.enable` + `Log.entryAdded` | See browser console |
| Page errors | `Runtime.exceptionThrown` | JS exceptions |
| Network log | `Network.enable` + events | All HTTP traffic |
| Request timing | `Network.getRecordingExtendedEvents` | Waterfall timing |
| Memory profile | `Memory.getDOMCounters` | Nodes, listeners, JS heap |
| CPU profile | `Performance.enable` | Not in headless default |
| JS coverage | `Profiler.enable` | Code coverage |
| Autoplay block | `Media.enable` | Block video autoplay |

**Capture console:**
```javascript
Log.enable()
Browser.on('Log.entryAdded', (entry) => {
  console.log(`[${entry.level}] ${entry.text}`)
})
```

**Block resource types:**
```javascript
Network.setRequestInterception({patterns: [
  {resourceType: 'image', interception: 'abort'},
  {resourceType: 'stylesheet', interception: 'abort'},
  {resourceType: 'font', interception: 'abort'},
  // Only let: document, script, xhr, fetch, websocket through
]})
```

---

## Download & File Handling

| Action | CDP | Notes |
|---|---|---|
| Trigger download | Navigate or click | Browser initiates download |
| Capture download | `Browser.setDownloadBehavior` | Save to path |
| Get download URL | `Fetch.fulfillRequest` | Serve fake file |
| Upload file | `DOM.setFileInputFiles` | Pre-set file on input |
| Read file | Not via CDP | Use fs in Node after capture |
| Intercept blob | `Page.setDownloadWillUse` | Redirect blob URL |

---

## Multi-Tab / Multi-Frame

| Action | CDP | Notes |
|---|---|---|
| List tabs | `Target.getTargets` | All pages + iframes |
| Open new tab | `Target.createTarget` | `url=about:blank` |
| Switch tab | `Target.activateTarget` | By targetID |
| Close tab | `Target.closeTarget` | By targetID |
| Get iframe document | `Frame.getDocument` | Per frame ID |
| Navigate iframe | `Frame.navigate` | Inject into iframe |
| Cross-origin access | Not allowed | CDP enforces origin |

**Multi-tab workflow:**
```javascript
// Create new tab
const {targetId} = await Target.createTarget({url: 'about:blank'})

// Activate it
await Target.activateTarget({targetId})

// Navigate in new tab
Page.navigate({url: 'https://example.com', targetId})

// Switch back
Target.activateTarget({targetId: originalTabId})
```

---

## PDF Generation

| Action | CDP | Notes |
|---|---|---|
| Capture as PDF | `Page.printToPDF` | Full page, no screenshot limit |
| PDF options | | landscape, margin, scale, paperWidth/Height |
| Save PDF | Write to file | Node `fs.writeFile` from buffer |

**PDF options:**
```javascript
Page.printToPDF({
  printBackground: true,        // Include CSS backgrounds
  landscape: false,
  paperWidth: 8.5,              // inches
  paperHeight: 11,
  marginTop: 0.5,
  marginBottom: 0.5,
  scale: 1.0,
})
```

---

## Advanced Actions

| Action | CDP | Notes |
|---|---|---|
| Drag element | `Input.dispatchDragEvent` series | dragstart, dragover, drop |
| Hover menu | `Input.dispatchMouseEvent` | Move to element, wait, click |
| Type with delay | Loop + `Input.insertText` + wait | Simulate real typing |
| Accessibility check | `Accessibility.queryAXTree` | Audit a11y |
| CSS coverage | `CSS.startRuleUsageTracking` | See which CSS is used |
| JS profiling | `Profiler.start` / `stop` | CPU analysis |
| Heap snapshot | `HeapProfiler.takeHeapSnapshot` | Memory analysis |

---

## Error Handling

| Scenario | Handling | |
|---|---|---|
| Navigation timeout | Catch, retry with longer timeout | |
| Element not found | Wait + retry loop with selector polling | |
| Stale element ref | Re-query DOM, get fresh target | |
| CORS blocked | Proxy requests or use `Fetch` mock | |
| SSL cert error | `--ignore-certificate-errors` flag | |
| CAPTCHA | Cannot solve programmatically; may need service | |
| Headless detected | Set realistic UA + viewport + webgl vendor | |
| Rate limited | Wait + retry with backoff; reduce concurrency | |

---

## Quick Reference: Common Tasks

| Task | One-liner approach |
|---|---|
| Get page title | `Runtime.evaluate({expression: 'document.title', returnByValue: true})` |
| Get all links | `Runtime.evaluate({expression: '[...document.links].map(l=>l.href)', returnByValue: true})` |
| Get form values | `Runtime.evaluate({expression: '[...new FormData(document.querySelector("form"))]', returnByValue: true})` |
| Screenshot page | `Page.captureScreenshot({format: 'png'})` |
| Click by text | `Runtime.evaluate({expression: "document.querySelector('button')?.click()"})` |
| Scroll to bottom | `Runtime.evaluate({expression: 'window.scrollTo(0, document.body.scrollHeight)'})` |
| Get computed color | `Runtime.evaluate({expression: "getComputedStyle(document.body).backgroundColor"})` |
| Detect if page loaded | `Runtime.evaluate({expression: 'document.readyState'})` |
| Wait for network | `Page.setLifecycleEvent({enabled: true})` and listen for `networkidle` |
| Fill + submit form | Direct DOM manipulation + `form.submit()` |
| Pre-login cookie | `Network.setCookie({url: 'https://...', name: 'session', value: '...'})` |

---

## Playwright Equivalents (if using Playwright on top of CDP)

If building on Playwright rather than raw CDP:

```javascript
const { chromium } = require('playwright')
const browser = await chromium.connect({wsEndpoint: 'wss://chrome.browserless.io?token=...'})

// Playwright wraps all the above with cleaner APIs:
await page.goto(url)
await page.fill('#input', 'text')
await page.click('button')
await page.screenshot({path: 'screenshot.png', fullPage: true})
const content = await page.content()  // full HTML
const text = await page.innerText('body')
const hrefs = await page.$$eval('a', els => els.map(e => e.href))
await page.selectOption('select', 'value')  // dropdown
await page.type('input', 'slowly', {delay: 100})  // realistic typing
```

Playwright additionally provides:
- Auto-waiting (actions wait for elements to be actionable)
- Smart retries (flaky action retries)
- Web-first element queries
- Built-in waitForNavigation, waitForResponse, waitForSelector
- request interception made simple via `page.route()`

---

## Limitations

| Limitation | Workaround |
|---|---|
| Cross-origin iframe access | Cannot read — communicate via `postMessage` |
| Browser extensions | Not available in headless |
| PDF links (print dialog) | Use `Page.printToPDF` instead |
| File download dialog | Use `Browser.setDownloadBehavior` to auto-save |
| Some SPAs (client routing) | `waitForSelector` on dynamic content |
| Headless detection | Set realistic UA, viewport, disable webgl |
| CAPTCHAs | Cannot solve; external service may be needed |
| Audio/video playback | Limited; `page.evaluate` to control players |
| WebSocket intercept | `Network.webSocketHandshake` events |
| OAuth callbacks | Open popup, intercept navigation to callback URL |
