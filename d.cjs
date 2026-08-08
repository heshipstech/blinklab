const { chromium } = require("@playwright/test");

async function main() {
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  const errs = [];
  p.on("pageerror", function (e) {
    errs.push("PAGEERROR: " + String(e.message).slice(0, 200));
  });
  p.on("console", function (m) {
    if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 200));
  });
  p.on("requestfailed", function (r) {
    errs.push("FAILED: " + r.url().slice(0, 120));
  });
  try {
    await p.goto("http://localhost:4173/blinklab/", {
      waitUntil: "domcontentloaded",
      timeout: 40000,
    });
  } catch (e) {
    errs.push("GOTO: " + String(e.message).slice(0, 120));
  }
  await p.waitForTimeout(6000);
  const state = await p
    .evaluate(function () {
      return {
        readyState: document.readyState,
        bodyLen: (document.body.innerText || "").length,
        boxes: document.querySelectorAll(".box").length,
      };
    })
    .catch(function () {
      return { error: "evaluate failed" };
    });
  console.log(JSON.stringify(state));
  console.log(errs.slice(0, 8).join("\n"));
  await b.close();
}

main();
