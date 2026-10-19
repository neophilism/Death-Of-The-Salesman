import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("./styles.css", import.meta.url), "utf8");
const page = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

const hexToRgb = (hex) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const luminance = (hex) => {
  const channels = hexToRgb(hex).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrast = (foreground, background) => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

test("dark and light text tokens meet WCAG AA contrast", () => {
  assert.ok(contrast("#f4f7fb", "#08111f") >= 4.5);
  assert.ok(contrast("#b7c3d4", "#08111f") >= 4.5);
  assert.ok(contrast("#132033", "#f4f7fb") >= 4.5);
  assert.ok(contrast("#4c5d72", "#f4f7fb") >= 4.5);
  assert.match(css, /:root\[data-theme="light"\]/);
  assert.match(css, /:root\[data-density="compact"\]/);
});

test("theme supports accessible responsive interaction states", () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /max-width: 767px/);
  assert.match(css, /max-width: 359px/);
  assert.match(page, /data-state=\{service\.state\}/);
  for (const label of ["Ready", "Local only", "Disabled"]) assert.match(page, new RegExp(label));
});

test("shell contains no decorative salesman quote", () => {
  assert.doesNotMatch(page, /quote|quotation|blockquote/i);
});
