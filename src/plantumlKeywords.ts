/**
 * Keyword and snippet data used by the PlantUML completion provider.
 *
 * This module is intentionally free of any `vscode` dependency so the data
 * (and the helpers that derive from it) can be unit-tested in isolation. The
 * completion provider maps these plain objects onto `vscode.CompletionItem`s.
 */

/** The kind of completion entry, mirrored onto `vscode.CompletionItemKind`. */
export type PlantUmlCompletionKind =
  | "keyword"
  | "type"
  | "function"
  | "snippet";

/** A single completion entry. */
export interface PlantUmlCompletion {
  /** The text shown in the completion list and inserted (unless snippet). */
  label: string;
  /** How the entry is categorised (drives the icon and grouping). */
  kind: PlantUmlCompletionKind;
  /** Short human-readable description shown next to the label. */
  detail: string;
  /**
   * Optional snippet body (VS Code snippet syntax, e.g. `${1:name}`). When
   * present the entry is inserted as a snippet rather than plain text.
   */
  insertText?: string;
  /** Optional longer documentation shown in the details fly-out. */
  documentation?: string;
}

/** Diagram start/end markers. */
const DIAGRAM_MARKERS = [
  "@startuml",
  "@enduml",
  "@startmindmap",
  "@endmindmap",
  "@startgantt",
  "@endgantt",
  "@startsalt",
  "@endsalt",
  "@startjson",
  "@endjson",
  "@startyaml",
  "@endyaml",
  "@startwbs",
  "@endwbs",
];

/** Element/type declaration keywords (get the "type" icon). */
const TYPE_KEYWORDS = [
  "abstract",
  "abstract class",
  "class",
  "interface",
  "enum",
  "annotation",
  "entity",
  "struct",
  "protocol",
  "exception",
  "component",
  "actor",
  "participant",
  "boundary",
  "control",
  "database",
  "collections",
  "queue",
  "usecase",
  "object",
  "map",
  "json",
  "state",
  "node",
  "folder",
  "frame",
  "cloud",
  "package",
  "namespace",
  "rectangle",
  "card",
  "agent",
  "artifact",
  "storage",
  "stack",
  "file",
  "person",
  "hexagon",
  "label",
  "circle",
  "together",
];

/** Control-flow and structural keywords (get the "keyword" icon). */
const CONTROL_KEYWORDS = [
  "start",
  "stop",
  "end",
  "if",
  "then",
  "else",
  "elseif",
  "endif",
  "while",
  "endwhile",
  "fork",
  "fork again",
  "end fork",
  "split",
  "split again",
  "end split",
  "partition",
  "repeat",
  "repeat while",
  "backward",
  "detach",
  "kill",
  "switch",
  "case",
  "endswitch",
  "goto",
  "alt",
  "opt",
  "loop",
  "par",
  "break",
  "critical",
  "group",
  "box",
  "end box",
  "note",
  "note left",
  "note right",
  "note top",
  "note bottom",
  "note over",
  "end note",
  "hnote",
  "rnote",
  "ref over",
  "over",
  "activate",
  "deactivate",
  "destroy",
  "create",
  "return",
  "autonumber",
  "autoactivate",
  "newpage",
  "title",
  "header",
  "footer",
  "caption",
  "legend",
  "end legend",
  "as",
  "also",
  "hide",
  "show",
  "remove",
  "restore",
  "left to right direction",
  "top to bottom direction",
];

/** Built-in commands / configuration keywords (get the "function" icon). */
const COMMAND_KEYWORDS = [
  "skinparam",
  "scale",
  "mainframe",
  "sprite",
  "style",
  "allow_mixing",
  "allowmixing",
  "hide empty description",
  "hide empty members",
  "hide circle",
  "hide stereotype",
  "set namespaceSeparator",
  "!define",
  "!undef",
  "!include",
  "!includeurl",
  "!theme",
  "!pragma",
  "!function",
  "!procedure",
  "!ifdef",
  "!ifndef",
  "!endif",
  "!else",
];

/** Ready-to-use multi-line snippets. */
const SNIPPETS: PlantUmlCompletion[] = [
  {
    label: "startuml",
    kind: "snippet",
    detail: "@startuml … @enduml block",
    insertText: "@startuml\n$0\n@enduml",
    documentation: "Insert a PlantUML diagram skeleton.",
  },
  {
    label: "note-block",
    kind: "snippet",
    detail: "note … end note block",
    insertText: "note ${1|left,right,top,bottom|} of ${2:element}\n$0\nend note",
    documentation: "Insert a multi-line note attached to an element.",
  },
  {
    label: "if-else",
    kind: "snippet",
    detail: "activity if / else / endif",
    insertText: "if (${1:condition?}) then (${2:yes})\n  $0\nelse (${3:no})\nendif",
    documentation: "Insert an activity-diagram conditional.",
  },
  {
    label: "alt-block",
    kind: "snippet",
    detail: "sequence alt / else / end",
    insertText: "alt ${1:condition}\n  $0\nelse ${2:otherwise}\nend",
    documentation: "Insert a sequence-diagram alternative fragment.",
  },
  {
    label: "loop-block",
    kind: "snippet",
    detail: "sequence loop / end",
    insertText: "loop ${1:condition}\n  $0\nend",
    documentation: "Insert a sequence-diagram loop fragment.",
  },
  {
    label: "package-block",
    kind: "snippet",
    detail: "package { … } block",
    insertText: 'package "${1:name}" {\n  $0\n}',
    documentation: "Insert a package grouping block.",
  },
];

/**
 * Builds the full list of completion entries. The result is stable and can be
 * cached by the caller.
 */
export function getPlantUmlCompletions(): PlantUmlCompletion[] {
  const items: PlantUmlCompletion[] = [];

  for (const label of DIAGRAM_MARKERS) {
    items.push({ label, kind: "keyword", detail: "diagram marker" });
  }
  for (const label of TYPE_KEYWORDS) {
    items.push({ label, kind: "type", detail: "element type" });
  }
  for (const label of CONTROL_KEYWORDS) {
    items.push({ label, kind: "keyword", detail: "keyword" });
  }
  for (const label of COMMAND_KEYWORDS) {
    items.push({ label, kind: "function", detail: "command" });
  }
  items.push(...SNIPPETS);

  return items;
}
