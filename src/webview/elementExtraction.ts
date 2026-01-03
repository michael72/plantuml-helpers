// src/webview/elementExtraction.ts


export interface ExtractedElement {
  id: string;
  nodes: SVGElement[];
  paths: string[];
  transforms: string[];
}

function generateElementKey(el: SVGElement): string {
  const bbox = (el as SVGGraphicsElement).getBBox?.() ?? { x: 0, y: 0 };
  const text = (el.textContent ?? '').slice(0, 30).trim();
  const tag = el.tagName.toLowerCase();
  return `${tag}_${Math.round(bbox.x)}_${Math.round(bbox.y)}_${text}`;
}

export function extractElements(svg: SVGSVGElement): Map<string, ExtractedElement> {
  const elements = new Map<string, ExtractedElement>();

  const selectors = 'path, rect, ellipse, circle, line, polyline, polygon, text, g';
  svg.querySelectorAll(selectors).forEach((node) => {
    const el = node as SVGElement;
    const key = el.id || generateElementKey(el);

    if (!elements.has(key)) {
      elements.set(key, {
        id: key,
        nodes: [],
        paths: [],
        transforms: [],
      });
    }

    const entry = elements.get(key)!;
    entry.nodes.push(el);

    if (el.tagName.toLowerCase() === 'path') {
      entry.paths.push(el.getAttribute('d') ?? '');
    }

    const transform = el.getAttribute('transform');
    if (transform) {
      entry.transforms.push(transform);
    }
  });

  return elements;
}