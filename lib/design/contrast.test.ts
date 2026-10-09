import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('app/globals.css', 'utf8');

function readTokens(selector: string): Record<string, string> {
  const at = css.indexOf(`\n${selector} {`);
  if (at === -1) throw new Error(`globals.css has no "${selector}" block`);
  const start = css.indexOf('{', at) + 1;
  const end = css.indexOf('\n}', start);
  const tokens: Record<string, string> = {};
  for (const line of css.slice(start, end).split('\n')) {
    const m = /^\s*--([a-z0-9-]+):\s*([^;]+);/i.exec(line);
    if (m) tokens[m[1]] = m[2].trim();
  }
  return tokens;
}

function toLinearRgb(value: string, tokens: Record<string, string>): [number, number, number] {
  let raw = value;
  for (let hop = 0; hop < 4 && raw.startsWith('var('); hop++) {
    raw = tokens[raw.slice(6, -1)] ?? raw;
  }
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(raw);
  if (!m) throw new Error(`not an oklch() colour: ${value}`);
  const [L, C, hDeg] = [Number(m[1]), Number(m[2]), Number(m[3])];

  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m2 = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m2 + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m2 - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m2 + 1.707614701 * s),
  ];
}

function contrast(fg: string, bg: string, tokens: Record<string, string>): number {
  const lum = (c: [number, number, number]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const a = lum(toLinearRgb(fg, tokens));
  const b = lum(toLinearRgb(bg, tokens));
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_PAIRS: [string, string, string][] = [
  ['foreground', 'background', 'body copy on the page'],
  ['foreground', 'card', 'body copy inside a card'],
  ['foreground', 'muted', 'text on a muted fill (table head, chips)'],
  ['foreground', 'sidebar', 'the active nav row label'],
  ['muted-foreground', 'background', 'hints and meta on the page'],
  ['muted-foreground', 'card', 'hints and meta inside a card'],
  ['muted-foreground', 'muted', 'placeholder in a muted field, axis labels'],
  ['muted-foreground', 'accent', 'meta on a hovered row'],
  ['primary-foreground', 'primary', 'the label on a primary button'],
  ['accent-brand', 'background', 'links on the page'],
  ['accent-brand', 'card', 'links inside a card'],
  ['accent-foreground', 'accent', 'text on a hovered/selected surface'],
  ['secondary-foreground', 'secondary', 'the label on a secondary button'],
  ['sidebar-foreground', 'sidebar', 'nav labels'],
  ['sidebar-accent-foreground', 'sidebar-accent', 'a hovered nav row'],
  ['ok', 'background', 'correct/on-track text'],
  ['ok', 'card', 'correct/on-track text in a card'],
  ['warn', 'background', 'partial/behind text'],
  ['warn', 'card', 'partial/behind text in a card'],
  ['alert', 'background', 'wrong/lapse text'],
  ['alert', 'card', 'wrong/lapse text in a card'],
  ['info', 'background', 'easy/mastered text'],
  ['info', 'card', 'easy/mastered text in a card'],
  ['destructive', 'background', 'destructive action text'],
  ['destructive', 'card', 'destructive action text in a card'],
];

const GRAPHIC_PAIRS: [string, string, string][] = [
  ['accent-brand', 'accent', 'the icon in an EmptyState disc; the brand dot on a section title'],
  ['accent-brand', 'background', 'brand-coloured KPI and section icons on the page'],
  ['accent-brand', 'card', 'the active-nav icon and chart marks on a card'],
];

describe.each(['light', 'dark'] as const)('theme tokens (%s) meet WCAG AA', (theme) => {
  const tokens = readTokens(theme === 'light' ? ':root' : '.dark');

  it.each(TEXT_PAIRS)('text %s on %s (%s) >= 4.5:1', (fg, bg, usage) => {
    const ratio = contrast(tokens[fg], tokens[bg], tokens);
    expect(
      Number(ratio.toFixed(2)),
      `--${fg} on --${bg} is ${ratio.toFixed(2)}:1, below the 4.5:1 AA floor for text (${usage}). ` +
        'Fix the token in app/globals.css — in OKLCH, move L (lightness) and leave C/H alone so the ' +
        'hue does not drift.',
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each(GRAPHIC_PAIRS)('graphic %s on %s (%s) >= 3:1', (fg, bg, usage) => {
    const ratio = contrast(tokens[fg], tokens[bg], tokens);
    expect(
      Number(ratio.toFixed(2)),
      `--${fg} on --${bg} is ${ratio.toFixed(2)}:1, below the 3:1 floor for non-text (${usage}).`,
    ).toBeGreaterThanOrEqual(3);
  });
});
