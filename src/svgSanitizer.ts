/**
 * Sanitizes SVG content received from a PlantUML server before it is
 * embedded into a webview or the markdown preview.
 *
 * The server URL is user- and workspace-configurable, so the SVG response
 * must be treated as untrusted input. The webview CSP is the primary
 * defense against script execution; this sanitizer provides
 * defense-in-depth by stripping active content that has no place in a
 * rendered diagram:
 *
 * - script/foreignObject/iframe/object/embed/form/meta/base/link elements
 * - event handler attributes (onclick, onload, ...)
 * - javascript: and non-image data: URLs in href/src-like attributes
 *
 * Legitimate PlantUML output (shapes, text, styles, hyperlinks and
 * embedded data:image URIs) is preserved.
 */

const DANGEROUS_ELEMENTS = [
  "script",
  "foreignObject",
  "iframe",
  "object",
  "embed",
  "form",
  "meta",
  "base",
  "link",
].join("|");

// <tag ...>...</tag> pairs of dangerous elements (non-greedy body)
const PAIRED_ELEMENT_RE = new RegExp(
  `<\\s*(${DANGEROUS_ELEMENTS})\\b[^>]*>[\\s\\S]*?<\\s*/\\s*\\1\\s*>`,
  "gi"
);

// Any leftover opening, self-closing or closing dangerous tag
const STRAY_TAG_RE = new RegExp(
  `<\\s*/?\\s*(?:${DANGEROUS_ELEMENTS})\\b[^>]*>`,
  "gi"
);

// Event handler attributes: onload="..." / onclick='...' / onerror=x
const EVENT_HANDLER_ATTR_RE = /\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

// href/src-like attributes whose value starts with a dangerous scheme.
// data: is only allowed for images (data:image/...).
const DANGEROUS_URL_ATTR_RE =
  /\s(?:href|xlink:href|src|action|formaction)\s*=\s*(?:"\s*(?:javascript:[^"]*|data:(?!image\/)[^"]*)"|'\s*(?:javascript:[^']*|data:(?!image\/)[^']*)'|(?:javascript:|data:(?!image\/))[^\s>]*)/gi;

function stripUntilStable(input: string, pattern: RegExp): string {
  let previous;
  let current = input;
  do {
    previous = current;
    current = current.replace(pattern, "");
  } while (current !== previous);
  return current;
}

/**
 * Removes active content from an SVG string received from the
 * PlantUML server. The result is safe to embed as inline HTML.
 *
 * @param svg The raw SVG response body
 * @returns The sanitized SVG
 */
export function sanitizeSvg(svg: string): string {
  let result = stripUntilStable(svg, PAIRED_ELEMENT_RE);
  result = stripUntilStable(result, STRAY_TAG_RE);
  result = stripUntilStable(result, EVENT_HANDLER_ATTR_RE);
  result = stripUntilStable(result, DANGEROUS_URL_ATTR_RE);
  return result;
}
