// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as rotate from "./rotate";
import * as reformat from "./reformat";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext): void {
  const swapLine = vscode.commands.registerTextEditorCommand(
    "pumlhelper.swapLine",
    (textEditor: vscode.TextEditor) => {
      rotateSelected(textEditor, rotate.RotateDirection.Swap);
    }
  );
  const rotateLeft = vscode.commands.registerTextEditorCommand(
    "pumlhelper.rotateLineLeft",
    (textEditor: vscode.TextEditor) => {
      rotateSelected(textEditor, rotate.RotateDirection.Left);
    }
  );
  const rotateRight = vscode.commands.registerTextEditorCommand(
    "pumlhelper.rotateLineRight",
    (textEditor: vscode.TextEditor) => {
      rotateSelected(textEditor, rotate.RotateDirection.Right);
    }
  );
  const autoFormat = vscode.commands.registerTextEditorCommand(
    "pumlhelper.autoFormat",
    (textEditor: vscode.TextEditor) => {
      autoFormatContent(textEditor, false);
    }
  );
  const reFormat = vscode.commands.registerTextEditorCommand(
    "pumlhelper.reFormat",
    (textEditor: vscode.TextEditor) => {
      autoFormatContent(textEditor, true);
    }
  );
  for (const s of [swapLine, rotateLeft, rotateRight, autoFormat, reFormat]) {
    context.subscriptions.push(s);
  }
}

export function deactivate(): void {
  // nothing to do
}

function rotateSelected(
  textEditor: vscode.TextEditor,
  dir: rotate.RotateDirection
): void {
  if (textEditor != null) {
    const document = textEditor.document;
    void textEditor.edit((editBuilder) => {
      for (const sel of textEditor.selections) {
        const range =
          sel.isEmpty || sel.isSingleLine
            ? document.lineAt(sel.active.line).range
            : sel;
        const lines = document.getText(range);
        const rotated = lines.split("\n").map((line) => {
          return rotate.rotateLine(line, dir);
        });
        editBuilder.replace(range, rotated.join("\n"));
      }
    }); // apply the (accumulated) replacement(s) (if multiple cursors/selections)
  }
}

function autoFormatContent(textEditor: vscode.TextEditor, rebuild: boolean): void {
  if (textEditor != null) {
    const document = textEditor.document;
    void textEditor.edit((editBuilder) => {
      for (const sel of textEditor.selections) {
        let range = sel;
        if (sel.isEmpty || sel.isSingleLine) {
          let line = sel.active.line;
          while (line >= 0 && line < document.lineCount) {
            const text = document.lineAt(line).text.trim();
            const nextLine = (line + 1) < document.lineCount ?
              document.lineAt(line + 1).text.trim() : "";
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
          while (last < document.lineCount) {
            const text = document.lineAt(last).text.trim();
            if (text === "@enduml" || text === "```" || (text.includes("}") && bracketCount === 1)) {
              if (!text.includes("}")) {
                last -= 1;
              }
              break;
            }
            else if (text.includes("{")) {
              bracketCount += 1;
            }
            else if (text.includes("}")) {
              bracketCount -= 1;
            }
            last += 1;
          }
          if (last == document.lineCount || line < 0) {
            void vscode.window.showErrorMessage(
              "No PlantUML found in current selection!"
            );
            return;
          }

          range = new vscode.Selection(
            line,
            0,
            last,
            document.lineAt(last).range.end.character
          );
          textEditor.selection = range;
        }
        const oldText = document.getText(range);
        try {
          const newText = reformat.autoFormatTxt(oldText, rebuild);
          if (oldText.trim() === newText.trim()) {
            void vscode.window.showInformationMessage(
              "The diagram was already sorted."
            );
          } else {
            editBuilder.replace(range, newText);
          }
        } catch (e) {
          if (e instanceof Error) {
            void vscode.window.showErrorMessage(e.message);
          } else {
            throw e;
          }
        }
      }
    }); // apply the (accumulated) replacement(s) (if multiple cursors/selections)
  }
}
