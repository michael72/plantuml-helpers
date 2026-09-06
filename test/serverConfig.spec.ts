import { describe, it, expect, vi, beforeEach } from "vitest";

import * as vscode from "vscode";
import {
  getServerUrl,
  getServerType,
  getRenderMethod,
  setActivePumlsrvPort,
} from "../src/serverConfig";

/* ------------------------------------------------------------------ */
/*  Shared helpers for the vscode mock                                 */
/* ------------------------------------------------------------------ */

/**
 * Build a WorkspaceConfiguration mock whose `.get()` returns the
 * `defaultValue` parameter it received (i.e. the production default).
 */
function defaultConfig(): vscode.WorkspaceConfiguration {
  return {
    get: (_: string, defaultValue: unknown) => defaultValue,
  } as unknown as vscode.WorkspaceConfiguration;
}

/**
 * Build a WorkspaceConfiguration mock with a custom `.get()` function.
 */
function configWithGet(
  getFn: (key: string, defaultValue: unknown) => unknown,
): vscode.WorkspaceConfiguration {
  return { get: getFn } as unknown as vscode.WorkspaceConfiguration;
}

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: vi.fn(() => defaultConfig()),
  },
}));

describe("serverConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-instate the default config after each clear
    vi.mocked(vscode.workspace.getConfiguration).mockImplementation(
      () => defaultConfig(),
    );
    setActivePumlsrvPort(undefined);
  });

  describe("getServerType", () => {
    it("should return 'PlantUML Server' by default", () => {
      const result = getServerType();
      expect(result).toBe("PlantUML Server");
    });

    it("should return configured server type", () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(
        configWithGet(() => "Local pumlsrv"),
      );

      const result = getServerType();
      expect(result).toBe("Local pumlsrv");
    });
  });

  describe("getServerUrl", () => {
    it("should return the PlantUML server URL by default", () => {
      const result = getServerUrl();
      expect(result).toBe("https://www.plantuml.com/plantuml");
    });

    it("should return local pumlsrv URL when server type is Local pumlsrv", () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(
        configWithGet(() => "Local pumlsrv"),
      );

      setActivePumlsrvPort(54321);
      const result = getServerUrl();
      expect(result).toBe("http://localhost:54321/plantuml");
    });

    it("should return custom URL when server type is Other", () => {
      const customUrl = "https://my-plantuml-server.com/plantuml";
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(
        configWithGet((key: string) => {
          if (key === "serverType") return "Other";
          if (key === "serverUrl") return customUrl;
          return undefined;
        }),
      );

      const result = getServerUrl();
      expect(result).toBe(customUrl);
    });

    it("should return custom URL when server type is Other and pumlsrv port is set", () => {
      const customUrl = "https://my-plantuml-server.com/plantuml";
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(
        configWithGet((key: string) => {
          if (key === "serverType") return "Other";
          if (key === "serverUrl") return customUrl;
          return undefined;
        }),
      );

      setActivePumlsrvPort(9999);
      const result = getServerUrl();
      // Other type ignores pumlsrv port
      expect(result).toBe(customUrl);
    });
  });

  describe("getRenderMethod", () => {
    it("should return 'get' by default", () => {
      const result = getRenderMethod();
      expect(result).toBe("get");
    });

    it("should return 'post' when configured", () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(
        configWithGet((key: string) => {
          if (key === "renderMethod") return "post";
          return "get";
        }),
      );

      const result = getRenderMethod();
      expect(result).toBe("post");
    });
  });

  describe("setActivePumlsrvPort", () => {
    it("should affect getServerUrl when server type is Local pumlsrv", () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(
        configWithGet(() => "Local pumlsrv"),
      );

      setActivePumlsrvPort(8080);
      expect(getServerUrl()).toBe("http://localhost:8080/plantuml");

      setActivePumlsrvPort(9090);
      expect(getServerUrl()).toBe("http://localhost:9090/plantuml");
    });
  });
});
