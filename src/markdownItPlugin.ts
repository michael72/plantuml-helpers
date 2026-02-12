import process from "node:process";
import { execFileSync } from "child_process";
import { encodePlantUml } from "./plantumlEncoder.js";
import { getServerUrl } from "./plantumlService.js";

// markdown-it types needed for the plugin signature
interface MarkdownIt {
  renderer: {
    rules: {
      fence?: (
        tokens: Token[],
        idx: number,
        options: unknown,
        env: unknown,
        self: Renderer
      ) => string;
    };
  };
}

interface Token {
  info: string;
  content: string;
}

interface Renderer {
  renderToken(tokens: Token[], idx: number, options: unknown): string;
}
/**
 * Synchronously fetches SVG content from a URL by spawning a short-lived node process.
 * This is necessary because markdown-it's render pipeline is synchronous.
 */
function fetchSvgSync(url: string): string {
  try {
    const proto = url.startsWith("https") ? "https" : "http";
    const script = [
      `const m = require("${proto}");`,
      `m.get(${JSON.stringify(url)}, (r) => {`,
      `  let d = "";`,
      `  r.on("data", (c) => d += c);`,
      `  r.on("end", () => process.stdout.write(d));`,
      `  r.on("error", (e) => { process.stderr.write(e.message); process.exit(1); });`,
      `}).on("error", (e) => { process.stderr.write(e.message); process.exit(1); });`,
    ].join("\n");

    const svg = execFileSync(process.execPath, ["-e", script], {
      encoding: "utf-8",
      timeout: 15_000,
    });

    return svg;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return `<div style="color:var(--vscode-errorForeground, red);padding:8px;border:1px solid currentColor;border-radius:4px;">
      <strong>PlantUML render error:</strong> ${message.replace(/</g, "&lt;")}
    </div>`;
  }
}

/**
 * Markdown-it plugin that renders ```plantuml fenced code blocks
 * as inline SVG by fetching from the configured PlantUML server.
 */
export function plantUmlPlugin(md: MarkdownIt): void {
  const defaultFence = md.renderer.rules.fence;

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (token?.info.trim().toLowerCase() === "plantuml") {
      const code = token.content.trim();
      // Wrap in @startuml/@enduml if not already present
      const diagramText = code.startsWith("@start")
        ? code
        : `@startuml\n${code}\n@enduml`;

      const encoded = encodePlantUml(diagramText);
      const serverUrl = getServerUrl();
      const url = `${serverUrl}/svg/${encoded}`;

      const svg = fetchSvgSync(url);

      return `<div class="plantuml-diagram" style="text-align:center;margin:1em 0;">${svg}</div>`;
    }

    // Fall back to default fence rendering for non-plantuml blocks
    if (defaultFence !== undefined) {
      return defaultFence(tokens, idx, options, env, self);
    }
    return self.renderToken(tokens, idx, options);
  };
}

