import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { chromium } from "@playwright/test";
import type { DOMPurify } from "dompurify";

// Monaco runs DOMPurify in a real browser, not Lexical's server-side DOM adapter.
// This check needs no application server, environment secrets or database.
const require = createRequire(import.meta.url);
const monacoRequire = createRequire(require.resolve("monaco-editor"));
const sanitizerPath = path.join(path.dirname(monacoRequire.resolve("dompurify")), "purify.min.js");
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.route("**/*", (route) => route.abort());
  await page.setContent("<main>Sanitizer compatibility</main>");
  await page.addScriptTag({ path: sanitizerPath });
  const html = await page.evaluate(() => {
    const sanitize = (window as unknown as { DOMPurify: DOMPurify }).DOMPurify;
    return sanitize.sanitize('<p>Hei <strong>gjester</strong></p><script>alert(1)</script><img onerror="alert(1)"><a href="javascript:alert(1)">Lenke</a>');
  });
  assert(html.includes("<strong>gjester</strong>"));
  assert(html.includes("Lenke"));
  assert(!/script|onerror|javascript:|alert\(/i.test(html));
  console.log("PASS: Monaco's patched DOMPurify preserves safe markup and removes executable content in Chromium.");
} finally {
  await browser.close();
}
