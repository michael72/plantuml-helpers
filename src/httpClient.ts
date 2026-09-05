import * as https from "https";
import * as http from "http";

/**
 * Options for HTTP requests.
 */
export interface HttpOptions {
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Additional request headers */
  headers?: Record<string, string | number>;
}

const DEFAULT_TIMEOUT = 30000;
const MAX_REDIRECTS = 5;

/**
 * Selects the correct Node.js module based on the URL protocol.
 */
function selectProtocol(url: string): typeof https | typeof http {
  return url.startsWith("https") ? https : http;
}

/**
 * Resolves a redirect Location header against the URL of the original
 * request. Relative locations are resolved; redirects that would
 * downgrade an HTTPS request to plain HTTP (or switch to a non-HTTP
 * scheme) are rejected.
 *
 * Exported for testing.
 */
export function resolveRedirectUrl(
  location: string,
  baseUrl: string,
): string {
  const resolved = new URL(location, baseUrl);
  if (resolved.protocol !== "https:" && resolved.protocol !== "http:") {
    throw new Error(
      `Server redirected to unsupported URL scheme: ${resolved.protocol}`,
    );
  }
  if (
    new URL(baseUrl).protocol === "https:" &&
    resolved.protocol !== "https:"
  ) {
    throw new Error(
      "Server attempted an insecure redirect from HTTPS to HTTP",
    );
  }
  return resolved.toString();
}

/**
 * Formats a consistent error message for request failures.
 */
function formatRequestError(message: string): string {
  return `Failed to connect to server: ${message}`;
}

/**
 * Formats a consistent error message for non-200 status codes.
 */
function formatStatusError(statusCode: number, statusMessage?: string): string {
  // v8 ignore next — statusMessage is always a string in HTTP/1.1
  return `Server returned status ${statusCode}${statusMessage != null && statusMessage.length > 0 ? `: ${statusMessage}` : ""}`;
}

/**
 * Core request function that handles protocol selection, response assembly,
 * redirects, timeouts, and consistent error formatting.
 */
function makeRequest(
  urlString: string,
  method: "GET" | "POST",
  body?: Buffer,
  options?: HttpOptions,
  redirectCount = 0,
): Promise<string> {
  if (redirectCount > MAX_REDIRECTS) {
    return Promise.reject(new Error("Too many redirects"));
  }

  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
  const protocol = selectProtocol(urlString);
  const parsedUrl = new URL(urlString);

  return new Promise<string>((resolve, reject) => {
    const requestOptions: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || undefined,
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: options?.headers,
    };

    const request = protocol.request(requestOptions, (response) => {
      // v8 ignore next — statusCode is always set on IncomingMessage
      const statusCode = response.statusCode ?? 0;
      const location = response.headers.location ?? "";

      // Handle redirects
      if (statusCode >= 300 && statusCode < 400 && location.length > 0) {
        try {
          const redirectUrl = resolveRedirectUrl(location, urlString);
          // Follow redirect with GET, regardless of original method
          makeRequest(redirectUrl, "GET", undefined, options, redirectCount + 1)
            .then(resolve)
            .catch(reject);
        } catch (error) {
          /* v8 ignore next — resolveRedirectUrl only throws Error */
          reject(error instanceof Error ? error : new Error(String(error)));
        }
        return;
      }

      if (statusCode !== 200) {
        reject(
          new Error(formatStatusError(statusCode, response.statusMessage)),
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

    request.on("error", (error: Error) => {
      reject(new Error(formatRequestError(error.message)));
    });

    request.setTimeout(timeout, () => {
      request.destroy();
      reject(new Error("Request timed out"));
    });

    if (body) {
      request.write(body);
    }
    request.end();
  });
}

/**
 * Performs an HTTP GET request and returns the response body as a string.
 *
 * Redirects are automatically followed (up to 5 hops). Non-200 responses
 * and network errors cause the promise to reject with a descriptive message.
 */
export function httpGet(
  url: string,
  options?: HttpOptions,
): Promise<string> {
  return makeRequest(url, "GET", undefined, options);
}

/**
 * Performs an HTTP POST request and returns the response body as a string.
 *
 * If the server responds with a redirect, it is followed with a GET request.
 * Non-200 responses and network errors cause the promise to reject.
 */
export function httpPost(
  url: string,
  body: Buffer,
  options?: HttpOptions,
): Promise<string> {
  return makeRequest(url, "POST", body, options);
}
