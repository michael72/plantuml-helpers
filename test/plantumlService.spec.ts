import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter, PassThrough } from "stream";
import type * as http from "http";

// Use vi.hoisted to declare mocks that will be used in vi.mock
const mocks = vi.hoisted(() => ({
  httpsGet: vi.fn(),
  httpGet: vi.fn(),
}));

// Mock modules before imports
vi.mock("https", () => ({
  get: mocks.httpsGet,
}));

vi.mock("http", () => ({
  get: mocks.httpGet,
}));

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((_key: string, defaultValue: string) => defaultValue),
    })),
  },
}));

import * as vscode from "vscode";
import { getServerUrl, fetchSvg } from "../src/plantumlService";

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
  return request;
}

describe("plantumlService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
