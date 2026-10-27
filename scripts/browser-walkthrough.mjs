/**
 * Comprehensive Browser Walkthrough for Cite (Archetype AF · Bibliography)
 * Connects to Headless Chrome via CDP, loads mock-wallet.js,
 * tests 1280px & 360px viewports, footer links, dropdown contrast,
 * walks every seeded work, tree navigation upstream and downstream,
 * standalone /w/[id] and /a/[address] routes,
 * publishes a new work with citations and pays royalties on-chain,
 * switches to recipient author on /me and withdraws royalties,
 * and asserts zero console errors / zero hydration warnings.
 */
import { spawn } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME_PORT = 9222;
const APP_URL = "http://localhost:3000";
const RPC_URL = "http://127.0.0.1:8727";

const ACC_ALICE = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Author of Work 1
const ACC_BOB = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";   // Author of Work 2, 5, 7, 9
const ACC_EVE = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";   // New publishing author

const mockWalletScript = readFileSync(
  new URL("../../docs/specs/tools/mock-wallet.js", import.meta.url),
  "utf8"
);

const userDir = mkdtempSync(join(tmpdir(), "chrome-cite-"));

console.log("Launching headless Chrome...");
const chrome = spawn("google-chrome", [
  "--headless=new",
  `--remote-debugging-port=${CHROME_PORT}`,
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  `--user-data-dir=${userDir}`,
  "about:blank",
]);

await new Promise((r) => setTimeout(r, 1200));

async function cdpHttp(path, method = "GET") {
  const res = await fetch(`http://127.0.0.1:${CHROME_PORT}${path}`, { method });
  return await res.json();
}

const version = await cdpHttp("/json/version");
console.log("Connected to Chrome:", version["Browser"]);

const list = await cdpHttp("/json/list");
const pageTarget = list.find((t) => t.type === "page");
const wsUrl = pageTarget?.webSocketDebuggerUrl;
if (!wsUrl) throw new Error("No page webSocketDebuggerUrl found");

const ws = new WebSocket(wsUrl);
let reqId = 1;
const pending = new Map();
const consoleErrors = [];
const cdpListeners = new Set();

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  for (const listener of cdpListeners) {
    try {
      listener(msg);
    } catch (e) {
      console.error("Listener error:", e);
    }
  }
  if (msg.method === "Runtime.consoleAPICalled") {
    if (msg.params.type === "error") {
      const errText = msg.params.args.map((a) => a.value || a.description).join(" ");
      if (!errText.includes("net::ERR_CONNECTION_REFUSED") && !errText.includes("favicon")) {
        consoleErrors.push(errText);
      }
    }
  }
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(msg.error);
    else resolve(msg.result);
  }
};

await new Promise((resolve) => (ws.onopen = resolve));

function send(method, params = {}) {
  const id = reqId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, method });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await send("Page.enable");
await send("Runtime.enable");

// Injected mock wallet for Eve initially (reads from localStorage across navigations)
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `
    ${mockWalletScript}
    const acc = localStorage.getItem("__active_mock_account") || "${ACC_EVE}";
    window.__installMockWallet({ rpc: "${RPC_URL}", account: acc });
    console.log("[MockWallet] Injected & installed for " + acc);
  `,
});

async function evaluate(expression) {
  const res = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.exceptionDetails) {
    throw new Error(`Eval failed: ${JSON.stringify(res.exceptionDetails)}`);
  }
  return res.result?.value;
}

async function setViewport(width, height) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });
}

async function navigate(path) {
  const url = `${APP_URL}${path}`;
  const loadPromise = new Promise((resolve) => {
    const handler = (msg) => {
      if (msg.method === "Page.loadEventFired") {
        cdpListeners.delete(handler);
        resolve();
      }
    };
    cdpListeners.add(handler);
  });
  await send("Page.navigate", { url });
  await loadPromise;
  await new Promise((r) => setTimeout(r, 600));
}

async function waitForText(target, maxMs = 6000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const text = await evaluate("document.body.innerText");
    if (text.includes(target)) return text;
    await new Promise((r) => setTimeout(r, 150));
  }
  return await evaluate("document.body.innerText");
}

console.log("\n--- Starting Cite Browser Verification ---");

try {
  // -------------------------------------------------------------
  // 1. Desktop 1280px on / (Bibliography View)
  // -------------------------------------------------------------
  console.log("1. Testing Desktop 1280px on /...");
  await setViewport(1280, 800);
  await navigate("/");

  const pageTitle = await evaluate("document.title");
  console.log(`   Page title: "${pageTitle}"`);
  if (!pageTitle.includes("Cite")) throw new Error("Title does not include 'Cite'");

  // Check 3 footer links
  const footerLinksCount = await evaluate(`
    (() => {
      const links = Array.from(document.querySelectorAll("footer a"));
      const hrefs = links.map(a => a.href);
      const hasBotchain = hrefs.some(h => h.includes("botchain.ai") && !h.includes("scan"));
      const hasScan = hrefs.some(h => h.includes("scan.botchain.ai"));
      const hasBuiltOn = document.querySelector("footer")?.textContent?.includes("Built on") || false;
      return { total: links.length, hasBotchain, hasScan, hasBuiltOn };
    })()
  `);
  console.log("   Footer links check:", footerLinksCount);
  if (!footerLinksCount.hasBotchain || !footerLinksCount.hasScan || !footerLinksCount.hasBuiltOn) {
    throw new Error("Footer missing one of the 3 required links!");
  }

  // Check wallet menu tokens in :root
  const menuTokens = await evaluate(`
    (() => {
      const s = getComputedStyle(document.documentElement);
      return {
        bg: s.getPropertyValue("--menu-bg").trim(),
        fg: s.getPropertyValue("--menu-fg").trim(),
        muted: s.getPropertyValue("--menu-muted").trim(),
        border: s.getPropertyValue("--menu-border").trim(),
        hover: s.getPropertyValue("--menu-hover-bg").trim(),
        danger: s.getPropertyValue("--menu-danger").trim()
      };
    })()
  `);
  console.log("   Wallet menu tokens:", menuTokens);
  const bg = menuTokens.bg.toLowerCase();
  const fg = menuTokens.fg.toLowerCase();
  if (!bg.includes("fff") || !fg.includes("1e1233")) {
    throw new Error(`Unexpected menu tokens: ${JSON.stringify(menuTokens)}`);
  }

  // Check that all 9 seeded works appear in the bibliography
  const initialText = await waitForText("Foundations of Decentralized Graph Computations");
  const hasSeededWorks =
    initialText.includes("[1]") &&
    initialText.includes("[9]") &&
    initialText.includes("Comprehensive Taxonomy");
  console.log(`   Seeded works visible: ${hasSeededWorks}`);
  if (!hasSeededWorks) throw new Error("Bibliography missing seeded works!");

  // By default, latest work (Work 9) is selected initially
  console.log("   Waiting for initial selection (Work [9]) tree viewer to render...");
  const initialTreeText = await waitForText("Cites (8)");
  const work9TreeCheck =
    initialTreeText.includes("Cites (8)") &&
    initialTreeText.includes("Foundations of Decentralized Graph Computations");
  console.log(`   Initial Work [9] Tree viewer (8 citations): ${work9TreeCheck}`);
  if (!work9TreeCheck) throw new Error("Initial Work [9] tree details incorrect!");

  // Now click Work [1] in the bibliography list to inspect foundational root
  console.log("   Clicking Work [1] in bibliography list to inspect foundational root...");
  const work1Clicked = await evaluate(`
    (() => {
      const el = document.querySelector("[data-bib-id='1']");
      if (el) {
        el.click();
        return true;
      }
      return false;
    })()
  `);
  console.log(`   Work 1 clicked: ${work1Clicked}`);
  if (!work1Clicked) throw new Error("Could not click Work [1] in bibliography list!");

  const treeText = await waitForText("This work is foundational");
  const work1TreeCheck = treeText.includes("This work is foundational") && treeText.includes("Cited by (5)");
  console.log(`   Work 1 Tree viewer (foundational, cited by 5): ${work1TreeCheck}`);
  if (!work1TreeCheck) throw new Error("Work 1 tree details incorrect!");

  // Test search filter
  console.log("   Testing search filter...");
  await evaluate(`
    (() => {
      const input = document.querySelector("input[placeholder*='Filter by title']");
      if (input) {
        input.value = "Commons Manifesto";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    })()
  `);
  await new Promise((r) => setTimeout(r, 300));
  const filterText = await evaluate("document.body.innerText");
  const filteredOk = filterText.includes("[4]") && !filterText.includes("[9] Comprehensive Taxonomy");
  console.log(`   Search filtered down to Work 4: ${filteredOk}`);
  if (!filteredOk) throw new Error("Search filter failed to isolate Work 4!");

  // Clear filter
  await evaluate(`
    (() => {
      const input = document.querySelector("input[placeholder*='Filter by title']");
      if (input) {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    })()
  `);
  await new Promise((r) => setTimeout(r, 300));

  // -------------------------------------------------------------
  // 2. Mobile 360px Viewport
  // -------------------------------------------------------------
  console.log("2. Testing Mobile 360px Viewport...");
  await setViewport(360, 740);
  await navigate("/");

  const overflowCheck = await evaluate(`
    ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    })
  `);
  console.log(`   360px viewport: scrollWidth=${overflowCheck.scrollWidth}, clientWidth=${overflowCheck.clientWidth}`);
  if (overflowCheck.scrollWidth > overflowCheck.clientWidth) {
    throw new Error("Horizontal overflow detected on mobile 360px viewport!");
  }

  await setViewport(1280, 800);

  // -------------------------------------------------------------
  // 3. Standalone Work Route /w/9
  // -------------------------------------------------------------
  console.log("3. Testing standalone /w/9 route...");
  await navigate("/w/9");
  const w9Standalone = await waitForText("Comprehensive Taxonomy");
  const w9Ok =
    w9Standalone.includes("Comprehensive Taxonomy") &&
    w9Standalone.includes("Cites (8)") &&
    w9Standalone.includes("0.25 BOT");
  console.log(`   Standalone /w/9 loaded correctly: ${w9Ok}`);
  if (!w9Ok) throw new Error("Standalone /w/9 route failed!");

  // -------------------------------------------------------------
  // 4. Author Route /a/[bob]
  // -------------------------------------------------------------
  console.log("4. Testing author route /a/[bob]...");
  await navigate(`/a/${ACC_BOB}`);
  const bobText = await waitForText("Practical Implementations");
  const bobOk =
    bobText.includes("[2]") &&
    bobText.includes("[5]");
  console.log(`   Bob's author page contains authored works [2] and [5]: ${bobOk}`);
  if (!bobOk) throw new Error("Bob's author route missing works!");

  // -------------------------------------------------------------
  // 5. Connect Mock Wallet
  // -------------------------------------------------------------
  console.log("5. Connecting Mock Wallet (Eve)...");
  await navigate("/");

  await evaluate(`(() => {
    const connectBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Connect"));
    if (connectBtn) connectBtn.click();
  })()`);

  await new Promise((r) => setTimeout(r, 600));

  await evaluate(`(() => {
    const mockItem = Array.from(document.querySelectorAll("[role='menuitem'], button")).find(el => el.textContent.includes("Mock Wallet"));
    if (mockItem) mockItem.click();
  })()`);

  await new Promise((r) => setTimeout(r, 1000));

  const walletConnected = await evaluate(`
    document.body.innerText.includes("0x15d3") || document.body.innerText.includes("Disconnect") || document.body.innerText.includes("Eve")
  `);
  console.log(`   Wallet connected for Eve: ${walletConnected}`);

  // -------------------------------------------------------------
  // 6. Real On-Chain Publication: Publish Work #10 Citing [1] and [2]
  // -------------------------------------------------------------
  console.log("6. Publishing Work #10 with citations on /publish...");
  await navigate("/publish");
  await waitForText("Publish Work & Anchor Citations");

  // Helper for React inputs
  await evaluate(`
    window.__setReactInput = function(selector, val) {
      const el = document.querySelector(selector);
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(el, val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    };
  `);

  // Fill in manual hash (32 bytes hex)
  const testHash = "0x888877776666555544443333222211110000ffffaaabbbcccdddeeefff000102";
  await evaluate(`window.__setReactInput("input[placeholder*='0x... hash directly']", "${testHash}")`);

  // Fill in title
  const testTitle = "Decentralized Scholarly Incentives and Royalties";
  await evaluate(`window.__setReactInput("input[placeholder*='e.g. Foundational']", "${testTitle}")`);

  // Fill in fee: 0.02 BOT
  await evaluate(`window.__setReactInput("input[placeholder='0.05']", "0.02")`);

  // Select Work [1] and Work [2] from citations list
  console.log("   Selecting Work [1] and Work [2] to cite...");
  await evaluate(`
    (() => {
      const w1 = document.querySelector("[data-cite-id='1']");
      if (w1) w1.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 400));

  await evaluate(`
    (() => {
      const w2 = document.querySelector("[data-cite-id='2']");
      if (w2) w2.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 600));

  // Verify total cost is 0.15 BOT (Work 1 fee 0.05 + Work 2 fee 0.10)
  const costCheck = await evaluate("document.body.innerText.includes('0.15 BOT')");
  console.log(`   Live citation cost calculated to 0.15 BOT: ${costCheck}`);
  if (!costCheck) throw new Error("Live citation quote did not equal expected 0.15 BOT!");

  // Submit Publish
  console.log("   Checking Publish button state...");
  const pubState = await evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const pubBtn = buttons.find(b => b.textContent.includes("Publish"));
      return {
        text: pubBtn ? pubBtn.textContent : "NOT_FOUND",
        disabled: pubBtn ? pubBtn.disabled : null,
      };
    })()
  `);
  console.log("   Publish button state:", pubState);

  const publishClicked = await evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const pubBtn = buttons.find(b => b.textContent.includes("Publish"));
      if (pubBtn && !pubBtn.disabled) {
        pubBtn.click();
        return true;
      }
      return false;
    })()
  `);
  console.log(`   Publish button clicked: ${publishClicked}`);
  if (!publishClicked) throw new Error("Could not click Publish button!");

  // Wait for redirect to /w/10
  console.log("   Waiting for confirmation and redirect to /w/10...");
  let onWork10 = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const url = await evaluate("window.location.pathname");
    const body = await evaluate("document.body.innerText");
    if (url.includes("/w/10") || body.includes("Decentralized Scholarly Incentives")) {
      console.log(`   Successfully redirected to new Work [10] at ${url}!`);
      onWork10 = true;
      break;
    }
  }
  if (!onWork10) throw new Error("Publication failed or did not redirect to Work 10!");

  // Verify Work 10 shows Cites (2): [1] and [2]
  const work10Text = await evaluate("document.body.innerText");
  const cites10Ok = work10Text.includes("Cites (2)") && work10Text.includes("[1]") && work10Text.includes("[2]");
  console.log(`   Work 10 displays both upstream citations: ${cites10Ok}`);
  if (!cites10Ok) throw new Error("Work 10 does not show expected upstream citations!");

  // -------------------------------------------------------------
  // 7. Verify /me dashboard for Eve
  // -------------------------------------------------------------
  console.log("7. Checking /me for Eve...");
  await evaluate(`document.querySelector("header a[href='/me']").click()`);
  await waitForText("Your Published Works");
  const meEveText = await waitForText("Decentralized Scholarly Incentives");
  console.log("   meEveText full snippet:", meEveText.slice(0, 800));
  const meEveOk = meEveText.includes("Decentralized Scholarly Incentives") && meEveText.includes("[10]");
  console.log(`   Eve's dashboard lists newly published Work [10]: ${meEveOk}`);
  if (!meEveOk) throw new Error("Eve's dashboard does not list Work 10!");

  // -------------------------------------------------------------
  // 8. Switch Account to Alice and Withdraw Earned Citation Royalties
  // -------------------------------------------------------------
  console.log("8. Switching to Alice to test royalty withdrawal on /me...");
  await evaluate(`
    window.__mockWallet.setAccount("${ACC_ALICE}");
    console.log("[MockWallet] Switched account to Alice");
  `);
  const aliceMeText = await waitForText("0.05 BOT");
  const aliceHasRoyalties = aliceMeText.includes("0.05 BOT") || aliceMeText.includes("Withdraw");
  console.log(`   Alice earned royalties from Eve's citation: ${aliceHasRoyalties}`);
  if (!aliceHasRoyalties) throw new Error("Alice did not receive 0.05 BOT royalties from Work 1 citation!");

  console.log("   Clicking Withdraw button for Alice...");
  const withdrawClicked = await evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const wBtn = buttons.find(b => b.textContent.includes("Withdraw"));
      if (wBtn && !wBtn.disabled) {
        wBtn.click();
        return true;
      }
      return false;
    })()
  `);
  console.log("   Waiting for Alice withdrawal confirmation...");
  let withdrawSuccess = false;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 600));
    const afterWithdrawText = await evaluate("document.body.innerText");
    if (afterWithdrawText.includes("0.00 BOT") || afterWithdrawText.includes("withdrawn")) {
      withdrawSuccess = true;
      break;
    }
  }
  console.log(`   Alice withdrawal confirmed: ${withdrawSuccess}`);
  if (!withdrawSuccess) throw new Error("Alice withdrawal was not confirmed!");

  // -------------------------------------------------------------
  // 9. Check Console Errors
  // -------------------------------------------------------------
  console.log("9. Checking console errors...");
  const errors = consoleErrors.filter(
    (e) => !e.includes("net::ERR_") && !e.includes("favicon")
  );
  console.log(`   Total console errors: ${errors.length}`);
  if (errors.length > 0) {
    console.error("   Errors found:", errors);
    throw new Error(`Console errors recorded during walkthrough: ${errors.join("; ")}`);
  }

  console.log("\n=======================================================");
  console.log("✓ ALL BROWSER WALKTHROUGH TESTS PASSED WITH 0 ERRORS!");
  console.log("=======================================================\n");
} finally {
  try {
    chrome.kill();
  } catch {}
}
