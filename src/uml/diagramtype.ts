export enum DiagramType {
  ClassComponent, // class and component (or object) diagram: not distinguished
  Sequence,
  UseCase,
  Activity,
  State,
  Timing,
  Unknown,
}

export const REGEX_INTERFACE = /^\s*(\(\)|interface)\s+((?:"[^"]+")|[^"\s]+)(?:\s+as\s+(\S+))?\s*$/;
export const REGEX_COMPONENT = /^\s*(component\s+)?((?:\[[^*\]]+\])|[^[*\]\s]+)(?:\s+as\s+(\S+))?\s*$/;
export const REGEX_CLASS = /^\s*(class|enum)\s+([^[\]\s]+)(?:\s+as\s+(\S+))?\s*$/;
export const REGEX_SEQUENCE = /^\s*(actor|participant)\s+([^[\]\s]+)(?:\s+as\s+(\S+))?\s*$/;
export const REGEX_USE_CASE = /(?:^|\s+)(?::([^:]+):)|(?:\(([^:]+)\))(?:$|\s+)/g;
export const REGEX_ACTIVITY = /(?:(?:^|\s+)\(\*\)(?:$|\s+))|(?:^\s*:.*)/g;
export const REGEX_STATE = /(?:^|\s+)\[\*\](?:$|\s+)/g;
const REGEX_COMP_USE = /(?:^|\s+)(?:\[[^*\]]+\])(?:$|\s+)/g;

// actor could be both sequence and usecase diagram
const keyMap: Map<string, DiagramType> = new Map([
  ["class", DiagramType.ClassComponent],
  ["interface", DiagramType.ClassComponent],
  ["component", DiagramType.ClassComponent],
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

function _getTypeByKeywords(line: string): DiagramType {
  const m = RegToken.exec(line);
  if (m) {
    const t = keyMap.get(m[1]);
    if (t != null) {
      return t;
    }
  }
  return DiagramType.Unknown;
}

export function getType(content: Array<string>): DiagramType {
  for (const line of content) {
    const tpe = _getTypeByKeywords(line);
    if (tpe != DiagramType.Unknown) {
      return tpe;
    }
  }
  // no (unique) keyword found?
  // check for "special strings"
  // :xyz: -> UseCase
  // [abc] or () "foo" -> Component
  for (const line of content) {
    if (
      REGEX_INTERFACE.exec(line) ||
      REGEX_COMPONENT.exec(line) ||
      REGEX_CLASS.exec(line) ||
      REGEX_COMP_USE.exec(line)
    ) {
      return DiagramType.ClassComponent;
    }
    if (REGEX_USE_CASE.exec(line)) {
      return DiagramType.UseCase;
    }
  }
  // arrows <|-, *-, o- -> Class or Component
  for (const line of content) {
    for (const arrow of ["<|-", "*-", "o-", "-|>", "-*", "-o"]) {
      if (line.indexOf(arrow) != -1) {
        return DiagramType.ClassComponent;
      }
    }
  }
  // nothing found, but -> arrows -> (probably) Sequence
  for (const line of content) {
    for (const arrow of ["->", "<-", " ++ ", " ** "]) {
      if (line.indexOf(arrow) != -1) {
        return DiagramType.Sequence;
      }
    }
  }
  return DiagramType.Unknown;
}
