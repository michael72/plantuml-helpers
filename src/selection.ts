import * as vscode from "vscode";

export function extractUml(
  textEditor: vscode.TextEditor
): vscode.Selection | undefined {
  const document = textEditor.document;
  for (const sel of textEditor.selections) {
    if (sel.isEmpty || sel.isSingleLine) {
      let line = sel.active.line;
      while (line >= 0 && line < document.lineCount) {
        const text = document.lineAt(line).text.trim();
        const nextLine =
          line + 1 < document.lineCount
            ? document.lineAt(line + 1).text.trim()
            : "";
        if (
          // auto format starting from the start of the document (without start)
          // or from opening bracket - including that bracket
          text.startsWith("@startuml") ||
          text === "```plantuml" ||
          text.includes("{") ||
          nextLine === "{"
        ) {
          if (text === "{") {
            // add identifier _before_ the opening bracket (like package etc.)
            line -= 1;
          } else if (nextLine !== "{" && !text.includes("{")) {
            line += 1;
          }
          break;
        }
        line -= 1;
      }
      let bracketCount = 0;
      let last = line;
      while (last >= 0 && last < document.lineCount) {
        const text = document.lineAt(last).text.trim();
        if (
          text === "@enduml" ||
          text === "```" ||
          (text.includes("}") && bracketCount === 1)
        ) {
          if (!text.includes("}")) {
            last -= 1;
          }
          break;
        } else if (text.includes("{")) {
          bracketCount += 1;
        } else if (text.includes("}")) {
          bracketCount -= 1;
        }
        last += 1;
      }
      if (last === document.lineCount || line < 0) {
        return undefined;
      }

      return new vscode.Selection(
        line,
        0,
        last,
        document.lineAt(last).range.end.character
      );
    }
    return sel;
  }
  return undefined;
}
