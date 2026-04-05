import { SortComponent } from "./sortcomponent.js";
import { SortSequence } from "./sortsequence.js";
import { Component } from "./uml/component.js";
import { DiagramType, getType } from "./uml/diagramtype.js";

const REGEX_LINEENDING = /(.*\S+)(\s*)$/s;

export const UNKNOWN_DIAGRAM_TYPE = "Unable to determine diagram type";

export function autoFormatTxt(txt: string, rebuild = false): string {
  const crLf = _crLf(txt);
  const m = REGEX_LINEENDING.exec(txt);
  // auto formatting does not include the ending - add it later
  let ending = "";
  if (m) {
    const matchedText = m[1];
    const matchedEnding = m[2];
    if (
      matchedText != null &&
      matchedText.length > 0 &&
      matchedEnding != null &&
      matchedEnding.length > 0
    ) {
      txt = matchedText;
      ending = matchedEnding;
      if (ending.length > 2) {
        ending = crLf;
      }
    }
  }

  const lines = txt.split(crLf);
  const { special, remaining } = _extractSpecialLines(lines);
  const tpe = getType(remaining);
  if (tpe == DiagramType.ClassComponent) {
    const component = Component.fromString(remaining);
    _injectSpecialLines(component, special);
    let formatted = new SortComponent(component)
      .autoFormat(rebuild)
      .toString(crLf);
    if (!formatted.endsWith(ending)) {
      formatted += ending;
    }
    return formatted;
  } else if (tpe == DiagramType.Sequence) {
    const component = Component.fromString(remaining, true);
    _injectSpecialLines(component, special);
    return new SortSequence(component).autoFormat().toString(crLf) + ending;
  } else if (tpe == DiagramType.Unknown) {
    throw new Error(UNKNOWN_DIAGRAM_TYPE);
  } else {
    throw new Error("Unsupported diagram type: " + tpe.toString());
  }
}

// Map from the first token of a block-opening line to the line that closes it.
// Lookup uses trimmedLower split at the first whitespace or "(" so that
// prefix-based starts ("legend right", "!if %cond()") resolve to the same key.
const BLOCK_END: Readonly<Record<string, string>> = {
  legend: "endlegend",
  "<style>": "</style>",
  header: "endheader",
  footer: "endfooter",
  title: "end title",
  skinparam: "}", // block form only — see guard below
  "!if": "!endif", // note: nested !if is not tracked; first !endif closes the block
  "!procedure": "!endprocedure",
  "!function": "!endfunction",
  "!startsub": "!endsub",
  "!definelong": "!enddefinelong",
};

// For these keywords a bare keyword on its own line starts a multi-line block.
// Only begin extraction when the closer actually appears in the file, so a bare
// "header" / "footer" / "title" used without a matching closer is left in place.
const REQUIRES_CLOSER: ReadonlySet<string> = new Set(["header", "footer", "title"]);

// Extract lines/blocks that must not be processed by the diagram sorter. They
// are re-added at the top of the sorted output (after @startuml if present).
function _extractSpecialLines(lines: string[]): {
  special: string[];
  remaining: string[];
} {
  // Pre-compute the set of all distinct trimmed-lower lines for closer checks.
  const lineSet = new Set(lines.map((l) => l.trim().toLowerCase()));

  const special: string[] = [];
  const remaining: string[] = [];
  let currentEndKey: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const trimmedLower = trimmed.toLowerCase();

    // Inside a special block: collect until the closing keyword.
    if (currentEndKey !== null) {
      special.push(line);
      if (trimmedLower === currentEndKey) currentEndKey = null;
      continue;
    }

    // Single-line !include directive (not a block, no closer needed).
    if (trimmed.startsWith("!include")) {
      special.push(line);
      continue;
    }

    // Derive the first token to look up in BLOCK_END.
    // Splitting on whitespace or "(" handles "legend right", "!if %cond()", etc.
    const firstToken = trimmedLower.split(/[\s(]/)[0];
    const endKey = BLOCK_END[firstToken];

    if (endKey !== undefined) {
      // skinparam: only the block form (line ends with "{") needs extraction;
      // single-line "skinparam Key Value" is left for the diagram parser.
      if (firstToken === "skinparam" && !trimmedLower.endsWith("{")) {
        remaining.push(line);
        continue;
      }

      // header / footer / title with inline text ("header My Title") is a
      // self-contained single-line directive — extract it without tracking.
      if (REQUIRES_CLOSER.has(firstToken) && trimmedLower !== firstToken) {
        special.push(line);
        continue;
      }

      // Bare header / footer / title: only start block tracking when the
      // closer actually appears later in the file.
      if (REQUIRES_CLOSER.has(firstToken) && !lineSet.has(endKey)) {
        remaining.push(line);
        continue;
      }

      special.push(line);
      currentEndKey = endKey;
    } else {
      remaining.push(line);
    }
  }

  return { special, remaining };
}

// Inject the extracted special lines into the component header, after the
// @startuml line if present, or at the beginning otherwise.
function _injectSpecialLines(component: Component, special: string[]): void {
  if (special.length === 0) return;

  const startumlIdx = component.header.findIndex((l) =>
    l.trim().toLowerCase().startsWith("@startuml")
  );
  if (startumlIdx >= 0) {
    component.header.splice(startumlIdx + 1, 0, ...special);
  } else {
    component.header.unshift(...special);
  }
}

function _crLf(txt: string): string {
  const idx = txt.indexOf("\n");
  if (idx != -1) {
    if (idx > 0 && txt.charAt(idx - 1) == "\r") {
      return "\r\n";
    }
    return "\n";
  }
  return "\r";
}
