// src/webview/main.ts

import { SvgAnimator } from './SvgAnimator';
import { ExtractedElement, extractElements } from './elementExtraction';

interface RenderMessage {
  type: 'render';
  svg: string;
  animate: boolean;
}

interface LoadingMessage {
  type: 'loading';
}

interface ErrorMessage {
  type: 'error';
  message: string;
}

type WebviewMessage = RenderMessage | LoadingMessage | ErrorMessage;

class WebviewApp {
  private readonly container: HTMLElement;
  private currentElements: Map<string, ExtractedElement> | null = null;

  constructor() {
    const container = document.getElementById('diagram-container');
    if (!container) {
      throw new Error('Container not found');
    }
    this.container = container;
    this.setupMessageHandler();
  }

  private setupMessageHandler(): void {
    window.addEventListener('message', (event: MessageEvent<WebviewMessage>) => {
      const message = event.data;

      switch (message.type) {
        case 'render':
          void this.render(message.svg, message.animate);
          break;
        case 'loading':
          this.showLoading();
          break;
        case 'error':
          this.showError(message.message);
          break;
      }
    });
  }

  private async render(svgString: string, animate: boolean): Promise<void> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const newSvg = doc.documentElement as unknown as SVGSVGElement;

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      this.showError('Failed to parse SVG');
      return;
    }

    const newElements = extractElements(newSvg);
    const currentSvg = this.container.querySelector('svg');

    if (animate && this.currentElements && currentSvg) {
      await SvgAnimator.animateDiff(
        currentSvg as SVGSVGElement,
        this.currentElements,
        newElements,
        500
      );

      // Swap in new SVG after animation
      this.container.innerHTML = '';
      this.container.appendChild(newSvg);
    } else {
      this.container.innerHTML = '';
      this.container.appendChild(newSvg);
    }

    // Re-extract from live DOM for next comparison
    const liveSvg = this.container.querySelector('svg');
    if (liveSvg) {
      this.currentElements = extractElements(liveSvg as SVGSVGElement);
    }
  }

  private showLoading(): void {
    this.container.innerHTML = '<div class="loading">Loading...</div>';
  }

  private showError(message: string): void {
    this.container.innerHTML = `<div class="error">${this.escapeHtml(message)}</div>`;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new WebviewApp();
});