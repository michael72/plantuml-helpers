// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as rotate from "./rotate";
import * as reformat from "./reformat";

function autoFormatContent(textEditor: vscode.TextEditor): void {
  if (textEditor) {
    const document = textEditor.document;
    textEditor.edit((editBuilder) => {
      for (const sel of textEditor.selections) {
        let range = sel;
        if (sel.isEmpty || sel.isSingleLine) {
          let line = sel.active.line;
          let last = line;
          while (line >= 0) {
            const text = document.lineAt(line).text.trim();
            if (
              text.startsWith("@startuml") ||
              text === "```plantuml" ||
              text.indexOf("{") !== -1
            ) {
              line += 1;
              break;
            }
            line -= 1;
          }
          while (last < document.lineCount) {
            const text = document.lineAt(last).text.trim();
            if (
              text === "@enduml" ||
              text === "```" ||
              text.indexOf("}") !== -1
            ) {
              last -= 1;
              break;
            }
            last += 1;
          }
          if (last == document.lineCount || line < 0) {
            vscode.window.showErrorMessage(
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
        }
        editBuilder.replace(
          range,
          reformat.autoFormatTxt(document.getText(range))
        );
      }
    }); // apply the (accumulated) replacement(s) (if multiple cursors/selections)
  }
}

function rotateSelected(
  textEditor: vscode.TextEditor,
  dir: rotate.RotateDirection
): void {
  if (textEditor) {
    const document = textEditor.document;
    textEditor.edit((editBuilder) => {
      for (const sel of textEditor.selections) {
        const range =
          sel.isEmpty || sel.isSingleLine
            ? document.lineAt(sel.active.line).range || sel
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
      autoFormatContent(textEditor);
    }
  );
  for (const s of [swapLine, rotateLeft, rotateRight, autoFormat]) {
    context.subscriptions.push(s);
  }
}

export function deactivate(): void {
  // nothing to do
}
