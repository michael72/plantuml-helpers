import * as vscode from "vscode";
import * as https from "https";
import * as http from "http";
import { encodePlantUml } from "./plantumlEncoder.js";
import { getServerUrl } from "./plantumlService.js";

/**
 * Fetches the list of available PlantUML themes from the configured server.
 *
 * Sends `@startuml\nhelp themes\n@enduml` to the server's /txt endpoint
 * and parses the theme names from the response.
 */
export async function getAvailableThemes(): Promise<string[]> {
  const encoded = encodePlantUml("@startuml\nhelp themes\n@enduml");
  const serverUrl = getServerUrl();
  const url = `${serverUrl}/txt/${encoded}`;

  const text = await fetchText(url);
  const result = parseThemes(text);
  return result;
}

/**
 * Parses theme names from the PlantUML "help themes" text output.
 *
 * The output contains a header ending with a colon, followed by
 * whitespace-separated theme names.
 */
export function parseThemes(text: string): string[] {
  const colonIndex = text.indexOf(":");
  if (colonIndex === -1) {
    return [];
  }
  const afterColon = text.substring(colonIndex + 1);
  return afterColon
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Returns the currently configured theme from settings.
 */
export function getThemeSetting(): string {
  const config = vscode.workspace.getConfiguration("plantumlHelpers");
  return config.get<string>("theme", "_none_");
}

/**
 * Adds the configured theme directive to a PlantUML diagram if:
 * - The theme setting is not "_none_"
 * - The diagram does not already contain a "!theme" directive
 *
 * The theme directive is inserted after the first `@start...` line.
 */
export function addTheme(diagramText: string): string {
  const theme = getThemeSetting();
  if (theme === "_none_") {
    return diagramText;
  }
  if (/!theme\b/i.test(diagramText)) {
    return diagramText;
  }

  // Insert "!theme <name>\n" after the first @start... line
  const themeExpression = theme.startsWith("!") ? theme : `!theme ${theme}`
  return diagramText.replace(
    /^(@start\w+.*\n)/m,
    `$1${themeExpression}\n`
  );
}

/**
 * Registers the "Set theme" command which shows a QuickPick
 * of available themes and saves the selection to settings.
 */
export function registerSetThemeCommand(): vscode.Disposable {
  return vscode.commands.registerCommand("pumlhelper.setTheme", async () => {
    const themes = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Fetching available PlantUML themes…",
        cancellable: false,
      },
      () => getAvailableThemes()
    );

    if (themes.length === 0) {
      void vscode.window.showWarningMessage(
        "Could not retrieve PlantUML themes from the server."
      );
      return;
    }

    const currentTheme = getThemeSetting();
    const picked = await vscode.window.showQuickPick(themes, {
      placeHolder: `Select a PlantUML theme (current: ${currentTheme})`,
      title: "PlantUML Theme",
    });

    /* v8 ignore next @preserve */
    if (picked !== undefined) {
      const config = vscode.workspace.getConfiguration("plantumlHelpers");
      await config.update("theme", picked, vscode.ConfigurationTarget.Global);
      void vscode.window.showInformationMessage(
        `PlantUML theme set to "${picked}".`
      );
    }
    await vscode.commands.executeCommand('markdown.preview.refresh');
  });
}

/**
 * Fetches plain text from a URL.
 */
function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    /* v8 ignore next @preserve */
    const protocol = url.startsWith("https") ? https : http;

    const request = protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(
          new Error(
            `PlantUML server returned status ${response.statusCode}: ${response.statusMessage}`
          )
        );
        return;
      }

      let data = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => {
        data += chunk;
      });
      response.on("end", () => {
        resolve(data);
      });
      response.on("error", reject);
    });

    request.on("error", (error) => {
      /* v8 ignore next @preserve */
      reject(
        new Error(`Failed to connect to PlantUML server: ${error.message}`)
      );
    });

    /* v8 ignore next @preserve */
    request.setTimeout(15000, () => {
      request.destroy();
      reject(new Error("Request to PlantUML server timed out"));
    });
  });
}