import * as vscode from "vscode";
import {
  getPlantUmlCompletions,
  PlantUmlCompletion,
  PlantUmlCompletionKind,
} from "./plantumlKeywords.js";

// Fence info strings that mark a code block as PlantUML - the same set used by
// the markdown-it plugin (see markdownItPlugin.ts) and the CLI formatter.
const PLANTUML_FENCE_INFOS: ReadonlySet<string> = new Set(["plantuml", "puml"]);

const FENCE_OPEN = /^\s*(`{3,}|~{3,})\s*(\S*)\s*$/;

/**
 * Determines whether the given line sits inside a ```plantuml / ```puml
 * fenced code block. The fence lines themselves are not considered "inside".
 *
 * This is pure logic (no `vscode` dependency) so it can be unit-tested.
 *
 * @param lines     All lines of the document.
 * @param lineIndex The zero-based line to test.
 */
export function isInsidePlantumlFence(
  lines: string[],
  lineIndex: number
): boolean {
  let insidePlantuml = false;
  let fence: string | undefined;

  for (let i = 0; i <= lineIndex; i++) {
    const line = lines[i] ?? "";
    if (fence === undefined) {
      const open = FENCE_OPEN.exec(line);
      if (open !== null) {
        // An opening fence marker is markdown, not diagram content.
        if (i === lineIndex) {
          return false;
        }
        fence = open[1] ?? "";
        insidePlantuml = PLANTUML_FENCE_INFOS.has((open[2] ?? "").toLowerCase());
      }
    } else {
      // Inside a block - look for the matching closing fence (same character,
      // at least the same length).
      const fenceChar = fence.charAt(0);
      const trimmed = line.trim();
      const isClose =
        trimmed.length >= fence.length &&
        trimmed.split("").every((c) => c === fenceChar);
      if (isClose) {
        // A closing fence marker is markdown, not diagram content.
        if (i === lineIndex) {
          return false;
        }
        fence = undefined;
        insidePlantuml = false;
      } else if (i === lineIndex) {
        return insidePlantuml;
      }
    }
  }

  return fence !== undefined && insidePlantuml;
}

/* v8 ignore start - the provider wiring depends on the vscode runtime */

function toCompletionKind(
  kind: PlantUmlCompletionKind
): vscode.CompletionItemKind {
  switch (kind) {
    case "type":
      return vscode.CompletionItemKind.Class;
    case "function":
      return vscode.CompletionItemKind.Function;
    case "snippet":
      return vscode.CompletionItemKind.Snippet;
    case "keyword":
    default:
      return vscode.CompletionItemKind.Keyword;
  }
}

function toCompletionItem(
  entry: PlantUmlCompletion,
  range: vscode.Range
): vscode.CompletionItem {
  const item = new vscode.CompletionItem(
    entry.label,
    toCompletionKind(entry.kind)
  );
  item.detail = entry.detail;
  item.range = range;
  if (entry.documentation !== undefined) {
    item.documentation = new vscode.MarkdownString(entry.documentation);
  }
  if (entry.insertText !== undefined) {
    item.insertText = new vscode.SnippetString(entry.insertText);
  }
  return item;
}

// The word being completed, including a leading @ or ! (which are not normal
// word characters but start many PlantUML keywords).
const WORD_PREFIX = /[@!]?[\w]*$/;

class PlantUmlCompletionProvider implements vscode.CompletionItemProvider {
  // The keyword list is static, so build the raw data once.
  private readonly entries = getPlantUmlCompletions();

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.CompletionItem[] | undefined {
    // Inside markdown, only offer completions within a plantuml code fence.
    if (document.languageId === "markdown") {
      const lines = document.getText().split(/\r?\n/);
      if (!isInsidePlantumlFence(lines, position.line)) {
        return undefined;
      }
    }

    const linePrefix = document
      .lineAt(position.line)
      .text.slice(0, position.character);
    const match = WORD_PREFIX.exec(linePrefix);
    const start =
      match === null ? position.character : position.character - match[0].length;
    const range = new vscode.Range(position.line, start, position.line, position.character);

    return this.entries.map((entry) => toCompletionItem(entry, range));
  }
}

/**
 * Registers the PlantUML keyword/snippet completion provider for plain
 * PlantUML files and for PlantUML code fences inside markdown documents.
 */
export function registerPlantUmlCompletionProvider(): vscode.Disposable {
  const provider = new PlantUmlCompletionProvider();
  return vscode.languages.registerCompletionItemProvider(
    [{ language: "plantuml" }, { language: "markdown" }],
    provider,
    "@",
    "!"
  );
}

/* v8 ignore stop */
