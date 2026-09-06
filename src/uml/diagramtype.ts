export enum DiagramType {
  ClassComponent, // class and component (or object) diagram: not distinguished
  Sequence,
  UseCase,
  Activity,
  State,
  Timing,
  Unknown,
}

export const REGEX_INTERFACE =
  /^\s*(\(\)|interface)\s+((?:"[^"]+")|[^"\s]+)(?:\s+as\s+(\S+))?\s*$/;
export const REGEX_COMPONENT =
  /^\s*(component\s+)?((?:\[[^*\]]+\])|[^[*\]\s]+)(?:\s+as\s+(\S+))?\s*$/;
export const REGEX_CLASS =
  /^\s*(class|enum|abstract|abstract class|annotation)\s+([^[\]\s]+)(?:\s+as\s+(\S+))?\s*$/;
export const REGEX_SEQUENCE =
  /^\s*(actor|participant)\s+([^[\]\s]+)(?:\s+as\s+(\S+))?\s*$/;
export const REGEX_USE_CASE =
  /(?:^|\s+)(?::([^:]+):)|(?:\(([^:]+)\))(?:$|\s+)/g;
export const REGEX_ACTIVITY = /(?:(?:^|\s+)\(\*\)(?:$|\s+))|(?:^\s*:.*)/g;
export const REGEX_STATE = /(?:^|\s+)\[\*\](?:$|\s+)/g;
const REGEX_COMP_USE = /(?:^|\s+)(?:\[[^*\]]+\])(?:$|\s+)/g;

/**
 * Canonical regex for block-opening lines (e.g. `package "name" {`).
 * Replaces `Component.regexTitle`.
 */
export const REGEX_BLOCK_OPENER =
  /\s*(package|namespace|node|folder|frame|cloud|database|class|component|interface|enum|annotation)\s+([^{\s]*)\s*([^{]*)?{.*/;

/** Arrow patterns that indicate a ClassComponent diagram. */
const CLASS_ARROWS = ["<|-", "*-", "o-", "-|>", "-*", "-o"] as const;

/** Arrow patterns that indicate a Sequence diagram. */
const SEQ_ARROWS = ["->", "<-", " ++ ", " ** "] as const;

// actor could be both sequence and usecase diagram
const keyMap: Map<string, DiagramType> = new Map([
  ["class", DiagramType.ClassComponent],
  ["interface", DiagramType.ClassComponent],
  ["component", DiagramType.ClassComponent],
  ["annotation", DiagramType.ClassComponent],
  ["abstract", DiagramType.ClassComponent],
  ["abstract class", DiagramType.ClassComponent],
  ["enum", DiagramType.ClassComponent],
  ["participant", DiagramType.Sequence],
  ["boundary", DiagramType.Sequence],
  ["control", DiagramType.Sequence],
  ["entity", DiagramType.Sequence],
  ["database", DiagramType.Sequence],
  ["collections", DiagramType.Sequence],
  ["return", DiagramType.Sequence],
  ["activate", DiagramType.Sequence],
  ["deactivate", DiagramType.Sequence],
  ["if", DiagramType.Activity],
  ["else", DiagramType.Activity],
  ["endif", DiagramType.Activity],
  ["state", DiagramType.State],
  ["clock", DiagramType.Timing],
  ["robust", DiagramType.Timing],
  ["concise", DiagramType.Timing],
]);

const RegToken = /^\s*([a-z]+).*/;

// ---------------------------------------------------------------------------
// TokenClassifier predicates
// ---------------------------------------------------------------------------

/**
 * Returns true when the line is a block-opening statement
 * (e.g. `package "name" {`, `namespace foo {`, `class Bar {`).
 */
export function isBlockOpener(line: string): boolean {
  return REGEX_BLOCK_OPENER.test(line);
}

/**
 * Returns true when the line is a class/component/interface-style definition
 * (but not a sequence participant/actor — those are detected via arrow patterns).
 *
 * Mirrors the regex dispatch in `Definition.fromString` except for
 * `REGEX_SEQUENCE`, which is excluded because it belongs to Sequence diagrams
 * and is detected through arrow-pattern fallback in `getDiagramType`.
 */
export function isDefinition(line: string): boolean {
  return (
    REGEX_INTERFACE.test(line) ||
    REGEX_COMPONENT.test(line) ||
    REGEX_CLASS.test(line) ||
    REGEX_COMP_USE.test(line)
  );
}

/**
 * Returns true when the line contains any arrow pattern
 * (both ClassComponent and Sequence arrow types).
 */
/* v8 ignore next @preserve */
export function isArrow(line: string): boolean {
  return isClassArrow(line) || isSequenceArrow(line);
}

/**
 * Returns true when the line contains a ClassComponent-specific arrow
 * (<|-, *-, o-, -|>, -*, -o).
 */
export function isClassArrow(line: string): boolean {
  for (const arrow of CLASS_ARROWS) {
    if (line.includes(arrow)) return true;
  }
  return false;
}

/**
 * Returns true when the line contains a Sequence-specific arrow
 * (->, <-, " ++ ", " ** ").
 */
export function isSequenceArrow(line: string): boolean {
  for (const arrow of SEQ_ARROWS) {
    if (line.includes(arrow)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Diagram-type detection
// ---------------------------------------------------------------------------

/**
 * Single-pass replacement for the old three-pass `getType()`.
 *
 * Priority (highest first):
 *  1. Keywords (class, interface, participant, if, state, …)
 *  2. Definition/block-opener lines → ClassComponent
 *  3. UseCase brackets → UseCase
 *  4. Class arrows → ClassComponent
 *  5. Sequence arrows → Sequence
 */
export function getDiagramType(content: Array<string>): DiagramType {
  let hasClassComponentDef = false;
  let hasUseCase = false;
  let hasClassArrow = false;
  let hasSequenceArrow = false;

  for (const line of content) {
    // Priority 1: keyword match → immediate return (highest priority)
    const tpe = _getTypeByKeywords(line);
    if (tpe != DiagramType.Unknown) {
      return tpe;
    }

    // Priority 2: definition or block-opener (was pass 2's first half)
    if (line !== "...") {
      if (isDefinition(line) || isBlockOpener(line)) {
        hasClassComponentDef = true;
      }
      // Priority 3: use-case pattern (was pass 2's second half)
      if (REGEX_USE_CASE.test(line)) {
        hasUseCase = true;
      }
    }

    // Priority 4: class-component arrows (was pass 3)
    if (isClassArrow(line)) {
      hasClassArrow = true;
    }

    // Priority 5: sequence arrows (was pass 4)
    if (isSequenceArrow(line)) {
      hasSequenceArrow = true;
    }
  }

  // Return the highest-priority fallback that was found
  if (hasClassComponentDef) return DiagramType.ClassComponent;
  if (hasUseCase) return DiagramType.UseCase;
  if (hasClassArrow) return DiagramType.ClassComponent;
  if (hasSequenceArrow) return DiagramType.Sequence;
  return DiagramType.Unknown;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _getTypeByKeywords(line: string): DiagramType {
  const m = RegToken.exec(line);
  if (m) {
    const keyword = m[1];
    /* v8 ignore else @preserve */
    if (keyword != null && keyword.length > 0) {
      const t = keyMap.get(keyword);
      if (t != null) {
        return t;
      }
    }
  }
  return DiagramType.Unknown;
}
