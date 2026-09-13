"use strict";

// Test-only Playwright is supplied by the local workspace runtime (see README).
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

const channel = process.env.BROWSER_CHANNEL || "chrome";
const output = path.resolve(__dirname, "../.steering/20260913-implement-demo/validation", channel);
const url = pathToFileURL(path.resolve(__dirname, "../index.html")).href;
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel, headless: true });
  const errors = [];
  const remoteRequests = [];
  const measurements = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, offline: true, locale: "ja-JP" });
  context.on("page", (page) => {
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("request", (request) => { if (/^https?:/.test(request.url())) remoteRequests.push(request.url()); });
  });
  const page = await context.newPage();
  const value = (id) => page.locator(`#${id}`).textContent();
  const phase = () => page.locator("body").getAttribute("data-phase");
  const waitEnabled = (id) => page.waitForFunction((id) => !document.getElementById(id).disabled, id);
  async function initial() {
    assert.equal(await phase(), "INITIAL");
    assert.equal(await value("probability"), "0");
    assert.equal(await value("assignment-label"), "割り当て先：なし");
    assert.equal(await value("log-count"), "0 EVENTS");
    assert.equal(await page.locator("#predict-button").isEnabled(), true);
    assert.equal(await page.locator("#detect-button").isDisabled(), true);
    assert.equal(await page.locator("#assign-button").isDisabled(), true);
    assert.equal(await page.locator("#arrival-message").isVisible(), false);
  }
  async function clickMeasured(id, expectedPhase) {
    const result = await page.evaluate(async ({ id, expectedPhase }) => {
      const start = performance.now();
      document.getElementById(id).click();
      // Synchronous DOM update, then the next paint opportunity.
      const immediatePhase = document.body.dataset.phase;
      const domMs = performance.now() - start;
      await new Promise(requestAnimationFrame);
      return { id, expectedPhase, immediatePhase, domMs, frameMs: performance.now() - start };
    }, { id, expectedPhase });
    assert.equal(result.immediatePhase, expectedPhase);
    assert.ok(result.frameMs < 1000, `${id}: UI response within 1 second`);
    measurements.push(result);
  }
  try {
    await page.goto(url);
    await initial();
    await page.screenshot({ path: path.join(output, "initial-desktop.png"), fullPage: true });
    const initialBox = await page.locator("#vehicle-marker").boundingBox();
    await page.locator("#predict-button").focus();
    await page.keyboard.press("Enter");
    assert.equal(await phase(), "PREDICTED");
    assert.equal(await value("probability"), "82");
    assert.equal(await value("predicted-departure"), "09:28");
    assert.match(await value("vehicle-status"), /AVAILABLE/);
    // Double clicks and synthetic events do not bypass the state guard.
    await page.evaluate(() => {
      for (let i = 0; i < 8; i++) for (const id of ["predict-button", "detect-button", "assign-button"]) document.getElementById(id).dispatchEvent(new MouseEvent("click"));
    });
    await page.waitForFunction(() => document.body.dataset.phase === "POSITIONING");
    const movementStart = performance.now();
    assert.equal(await page.locator("#detect-button").isDisabled(), true);
    await waitEnabled("detect-button");
    const movementMs = performance.now() - movementStart;
    assert.ok(movementMs >= 1200 && movementMs < 2400, `positioning duration ${movementMs}`);
    const nearBox = await page.locator("#vehicle-marker").boundingBox();
    assert.ok(nearBox.x > initialBox.x + 100);
    assert.equal(await value("assignment-label"), "割り当て先：なし");
    assert.equal(await value("demand-total"), "1.82");
    assert.equal(await value("log-count"), "6 EVENTS");
    await page.screenshot({ path: path.join(output, "positioning-desktop.png"), fullPage: true });
    // Reload from prediction resets all memory and any pending effects.
    await page.reload();
    await initial();
    await clickMeasured("predict-button", "PREDICTED");
    await waitEnabled("detect-button");
    await clickMeasured("detect-button", "CONFIRMED");
    assert.equal(await value("probability"), "98");
    assert.match(await value("prediction-status"), /CONFIRMED/);
    assert.match(await value("vehicle-status"), /POSITIONING/);
    assert.equal(await value("assignment-label"), "割り当て先：なし");
    assert.equal(await value("demand-total"), "1.82");
    await clickMeasured("assign-button", "ASSIGNED");
    assert.equal(await page.locator("#arrival-message").isVisible(), false);
    assert.equal(await value("assignment-label"), "割り当て先：山田さん");
    await page.locator("#arrival-message").waitFor({ state: "visible" });
    assert.equal(await value("probability"), "98");
    assert.equal(await value("log-count"), "8 EVENTS");
    assert.equal(await page.locator("#activity-log li").count(), 8);
    const assignedBox = await page.locator("#vehicle-marker").boundingBox();
    const userBox = await page.locator(".user-dot").boundingBox();
    assert.ok(assignedBox.x > nearBox.x && assignedBox.y > nearBox.y);
    assert.ok(assignedBox.x + assignedBox.width <= userBox.x || assignedBox.y + assignedBox.height <= userBox.y, "vehicle and user icons do not overlap");
    await page.screenshot({ path: path.join(output, "arrived-desktop.png"), fullPage: true });
    assert.equal(await page.locator(".step-button:enabled").count(), 0);
    await page.reload();
    await initial();

    // Suppressed transition events still complete through the fallback timer.
    await page.evaluate(() => document.getElementById("vehicle-marker").addEventListener("transitionend", (event) => event.stopImmediatePropagation(), true));
    await clickMeasured("predict-button", "PREDICTED");
    await waitEnabled("detect-button");
    await page.locator("#detect-button").click();
    await page.locator("#assign-button").click();
    await page.locator("#arrival-message").waitFor({ state: "visible" });

    // Reduced motion completes without waiting on a CSS event, including a mid-flight change.
    await page.reload();
    await page.locator("#predict-button").click();
    await page.waitForFunction(() => document.body.dataset.phase === "POSITIONING");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await waitEnabled("detect-button");
    await page.locator("#detect-button").focus();
    await page.keyboard.press("Space");
    assert.equal(await phase(), "CONFIRMED");
    await page.locator("#assign-button").focus();
    await page.keyboard.press("Enter");
    await page.locator("#arrival-message").waitFor({ state: "visible" });

    for (const size of [{ width: 1366, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
      await page.setViewportSize(size);
      await page.reload();
      await initial();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `no horizontal overflow at ${size.width}`);
      for (const [panelSelector, childSelector] of [[".schedule-panel", "#calendar-destination"], [".prediction-panel", "#prediction-status"], [".prediction-panel", ".prediction-footnote"]]) {
        const panelBox = await page.locator(panelSelector).boundingBox();
        const childBox = await page.locator(childSelector).boundingBox();
        assert.ok(childBox.x >= panelBox.x && childBox.x + childBox.width <= panelBox.x + panelBox.width + 1 && childBox.y >= panelBox.y && childBox.y + childBox.height <= panelBox.y + panelBox.height + 1, `${childSelector} fits its panel at ${size.width}`);
        if (size.width <= 580) assert.ok(panelBox.width >= size.width - 30, `full-width mobile panel: ${panelSelector}`);
      }
      for (const id of ["predict-button", "detect-button", "assign-button"]) {
        const box = await page.locator(`#${id}`).boundingBox();
        assert.ok(box.width > 0 && box.height >= 44 && box.x >= 0 && box.x + box.width <= size.width);
      }
      if (size.width === 390 || size.width === 1366) await page.screenshot({ path: path.join(output, `initial-${size.width}.png`), fullPage: true });
      await page.locator("#predict-button").click();
      await waitEnabled("detect-button");
      await page.locator("#detect-button").click();
      await page.locator("#assign-button").click();
      await page.locator("#arrival-message").waitFor({ state: "visible" });
      assert.equal(await value("log-count"), "8 EVENTS");
      if (size.width === 390) await page.screenshot({ path: path.join(output, "arrived-mobile.png"), fullPage: true });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(remoteRequests, []);
    const result = { channel, version: browser.version(), offline: true, fileUrl: true, measurements, positioningMs: movementMs, errors, remoteRequests, result: "PASS" };
    fs.writeFileSync(path.join(output, "results.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
