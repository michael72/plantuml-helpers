import { autoFormatTxt } from "./reformat.js";

/** Result of formatting the content of a single file. */
export interface FormatFileResult {
  /** The (possibly modified) file content. */
  text: string;
  /** Number of PlantUML diagrams found in the file. */
  found: number;
  /** Number of diagrams whose content was changed. */
  changed: number;
  /** Diagrams that could not be formatted (unsupported type etc.). */
  warnings: string[];
}

/** File extensions treated as plain PlantUML files. */
export const PLANTUML_EXTENSIONS: ReadonlySet<string> = new Set([
  ".puml",
  ".plantuml",
  ".iuml",
  ".pu",
  ".wsd",
]);

/** File extensions treated as markdown files with embedded PlantUML blocks. */
export const MARKDOWN_EXTENSIONS: ReadonlySet<string> = new Set([
  ".md",
  ".markdown",
]);

// Fence info strings that mark a code block as PlantUML - the same set that
// the markdown-it plugin renders (see markdownItPlugin.ts).
const PLANTUML_FENCE_INFOS: ReadonlySet<string> = new Set(["plantuml", "puml"]);

const FENCE_OPEN = /^\s*(`{3,}|~{3,})\s*(\S*)\s*$/;

/**
 * Formats the content of a PlantUML file.
 *
 * If the file contains `@startuml`/`@enduml` sections, each section is
 * formatted separately and any text outside the sections is left untouched.
 * Otherwise the whole content is treated as one diagram.
 */
export function formatPlantUmlContent(
  content: string,
  rebuild = false
): FormatFileResult {
  const eol = _eol(content);
  const lines = content.split(/\r?\n/);
  const regions = _findUmlRegions(lines);

  if (regions.length === 0) {
    // bare diagram without @startuml/@enduml markers
    const result = _emptyResult(content);
    result.found = 1;
    result.text = _tryFormat(content, rebuild, result, "diagram");
    return result;
  }

  return _formatRegions(lines, regions, eol, rebuild);
}

/**
 * Formats all ```plantuml / ```puml fenced code blocks in markdown content.
 * All other content is left untouched.
 */
export function formatMarkdownContent(
  content: string,
  rebuild = false
): FormatFileResult {
  const eol = _eol(content);
  const lines = content.split(/\r?\n/);
  const regions: _Region[] = [];

  let i = 0;
  while (i < lines.length) {
    const open = FENCE_OPEN.exec(lines[i] ?? "");
    i += 1;
    if (open !== null) {
      const fence = open[1] ?? "";
      const info = (open[2] ?? "").toLowerCase();
      // find the closing fence: same character, at least the same length
      const close = _findClosingFence(lines, i, fence);
      if (close < 0) {
        if (PLANTUML_FENCE_INFOS.has(info)) {
          const result = _emptyResult(content);
          result.warnings.push(`unterminated \`\`\`${info} block at line ${i}`);
          return result;
        }
        break;
      }
      if (PLANTUML_FENCE_INFOS.has(info) && close > i) {
        // exclude the fence lines themselves from the region
        regions.push({ start: i, end: close - 1 });
      }
      i = close + 1;
    }
  }

  return _formatRegions(lines, regions, eol, rebuild);
}

interface _Region {
  /** First line of the diagram (inclusive). */
  start: number;
  /** Last line of the diagram (inclusive). */
  end: number;
}

function _emptyResult(content: string): FormatFileResult {
  return { text: content, found: 0, changed: 0, warnings: [] };
}

// Finds all @startuml ... @enduml sections (markers included in the region -
// autoFormatTxt handles them and keeps them in place).
function _findUmlRegions(lines: string[]): _Region[] {
  const regions: _Region[] = [];
  let start = -1;
  lines.forEach((line, idx) => {
    const trimmed = line.trim().toLowerCase();
    if (start < 0 && trimmed.startsWith("@startuml")) {
      start = idx;
    } else if (start >= 0 && trimmed.startsWith("@enduml")) {
      regions.push({ start, end: idx });
      start = -1;
    }
  });
  return regions;
}

function _findClosingFence(
  lines: string[],
  from: number,
  fence: string
): number {
  const fenceChar = fence.charAt(0);
  for (let i = from; i < lines.length; i++) {
    const trimmed = (lines[i] ?? "").trim();
    if (
      trimmed.length >= fence.length &&
      trimmed.split("").every((c) => c === fenceChar)
    ) {
      return i;
    }
  }
  return -1;
}

// Formats each region in place (bottom-up so indices stay valid) and joins
// the lines back together.
function _formatRegions(
  lines: string[],
  regions: _Region[],
  eol: string,
  rebuild: boolean
): FormatFileResult {
  const result = _emptyResult("");
  result.found = regions.length;

  for (let r = regions.length - 1; r >= 0; r--) {
    const region = regions[r];
    /* v8 ignore next @preserve */
    if (region !== undefined) {
      const original = lines.slice(region.start, region.end + 1).join(eol);
      const formatted = _tryFormat(
        original,
        rebuild,
        result,
        `diagram at line ${region.start + 1}`
      );
      if (formatted !== original) {
        lines.splice(
          region.start,
          region.end - region.start + 1,
          ...formatted.split(/\r?\n/)
        );
      }
    }
  }

  result.text = lines.join(eol);
  return result;
}

// Formats a single diagram, counting changes and collecting a warning
// (instead of throwing) when the diagram cannot be formatted.
function _tryFormat(
  text: string,
  rebuild: boolean,
  result: FormatFileResult,
  what: string
): string {
  try {
    const formatted = autoFormatTxt(text, rebuild);
    if (formatted.trim() !== text.trim()) {
      result.changed += 1;
      return formatted;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    result.warnings.push(`${what}: ${message}`);
  }
  return text;
}

function _eol(content: string): string {
  return content.includes("\r\n") ? "\r\n" : "\n";
}
