import * as vscode from "vscode";
import { findUmlBoundaries } from "./umlBoundary.js";

/**
 * Extracts the UML diagram selection from a text editor.
 * Uses the cursor position to find the diagram boundaries.
 *
 * @param textEditor The VS Code text editor
 * @returns A Selection covering the UML diagram, or undefined if not found
 */
export function extractUml(
  textEditor: vscode.TextEditor
): vscode.Selection | undefined {
  const document = textEditor.document;

  for (const sel of textEditor.selections) {
    if (sel.isEmpty || sel.isSingleLine) {
      // Convert document to lines array
      const lines: string[] = [];
      for (let i = 0; i < document.lineCount; i++) {
        lines.push(document.lineAt(i).text);
      }

      // Find boundaries using pure function
      const boundary = findUmlBoundaries(lines, sel.active.line);
      if (boundary === undefined) {
        return undefined;
      }

      return new vscode.Selection(
        boundary.startLine,
        0,
        boundary.endLine,
        document.lineAt(boundary.endLine).range.end.character
      );
    }
    return sel;
  }
  return undefined;
}
