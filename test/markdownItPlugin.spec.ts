import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted to declare mocks that will be used in vi.mock
const mocks = vi.hoisted(() => ({
  execFileSync: vi.fn(),
  encodePlantUml: vi.fn(),
  getServerUrl: vi.fn(),
}));

vi.mock("child_process", () => ({
  execFileSync: mocks.execFileSync,
}));

vi.mock("../src/plantumlEncoder", () => ({
  encodePlantUml: mocks.encodePlantUml,
}));

vi.mock("../src/plantumlService", () => ({
  getServerUrl: mocks.getServerUrl,
}));

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((_key: string, defaultValue: string) => defaultValue),
    })),
  },
}));

import { plantUmlPlugin } from "../src/markdownItPlugin";

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
        fence: existingFence,
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

// --- Tests ---

describe("markdownItPlantUml", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerUrl.mockReturnValue("https://www.plantuml.com/plantuml");
    mocks.encodePlantUml.mockReturnValue("SomeEncodedString");
  });

  describe("plantUmlPlugin", () => {
    it("should register a fence rule on the markdown-it instance", () => {
      const md = createMockMd();

      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      expect(md.renderer.rules.fence).toBeDefined();
      expect(typeof md.renderer.rules.fence).toBe("function");
    });
  });

  describe("plantuml fence rendering", () => {
    it("should render a plantuml block as inline SVG", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      const svgContent = "<svg><text>diagram</text></svg>";
      mocks.execFileSync.mockReturnValue(svgContent);

      const tokens = [createToken("plantuml", "A -> B\n")];
      const result = md.renderer.rules.fence!(
        tokens,
        0,
        {},
        {},
        createMockSelf()
      );

      expect(result).toContain(svgContent);
      expect(result).toContain('class="plantuml-diagram"');
    });

    it("should wrap bare code in @startuml/@enduml", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      mocks.execFileSync.mockReturnValue("<svg></svg>");

      const tokens = [createToken("plantuml", "A -> B")];
      md.renderer.rules.fence!(tokens, 0, {}, {}, createMockSelf());

      expect(mocks.encodePlantUml).toHaveBeenCalledWith(
        "@startuml\nA -> B\n@enduml"
      );
    });

    it("should not double-wrap code that already has @startuml", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      mocks.execFileSync.mockReturnValue("<svg></svg>");

      const code = "@startuml\nA -> B\n@enduml";
      const tokens = [createToken("plantuml", code)];
      md.renderer.rules.fence!(tokens, 0, {}, {}, createMockSelf());

      expect(mocks.encodePlantUml).toHaveBeenCalledWith(code);
    });

    it("should not double-wrap code that starts with @startmindmap", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      mocks.execFileSync.mockReturnValue("<svg></svg>");

      const code = "@startmindmap\n* root\n** child\n@endmindmap";
      const tokens = [createToken("plantuml", code)];
      md.renderer.rules.fence!(tokens, 0, {}, {}, createMockSelf());

      expect(mocks.encodePlantUml).toHaveBeenCalledWith(code);
    });

    it("should construct the correct URL from server and encoded text", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      mocks.getServerUrl.mockReturnValue("http://localhost:8080/plantuml");
      mocks.encodePlantUml.mockReturnValue("ABC123");
      mocks.execFileSync.mockReturnValue("<svg></svg>");

      const tokens = [createToken("plantuml", "A -> B")];
      md.renderer.rules.fence!(tokens, 0, {}, {}, createMockSelf());

      // The spawned script receives the full URL
      const scriptArg = mocks.execFileSync.mock.calls[0]?.[1]?.[1] as string;
      expect(scriptArg).toContain("http://localhost:8080/plantuml/svg/ABC123");
    });

    it("should use https module for https URLs", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      mocks.getServerUrl.mockReturnValue("https://www.plantuml.com/plantuml");
      mocks.execFileSync.mockReturnValue("<svg></svg>");

      const tokens = [createToken("plantuml", "A -> B")];
      md.renderer.rules.fence!(tokens, 0, {}, {}, createMockSelf());

      const scriptArg = mocks.execFileSync.mock.calls[0]?.[1]?.[1] as string;
      expect(scriptArg).toContain('require("https")');
    });

    it("should use http module for http URLs", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      mocks.getServerUrl.mockReturnValue("http://localhost:8080/plantuml");
      mocks.execFileSync.mockReturnValue("<svg></svg>");

      const tokens = [createToken("plantuml", "A -> B")];
      md.renderer.rules.fence!(tokens, 0, {}, {}, createMockSelf());

      const scriptArg = mocks.execFileSync.mock.calls[0]?.[1]?.[1] as string;
      expect(scriptArg).toContain('require("http")');
    });

    it("should be case-insensitive for the plantuml info string", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      mocks.execFileSync.mockReturnValue("<svg>upper</svg>");

      const tokens = [createToken("PlantUML", "A -> B")];
      const result = md.renderer.rules.fence!(
        tokens,
        0,
        {},
        {},
        createMockSelf()
      );

      expect(result).toContain("<svg>upper</svg>");
    });

    it("should trim whitespace from the info string", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      mocks.execFileSync.mockReturnValue("<svg></svg>");

      const tokens = [createToken("  plantuml  ", "A -> B")];
      const result = md.renderer.rules.fence!(
        tokens,
        0,
        {},
        {},
        createMockSelf()
      );

      expect(result).toContain('class="plantuml-diagram"');
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

    it("should not call execFileSync for non-plantuml blocks", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      const tokens = [createToken("python", "print('hello')")];
      md.renderer.rules.fence!(tokens, 0, {}, {}, createMockSelf());

      expect(mocks.execFileSync).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should return an error div when execFileSync throws", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      mocks.execFileSync.mockImplementation(() => {
        throw new Error("Connection refused");
      });

      const tokens = [createToken("plantuml", "A -> B")];
      const result = md.renderer.rules.fence!(
        tokens,
        0,
        {},
        {},
        createMockSelf()
      );

      expect(result).toContain("PlantUML render error");
      expect(result).toContain("Connection refused");
    });

    it("should escape HTML in error messages", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      mocks.execFileSync.mockImplementation(() => {
        throw new Error("Error with <script>alert('xss')</script>");
      });

      const tokens = [createToken("plantuml", "A -> B")];
      const result = md.renderer.rules.fence!(
        tokens,
        0,
        {},
        {},
        createMockSelf()
      );

      expect(result).not.toContain("<script>");
      expect(result).toContain("&lt;script>");
    });

    it("should handle non-Error thrown values", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      mocks.execFileSync.mockImplementation(() => {
        throw "string error";  
      });

      const tokens = [createToken("plantuml", "A -> B")];
      const result = md.renderer.rules.fence!(
        tokens,
        0,
        {},
        {},
        createMockSelf()
      );

      expect(result).toContain("Unknown error");
    });
  });

  describe("caching", () => {
    it("should fetch again for different diagrams", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      mocks.execFileSync.mockReturnValue("<svg></svg>");

      // Different content produces different encoded strings -> different URLs
      let callCount = 0;
      mocks.encodePlantUml.mockImplementation(() => {
        callCount++;
        return `encoded_${callCount}`;
      });

      const self = createMockSelf();
      md.renderer.rules.fence!(
        [createToken("plantuml", "A -> B")],
        0,
        {},
        {},
        self
      );
      md.renderer.rules.fence!(
        [createToken("plantuml", "C -> D")],
        0,
        {},
        {},
        self
      );

      expect(mocks.execFileSync).toHaveBeenCalledTimes(2);
    });


    it("should not cache error results", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      // First call: error
      mocks.execFileSync.mockImplementationOnce(() => {
        throw new Error("timeout");
      });
      // Second call: success
      mocks.execFileSync.mockReturnValueOnce("<svg>recovered</svg>");

      const tokens = [createToken("plantuml", "A -> B")];
      const self = createMockSelf();

      const result1 = md.renderer.rules.fence!(tokens, 0, {}, {}, self);
      const result2 = md.renderer.rules.fence!(tokens, 0, {}, {}, self);

      expect(result1).toContain("PlantUML render error");
      expect(result2).toContain("<svg>recovered</svg>");
      expect(mocks.execFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe("execFileSync invocation", () => {
    it("should spawn process.execPath with -e flag", () => {
      const md = createMockMd();
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);

      mocks.execFileSync.mockReturnValue("<svg></svg>");

      const tokens = [createToken("plantuml", "A -> B")];
      md.renderer.rules.fence!(tokens, 0, {}, {}, createMockSelf());

      expect(mocks.execFileSync).toHaveBeenCalledWith(
        expect.any(String), // process.execPath
        ["-e", expect.stringContaining("require(")],
        expect.objectContaining({
          encoding: "utf-8",
          timeout: 15_000,
        })
      );
    });
  });
});