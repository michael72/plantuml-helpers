// src/webview/SvgAnimator.ts

import * as d3 from 'd3';
import { createPathInterpolator } from './pathInterpolation';
import { ExtractedElement } from './elementExtraction';

type SvgTransition = d3.Transition<SVGElement, unknown, null, undefined>;

const NATIVE_ATTRS = new Set([
  'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry',
  'x1', 'y1', 'x2', 'y2',
  'width', 'height',
  'fill', 'stroke', 'stroke-width', 'opacity',
  'transform'
]);

function getAttributes(el: SVGElement): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attributes = el.attributes;
  for (let i = 0; i < attributes.length; i++) {
    const attr = attributes[i];
    if (attr)
    attrs[attr.name] = attr.value;
  }
  return attrs;
}

export class SvgAnimator {
  static animateElement(
    element: SVGElement,
    toAttrs: Record<string, string>,
    duration: number
  ): SvgTransition {
    const selection = d3.select<SVGElement, unknown>(element);
    const transition = selection.transition().duration(duration);

    for (const [attr, toValue] of Object.entries(toAttrs)) {
      const fromValue = element.getAttribute(attr);

      if (attr === 'd' && fromValue && toValue) {
        try {
          const interpolator = createPathInterpolator(fromValue, toValue);
          transition.attrTween('d', () => interpolator);
        } catch {
          transition.attr('d', toValue);
        }
      } else if (NATIVE_ATTRS.has(attr)) {
        transition.attr(attr, toValue);
      }
    }

    return transition;
  }

  static fadeIn(element: SVGElement, duration: number): SvgTransition {
    return d3.select<SVGElement, unknown>(element)
      .style('opacity', '0')
      .transition()
      .duration(duration)
      .style('opacity', '1');
  }

  static fadeOut(element: SVGElement, duration: number): SvgTransition {
    return d3.select<SVGElement, unknown>(element)
      .transition()
      .duration(duration)
      .style('opacity', '0')
      .remove();
  }

  static async animateDiff(
    currentSvg: SVGSVGElement,
    fromElements: Map<string, ExtractedElement>,
    toElements: Map<string, ExtractedElement>,
    duration: number
  ): Promise<void> {
    const allIds = new Set([...fromElements.keys(), ...toElements.keys()]);

    for (const id of allIds) {
      const from = fromElements.get(id);
      const to = toElements.get(id);

      if (from && to) {
        from.nodes.forEach((fromNode, i) => {
          const toNode = to.nodes[i];
          if (!toNode) {
            SvgAnimator.fadeOut(fromNode, duration);
            return;
          }
          const toAttrs = getAttributes(toNode);
          SvgAnimator.animateElement(fromNode, toAttrs, duration);
        });

      } else if (to && !from) {
        to.nodes.forEach((toNode) => {
          const clone = toNode.cloneNode(true) as SVGElement;
          currentSvg.appendChild(clone);
          SvgAnimator.fadeIn(clone, duration);
        });

      } else if (from && !to) {
        from.nodes.forEach((fromNode) => {
          SvgAnimator.fadeOut(fromNode, duration);
        });
      }
    }

    await new Promise((resolve) => setTimeout(resolve, duration + 50));
  }
}