import { describe, it, expect, vi, beforeEach } from "vitest";

// All mocks declared before vi.mock calls
const mocks = vi.hoisted(() => ({
  httpGet: vi.fn(),
  encodePlantUml: vi.fn(),
  getServerUrl: vi.fn(),
  configUpdate: vi.fn(),
  getConfiguration: vi.fn(),
  showQuickPick: vi.fn(),
  showWarningMessage: vi.fn(),
  showInformationMessage: vi.fn(),
  withProgress: vi.fn(),
  registerCommand: vi.fn(),
  executeCommand: vi.fn(),
}));

vi.mock("../src/httpClient.js", () => ({
  httpGet: mocks.httpGet,
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
    executeCommand: mocks.executeCommand,
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
        "@startuml\n!theme cerulean\nA -> B\n@enduml",
      );
    });

    it("should add theme after @startmindmap", () => {
      mockThemeSetting("amiga");
      const input = "@startmindmap\n* root\n@endmindmap";
      expect(addTheme(input)).toBe(
        "@startmindmap\n!theme amiga\n* root\n@endmindmap",
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
      mocks.httpGet.mockResolvedValue(responseText);

      const themes = await getAvailableThemes();

      expect(themes).toEqual(["_none_", "amiga", "cerulean"]);
      expect(mocks.encodePlantUml).toHaveBeenCalledWith(
        "@startuml\nhelp themes\n@enduml",
      );
    });

    it("should reject on server error", async () => {
      mocks.httpGet.mockRejectedValue(
        new Error("Server returned status 500"),
      );

      await expect(getAvailableThemes()).rejects.toThrow(
        "Server returned status 500",
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
        expect.any(Function),
      );
      expect(result).toBe(disposable);
    });

    it("should show warning when no themes are fetched", async () => {
      mocks.registerCommand.mockImplementation(
        () => {
          return { dispose: vi.fn() };
        },
      );

      mocks.withProgress.mockImplementation(
        async (_opts: unknown, task: () => Promise<string[]>) => task(),
      );

      mocks.httpGet.mockResolvedValue("no colon here");

      registerSetThemeCommand();
      const handler = mocks.registerCommand.mock
        .calls[0]?.[1] as () => Promise<void>;
      await handler();

      expect(mocks.showWarningMessage).toHaveBeenCalledWith(
        "Could not retrieve PlantUML themes from the server.",
      );
    });

    it("should update setting when theme is picked", async () => {
      mocks.withProgress.mockImplementation(
        async (_opts: unknown, task: () => Promise<string[]>) => task(),
      );
      mocks.showQuickPick.mockResolvedValue("cerulean");

      mocks.httpGet.mockResolvedValue(
        "themes :\n  _none_\n  amiga\n  cerulean\n",
      );

      registerSetThemeCommand();
      const handler = mocks.registerCommand.mock
        .calls[0]?.[1] as () => Promise<void>;
      await handler();

      expect(mocks.configUpdate).toHaveBeenCalledWith("theme", "cerulean", 1);
      expect(mocks.showInformationMessage).toHaveBeenCalledWith(
        'PlantUML theme set to "cerulean".',
      );
    });
  });
});
