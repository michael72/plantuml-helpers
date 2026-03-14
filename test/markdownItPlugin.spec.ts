import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted to declare mocks that will be used in vi.mock
const mocks = vi.hoisted(() => ({
  fetchSvg: vi.fn(),
  encodePlantUml: vi.fn(),
  addTheme: vi.fn((text: string) => text), // pass-through by default
}));

vi.mock("../src/plantumlEncoder", () => ({
  encodePlantUml: mocks.encodePlantUml,
}));

vi.mock("../src/plantumlService", () => ({
  fetchSvg: mocks.fetchSvg,
}));

vi.mock("../src/themeService", () => ({
  addTheme: mocks.addTheme,
}));

import { plantUmlPlugin, _resetCaches, _cacheStats } from "../src/markdownItPlugin";

// --- Test helpers ---

interface Token {
  info: string;
  content: string;
}

interface Renderer {
  renderToken(tokens: Token[], idx: number, options: unknown): string;
}

type FenceRule = (
  tokens: Token[],
  idx: number,
  options: unknown,
  env: unknown,
  self: Renderer
) => string;

interface MockMarkdownIt {
  renderer: {
    rules: {
      fence?: FenceRule;
    };
  };
}

function createMockMd(existingFence?: FenceRule): MockMarkdownIt {
  return {
    renderer: {
      rules: {
        fence: existingFence!,
      },
    },
  };
}

function createMockSelf(): Renderer {
  return {
    renderToken: vi.fn().mockReturnValue("<code>fallback</code>"),
  };
}

function createToken(info: string, content: string): Token {
  return { info, content };
}

/** Helper: flush all pending microtasks (resolved promises). */
function flushPromises(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

// --- Tests ---

describe("markdownItPlantUml", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetCaches();
    mocks.encodePlantUml.mockReturnValue("SomeEncodedString");
    // Default: fetchSvg resolves immediately
    mocks.fetchSvg.mockResolvedValue("<svg>default</svg>");
  });

  describe("plantUmlPlugin", () => {
    it("should register a fence rule on the markdown-it instance", () => {
      const md = createMockMd();

      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      expect(md.renderer.rules.fence).toBeDefined();
      expect(typeof md.renderer.rules.fence).toBe("function");
    });
  });

  describe("cold start (empty cache)", () => {
    it("should return an empty placeholder on first render", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      const tokens = [createToken("plantuml", "A -> B\n")];
      const result = md.renderer.rules.fence!(
        tokens,
        0,
        {},
        {},
        createMockSelf()
      );

      expect(result).toContain('class="plantuml-diagram"');
      // Placeholder is empty – no SVG content yet
      expect(result).not.toContain("<svg");
    });

    it("should trigger a background fetch on cache miss", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      const tokens = [createToken("plantuml", "A -> B")];
      md.renderer.rules.fence!(tokens, 0, {}, {}, createMockSelf());

      expect(mocks.fetchSvg).toHaveBeenCalledTimes(1);
    });

    it("should wrap bare code in @startuml/@enduml before encoding", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      const tokens = [createToken("plantuml", "A -> B")];
      md.renderer.rules.fence!(tokens, 0, {}, {}, createMockSelf());

      expect(mocks.addTheme).toHaveBeenCalledWith("@startuml\nA -> B\n@enduml");
    });

    it("should not double-wrap code that already has @startuml", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      const code = "@startuml\nA -> B\n@enduml";
      const tokens = [createToken("plantuml", code)];
      md.renderer.rules.fence!(tokens, 0, {}, {}, createMockSelf());

      expect(mocks.addTheme).toHaveBeenCalledWith(code);
    });

    it("should not double-wrap code that starts with @startmindmap", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      const code = "@startmindmap\n* root\n** child\n@endmindmap";
      const tokens = [createToken("plantuml", code)];
      md.renderer.rules.fence!(tokens, 0, {}, {}, createMockSelf());

      expect(mocks.addTheme).toHaveBeenCalledWith(code);
    });
  });

  describe("cache hit (second render after fetch completes)", () => {
    it("should return the fetched SVG on the second render pass", async () => {
      const md = createMockMd();
      const onAllFetched = vi.fn();
      plantUmlPlugin(
        md as Parameters<typeof plantUmlPlugin>[0],
        onAllFetched
      );

      mocks.fetchSvg.mockResolvedValue("<svg><text>diagram</text></svg>");

      const tokens = [createToken("plantuml", "A -> B")];
      const self = createMockSelf();

      // First render: cache miss → placeholder
      md.renderer.rules.fence!(tokens, 0, {}, {}, self);

      // Wait for the background fetch to settle
      await flushPromises();

      // Second render: cache hit → actual SVG
      const result = md.renderer.rules.fence!(tokens, 0, {}, {}, self);

      expect(result).toContain("<svg><text>diagram</text></svg>");
      expect(result).toContain('class="plantuml-diagram"');
    });

    it("should not trigger another fetch on cache hit", async () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      mocks.fetchSvg.mockResolvedValue("<svg></svg>");

      const tokens = [createToken("plantuml", "A -> B")];
      const self = createMockSelf();

      // First render (miss) + wait
      md.renderer.rules.fence!(tokens, 0, {}, {}, self);
      await flushPromises();

      // Second render (hit)
      md.renderer.rules.fence!(tokens, 0, {}, {}, self);

      expect(mocks.fetchSvg).toHaveBeenCalledTimes(1);
    });
  });

  describe("no-flicker slot cache", () => {
    it("should return previous SVG when diagram changes at same position", async () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      // Return a stable key per distinct input
      mocks.encodePlantUml.mockImplementation(
        (text: string) => `encoded_${text.length}`
      );
      mocks.fetchSvg.mockResolvedValueOnce("<svg>first</svg>");

      const self = createMockSelf();

      // First render: cache miss → placeholder, triggers background fetch
      md.renderer.rules.fence!(
        [createToken("plantuml", "A -> B")],
        0,
        {},
        {},
        self
      );
      await flushPromises();

      // Second render with same content → cache hit, populates slot cache
      const hitResult = md.renderer.rules.fence!(
        [createToken("plantuml", "A -> B")],
        0,
        {},
        {},
        self
      );
      expect(hitResult).toContain("<svg>first</svg>");

      // Now change the diagram — different encoded key, cache miss
      // fetchSvg for new diagram is pending (never resolves in this test)
      mocks.fetchSvg.mockReturnValue(new Promise(() => {}));

      const result = md.renderer.rules.fence!(
        [createToken("plantuml", "C -> D")],
        0,
        {},
        {},
        self
      );

      // Should show the previous SVG from slot cache, not empty placeholder
      expect(result).toContain("<svg>first</svg>");
    });
  });

  describe("onAllFetched callback", () => {
    it("should call onAllFetched when a single fetch completes", async () => {
      const md = createMockMd();
      const onAllFetched = vi.fn();
      plantUmlPlugin(
        md as Parameters<typeof plantUmlPlugin>[0],
        onAllFetched
      );

      mocks.fetchSvg.mockResolvedValue("<svg></svg>");

      const tokens = [createToken("plantuml", "A -> B")];
      md.renderer.rules.fence!(tokens, 0, {}, {}, createMockSelf());

      expect(onAllFetched).not.toHaveBeenCalled();
      await flushPromises();
      expect(onAllFetched).toHaveBeenCalledTimes(1);
    });

    it("should call onAllFetched only after ALL fetches complete", async () => {
      const md = createMockMd();
      const onAllFetched = vi.fn();
      plantUmlPlugin(
        md as Parameters<typeof plantUmlPlugin>[0],
        onAllFetched
      );

      let callCount = 0;
      mocks.encodePlantUml.mockImplementation(() => `encoded_${++callCount}`);

      // Two diagrams: first resolves quickly, second takes longer
      let resolveSecond!: (value: string) => void;
      mocks.fetchSvg
        .mockResolvedValueOnce("<svg>first</svg>")
        .mockReturnValueOnce(
          new Promise<string>((r) => {
            resolveSecond = r;
          })
        );

      const self = createMockSelf();
      md.renderer.rules.fence!(
        [createToken("plantuml", "A -> B"), createToken("plantuml", "C -> D")],
        0,
        {},
        {},
        self
      );
      md.renderer.rules.fence!(
        [createToken("plantuml", "A -> B"), createToken("plantuml", "C -> D")],
        1,
        {},
        {},
        self
      );

      // First fetch settles
      await flushPromises();
      expect(onAllFetched).not.toHaveBeenCalled();

      // Second fetch settles
      resolveSecond("<svg>second</svg>");
      await flushPromises();
      expect(onAllFetched).toHaveBeenCalledTimes(1);
    });

    it("should call onAllFetched even when fetches fail", async () => {
      const md = createMockMd();
      const onAllFetched = vi.fn();
      plantUmlPlugin(
        md as Parameters<typeof plantUmlPlugin>[0],
        onAllFetched
      );

      mocks.fetchSvg.mockRejectedValue(new Error("Network error"));

      const tokens = [createToken("plantuml", "A -> B")];
      md.renderer.rules.fence!(tokens, 0, {}, {}, createMockSelf());

      await flushPromises();
      expect(onAllFetched).toHaveBeenCalledTimes(1);
    });

    it("should work without an onAllFetched callback", async () => {
      const md = createMockMd();
      // No callback passed
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      mocks.fetchSvg.mockResolvedValue("<svg></svg>");

      const tokens = [createToken("plantuml", "A -> B")];
      // Should not throw
      md.renderer.rules.fence!(tokens, 0, {}, {}, createMockSelf());
      await flushPromises();
    });
  });

  describe("error handling", () => {
    it("should not cache failed fetches", async () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      // First call: error
      mocks.fetchSvg.mockRejectedValueOnce(new Error("timeout"));
      // Second call: success
      mocks.fetchSvg.mockResolvedValueOnce("<svg>recovered</svg>");

      const tokens = [createToken("plantuml", "A -> B")];
      const self = createMockSelf();

      // First render: triggers failed fetch
      md.renderer.rules.fence!(tokens, 0, {}, {}, self);
      await flushPromises();

      // Cache should be empty after failed fetch
      expect(_cacheStats().svgCacheSize).toBe(0);

      // Second render: triggers new fetch (not served from cache)
      md.renderer.rules.fence!(tokens, 0, {}, {}, self);
      await flushPromises();

      // Now cached
      expect(_cacheStats().svgCacheSize).toBe(1);

      // Third render: served from cache
      const result = md.renderer.rules.fence!(tokens, 0, {}, {}, self);
      expect(result).toContain("<svg>recovered</svg>");
      expect(mocks.fetchSvg).toHaveBeenCalledTimes(2);
    });
  });

  describe("cache pruning", () => {
    it("should prune unreferenced SVG cache entries after all fetches complete", async () => {
      const md = createMockMd();
      const onAllFetched = vi.fn();
      plantUmlPlugin(
        md as Parameters<typeof plantUmlPlugin>[0],
        onAllFetched
      );

      // Distinct keys per distinct content
      mocks.encodePlantUml.mockImplementation(
        (text: string) => `key_${Buffer.from(text).toString("base64").slice(0, 12)}`
      );
      mocks.fetchSvg.mockResolvedValue("<svg>A</svg>");

      const self = createMockSelf();

      // Render pass 1: diagram A at idx 0 → miss → fetch
      md.renderer.rules.fence!(
        [createToken("plantuml", "A -> B")],
        0,
        {},
        {},
        self
      );
      await flushPromises();

      expect(_cacheStats().svgCacheSize).toBe(1);

      // Render pass 2: cache hit for same content (verify hit)
      md.renderer.rules.fence!(
        [createToken("plantuml", "A -> B")],
        0,
        {},
        {},
        self
      );
      expect(mocks.fetchSvg).toHaveBeenCalledTimes(1); // no new fetch

      // Render pass 3: diagram changes at idx 0 → miss → fetch
      mocks.fetchSvg.mockResolvedValue("<svg>new</svg>");
      md.renderer.rules.fence!(
        [createToken("plantuml", "X -> Y -> Z")],
        0,
        {},
        {},
        self
      );
      await flushPromises();

      // Old key_A was pruned because slot 0 now points to key_X.
      // Only the new entry remains.
      expect(_cacheStats().svgCacheSize).toBe(1);
    });
  });

  describe("case and whitespace handling", () => {
    it("should be case-insensitive for the plantuml info string", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      const tokens = [createToken("PlantUML", "A -> B")];
      const result = md.renderer.rules.fence!(
        tokens,
        0,
        {},
        {},
        createMockSelf()
      );

      // Should be recognized as plantuml (triggers fetch, returns placeholder)
      expect(result).toContain('class="plantuml-diagram"');
      expect(mocks.fetchSvg).toHaveBeenCalled();
    });

    it("should trim whitespace from the info string", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      const tokens = [createToken("  plantuml  ", "A -> B")];
      const result = md.renderer.rules.fence!(
        tokens,
        0,
        {},
        {},
        createMockSelf()
      );

      expect(result).toContain('class="plantuml-diagram"');
      expect(mocks.fetchSvg).toHaveBeenCalled();
    });
  });

  describe("non-plantuml fence fallback", () => {
    it("should delegate to existing fence rule for non-plantuml blocks", () => {
      const originalFence = vi
        .fn()
        .mockReturnValue("<pre><code>js code</code></pre>");
      const md = createMockMd(originalFence);
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      const tokens = [createToken("javascript", 'console.log("hi")')];
      const self = createMockSelf();
      const result = md.renderer.rules.fence!(tokens, 0, {}, {}, self);

      expect(result).toBe("<pre><code>js code</code></pre>");
      expect(originalFence).toHaveBeenCalledWith(tokens, 0, {}, {}, self);
    });

    it("should use renderToken when no original fence rule exists", () => {
      const md = createMockMd(undefined);
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      const tokens = [createToken("javascript", 'console.log("hi")')];
      const self = createMockSelf();
      const result = md.renderer.rules.fence!(tokens, 0, {}, {}, self);

      expect(result).toBe("<code>fallback</code>");
      expect(self.renderToken).toHaveBeenCalledWith(tokens, 0, {});
    });

    it("should not call fetchSvg for non-plantuml blocks", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      const tokens = [createToken("python", "print('hello')")];
      md.renderer.rules.fence!(tokens, 0, {}, {}, createMockSelf());

      expect(mocks.fetchSvg).not.toHaveBeenCalled();
    });
  });

  describe("_cacheStats and _resetCaches", () => {
    it("should report zero sizes after reset", () => {
      const stats = _cacheStats();
      expect(stats.svgCacheSize).toBe(0);
      expect(stats.slotCacheSize).toBe(0);
      expect(stats.pendingFetches).toBe(0);
    });

    it("should report pending fetches while in flight", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      // Never-resolving promise
      mocks.fetchSvg.mockReturnValue(new Promise(() => {}));

      const tokens = [createToken("plantuml", "A -> B")];
      md.renderer.rules.fence!(tokens, 0, {}, {}, createMockSelf());

      expect(_cacheStats().pendingFetches).toBe(1);
    });
  });
});