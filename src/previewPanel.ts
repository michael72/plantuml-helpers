 
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
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _messageHandler: MessageHandler | undefined;
  //private _pendingUpdateTimer: ReturnType<typeof setTimeout> | undefined;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

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

 updateSvg(svg: string): void {
     
    this._panel.webview.postMessage({
      type: 'render',
      svg,
      animate: true,
    });
  }

  showLoading(): void {
    this._panel.webview.postMessage({ type: 'loading' });
  }

  showError(message: string): void {
    this._panel.webview.postMessage({ type: 'error', message });
  }

  private getWebviewContent(): string {
    const webviewScript = this.getWebviewUri('dist/webview.js');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    script-src ${this._panel.webview.cspSource};
    style-src 'unsafe-inline';
  ">
  <style>
    body { margin: 0; padding: 16px; background: white; }
    #diagram-container { width: 100%; height: 100%; }
    #diagram-container svg { max-width: 100%; height: auto; }
    .loading { display: flex; justify-content: center; align-items: center; height: 200px; color: #666; }
    .error { color: #d32f2f; padding: 16px; }
  </style>
</head>
<body>
  <div id="diagram-container"></div>
  <script src="${webviewScript.toString()}"></script>
</body>
</html>`;
  }

  private getWebviewUri(relativePath: string): vscode.Uri {
    const uri = vscode.Uri.joinPath(this._extensionUri, relativePath);
    return this._panel.webview.asWebviewUri(uri);
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


/* v8 ignore stop */
