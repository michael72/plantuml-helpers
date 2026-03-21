import { encodePlantUml } from "./plantumlEncoder.js";
import { fetchSvg } from "./plantumlService.js";
import { addTheme } from "./themeService.js";

// markdown-it types needed for the plugin signature
interface MarkdownIt {
  renderer: {
    rules: {
      fence?: (
        tokens: Token[],
        idx: number,
        options: unknown,
        env: unknown,
        self: Renderer
      ) => string;
    };
  };
}

interface Token {
  info: string;
  content: string;
}

interface Renderer {
  renderToken(tokens: Token[], idx: number, options: unknown): string;
}

/** Value stored per positional slot (token index). */
interface SlotEntry {
  /** The encoded PlantUML key that was last rendered at this position. */
  encodedKey: string;
  /** The SVG HTML that was last shown at this position. */
  svg: string;
}

/**
 * SVG cache: encoded PlantUML string → rendered SVG.
 * Populated asynchronously; read synchronously by the fence callback.
 */
const svgCache = new Map<string, string>();

/**
 * Slot cache: token index → last rendered result for that position.
 * Ensures we return the previous SVG on cache miss (no flicker).
 */
const slotCache = new Map<number, SlotEntry>();

/** Number of in-flight async fetches. */
let pendingFetches = 0;

/** Exposed for testing – resets all internal state. */
export function _resetCaches(): void {
  svgCache.clear();
  slotCache.clear();
  pendingFetches = 0;
}

/** Exposed for testing – read-only access to cache sizes. */
export function _cacheStats(): {
  svgCacheSize: number;
  slotCacheSize: number;
  pendingFetches: number;
} {
  return {
    svgCacheSize: svgCache.size,
    slotCacheSize: slotCache.size,
    pendingFetches,
  };
}

/**
 * Wraps raw PlantUML code in @startuml/@enduml if not already present.
 */
function wrapDiagram(code: string): string {
  return code.startsWith("@start") ? code : `@startuml\n${code}\n@enduml`;
}

/**
 * Wraps an SVG string in the standard container div.
 */
function wrapSvgHtml(svg: string): string {
  return `<div class="plantuml-diagram" style="text-align:center;margin:1em 0;">${svg}</div>`;
}

/**
 * Returns a placeholder div that occupies space but shows nothing.
 * Used on cold start when no previous SVG is available.
 */
function emptyPlaceholder(): string {
  return `<div class="plantuml-diagram" style="text-align:center;margin:1em 0;"></div>`;
}

/**
 * Kicks off an asynchronous SVG fetch for the given diagram text and
 * encoded cache key. When all pending fetches have settled, calls
 * `onAllFetched` so the host can trigger a re-render.
 */
function fetchInBackground(
  diagramText: string,
  encodedKey: string,
  onAllFetched: () => void
): void {
  pendingFetches++;

  fetchSvg(diagramText)
    .then((svg) => {
      svgCache.set(encodedKey, svg);
    })
    .catch(() => {
      // Don't cache errors – next render pass will retry.
    })
    .finally(() => {
      pendingFetches--;
      if (pendingFetches === 0) {
        // Prune SVG cache: keep only entries referenced by a current slot.
        // Slot entries for removed diagrams may linger (trivially small),
        // but their encodedKeys will no longer match the document state,
        // so the corresponding SVG entries get cleaned up on the next
        // fetch cycle after the diagram at that position changes.
        const activeKeys = new Set(
          [...slotCache.values()].map((s) => s.encodedKey)
        );
        for (const key of svgCache.keys()) {
          /* v8 ignore next @preserve */
          if (!activeKeys.has(key)) {
            svgCache.delete(key);
          }
        }
        onAllFetched();
      }
    });
}

/**
 * Markdown-it plugin that renders ```plantuml fenced code blocks
 * as inline SVG diagrams.
 *
 * On the first render of a new/changed diagram the fence returns
 * the previous SVG for that position (or an empty placeholder on
 * cold start) and fires an async fetch in the background. Once all
 * pending fetches have completed, `onAllFetched` is called so the
 * host can trigger `markdown.preview.refresh` for a single
 * flicker-free update.
 *
 * @param md          The markdown-it instance.
 * @param onAllFetched Callback invoked when all in-flight fetches
 *                     have settled. Typically wired to
 *                     `markdown.preview.refresh`.
 */
export function plantUmlPlugin(md: MarkdownIt, onAllFetched: () => void): void {
  const defaultFence = md.renderer.rules.fence;

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (
      token &&
      ["plantuml", "puml"].includes(token.info.trim().toLowerCase())
    ) {
      const code = token.content.trim();
      const wrapped = wrapDiagram(code);
      const diagramText = addTheme(wrapped);

      const encodedKey = encodePlantUml(diagramText);

      // --- Cache hit: return immediately ---
      const cached = svgCache.get(encodedKey);
      if (cached !== undefined) {
        const html = wrapSvgHtml(cached);
        slotCache.set(idx, { encodedKey, svg: html });
        return html;
      }

      // --- Cache miss: trigger background fetch ---
      fetchInBackground(diagramText, encodedKey, onAllFetched);

      // Return the previous SVG for this slot if available (no flicker).
      const slot = slotCache.get(idx);
      if (slot !== undefined) {
        // Update the slot to track the new key while keeping the old SVG.
        slotCache.set(idx, { encodedKey, svg: slot.svg });
        return slot.svg;
      }

      // Cold start – nothing to show yet.
      const placeholder = emptyPlaceholder();
      slotCache.set(idx, { encodedKey, svg: placeholder });
      return placeholder;
    }

    // Fall back to default fence rendering for non-plantuml blocks
    if (defaultFence !== undefined) {
      return defaultFence(tokens, idx, options, env, self);
    }
    return self.renderToken(tokens, idx, options);
  };
}
