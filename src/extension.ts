/* v8 ignore start */
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as rotate from "./rotate.js";
import * as reformat from "./reformat.js";
import { PlantUmlPreviewPanel } from "./previewPanel.js";
import { extractUml } from "./selection.js";
import { fetchSvg } from "./plantumlService.js";

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

  const showPreview = vscode.commands.registerCommand(
    "pumlhelper.showPreview",
    async () => {
      const textEditor = vscode.window.activeTextEditor;
      if (!textEditor) {
        void vscode.window.showErrorMessage("No active text editor");
        return;
      }

      const range = extractUml(textEditor);
      if (!range) {
        void vscode.window.showErrorMessage(
          "No PlantUML diagram found at cursor position"
        );
        return;
      }

      const diagramText = textEditor.document.getText(range);
      const panel = PlantUmlPreviewPanel.createOrShow(context.extensionUri);

      panel.showLoading();

      try {
        const svg = await fetchSvg(diagramText);
        panel.updateSvg(svg);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error occurred";
        panel.showError(message);
        void vscode.window.showErrorMessage(
          `Failed to generate diagram: ${message}`
        );
      }
    }
  );

  for (const s of [
    swapLine,
    rotateLeft,
    rotateRight,
    autoFormat,
    reFormat,
    showPreview,
  ]) {
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

function autoFormatContent(
  textEditor: vscode.TextEditor,
  rebuild: boolean
): void {
  if (textEditor != null) {
    void textEditor.edit((editBuilder) => {
      const range = extractUml(textEditor);
      if (range === undefined) {
        void vscode.window.showErrorMessage(
          "No PlantUML found in current selection!"
        );
        return;
      } else {
        const oldText = textEditor.document.getText(range);
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
/* v8 ignore stop */
