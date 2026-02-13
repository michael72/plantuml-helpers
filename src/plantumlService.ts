import * as vscode from "vscode";
import * as https from "https";
import * as http from "http";
import * as zlib from "zlib";
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
 * Gets the configured render method for communicating with the PlantUML server.
 */
export function getRenderMethod(): "get" | "post" | "post-deflate" {
  const config = vscode.workspace.getConfiguration("plantumlHelpers");
  return config.get<"get" | "post" | "post-deflate">("renderMethod", "get");
}

/**
 * Fetches an SVG diagram from the PlantUML server.
 * Uses the configured render method (GET, POST, or POST with deflate compression).
 *
 * @param diagramText The PlantUML diagram source text
 * @returns Promise resolving to the SVG content
 */
export async function fetchSvg(diagramText: string): Promise<string> {
  const method = getRenderMethod();
  if (method === "post" || method === "post-deflate") {
    return fetchSvgViaPost(diagramText, method === "post-deflate");
  }
  return fetchSvgViaGet(diagramText);
}

/**
 * Fetches SVG via GET request with the encoded diagram in the URL.
 */
async function fetchSvgViaGet(diagramText: string): Promise<string> {
  const encoded = encodePlantUml(diagramText);
  const serverUrl = getServerUrl();
  const url = `${serverUrl}/svg/${encoded}`;

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;

    const request = protocol.get(url, (response) => {
      // Handle redirects
      /* v8 ignore next @preserve - there should be a response inside the callback */
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
      reject(
        new Error(`Failed to connect to PlantUML server: ${error.message}`)
      );
    });

    request.setTimeout(30000, () => {
      /* v8 ignore start */
      request.destroy();
      reject(new Error("Request to PlantUML server timed out"));
      /* v8 ignore stop */
    });
  });
}

/**
 * Fetches SVG via POST request with the diagram text in the request body.
 * The PlantUML server (Jetty-based) accepts POST requests where the body
 * contains the diagram source as plain text or deflate-compressed bytes.
 *
 * @param diagramText The PlantUML diagram source text
 * @param compress Whether to deflate-compress the request body
 * @returns Promise resolving to the SVG content
 */
async function fetchSvgViaPost(
  diagramText: string,
  compress: boolean
): Promise<string> {
  const serverUrl = getServerUrl();
  const postUrl = `${serverUrl}/svg/`;
  const parsedUrl = new URL(postUrl);

  let body: Buffer;
  let contentType: string;

  if (compress) {
    body = zlib.deflateRawSync(Buffer.from(diagramText, "utf-8"), { level: 9 });
    contentType = "application/octet-stream";
  } else {
    body = Buffer.from(diagramText, "utf-8");
    contentType = "text/plain";
  }

  const protocol = parsedUrl.protocol === "https:" ? https : http;

  const options: http.RequestOptions = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || undefined,
    path: parsedUrl.pathname,
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "Content-Length": body.length,
    },
  };

  return new Promise((resolve, reject) => {
    const request = protocol.request(options, (response) => {
      /* v8 ignore next @preserve - there should be a response inside the callback */
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
      reject(
        new Error(`Failed to connect to PlantUML server: ${error.message}`)
      );
    });

    request.setTimeout(30000, () => {
      /* v8 ignore start */
      request.destroy();
      reject(new Error("Request to PlantUML server timed out"));
      /* v8 ignore stop */
    });

    request.write(body);
    request.end();
  });
}

/**
 * Helper function to fetch from a URL (used for redirects).
 */
function fetchFromUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    /* v8 ignore next @preserve */
    const protocol = url.startsWith("https") ? https : http;

    const request = protocol.get(url, (response) => {
      /* v8 ignore start */
      if (response.statusCode !== 200) {
        reject(
          new Error(
            `PlantUML server returned status ${response.statusCode}: ${response.statusMessage}`
          )
        );
        return;
      }
      /* v8 ignore stop */

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
      /* v8 ignore start */
      request.destroy();
      reject(new Error("Request to PlantUML server timed out"));
      /* v8 ignore stop */
    });
  });
}
