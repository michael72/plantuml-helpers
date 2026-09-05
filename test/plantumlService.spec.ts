import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock httpClient before imports
const httpClientMocks = vi.hoisted(() => ({
  httpGet: vi.fn(),
  httpPost: vi.fn(),
}));

vi.mock("../src/httpClient.js", () => ({
  httpGet: httpClientMocks.httpGet,
  httpPost: httpClientMocks.httpPost,
}));

vi.mock("../src/pumlsrvService.js", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../src/pumlsrvService.js")>();
  return {
    ...original,
    getServerUrl: vi.fn(original.getServerUrl),
    ensurePumlsrvRunning: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((_key: string, defaultValue: string) => defaultValue),
    })),
  },
}));

import * as vscode from "vscode";
import {
  getServerUrl,
  getRenderMethod,
  fetchSvg,
} from "../src/plantumlService";

describe("plantumlService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset vscode mock to default https URL
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((_key: string, defaultValue: string) => defaultValue),
    } as unknown as vscode.WorkspaceConfiguration);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getServerUrl", () => {
    it("should return default URL when no config is set", () => {
      const mockGet = vi
        .fn()
        .mockReturnValue("https://www.plantuml.com/plantuml");
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: mockGet,
      } as unknown as vscode.WorkspaceConfiguration);

      const result = getServerUrl();

      expect(result).toBe("https://www.plantuml.com/plantuml");
      expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith(
        "plantumlHelpers",
      );
    });

    it("should return custom URL when configured", () => {
      const customUrl = "https://my-plantuml-server.com/plantuml";
      const mockGet = vi.fn().mockReturnValue(customUrl);
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: mockGet,
      } as unknown as vscode.WorkspaceConfiguration);

      const result = getServerUrl();

      expect(result).toBe(customUrl);
    });
  });

  describe("getRenderMethod", () => {
    it("should return 'get' by default", () => {
      const result = getRenderMethod();
      expect(result).toBe("get");
    });

    it("should return 'post' when configured", () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((_key: string, defaultValue: string) => {
          if (_key === "renderMethod") return "post";
          return defaultValue;
        }),
      } as unknown as vscode.WorkspaceConfiguration);

      const result = getRenderMethod();
      expect(result).toBe("post");
    });
  });

  describe("fetchSvg via GET", () => {
    it("should fetch SVG from PlantUML server via httpGet", async () => {
      const svgContent = "<svg>test diagram</svg>";
      httpClientMocks.httpGet.mockResolvedValue(svgContent);

      const result = await fetchSvg("@startuml\nA -> B\n@enduml");

      expect(result).toBe(svgContent);
      expect(httpClientMocks.httpGet).toHaveBeenCalledTimes(1);

      // Verify the URL contains the encoded diagram
      const calledUrl = httpClientMocks.httpGet.mock.calls[0]![0] as string;
      expect(calledUrl).toContain("/svg/");
      expect(calledUrl).toMatch(
        /https:\/\/www\.plantuml\.com\/plantuml\/svg\/[0-9A-Za-z\-_]+/,
      );
    });

    it("should reject when httpGet fails", async () => {
      httpClientMocks.httpGet.mockRejectedValue(
        new Error("Server returned status 500: Internal Server Error"),
      );

      await expect(fetchSvg("@startuml\nA -> B\n@enduml")).rejects.toThrow(
        "Server returned status 500",
      );
    });

    it("should reject when httpGet throws a network error", async () => {
      httpClientMocks.httpGet.mockRejectedValue(
        new Error("Failed to connect to server: Network unreachable"),
      );

      await expect(fetchSvg("@startuml\nA -> B\n@enduml")).rejects.toThrow(
        "Failed to connect to server",
      );
    });

    it("should use http for http URLs", async () => {
      const customUrl = "http://local-plantuml.test/plantuml";
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn().mockReturnValue(customUrl),
      } as unknown as vscode.WorkspaceConfiguration);

      const svgContent = "<svg>local diagram</svg>";
      httpClientMocks.httpGet.mockResolvedValue(svgContent);

      const result = await fetchSvg("@startuml\nA -> B\n@enduml");

      const calledUrl = httpClientMocks.httpGet.mock.calls[0]![0] as string;
      expect(calledUrl).toContain("http://local-plantuml.test");
      expect(result).toBe(svgContent);
    });

    it("should sanitize active content out of the fetched SVG", async () => {
      const svgContent =
        `<svg onload="alert(1)"><script>alert(2)</script>` +
        `<text>diagram</text></svg>`;
      httpClientMocks.httpGet.mockResolvedValue(svgContent);

      const result = await fetchSvg("@startuml\nA -> B\n@enduml");

      expect(result).toBe("<svg><text>diagram</text></svg>");
    });

    it("should construct correct URL with encoded diagram", async () => {
      const svgContent = "<svg>test</svg>";
      httpClientMocks.httpGet.mockResolvedValue(svgContent);

      await fetchSvg("@startuml\ntest\n@enduml");

      const calledUrl = httpClientMocks.httpGet.mock.calls[0]![0] as string;
      // URL should contain /svg/ and encoded content
      expect(calledUrl).toContain("/svg/");
      expect(calledUrl).toMatch(
        /https:\/\/www\.plantuml\.com\/plantuml\/svg\/[0-9A-Za-z\-_]+/,
      );
    });
  });

  describe("fetchSvg via POST", () => {
    it("should POST diagram text as plain text when renderMethod is 'post'", async () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((_key: string, defaultValue: string) => {
          if (_key === "renderMethod") return "post";
          return defaultValue;
        }),
      } as unknown as vscode.WorkspaceConfiguration);

      const svgContent = "<svg>post diagram</svg>";
      httpClientMocks.httpPost.mockResolvedValue(svgContent);

      const diagramText = "@startuml\nA -> B\n@enduml";
      const result = await fetchSvg(diagramText);

      expect(result).toBe(svgContent);
      expect(httpClientMocks.httpPost).toHaveBeenCalledTimes(1);

      const calledUrl = httpClientMocks.httpPost.mock.calls[0]![0] as string;
      const calledBody = httpClientMocks.httpPost.mock
        .calls[0]![1] as Buffer;

      expect(calledUrl).toBe("https://www.plantuml.com/plantuml/svg/");
      expect(calledBody).toEqual(Buffer.from(diagramText, "utf-8"));

      // Verify headers passed via options
      const calledOptions = httpClientMocks.httpPost.mock
        .calls[0]![2] as Record<string, unknown>;
      expect(calledOptions).toBeDefined();
      if (calledOptions) {
        const headers = calledOptions["headers"] as Record<string, unknown>;
        expect(headers["Content-Type"]).toBe("text/plain");
        expect(headers["Content-Length"]).toBe(Buffer.byteLength(diagramText));
      }
    });

    it("should always use POST with deflate compression when serverType is 'Local pumlsrv'", async () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((_key: string, defaultValue: string) => {
          if (_key === "serverType") return "Local pumlsrv";
          return defaultValue;
        }),
      } as unknown as vscode.WorkspaceConfiguration);

      const svgContent = "<svg>pumlsrv diagram</svg>";
      httpClientMocks.httpPost.mockResolvedValue(svgContent);

      const diagramText = "@startuml\nA -> B\n@enduml";
      const result = await fetchSvg(diagramText);

      expect(result).toBe(svgContent);

      const calledBody = httpClientMocks.httpPost.mock
        .calls[0]![1] as Buffer;
      expect(Buffer.isBuffer(calledBody)).toBe(true);
      // Body should be compressed (not plain text)
      expect(calledBody).not.toEqual(Buffer.from(diagramText, "utf-8"));

      // Verify deflate header
      const calledOptions = httpClientMocks.httpPost.mock
        .calls[0]![2] as Record<string, unknown>;
      expect(calledOptions).toBeDefined();
      if (calledOptions) {
        const headers = calledOptions["headers"] as Record<string, unknown>;
        expect(headers["Content-Encoding"]).toBe("deflate");
      }
    });

    it("should use http for http server URLs in POST mode", async () => {
      const customUrl = "http://localhost:8080/plantuml";
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((_key: string, defaultValue: string) => {
          if (_key === "renderMethod") return "post";
          if (_key === "serverType") return "Other";
          if (_key === "serverUrl") return customUrl;
          return defaultValue;
        }),
      } as unknown as vscode.WorkspaceConfiguration);

      const svgContent = "<svg>local post</svg>";
      httpClientMocks.httpPost.mockResolvedValue(svgContent);

      const result = await fetchSvg("@startuml\nA -> B\n@enduml");

      expect(result).toBe(svgContent);
      const calledUrl = httpClientMocks.httpPost.mock.calls[0]![0] as string;
      expect(calledUrl).toBe("http://localhost:8080/plantuml/svg/");
    });

    it("should handle non-200 status codes in POST mode", async () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((_key: string, defaultValue: string) => {
          if (_key === "renderMethod") return "post";
          return defaultValue;
        }),
      } as unknown as vscode.WorkspaceConfiguration);

      httpClientMocks.httpPost.mockRejectedValue(
        new Error("Server returned status 500: Internal Server Error"),
      );

      await expect(fetchSvg("@startuml\nA -> B\n@enduml")).rejects.toThrow(
        "Server returned status 500",
      );
    });

    it("should handle network errors in POST mode", async () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((_key: string, defaultValue: string) => {
          if (_key === "renderMethod") return "post";
          return defaultValue;
        }),
      } as unknown as vscode.WorkspaceConfiguration);

      httpClientMocks.httpPost.mockRejectedValue(
        new Error("Failed to connect to server: Connection refused"),
      );

      await expect(fetchSvg("@startuml\nA -> B\n@enduml")).rejects.toThrow(
        "Failed to connect to server",
      );
    });
  });
});
