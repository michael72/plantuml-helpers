import * as vscode from "vscode";

/**
 * Manages the PlantUML preview webview panel.
 * This panel displays SVG content rendered from PlantUML diagrams.
 */
export class PlantUmlPreviewPanel {
  public static currentPanel: PlantUmlPreviewPanel | undefined;
  public static readonly viewType = "plantumlPreview";

  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

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
  }

  /**
   * Creates or shows the preview panel.
   */
  public static createOrShow(extensionUri: vscode.Uri): PlantUmlPreviewPanel {
    const column = vscode.ViewColumn.Beside;

    // If panel already exists, show it
    if (PlantUmlPreviewPanel.currentPanel) {
      PlantUmlPreviewPanel.currentPanel._panel.reveal(column);
      return PlantUmlPreviewPanel.currentPanel;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      PlantUmlPreviewPanel.viewType,
      "PlantUML Preview",
      column,
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

    .controls {
      margin-bottom: 16px;
      display: flex;
      gap: 8px;
    }

    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 12px;
      border-radius: 2px;
      cursor: pointer;
      font-family: var(--vscode-font-family);
      font-size: 13px;
    }

    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
  </style>
</head>
<body>
  <div class="controls">
    <button onclick="zoomIn()">Zoom In</button>
    <button onclick="zoomOut()">Zoom Out</button>
    <button onclick="resetZoom()">Reset</button>
  </div>
  <div class="container">
    ${
      svgContent
        ? `<div class="svg-container" id="svg-container">${svgContent}</div>`
        : `<div class="placeholder">No diagram to display.<br><br>Place your cursor in a PlantUML diagram and run the preview command.</div>`
    }
  </div>
  <script nonce="${nonce}">
    let currentZoom = 1;
    const zoomStep = 0.1;

    function zoomIn() {
      currentZoom += zoomStep;
      applyZoom();
    }

    function zoomOut() {
      currentZoom = Math.max(0.1, currentZoom - zoomStep);
      applyZoom();
    }

    function resetZoom() {
      currentZoom = 1;
      applyZoom();
    }

    function applyZoom() {
      const container = document.getElementById('svg-container');
      if (container) {
        container.style.transform = 'scale(' + currentZoom + ')';
        container.style.transformOrigin = 'top left';
      }
    }
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
