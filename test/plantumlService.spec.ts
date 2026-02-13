import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter, PassThrough } from "stream";
import type * as http from "http";

// Use vi.hoisted to declare mocks that will be used in vi.mock
const mocks = vi.hoisted(() => ({
  httpsGet: vi.fn(),
  httpGet: vi.fn(),
  httpsRequest: vi.fn(),
  httpRequest: vi.fn(),
}));

// Mock modules before imports
vi.mock("https", () => ({
  get: mocks.httpsGet,
  request: mocks.httpsRequest,
}));

vi.mock("http", () => ({
  get: mocks.httpGet,
  request: mocks.httpRequest,
}));

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((_key: string, defaultValue: string) => defaultValue),
    })),
  },
}));

import * as vscode from "vscode";
import { getServerUrl, getRenderMethod, fetchSvg } from "../src/plantumlService";

// Create a mock response helper that emits events on next tick
function createMockResponse(
  statusCode: number,
  data: string,
  headers: Record<string, string> = {}
): http.IncomingMessage {
  const response = new PassThrough() as unknown as http.IncomingMessage;
  response.statusCode = statusCode;
  response.statusMessage = statusCode === 200 ? "OK" : "Error";
  response.headers = headers;
  response.setEncoding = vi.fn();

  // Store data to emit later (will be triggered manually)
  (response as unknown as { _testData: string })._testData = data;

  return response;
}

// Helper to emit response events after listeners are attached
function emitResponseEvents(response: http.IncomingMessage): void {
  const data = (response as unknown as { _testData: string })._testData;
  process.nextTick(() => {
    response.emit("data", data);
    response.emit("end");
  });
}

// Create a mock request helper
function createMockRequest(): http.ClientRequest {
  const request = new EventEmitter() as http.ClientRequest;
  request.setTimeout = vi.fn().mockReturnThis();
  request.destroy = vi.fn();
  request.write = vi.fn();
  request.end = vi.fn();
  return request;
}

describe("plantumlService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset vscode mock to default https URL (vi.clearAllMocks only clears call history, not implementations)
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
        "plantumlHelpers"
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

    it("should return 'post-deflate' when configured", () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((_key: string, defaultValue: string) => {
          if (_key === "renderMethod") return "post-deflate";
          return defaultValue;
        }),
      } as unknown as vscode.WorkspaceConfiguration);

      const result = getRenderMethod();
      expect(result).toBe("post-deflate");
    });
  });

  describe("fetchSvg", () => {
    it("should fetch SVG from PlantUML server", async () => {
      const svgContent = "<svg>test diagram</svg>";
      const mockResponse = createMockResponse(200, svgContent);
      const mockRequest = createMockRequest();

      mocks.httpsGet.mockImplementation(
        (_url: unknown, callback: (res: http.IncomingMessage) => void) => {
          callback(mockResponse);
          emitResponseEvents(mockResponse);
          return mockRequest;
        }
      );

      const result = await fetchSvg("@startuml\nA -> B\n@enduml");

      expect(result).toBe(svgContent);
    });

    it("should handle non-200 status codes", async () => {
      const mockResponse = createMockResponse(500, "Internal Server Error");
      const mockRequest = createMockRequest();

      mocks.httpsGet.mockImplementation(
        (_url: unknown, callback: (res: http.IncomingMessage) => void) => {
          callback(mockResponse);
          return mockRequest;
        }
      );

      await expect(fetchSvg("@startuml\nA -> B\n@enduml")).rejects.toThrow(
        "PlantUML server returned status 500"
      );
    });

    it("should handle network errors", async () => {
      const mockRequest = createMockRequest();

      mocks.httpsGet.mockImplementation(() => {
        process.nextTick(() => {
          mockRequest.emit("error", new Error("Network unreachable"));
        });
        return mockRequest;
      });

      await expect(fetchSvg("@startuml\nA -> B\n@enduml")).rejects.toThrow(
        "Failed to connect to PlantUML server"
      );
    });

    it("should use http for http URLs", async () => {
      const customUrl = "http://local-plantuml.test/plantuml";
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn().mockReturnValue(customUrl),
      } as unknown as vscode.WorkspaceConfiguration);

      const svgContent = "<svg>local diagram</svg>";
      const mockResponse = createMockResponse(200, svgContent);
      const mockRequest = createMockRequest();

      mocks.httpGet.mockImplementation(
        (_url: unknown, callback: (res: http.IncomingMessage) => void) => {
          callback(mockResponse);
          emitResponseEvents(mockResponse);
          return mockRequest;
        }
      );

      const result = await fetchSvg("@startuml\nA -> B\n@enduml");

      expect(mocks.httpGet).toHaveBeenCalled();
      expect(result).toBe(svgContent);
    });

    it("should handle redirects", async () => {
      const redirectUrl = "https://redirected.plantuml.com/svg/encoded";
      const svgContent = "<svg>redirected diagram</svg>";

      const redirectResponse = createMockResponse(302, "", {
        location: redirectUrl,
      });
      const finalResponse = createMockResponse(200, svgContent);
      const mockRequest = createMockRequest();

      let callCount = 0;
      mocks.httpsGet.mockImplementation(
        (_url: unknown, callback: (res: http.IncomingMessage) => void) => {
          callCount++;
          const response = callCount === 1 ? redirectResponse : finalResponse;
          callback(response);
          if (callCount > 1) {
            emitResponseEvents(response);
          }
          return mockRequest;
        }
      );

      const result = await fetchSvg("@startuml\nA -> B\n@enduml");

      expect(result).toBe(svgContent);
      expect(callCount).toBe(2);
    });

    it("should construct correct URL with encoded diagram", async () => {
      const svgContent = "<svg>test</svg>";
      const mockResponse = createMockResponse(200, svgContent);
      const mockRequest = createMockRequest();

      let capturedUrl = "";
      mocks.httpsGet.mockImplementation(
        (url: unknown, callback: (res: http.IncomingMessage) => void) => {
          capturedUrl = url as string;
          callback(mockResponse);
          emitResponseEvents(mockResponse);
          return mockRequest;
        }
      );

      await fetchSvg("@startuml\ntest\n@enduml");

      // URL should contain /svg/ and encoded content
      expect(capturedUrl).toContain("/svg/");
      expect(capturedUrl).toMatch(
        /https:\/\/www\.plantuml\.com\/plantuml\/svg\/[0-9A-Za-z\-_]+/
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
      const mockResponse = createMockResponse(200, svgContent);
      const mockRequest = createMockRequest();

      mocks.httpsRequest.mockImplementation(
        (
          _opts: unknown,
          callback: (res: http.IncomingMessage) => void
        ) => {
          callback(mockResponse);
          emitResponseEvents(mockResponse);
          return mockRequest;
        }
      );

      const diagramText = "@startuml\nA -> B\n@enduml";
      const result = await fetchSvg(diagramText);

      expect(result).toBe(svgContent);
      expect(mocks.httpsRequest).toHaveBeenCalled();

      // Verify request options
      const options = mocks.httpsRequest.mock.calls[0]![0] as http.RequestOptions;
      expect(options.method).toBe("POST");
      expect(options.path).toBe("/plantuml/svg/");
      expect((options.headers as Record<string, unknown>)["Content-Type"]).toBe("text/plain");
      expect((options.headers as Record<string, unknown>)["Content-Length"]).toBe(
        Buffer.byteLength(diagramText)
      );

      // Verify body was written
      expect(mockRequest.write).toHaveBeenCalledWith(
        Buffer.from(diagramText, "utf-8")
      );
      expect(mockRequest.end).toHaveBeenCalled();
    });

    it("should POST deflate-compressed content when renderMethod is 'post-deflate'", async () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((_key: string, defaultValue: string) => {
          if (_key === "renderMethod") return "post-deflate";
          return defaultValue;
        }),
      } as unknown as vscode.WorkspaceConfiguration);

      const svgContent = "<svg>deflate diagram</svg>";
      const mockResponse = createMockResponse(200, svgContent);
      const mockRequest = createMockRequest();

      mocks.httpsRequest.mockImplementation(
        (
          _opts: unknown,
          callback: (res: http.IncomingMessage) => void
        ) => {
          callback(mockResponse);
          emitResponseEvents(mockResponse);
          return mockRequest;
        }
      );

      const diagramText = "@startuml\nA -> B\n@enduml";
      const result = await fetchSvg(diagramText);

      expect(result).toBe(svgContent);

      // Verify request options for compressed POST
      const options = mocks.httpsRequest.mock.calls[0]![0] as http.RequestOptions;
      expect(options.method).toBe("POST");
      expect((options.headers as Record<string, unknown>)["Content-Type"]).toBe(
        "application/octet-stream"
      );

      // Verify body was written (compressed, so it should be a Buffer)
      const writtenBody = (mockRequest.write as ReturnType<typeof vi.fn>).mock
        .calls[0]![0] as Buffer;
      expect(Buffer.isBuffer(writtenBody)).toBe(true);
      // Compressed body should differ from the plain text
      expect(writtenBody).not.toEqual(Buffer.from(diagramText, "utf-8"));
    });

    it("should use http for http server URLs in POST mode", async () => {
      const customUrl = "http://localhost:8080/plantuml";
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((_key: string, defaultValue: string) => {
          if (_key === "renderMethod") return "post";
          if (_key === "server") return customUrl;
          return defaultValue;
        }),
      } as unknown as vscode.WorkspaceConfiguration);

      const svgContent = "<svg>local post</svg>";
      const mockResponse = createMockResponse(200, svgContent);
      const mockRequest = createMockRequest();

      mocks.httpRequest.mockImplementation(
        (
          _opts: unknown,
          callback: (res: http.IncomingMessage) => void
        ) => {
          callback(mockResponse);
          emitResponseEvents(mockResponse);
          return mockRequest;
        }
      );

      const result = await fetchSvg("@startuml\nA -> B\n@enduml");

      expect(result).toBe(svgContent);
      expect(mocks.httpRequest).toHaveBeenCalled();
      expect(mocks.httpsRequest).not.toHaveBeenCalled();

      const options = mocks.httpRequest.mock.calls[0]![0] as http.RequestOptions;
      expect(options.hostname).toBe("localhost");
      expect(options.port).toBe("8080");
      expect(options.path).toBe("/plantuml/svg/");
    });

    it("should handle non-200 status codes in POST mode", async () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((_key: string, defaultValue: string) => {
          if (_key === "renderMethod") return "post";
          return defaultValue;
        }),
      } as unknown as vscode.WorkspaceConfiguration);

      const mockResponse = createMockResponse(500, "Internal Server Error");
      const mockRequest = createMockRequest();

      mocks.httpsRequest.mockImplementation(
        (
          _opts: unknown,
          callback: (res: http.IncomingMessage) => void
        ) => {
          callback(mockResponse);
          return mockRequest;
        }
      );

      await expect(fetchSvg("@startuml\nA -> B\n@enduml")).rejects.toThrow(
        "PlantUML server returned status 500"
      );
    });

    it("should handle network errors in POST mode", async () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((_key: string, defaultValue: string) => {
          if (_key === "renderMethod") return "post";
          return defaultValue;
        }),
      } as unknown as vscode.WorkspaceConfiguration);

      const mockRequest = createMockRequest();

      mocks.httpsRequest.mockImplementation(() => {
        process.nextTick(() => {
          mockRequest.emit("error", new Error("Connection refused"));
        });
        return mockRequest;
      });

      await expect(fetchSvg("@startuml\nA -> B\n@enduml")).rejects.toThrow(
        "Failed to connect to PlantUML server"
      );
    });

    it("should handle redirects in POST mode", async () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((_key: string, defaultValue: string) => {
          if (_key === "renderMethod") return "post";
          return defaultValue;
        }),
      } as unknown as vscode.WorkspaceConfiguration);

      const redirectUrl = "https://redirected.plantuml.com/svg/result";
      const svgContent = "<svg>redirected post</svg>";

      const redirectResponse = createMockResponse(302, "", {
        location: redirectUrl,
      });
      const finalResponse = createMockResponse(200, svgContent);
      const mockRequest = createMockRequest();

      // POST request returns redirect
      mocks.httpsRequest.mockImplementation(
        (
          _opts: unknown,
          callback: (res: http.IncomingMessage) => void
        ) => {
          callback(redirectResponse);
          return mockRequest;
        }
      );

      // Redirect follow-up uses GET
      mocks.httpsGet.mockImplementation(
        (_url: unknown, callback: (res: http.IncomingMessage) => void) => {
          callback(finalResponse);
          emitResponseEvents(finalResponse);
          return mockRequest;
        }
      );

      const result = await fetchSvg("@startuml\nA -> B\n@enduml");

      expect(result).toBe(svgContent);
      expect(mocks.httpsRequest).toHaveBeenCalled();
      expect(mocks.httpsGet).toHaveBeenCalled();
    });
  });
});
