#!/usr/bin/env node
/* v8 ignore start - thin I/O wrapper around cliFormat.ts, which is tested */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FormatFileResult,
  MARKDOWN_EXTENSIONS,
  PLANTUML_EXTENSIONS,
  formatMarkdownContent,
  formatPlantUmlContent,
} from "./cliFormat.js";

const USAGE = `Usage: pumlfmt [options] <file>...

Auto-formats PlantUML diagrams (fixes the arrow layout) in .puml files or
in \`\`\`plantuml code blocks of markdown files. Files are modified in place.

Options:
  -r, --reset    Reset arrow directions to their defaults before formatting
  -c, --check    Do not write; exit with code 1 if a file would change
  -h, --help     Show this help
  -V, --version  Print the version

Supported file types:
  PlantUML:  ${[...PLANTUML_EXTENSIONS].join(", ")}
  Markdown:  ${[...MARKDOWN_EXTENSIONS].join(", ")} (\`\`\`plantuml / \`\`\`puml blocks)
`;

interface CliArgs {
  rebuild: boolean;
  check: boolean;
  files: string[];
}

function main(argv: string[]): number {
  const args = parseArgs(argv);
  if (typeof args === "number") {
    return args;
  }

  let exitCode = 0;
  let wouldChange = false;

  for (const file of args.files) {
    const result = processFile(file, args.rebuild, args.check);
    if (result === undefined) {
      exitCode = 1;
    } else if (result.changed > 0) {
      wouldChange = true;
    }
  }

  if (args.check && wouldChange) {
    return 1;
  }
  return exitCode;
}

// Returns the parsed arguments, or an exit code when the program should
// stop right away (0 for --help/--version, 2 for usage errors).
function parseArgs(argv: string[]): CliArgs | number {
  const args: CliArgs = { rebuild: false, check: false, files: [] };

  for (const arg of argv) {
    if (arg === "-h" || arg === "--help") {
      process.stdout.write(USAGE);
      return 0;
    } else if (arg === "-V" || arg === "--version") {
      process.stdout.write(`pumlfmt ${readVersion()}\n`);
      return 0;
    } else if (arg === "-r" || arg === "--reset") {
      args.rebuild = true;
    } else if (arg === "-c" || arg === "--check") {
      args.check = true;
    } else if (arg.startsWith("-")) {
      process.stderr.write(`pumlfmt: unknown option '${arg}'\n\n${USAGE}`);
      return 2;
    } else {
      args.files.push(arg);
    }
  }

  if (args.files.length === 0) {
    process.stderr.write(`pumlfmt: no input files\n\n${USAGE}`);
    return 2;
  }
  return args;
}

// Formats a single file in place. Returns undefined on failure.
function processFile(
  file: string,
  rebuild: boolean,
  check: boolean
): FormatFileResult | undefined {
  const ext = path.extname(file).toLowerCase();
  let content: string;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch (e) {
    process.stderr.write(`pumlfmt: ${errorMessage(e)}\n`);
    return undefined;
  }

  let result: FormatFileResult;
  if (MARKDOWN_EXTENSIONS.has(ext)) {
    result = formatMarkdownContent(content, rebuild);
  } else if (PLANTUML_EXTENSIONS.has(ext)) {
    result = formatPlantUmlContent(content, rebuild);
  } else {
    process.stderr.write(`pumlfmt: ${file}: unsupported file type '${ext}'\n`);
    return undefined;
  }

  for (const warning of result.warnings) {
    process.stderr.write(`pumlfmt: warning: ${file}: ${warning}\n`);
  }
  if (result.found === 0 && result.warnings.length === 0) {
    process.stderr.write(`pumlfmt: warning: ${file}: no PlantUML found\n`);
  }

  if (result.changed === 0) {
    process.stdout.write(`unchanged  ${file}\n`);
  } else if (check) {
    process.stdout.write(
      `would format  ${file} (${diagramCount(result.changed)})\n`
    );
  } else {
    try {
      fs.writeFileSync(file, result.text, "utf8");
    } catch (e) {
      process.stderr.write(`pumlfmt: ${errorMessage(e)}\n`);
      return undefined;
    }
    process.stdout.write(
      `formatted  ${file} (${diagramCount(result.changed)})\n`
    );
  }
  return result;
}

function diagramCount(n: number): string {
  return n === 1 ? "1 diagram" : `${n} diagrams`;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function readVersion(): string {
  // package.json is two levels up from out/src/cli.js (or one level up when
  // running from the sources with tsx).
  const dir = path.dirname(fileURLToPath(import.meta.url));
  for (const candidate of ["../../package.json", "../package.json"]) {
    try {
      const raw = fs.readFileSync(path.join(dir, candidate), "utf8");
      const pkg = JSON.parse(raw) as { name?: string; version?: string };
      if (pkg.name === "plantuml-helpers" && pkg.version !== undefined) {
        return pkg.version;
      }
    } catch {
      // try the next candidate
    }
  }
  return "unknown";
}

process.exit(main(process.argv.slice(2)));

/* v8 ignore stop */
