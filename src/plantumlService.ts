import * as vscode from "vscode";
import * as https from "https";
import * as http from "http";
import { encodePlantUml } from "./plantumlEncoder.js";

/**
 * Service for fetching PlantUML diagrams from a PlantUML server.
 */

/**
 * Gets the configured PlantUML server URL.
 */
export function getServerUrl(): string {
  const config = vscode.workspace.getConfiguration("plantumlHelpers");
  return config.get<string>("server", "https://www.plantuml.com/plantuml");
}

/**
 * Fetches an SVG diagram from the PlantUML server.
 *
 * @param diagramText The PlantUML diagram source text
 * @returns Promise resolving to the SVG content
 */
export async function fetchSvg(diagramText: string): Promise<string> {
  const encoded = encodePlantUml(diagramText);
  const serverUrl = getServerUrl();
  const url = `${serverUrl}/svg/${encoded}`;

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;

    const request = protocol.get(url, (response) => {
      // Handle redirects
      const statusCode = response.statusCode ?? 0;
      const location = response.headers.location ?? "";
      if (statusCode >= 300 && statusCode < 400 && location.length > 0) {
        fetchFromUrl(location).then(resolve).catch(reject);
        return;
      }

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
      reject(new Error(`Failed to connect to PlantUML server: ${error.message}`));
    });

    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error("Request to PlantUML server timed out"));
    });
  });
}

/**
 * Helper function to fetch from a URL (used for redirects).
 */
function fetchFromUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
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

    request.on("error", reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error("Request to PlantUML server timed out"));
    });
  });
}
