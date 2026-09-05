import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as http from "http";
import { httpGet, httpPost, resolveRedirectUrl } from "../src/httpClient";

let server: http.Server;
let serverPort: number;
let redirectServer: http.Server;
let redirectPort: number;

const TEST_BODY = "Hello from test server";

beforeAll(() => {
  // Main test server
  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost`);

    if (url.pathname === "/echo" && req.method === "POST") {
      // Echo back the POST body
      let body = "";
      req.on("data", (chunk: string) => {
        body += chunk;
      });
      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end(`Received: ${body}`);
      });
      return;
    }

    if (url.pathname === "/empty") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("");
      return;
    }

    if (url.pathname === "/error" && req.method === "GET") {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
      return;
    }

    if (url.pathname === "/timeout") {
      // Never respond
      return;
    }

    if (url.pathname === "/redirect-loop") {
      res.writeHead(302, { Location: `/redirect-loop` });
      res.end();
      return;
    }

    if (url.pathname === "/non-standard-status") {
      // 999 is not a standard HTTP status, so statusMessage is empty string
      res.writeHead(999);
      res.end();
      return;
    }

    // Default: return test body
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(TEST_BODY);
  });

  // Redirect server (returns redirects)
  redirectServer = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost`);

    if (url.pathname === "/redirect-to-target") {
      res.writeHead(302, {
        Location: `http://localhost:${serverPort}/`,
      });
      res.end();
      return;
    }

    if (url.pathname === "/redirect-relative") {
      res.writeHead(302, { Location: "/" });
      res.end();
      return;
    }

    if (url.pathname === "/redirect-https-downgrade") {
      // Trying to redirect from http to https... actually this is an upgrade,
      // not a downgrade. But for testing the error path, we'll simulate a
      // redirect with a Location that uses a non-http scheme.
      res.writeHead(302, { Location: "file:///etc/passwd" });
      res.end();
      return;
    }

    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(TEST_BODY);
  });

  return new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      serverPort =
        typeof addr === "object" && addr ? (addr as { port: number }).port : 0;

      redirectServer.listen(0, "127.0.0.1", () => {
        const addr2 = redirectServer.address();
        redirectPort =
          typeof addr2 === "object" && addr2
            ? (addr2 as { port: number }).port
            : 0;
        resolve();
      });
    });
  });
});

afterAll(() => {
  server?.close();
  redirectServer?.close();
});

describe("httpGet", () => {
  it("should fetch a URL and return the body", async () => {
    const result = await httpGet(`http://localhost:${serverPort}/`);
    expect(result).toBe(TEST_BODY);
  }, 5000);

  it("should handle empty response body", async () => {
    const result = await httpGet(`http://localhost:${serverPort}/empty`);
    expect(result).toBe("");
  }, 5000);
});

describe("httpPost", () => {
  it("should POST a body and return the response", async () => {
    const payload = Buffer.from("test data");
    const result = await httpPost(
      `http://localhost:${serverPort}/echo`,
      payload,
    );
    expect(result).toBe("Received: test data");
  }, 5000);

  it("should POST with custom headers", async () => {
    const payload = Buffer.from("data");
    const result = await httpPost(
      `http://localhost:${serverPort}/echo`,
      payload,
      { headers: { "X-Custom": "value" } },
    );
    expect(result).toBe("Received: data");
  }, 5000);
});

describe("error handling", () => {
  it("should reject on non-200 status code", async () => {
    await expect(
      httpGet(`http://localhost:${serverPort}/error`),
    ).rejects.toThrow("Server returned status 500");
  }, 5000);

  it("should reject on connection refused", async () => {
    // Use a port that's unlikely to be in use
    await expect(
      httpGet(`http://localhost:1/nonexistent`, { timeout: 500 }),
    ).rejects.toThrow("Failed to connect to server");
  }, 5000);

  it("should reject on timeout", async () => {
    await expect(
      httpGet(`http://localhost:${serverPort}/timeout`, { timeout: 100 }),
    ).rejects.toThrow("Request timed out");
  }, 5000);

  it("should handle non-standard status codes without status message", async () => {
    await expect(
      httpGet(`http://localhost:${serverPort}/non-standard-status`),
    ).rejects.toThrow("Server returned status 999");
  }, 5000);

  it("should connect to default port when port is omitted", async () => {
    // URL without explicit port → parsedUrl.port is "" → request uses default port
    await expect(
      httpGet("http://127.0.0.1/nonexistent", { timeout: 100 }),
    ).rejects.toThrow("Failed to connect to server");
  }, 5000);

  it("should select https module for https URLs", async () => {
    // Can't spin up a real HTTPS server, but connecting to an https URL
    // exercises the https branch of selectProtocol
    await expect(
      httpGet("https://localhost:1/nonexistent", { timeout: 100 }),
    ).rejects.toThrow("Failed to connect to server");
  }, 5000);
});

describe("redirect handling", () => {
  it("should follow a redirect to a new URL", async () => {
    const result = await httpGet(
      `http://localhost:${redirectPort}/redirect-to-target`,
    );
    expect(result).toBe(TEST_BODY);
  }, 5000);

  it("should follow a relative redirect", async () => {
    const result = await httpGet(
      `http://localhost:${redirectPort}/redirect-relative`,
    );
    expect(result).toBe(TEST_BODY);
  }, 5000);

  it("should reject redirects to non-HTTP URL schemes", async () => {
    await expect(
      httpGet(`http://localhost:${redirectPort}/redirect-https-downgrade`),
    ).rejects.toThrow("unsupported URL scheme");
  }, 5000);

  it("should reject infinite redirect loops", async () => {
    await expect(
      httpGet(`http://localhost:${serverPort}/redirect-loop`),
    ).rejects.toThrow("Too many redirects");
  }, 5000);
});

describe("resolveRedirectUrl", () => {
  it("should resolve relative locations", () => {
    const result = resolveRedirectUrl(
      "/plantuml/svg/abc",
      "https://www.plantuml.com/plantuml/svg/encoded",
    );
    expect(result).toBe("https://www.plantuml.com/plantuml/svg/abc");
  });

  it("should reject HTTPS to HTTP downgrade", () => {
    expect(() =>
      resolveRedirectUrl(
        "http://insecure.test/foo",
        "https://secure.test/foo",
      ),
    ).toThrow("insecure redirect");
  });

  it("should reject non-HTTP URL schemes", () => {
    expect(() =>
      resolveRedirectUrl(
        "file:///etc/passwd",
        "https://secure.test/foo",
      ),
    ).toThrow("unsupported URL scheme");
  });

  it("should allow HTTP to HTTP redirect", () => {
    const result = resolveRedirectUrl(
      "http://other.test/bar",
      "http://original.test/foo",
    );
    expect(result).toBe("http://other.test/bar");
  });

  it("should allow HTTP to HTTPS upgrade", () => {
    const result = resolveRedirectUrl(
      "https://secure.test/bar",
      "http://insecure.test/foo",
    );
    expect(result).toBe("https://secure.test/bar");
  });
});
