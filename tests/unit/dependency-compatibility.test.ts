import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { transform, transformSync } from "@esbuild-kit/core-utils";
import { InMemoryFileSystemHost } from "@ts-morph/common";
import { createHeadlessEditor } from "@lexical/headless";
import { withDOM } from "@lexical/headless/dom";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { $getRoot } from "lexical";

/** Execution checks for patched transitive packages awaiting upstream range updates. */
describe("security override compatibility", () => {
  it("transpiles TypeScript through the legacy Drizzle loader's actual esbuild wrapper", async () => {
    for (const compile of [transformSync, transform]) {
      const result = await compile("const answer: number = 42; export { answer };", "/tmp/dependency-check.ts", { format: "cjs" });
      const fixtureModule = { exports: {} as Record<string, unknown> };
      runInNewContext(result.code, { module: fixtureModule, exports: fixtureModule.exports });
      expect(fixtureModule.exports.answer).toBe(42);
    }
  });

  it("preserves ts-morph glob inclusion, braces and exclusions with patched minimatch", async () => {
    const host = new InMemoryFileSystemHost();
    host.writeFileSync("/src/one.ts", "export {};");
    host.writeFileSync("/src/nested/two.tsx", "export {};");
    host.writeFileSync("/src/excluded/three.ts", "export {};");
    host.writeFileSync("/src/readme.md", "Not source");
    expect((await host.glob(["/src/**/*.{ts,tsx}", "!/src/excluded/**"])).sort()).toEqual([
      "/src/nested/two.tsx", "/src/one.ts",
    ]);
  });

  it("round-trips formatted content through Lexical's actual Happy DOM adapter", () => {
    const previousWindow = globalThis.window;
    withDOM((window) => {
      const editor = createHeadlessEditor({ onError: (error) => { throw error; } });
      editor.update(() => {
        const document = new window.DOMParser().parseFromString("<p>Hei <strong>gjester</strong> &amp; familie</p>", "text/html");
        $getRoot().append(...$generateNodesFromDOM(editor, document));
      }, { discrete: true });
      editor.getEditorState().read(() => {
        expect($getRoot().getTextContent()).toBe("Hei gjester & familie");
        const html = $generateHtmlFromNodes(editor);
        expect(html).toContain("gjester");
        expect(html).toContain("<strong");
        expect(html).toContain("&amp; familie");
      });
    });
    expect(globalThis.window).toBe(previousWindow);
  });

});
