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
    return (
      new SortSequence(component)
        .autoFormat()
        .toString(crLf) + ending
    );
  } else if (tpe == DiagramType.Unknown) {
    throw new Error(UNKNOWN_DIAGRAM_TYPE);
  } else {
    throw new Error("Unsupported diagram type: " + tpe.toString());
  }
}

// Extract !include directives and legend...endlegend blocks from the lines so
// they are not included in the sorting. They will be re-added at the beginning
// of the sorted output (after @startuml if present).
function _extractSpecialLines(lines: string[]): {
  special: string[];
  remaining: string[];
} {
  const special: string[] = [];
  const remaining: string[] = [];
  let inLegend = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const trimmedLower = trimmed.toLowerCase();
    if (inLegend) {
      special.push(line);
      if (trimmedLower === "endlegend") {
        inLegend = false;
      }
    } else if (trimmed.startsWith("!include")) {
      special.push(line);
    } else if (
      trimmedLower === "legend" ||
      trimmedLower.startsWith("legend ") ||
      trimmedLower.startsWith("legend\t")
    ) {
      special.push(line);
      inLegend = true;
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
