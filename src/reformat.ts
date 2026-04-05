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

// Extract lines/blocks that should not be included in the sorting. They will be
// re-added at the beginning of the sorted output (after @startuml if present).
//
// Extracted constructs:
//   !include directives
//   legend...endlegend
//   <style>...</style>
//   header / header...endheader
//   footer / footer...endfooter
//   title / title...end title
//   skinparam { ... }  (block form — closing "}" would break the component parser)
//   !if...!endif  (may contain diagram elements; supports nesting)
//   !procedure...!endprocedure
//   !function...!endfunction
//   !startsub...!endsub
//   !definelong...!enddefinelong  (legacy)
function _extractSpecialLines(lines: string[]): {
  special: string[];
  remaining: string[];
} {
  // Pre-scan: only activate multi-line block tracking when a proper closer
  // exists in the file. This prevents a bare "header" / "footer" / "title"
  // (with no matching closer) from swallowing all subsequent lines.
  const lower = lines.map((l) => l.trim().toLowerCase());
  const hasCloser = (closer: string) => lower.includes(closer);

  const special: string[] = [];
  const remaining: string[] = [];
  let inLegend = false;
  let inStyle = false;
  let inHeader = false;
  let inFooter = false;
  let inTitle = false;
  let inSkinparam = false;
  let ifDepth = 0;
  let inProcedure = false;
  let inFunction = false;
  let inStartsub = false;
  let inDefinelong = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const trimmedLower = trimmed.toLowerCase();

    if (inLegend) {
      special.push(line);
      if (trimmedLower === "endlegend") inLegend = false;
    } else if (inStyle) {
      special.push(line);
      if (trimmedLower === "</style>") inStyle = false;
    } else if (inHeader) {
      special.push(line);
      if (trimmedLower === "endheader") inHeader = false;
    } else if (inFooter) {
      special.push(line);
      if (trimmedLower === "endfooter") inFooter = false;
    } else if (inTitle) {
      special.push(line);
      if (trimmedLower === "end title") inTitle = false;
    } else if (inSkinparam) {
      special.push(line);
      if (trimmedLower === "}") inSkinparam = false;
    } else if (ifDepth > 0) {
      special.push(line);
      if (trimmedLower.startsWith("!if ") || trimmedLower === "!if")
        ifDepth++;
      else if (trimmedLower === "!endif") ifDepth--;
    } else if (inProcedure) {
      special.push(line);
      if (trimmedLower === "!endprocedure") inProcedure = false;
    } else if (inFunction) {
      special.push(line);
      if (trimmedLower === "!endfunction") inFunction = false;
    } else if (inStartsub) {
      special.push(line);
      if (trimmedLower.startsWith("!endsub")) inStartsub = false;
    } else if (inDefinelong) {
      special.push(line);
      if (trimmedLower === "!enddefinelong") inDefinelong = false;
    } else if (trimmed.startsWith("!include")) {
      special.push(line);
    } else if (
      trimmedLower === "legend" ||
      trimmedLower.startsWith("legend ") ||
      trimmedLower.startsWith("legend\t")
    ) {
      special.push(line);
      inLegend = true;
    } else if (trimmedLower === "<style>") {
      special.push(line);
      inStyle = true;
    } else if (trimmedLower === "header" && hasCloser("endheader")) {
      special.push(line);
      inHeader = true;
    } else if (
      trimmedLower.startsWith("header ") ||
      trimmedLower.startsWith("header\t")
    ) {
      special.push(line); // single-line header
    } else if (trimmedLower === "footer" && hasCloser("endfooter")) {
      special.push(line);
      inFooter = true;
    } else if (
      trimmedLower.startsWith("footer ") ||
      trimmedLower.startsWith("footer\t")
    ) {
      special.push(line); // single-line footer
    } else if (trimmedLower === "title" && hasCloser("end title")) {
      special.push(line);
      inTitle = true;
    } else if (
      trimmedLower.startsWith("title ") ||
      trimmedLower.startsWith("title\t")
    ) {
      special.push(line); // single-line title
    } else if (
      trimmedLower.startsWith("skinparam") &&
      trimmedLower.endsWith("{")
    ) {
      special.push(line);
      inSkinparam = true;
    } else if (trimmedLower.startsWith("!if ") || trimmedLower === "!if") {
      special.push(line);
      ifDepth = 1;
    } else if (trimmedLower.startsWith("!procedure ")) {
      special.push(line);
      inProcedure = true;
    } else if (trimmedLower.startsWith("!function ")) {
      special.push(line);
      inFunction = true;
    } else if (trimmedLower.startsWith("!startsub")) {
      special.push(line);
      inStartsub = true;
    } else if (trimmedLower.startsWith("!definelong")) {
      special.push(line);
      inDefinelong = true;
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
