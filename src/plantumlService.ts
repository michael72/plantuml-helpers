import * as vscode from "vscode";
import * as zlib from "zlib";
import { encodePlantUml } from "./plantumlEncoder.js";
import { sanitizeSvg } from "./svgSanitizer.js";
import {
  getServerUrl,
  getServerType,
  ensurePumlsrvRunning,
} from "./pumlsrvService.js";
import { httpGet, httpPost } from "./httpClient.js";

export { getServerUrl };

/**
 * Service for fetching PlantUML diagrams from a PlantUML server.
 */

/**
 * Gets the configured render method for communicating with the PlantUML server.
 */
export function getRenderMethod(): "get" | "post" {
  const config = vscode.workspace.getConfiguration("plantumlHelpers");
  return config.get<"get" | "post">("renderMethod", "get");
}

/**
 * Fetches an SVG diagram from the PlantUML server.
 * Uses the configured render method (GET or POST).
 * When 'Local pumlsrv' is selected, always uses POST with deflate compression
 * (the fastest method supported by pumlsrv), regardless of the renderMethod setting.
 *
 * @param diagramText The PlantUML diagram source text
 * @returns Promise resolving to the SVG content
 */
export async function fetchSvg(diagramText: string): Promise<string> {
  let svg: string;
  if (getServerType() === "Local pumlsrv") {
    await ensurePumlsrvRunning();
    svg = await fetchSvgViaPost(diagramText, true);
  } else if (getRenderMethod() === "post") {
    svg = await fetchSvgViaPost(diagramText, false);
  } else {
    svg = await fetchSvgViaGet(diagramText);
  }
  // The server (and thus its response) is user/workspace-configurable,
  // so the SVG is untrusted input for the preview webviews.
  return sanitizeSvg(svg);
}

/**
 * Fetches SVG via GET request with the encoded diagram in the URL.
 * Delegates HTTP I/O to httpClient.
 */
async function fetchSvgViaGet(diagramText: string): Promise<string> {
  const encoded = encodePlantUml(diagramText);
  const serverUrl = getServerUrl();
  const url = `${serverUrl}/svg/${encoded}`;
  return httpGet(url);
}

/**
 * Fetches SVG via POST request with the diagram text in the request body.
 * The PlantUML server (Jetty-based) accepts POST requests where the body
 * contains the diagram source as plain text or deflate-compressed bytes.
 *
 * Delegates HTTP I/O to httpClient, keeping body preparation (compression)
 * in this module since that is domain-specific.
 *
 * @param diagramText The PlantUML diagram source text
 * @param compress Whether to deflate-compress the request body
 * @returns Promise resolving to the SVG content
 */
async function fetchSvgViaPost(
  diagramText: string,
  compress: boolean,
): Promise<string> {
  const serverUrl = getServerUrl();
  const postUrl = `${serverUrl}/svg/`;

  let body: Buffer;

  if (compress) {
    body = zlib.deflateSync(Buffer.from(diagramText, "utf-8"), { level: 9 });
  } else {
    body = Buffer.from(diagramText, "utf-8");
  }

  const headers: Record<string, string | number> = {
    "Content-Type": "text/plain",
    "Content-Length": body.length,
  };
  if (compress) {
    headers["Content-Encoding"] = "deflate";
  }

  return httpPost(postUrl, body, { headers });
}
