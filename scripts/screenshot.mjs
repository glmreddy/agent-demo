// One-off local visual-verification helper (not part of the app).
// Usage: node scripts/screenshot.mjs <url> <output-file> [width] [height]
import { chromium } from "playwright";

const [, , url, outFile, width, height] = process.argv;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(width) || 1440, height: Number(height) || 1200 },
});

const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto(url, { waitUntil: "networkidle" });
await page.screenshot({ path: outFile, fullPage: true });
await browser.close();

if (errors.length) {
  console.log("Console errors:");
  for (const e of errors) console.log(" - " + e);
} else {
  console.log("No console errors.");
}
console.log(`Saved screenshot to ${outFile}`);
