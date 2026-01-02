/* v8 ignore start - this webview script is not tested */
/* global document */

/**
 * VS Code API interface for webview communication.
 */
interface VsCodeApi {
  postMessage(message: { command: string }): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

/**
 * Zoom controller for the PlantUML preview.
 */
class ZoomController {
  private currentZoom = 1;
  private readonly zoomStep = 0.1;
  private readonly minZoom = 0.1;

  private readonly wrapper: HTMLElement | null;
  private readonly svgContainer: HTMLElement | null;
  private readonly zoomLevelDisplay: HTMLElement | null;

  constructor() {
    this.wrapper = document.getElementById("zoom-wrapper");
    this.svgContainer = document.getElementById("svg-container");
    this.zoomLevelDisplay = document.getElementById("zoom-level");
  }

  zoomIn(): void {
    this.currentZoom += this.zoomStep;
    this.applyZoom();
  }

  zoomOut(): void {
    this.currentZoom = Math.max(this.minZoom, this.currentZoom - this.zoomStep);
    this.applyZoom();
  }

  resetZoom(): void {
    this.currentZoom = 1;
    this.applyZoom();
  }

  private applyZoom(): void {
    if (this.wrapper && this.svgContainer) {
      // Apply the scale transform
      this.wrapper.style.transform = `scale(${this.currentZoom})`;
      this.wrapper.style.transformOrigin = "top left";

      // Use offsetWidth/offsetHeight which give layout dimensions (not affected by transform)
      // to correctly calculate the space needed for scrolling
      const baseWidth = this.svgContainer.offsetWidth;
      const baseHeight = this.svgContainer.offsetHeight;
      this.wrapper.style.minWidth = `${baseWidth * this.currentZoom}px`;
      this.wrapper.style.minHeight = `${baseHeight * this.currentZoom}px`;
    }
    this.updateZoomDisplay();
  }

  private updateZoomDisplay(): void {
    if (this.zoomLevelDisplay) {
      this.zoomLevelDisplay.textContent = `${Math.round(this.currentZoom * 100)}%`;
    }
  }
}

/**
 * Initialize the preview panel controls.
 */
function initPreviewControls(): void {
  const vscode = acquireVsCodeApi();
  const zoomController = new ZoomController();

  // Zoom controls
  document.getElementById("btn-zoom-in")?.addEventListener("click", () => {
    zoomController.zoomIn();
  });

  document.getElementById("btn-zoom-out")?.addEventListener("click", () => {
    zoomController.zoomOut();
  });

  document.getElementById("btn-reset-zoom")?.addEventListener("click", () => {
    zoomController.resetZoom();
  });

  // Format controls
  document.getElementById("btn-auto-format")?.addEventListener("click", () => {
    vscode.postMessage({ command: "autoFormat" });
  });

  document.getElementById("btn-reset-arrows")?.addEventListener("click", () => {
    vscode.postMessage({ command: "resetArrows" });
  });
}

// Initialize when DOM is ready
initPreviewControls();

/* v8 ignore stop */
