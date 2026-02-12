/* v8 ignore start */
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as rotate from "./rotate.js";
import * as reformat from "./reformat.js";
import { PlantUmlPreviewPanel } from "./previewPanel.js";
import { extractUml } from "./selection.js";
import { fetchSvg } from "./plantumlService.js";
import { plantUmlPlugin } from "./markdownItPlugin.js";

// Track the current preview state
let lastDiagramText: string | undefined;
let updateTimeout: ReturnType<typeof setTimeout> | undefined;
const UPDATE_DELAY_MS = 100; // Debounce delay

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
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
      if (textEditor) {
        const range = extractUml(textEditor);
        if (!range) {
          void vscode.window.showErrorMessage(
            "No PlantUML diagram found at cursor position"
          );
        }

        const diagramText =
          textEditor === undefined || range === undefined
            ? ""
            : textEditor.document.getText(range);
        lastDiagramText = diagramText;
      } else {
        void vscode.window.showErrorMessage("No active text editor");
      }
      await updatePreview(context.extensionUri, lastDiagramText ?? "");
    }
  );

  // Listen for text document changes to update the preview
  const textChangeListener = vscode.workspace.onDidChangeTextDocument(
    (event) => {
      // Only update if we have an active preview and the changed document matches
      if (!PlantUmlPreviewPanel.currentPanel) {
        return;
      }

      // Debounce updates
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }

      updateTimeout = setTimeout(() => {
        void updatePreviewFromDocument(context.extensionUri, event.document);
      }, UPDATE_DELAY_MS);
    }
  );

  for (const s of [
    swapLine,
    rotateLeft,
    rotateRight,
    autoFormat,
    reFormat,
    showPreview,
    textChangeListener,
  ]) {
    context.subscriptions.push(s);
  }

  return {
    extendMarkdownIt(md: unknown) {
      plantUmlPlugin(md as Parameters<typeof plantUmlPlugin>[0]);
      return md;
    },
  };
}

/**
 * Updates the preview panel with the given diagram text.
 */
async function updatePreview(
  extensionUri: vscode.Uri,
  diagramText: string
): Promise<void> {
  const panel = PlantUmlPreviewPanel.createOrShow(extensionUri);

  // Set up message handler for toolbar commands
  panel.setMessageHandler((command: string) => {
    void handlePreviewCommand(command);
  });

  panel.showLoading();

  try {
    const svg = await fetchSvg(diagramText);
    panel.updateSvg(svg);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    panel.showError(message);
  }
}

/**
 * Handles commands from the preview panel toolbar.
 */
async function handlePreviewCommand(command: string): Promise<void> {
  // Find the editor for the tracked document
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    void vscode.window.showErrorMessage(
      "Source editor is no longer visible. Please reopen the preview."
    );
    return;
  }

  // Perform the requested action
  if (command === "autoFormat") {
    await performFormatting(editor, false);
  } else if (command === "resetArrows") {
    await performFormatting(editor, true);
  }
}

/**
 * Performs formatting on the editor and refreshes the preview.
 */
async function performFormatting(
  textEditor: vscode.TextEditor,
  rebuild: boolean
): Promise<void> {
  const range = extractUml(textEditor);
  if (range === undefined) {
    void vscode.window.showErrorMessage(
      "No PlantUML found in current selection!"
    );
    return;
  }

  const oldText = textEditor.document.getText(range);
  try {
    const newText = reformat.autoFormatTxt(oldText, rebuild);
    if (oldText.trim() === newText.trim()) {
      void vscode.window.showInformationMessage(
        "The diagram was already sorted."
      );
    } else {
      await textEditor.edit((editBuilder) => {
        editBuilder.replace(range, newText);
      });
      // The preview will auto-update via onDidChangeTextDocument
    }
  } catch (e) {
    if (e instanceof Error) {
      void vscode.window.showErrorMessage(e.message);
    } else {
      throw e;
    }
  }
}

/**
 * Extracts the diagram from a document and updates the preview if changed.
 */
async function updatePreviewFromDocument(
  extensionUri: vscode.Uri,
  document: vscode.TextDocument
): Promise<void> {
  // Find the diagram in the document using the active editor position
  const textEditor = vscode.window.activeTextEditor;
  if (textEditor?.document.uri.toString() !== document.uri.toString()) {
    return;
  }

  const range = extractUml(textEditor);
  if (!range) {
    return;
  }

  const diagramText = document.getText(range);

  // Only update if the diagram text actually changed
  if (diagramText === lastDiagramText) {
    return;
  }

  lastDiagramText = diagramText;
  await updatePreview(extensionUri, diagramText);
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
