import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter, PassThrough } from "stream";
import type * as http from "http";

// Use vi.hoisted to declare mocks
const mocks = vi.hoisted(() => ({
  httpsGet: vi.fn(),
  httpGet: vi.fn(),
  encodePlantUml: vi.fn(),
  getServerUrl: vi.fn(),
  getConfiguration: vi.fn(),
  showQuickPick: vi.fn(),
  showWarningMessage: vi.fn(),
  showInformationMessage: vi.fn(),
  withProgress: vi.fn(),
  registerCommand: vi.fn(),
  executeCommand: vi.fn(),
  configUpdate: vi.fn(),
}));

vi.mock("https", () => ({
  get: mocks.httpsGet,
}));

vi.mock("http", () => ({
  get: mocks.httpGet,
}));

vi.mock("../src/plantumlEncoder", () => ({
  encodePlantUml: mocks.encodePlantUml,
}));

vi.mock("../src/plantumlService", () => ({
  getServerUrl: mocks.getServerUrl,
}));

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: mocks.getConfiguration,
  },
  window: {
    showQuickPick: mocks.showQuickPick,
    showWarningMessage: mocks.showWarningMessage,
    showInformationMessage: mocks.showInformationMessage,
    withProgress: mocks.withProgress,
  },
  commands: {
    registerCommand: mocks.registerCommand,
    executeCommand: mocks.executeCommand
  },
  ProgressLocation: {
    Notification: 15,
  },
  ConfigurationTarget: {
    Global: 1,
  },
}));

import {
  parseThemes,
  addTheme,
  getAvailableThemes,
  registerSetThemeCommand,
} from "../src/themeService";

// Helper to create a mock HTTP response
function createMockResponse(
  statusCode: number,
  data: string
): http.IncomingMessage {
  const response = new PassThrough() as unknown as http.IncomingMessage;
  response.statusCode = statusCode;
  response.statusMessage = statusCode === 200 ? "OK" : "Error";
  response.setEncoding = vi.fn();
  (response as unknown as { _testData: string })._testData = data;
  return response;
}

function emitResponseEvents(response: http.IncomingMessage): void {
  const data = (response as unknown as { _testData: string })._testData;
  process.nextTick(() => {
    response.emit("data", data);
    response.emit("end");
  });
}

function createMockRequest(): http.ClientRequest {
  const request = new EventEmitter() as http.ClientRequest;
  request.setTimeout = vi.fn().mockReturnThis();
  request.destroy = vi.fn();
  return request;
}

function mockThemeSetting(theme: string): void {
  mocks.getConfiguration.mockReturnValue({
    get: vi.fn((_key: string, defaultValue: string) => {
      if (_key === "theme") {
        return theme;
      }
      return defaultValue;
    }),
    update: mocks.configUpdate,
  });
}

describe("themeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerUrl.mockReturnValue("https://www.plantuml.com/plantuml");
    mocks.encodePlantUml.mockReturnValue("EncodedThemes");
    mockThemeSetting("_none_");
  });

  describe("parseThemes", () => {
    it("should parse themes from help output", () => {
      const text = `
Help on themes

 The possible themes are :

            _none_

            amiga
            aws-orange

            black-knight
            bluegray
`;
      const result = parseThemes(text);
      expect(result).toEqual([
        "_none_",
        "amiga",
        "aws-orange",
        "black-knight",
        "bluegray",
      ]);
    });

    it("should return empty array if no colon found", () => {
      expect(parseThemes("no colon here")).toEqual([]);
    });

    it("should handle empty text after colon", () => {
      expect(parseThemes("themes:")).toEqual([]);
    });

    it("should handle single theme", () => {
      expect(parseThemes("themes: amiga")).toEqual(["amiga"]);
    });
  });

  describe("addTheme", () => {
    it("should not modify diagram when theme is _none_", () => {
      mockThemeSetting("_none_");
      const input = "@startuml\nA -> B\n@enduml";
      expect(addTheme(input)).toBe(input);
    });

    it("should add theme after @startuml", () => {
      mockThemeSetting("cerulean");
      const input = "@startuml\nA -> B\n@enduml";
      expect(addTheme(input)).toBe(
        "@startuml\n!theme cerulean\nA -> B\n@enduml"
      );
    });

    it("should add theme after @startmindmap", () => {
      mockThemeSetting("amiga");
      const input = "@startmindmap\n* root\n@endmindmap";
      expect(addTheme(input)).toBe(
        "@startmindmap\n!theme amiga\n* root\n@endmindmap"
      );
    });

    it("should not add theme if !theme is already present", () => {
      mockThemeSetting("cerulean");
      const input = "@startuml\n!theme aws-orange\nA -> B\n@enduml";
      expect(addTheme(input)).toBe(input);
    });

    it("should be case-insensitive when checking for existing !theme", () => {
      mockThemeSetting("cerulean");
      const input = "@startuml\n!THEME aws-orange\nA -> B\n@enduml";
      expect(addTheme(input)).toBe(input);
    });

    it("should not modify text without @start directive", () => {
      mockThemeSetting("cerulean");
      const input = "A -> B";
      expect(addTheme(input)).toBe(input);
    });

    it("should not add !theme when a directive is present", () => {
      const directive = "!include http://externalserver/some/external/puml";
      mockThemeSetting(directive);
      const input = "@startuml\nA -> B\n@enduml";
      expect(addTheme(input)).toBe(`@startuml\n${directive}\nA -> B\n@enduml`);
    });
  });

  describe("getAvailableThemes", () => {
    it("should fetch and parse themes from the server", async () => {
      const responseText = "themes :\n  _none_\n  amiga\n  cerulean\n";
      const response = createMockResponse(200, responseText);
      const request = createMockRequest();

      mocks.httpsGet.mockImplementation(
        (
          _url: string,
          callback: (res: http.IncomingMessage) => void
        ): http.ClientRequest => {
          callback(response);
          emitResponseEvents(response);
          return request;
        }
      );

      const themes = await getAvailableThemes();

      expect(themes).toEqual(["_none_", "amiga", "cerulean"]);
      expect(mocks.encodePlantUml).toHaveBeenCalledWith(
        "@startuml\nhelp themes\n@enduml"
      );
    });

    it("should reject on server error", async () => {
      const response = createMockResponse(500, "");
      const request = createMockRequest();

      mocks.httpsGet.mockImplementation(
        (
          _url: string,
          callback: (res: http.IncomingMessage) => void
        ): http.ClientRequest => {
          callback(response);
          return request;
        }
      );

      await expect(getAvailableThemes()).rejects.toThrow(
        "PlantUML server returned status 500"
      );
    });
  });

  describe("registerSetThemeCommand", () => {
    it("should register the pumlhelper.setTheme command", () => {
      const disposable = { dispose: vi.fn() };
      mocks.registerCommand.mockReturnValue(disposable);

      const result = registerSetThemeCommand();

      expect(mocks.registerCommand).toHaveBeenCalledWith(
        "pumlhelper.setTheme",
        expect.any(Function)
      );
      expect(result).toBe(disposable);
    });

    it("should show warning when no themes are fetched", async () => {
      mocks.registerCommand.mockImplementation(
        (_cmd: string, handler: () => Promise<void>) => {
          // Store handler to call it
          (registerSetThemeCommand as unknown as { _handler: () => Promise<void> })._handler = handler;
          return { dispose: vi.fn() };
        }
      );

      mocks.withProgress.mockImplementation(
        async (_opts: unknown, task: () => Promise<string[]>) => task()
      );

      // Mock getAvailableThemes to return empty
      const responseText = "no colon here";
      const response = createMockResponse(200, responseText);
      const request = createMockRequest();

      mocks.httpsGet.mockImplementation(
        (
          _url: string,
          callback: (res: http.IncomingMessage) => void
        ): http.ClientRequest => {
          callback(response);
          emitResponseEvents(response);
          return request;
        }
      );

      registerSetThemeCommand();
      const handler = mocks.registerCommand.mock.calls[0]?.[1] as () => Promise<void>;
      await handler();

      expect(mocks.showWarningMessage).toHaveBeenCalledWith(
        "Could not retrieve PlantUML themes from the server."
      );
    });

    it("should update setting when theme is picked", async () => {
      mocks.withProgress.mockImplementation(
        async (_opts: unknown, task: () => Promise<string[]>) => task()
      );
      mocks.showQuickPick.mockResolvedValue("cerulean");
      mocks.configUpdate.mockResolvedValue(undefined);

      const responseText = "themes :\n  _none_\n  amiga\n  cerulean\n";
      const response = createMockResponse(200, responseText);
      const request = createMockRequest();

      mocks.httpsGet.mockImplementation(
        (
          _url: string,
          callback: (res: http.IncomingMessage) => void
        ): http.ClientRequest => {
          callback(response);
          emitResponseEvents(response);
          return request;
        }
      );

      registerSetThemeCommand();
      const handler = mocks.registerCommand.mock.calls[0]?.[1] as () => Promise<void>;
      await handler();

      expect(mocks.configUpdate).toHaveBeenCalledWith("theme", "cerulean", 1);
      expect(mocks.showInformationMessage).toHaveBeenCalledWith(
        'PlantUML theme set to "cerulean".'
      );
    });
  });
});