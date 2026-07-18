import { describe, it, expect } from "vitest";
import { sanitizeSvg } from "../src/svgSanitizer";

describe("sanitizeSvg", () => {
  it("keeps a typical PlantUML SVG unchanged", () => {
    const svg =
      `<?xml version="1.0" encoding="us-ascii" standalone="no"?>` +
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
      `contentStyleType="text/css" height="120px" width="200px">` +
      `<defs/><g><rect fill="#E2E2F0" height="30" width="50" x="10" y="10"/>` +
      `<text fill="#000000" font-family="sans-serif" font-size="13" x="20" y="30">Alice</text>` +
      `<path d="M10,50 L100,50" fill="none" style="stroke:#181818;"/>` +
      `<ellipse cx="50" cy="80" fill="#181818" rx="4" ry="4"/>` +
      `</g></svg>`;
    expect(sanitizeSvg(svg)).toBe(svg);
  });

  it("keeps PlantUML hyperlinks with http(s) targets", () => {
    const svg = `<svg><a href="https://example.com" xlink:href="https://example.com"><text>link</text></a></svg>`;
    expect(sanitizeSvg(svg)).toBe(svg);
  });

  it("keeps embedded data:image URIs", () => {
    const svg = `<svg><image href="data:image/png;base64,iVBORw0KGgo=" width="10" height="10"/></svg>`;
    expect(sanitizeSvg(svg)).toBe(svg);
  });

  it("removes script elements", () => {
    const svg = `<svg><script>alert(1)</script><text>ok</text></svg>`;
    expect(sanitizeSvg(svg)).toBe("<svg><text>ok</text></svg>");
  });

  it("removes unclosed and self-closing script tags", () => {
    expect(
      sanitizeSvg(`<svg><script src="https://evil.test/x.js"/></svg>`)
    ).toBe("<svg></svg>");
    expect(sanitizeSvg(`<svg><script>alert(1)`)).toBe("<svg>alert(1)");
  });

  it("removes nested/split script elements", () => {
    const svg = `<svg><scr<script>ipt>alert(1)</script></svg>`;
    const result = sanitizeSvg(svg);
    expect(result).not.toContain("<script");
    expect(result).not.toContain("</script");
  });

  it("removes foreignObject elements", () => {
    const svg = `<svg><foreignObject><iframe src="https://evil.test"></iframe></foreignObject></svg>`;
    expect(sanitizeSvg(svg)).toBe("<svg></svg>");
  });

  it("removes iframe, object, embed, form, meta, base and link tags", () => {
    const svg =
      `<svg><iframe src="https://evil.test"></iframe>` +
      `<object data="x"></object><embed src="x">` +
      `<form action="https://evil.test"></form>` +
      `<meta http-equiv="refresh" content="0;url=https://evil.test">` +
      `<base href="https://evil.test/">` +
      `<link rel="stylesheet" href="https://evil.test/x.css"></svg>`;
    expect(sanitizeSvg(svg)).toBe("<svg></svg>");
  });

  it("removes event handler attributes", () => {
    const svg = `<svg onload="alert(1)"><rect onclick='alert(2)' width="10"/><text onmouseover=alert(3)>hi</text></svg>`;
    expect(sanitizeSvg(svg)).toBe(
      `<svg><rect width="10"/><text>hi</text></svg>`
    );
  });

  it("removes javascript: URLs in href attributes", () => {
    const svg = `<svg><a href="javascript:alert(1)"><text>click</text></a></svg>`;
    const result = sanitizeSvg(svg);
    expect(result).not.toContain("javascript:");
    expect(result).toContain("<text>click</text>");
  });

  it("removes javascript: URLs in xlink:href and unquoted attributes", () => {
    expect(
      sanitizeSvg(`<svg><a xlink:href='javascript:alert(1)'>x</a></svg>`)
    ).not.toContain("javascript:");
    expect(
      sanitizeSvg(`<svg><a href=javascript:alert(1)>x</a></svg>`)
    ).not.toContain("javascript:");
  });

  it("removes non-image data: URLs", () => {
    const svg = `<svg><a href="data:text/html,<script>alert(1)</script>">x</a></svg>`;
    const result = sanitizeSvg(svg);
    expect(result).not.toContain("data:text/html");
  });
});
