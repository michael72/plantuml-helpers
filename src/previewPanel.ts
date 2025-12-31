/* v8 ignore start - this UI file is not tested */

import * as vscode from "vscode";

/**
 * Message handler type for webview messages.
 */
export type MessageHandler = (command: string) => void;

/**
 * Manages the PlantUML preview webview panel.
 * This panel displays SVG content rendered from PlantUML diagrams.
 */
export class PlantUmlPreviewPanel {
  public static currentPanel: PlantUmlPreviewPanel | undefined;
  public static readonly viewType = "plantumlPreview";

  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _messageHandler: MessageHandler | undefined;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private constructor(panel: vscode.WebviewPanel, _extensionUri: vscode.Uri) {
    this._panel = panel;

    // Set initial content
    this._updateContent("");

    // Handle panel disposal
    this._panel.onDidDispose(
      () => {
        this.dispose();
      },
      null,
      this._disposables
    );

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message: { command: string }) => {
        if (this._messageHandler) {
          this._messageHandler(message.command);
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Sets the message handler for webview commands.
   */
  public setMessageHandler(handler: MessageHandler): void {
    this._messageHandler = handler;
  }

  /**
   * Creates or shows the preview panel.
   */
  public static createOrShow(extensionUri: vscode.Uri): PlantUmlPreviewPanel {
    const column = vscode.ViewColumn.Beside;

    // If panel already exists, show it without stealing focus
    if (PlantUmlPreviewPanel.currentPanel) {
      PlantUmlPreviewPanel.currentPanel._panel.reveal(column, true);
      return PlantUmlPreviewPanel.currentPanel;
    }

    // Otherwise, create a new panel (preserveFocus: true to keep editor focused)
    const panel = vscode.window.createWebviewPanel(
      PlantUmlPreviewPanel.viewType,
      "PlantUML Preview",
      { viewColumn: column, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    PlantUmlPreviewPanel.currentPanel = new PlantUmlPreviewPanel(
      panel,
      extensionUri
    );
    return PlantUmlPreviewPanel.currentPanel;
  }

  /**
   * Updates the webview content with the provided SVG.
   */
  public updateSvg(svgContent: string): void {
    this._updateContent(svgContent);
  }

  /**
   * Shows an error message in the preview panel.
   */
  public showError(message: string): void {
    this._panel.webview.html = this._getErrorHtml(message);
  }

  /**
   * Shows a loading indicator in the preview panel.
   */
  public showLoading(): void {
    this._panel.webview.html = this._getLoadingHtml();
  }

  private _updateContent(svgContent: string): void {
    this._panel.webview.html = this._getWebviewContent(svgContent);
  }

  private _getWebviewContent(svgContent: string): string {
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>PlantUML Preview</title>
  <style>
    body {
      margin: 0;
      padding: 16px;
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      box-sizing: border-box;
    }

    .container {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      width: 100%;
      overflow: auto;
    }

    .svg-container {
      background-color: white;
      padding: 16px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      max-width: 100%;
      overflow: auto;
    }

    .svg-container svg {
      max-width: 100%;
      height: auto;
    }

    .placeholder {
      color: var(--vscode-descriptionForeground);
      font-family: var(--vscode-font-family);
      font-size: 14px;
      text-align: center;
      padding: 40px;
    }

    .toolbar {
      margin-bottom: 16px;
      display: flex;
      gap: 4px;
      background-color: var(--vscode-editor-background);
      padding: 4px;
      border-radius: 4px;
    }

    .toolbar-group {
      display: flex;
      gap: 2px;
    }

    .toolbar-separator {
      width: 1px;
      background-color: var(--vscode-widget-border, #444);
      margin: 0 8px;
    }

    .icon-button {
      background-color: transparent;
      color: var(--vscode-icon-foreground, var(--vscode-editor-foreground));
      border: none;
      padding: 6px 8px;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 28px;
    }

    .icon-button:hover {
      background-color: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
    }

    .icon-button:active {
      background-color: var(--vscode-toolbar-activeBackground, rgba(99, 102, 103, 0.31));
    }

    .icon-button svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }

    .zoom-level {
      font-family: var(--vscode-font-family);
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      min-width: 40px;
      text-align: center;
      line-height: 28px;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-group">
      <button class="icon-button" id="btn-zoom-out" title="Zoom Out">
        <svg viewBox="0 0 16 16"><path d="M7.5 1a6.5 6.5 0 1 0 4.13 11.53l2.92 2.93a.75.75 0 0 0 1.06-1.06l-2.93-2.92A6.5 6.5 0 0 0 7.5 1zM2 7.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0zm3.25 0a.75.75 0 0 1 .75-.75h5a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75z"/></svg>
      </button>
      <span class="zoom-level" id="zoom-level">100%</span>
      <button class="icon-button" id="btn-zoom-in" title="Zoom In">
        <svg viewBox="0 0 16 16"><path d="M7.5 1a6.5 6.5 0 1 0 4.13 11.53l2.92 2.93a.75.75 0 0 0 1.06-1.06l-2.93-2.92A6.5 6.5 0 0 0 7.5 1zM2 7.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0zm4.75-2a.75.75 0 0 1 .75.75V7h.75a.75.75 0 0 1 0 1.5H7.5v.75a.75.75 0 0 1-1.5 0V8.5h-.75a.75.75 0 0 1 0-1.5H6v-.75A.75.75 0 0 1 6.75 5.5z"/></svg>
      </button>
      <button class="icon-button" id="btn-reset-zoom" title="Reset Zoom to 100%">
        <svg viewBox="0 0 16 16"><path d="M4.5 2A2.5 2.5 0 0 0 2 4.5v7A2.5 2.5 0 0 0 4.5 14h7a2.5 2.5 0 0 0 2.5-2.5v-7A2.5 2.5 0 0 0 11.5 2h-7zM3.5 4.5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7z"/></svg>
      </button>
    </div>
    <div class="toolbar-separator"></div>
    <div class="toolbar-group">
      <button class="icon-button" id="btn-auto-format" title="Auto Format - Optimize arrow layout">
        <svg viewBox="0 0 16 16"><path d="M2.5 4a.5.5 0 0 0 0 1h11a.5.5 0 0 0 0-1h-11zm0 4a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1h-7zm0 4a.5.5 0 0 0 0 1h11a.5.5 0 0 0 0-1h-11z"/><path d="M12.354 7.146a.5.5 0 0 1 0 .708l-2 2a.5.5 0 0 1-.708-.708L11.293 7.5 9.646 5.854a.5.5 0 1 1 .708-.708l2 2z"/></svg>
      </button>
      <button class="icon-button" id="btn-reset-arrows" title="Reset Arrow Directions to Defaults">
        <svg viewBox="0 0 16 16"><path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 1 1 .908-.418A6 6 0 1 1 8 2v1z"/><path d="M8 1.5V5l3-2.5L8 0v1.5z"/></svg>
      </button>
    </div>
  </div>
  <div class="container">
    ${
      svgContent
        ? `<div class="svg-container" id="svg-container">${svgContent}</div>`
        : `<div class="placeholder">No diagram to display.<br><br>Place your cursor in a PlantUML diagram and run the preview command.</div>`
    }
  </div>
  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();
      let currentZoom = 1;
      const zoomStep = 0.1;

      function updateZoomDisplay() {
        const zoomLevel = document.getElementById('zoom-level');
        if (zoomLevel) {
          zoomLevel.textContent = Math.round(currentZoom * 100) + '%';
        }
      }

      function applyZoom() {
        const container = document.getElementById('svg-container');
        if (container) {
          container.style.transform = 'scale(' + currentZoom + ')';
          container.style.transformOrigin = 'top left';
        }
        updateZoomDisplay();
      }

      // Zoom In
      document.getElementById('btn-zoom-in').addEventListener('click', function() {
        currentZoom += zoomStep;
        applyZoom();
      });

      // Zoom Out
      document.getElementById('btn-zoom-out').addEventListener('click', function() {
        currentZoom = Math.max(0.1, currentZoom - zoomStep);
        applyZoom();
      });

      // Reset Zoom
      document.getElementById('btn-reset-zoom').addEventListener('click', function() {
        currentZoom = 1;
        applyZoom();
      });

      // Auto Format
      document.getElementById('btn-auto-format').addEventListener('click', function() {
        vscode.postMessage({ command: 'autoFormat' });
      });

      // Reset Arrows
      document.getElementById('btn-reset-arrows').addEventListener('click', function() {
        vscode.postMessage({ command: 'resetArrows' });
      });
    })();
  </script>
</body>
</html>`;
  }

  private _getLoadingHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PlantUML Preview</title>
  <style>
    body {
      margin: 0;
      padding: 16px;
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      font-family: var(--vscode-font-family);
    }

    .loading {
      text-align: center;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--vscode-editor-foreground);
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="loading">
    <div class="spinner"></div>
    <div>Generating diagram...</div>
  </div>
</body>
</html>`;
  }

  private _getErrorHtml(message: string): string {
    const escapedMessage = message
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PlantUML Preview - Error</title>
  <style>
    body {
      margin: 0;
      padding: 16px;
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      font-family: var(--vscode-font-family);
    }

    .error {
      text-align: center;
      padding: 24px;
      background-color: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      border-radius: 4px;
      max-width: 600px;
    }

    .error-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .error-message {
      color: var(--vscode-errorForeground);
    }
  </style>
</head>
<body>
  <div class="error">
    <div class="error-icon">⚠️</div>
    <div class="error-message">${escapedMessage}</div>
  </div>
</body>
</html>`;
  }

  public dispose(): void {
    PlantUmlPreviewPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}

function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/* v8 ignore stop */
