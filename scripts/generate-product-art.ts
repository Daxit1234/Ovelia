/**
 * Generates branded SVG product renders used as placeholder photography until
 * real product photos are uploaded from the admin.
 *
 *   npm run art:generate
 */
import fs from "node:fs";
import path from "node:path";
import { SEED_CATEGORIES, SEED_PRODUCTS, type BottleShape, type SeedProduct } from "./seed-data";

const OUT = path.resolve(process.cwd(), "public/images");
const BRAND = { green: "#0b4d3b", teal: "#0e8f80", mint: "#eef7f3", ink: "#0f1f1a", blue: "#3b82f6" };
const FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

/* ------------------------------------------------------------------ */
/* Colour helpers                                                      */
/* ------------------------------------------------------------------ */

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("")}`;
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex([r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t]);
}

const lighten = (hex: string, t: number) => mix(hex, "#ffffff", t);
const darken = (hex: string, t: number) => mix(hex, "#000000", t);

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

let uid = 0;
const id = (prefix: string) => `${prefix}${++uid}`;

/* ------------------------------------------------------------------ */
/* Brand mark                                                          */
/* ------------------------------------------------------------------ */

function brandMark(x: number, y: number, size: number, color = BRAND.green): string {
  const s = size / 24;
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="M12 1.5C12 1.5 4 10.2 4 15a8 8 0 0 0 16 0c0-4.8-8-13.5-8-13.5Z" fill="${color}"/>
    <path d="M8.2 16.2c2.6-.2 5.6-1.8 7-5.4.3 3.8-1.8 7.2-5.3 7.4-.9.1-1.5-.6-1.7-2Z" fill="#ffffff" opacity="0.92"/>
  </g>`;
}

/* ------------------------------------------------------------------ */
/* Label                                                               */
/* ------------------------------------------------------------------ */

interface LabelSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  subtitle: string;
  size: string;
  color: string;
  accent: string;
}

function fitFont(text: string, maxWidth: number, max: number, min = 12): number {
  return Math.max(min, Math.min(max, Math.floor(maxWidth / (Math.max(text.length, 1) * 0.6))));
}

function label(spec: LabelSpec): string {
  const cx = spec.x + spec.w / 2;
  const titleWords = spec.title.split(" ");
  const titleLines = titleWords.length > 1 && spec.title.length > 11 ? [titleWords.slice(0, Math.ceil(titleWords.length / 2)).join(" "), titleWords.slice(Math.ceil(titleWords.length / 2)).join(" ")] : [spec.title];
  const longest = titleLines.reduce((a, b) => (a.length > b.length ? a : b));
  const titleSize = fitFont(longest, spec.w - 28, 34, 16);
  const bandH = Math.max(34, spec.h * 0.16);
  const brandSize = Math.min(18, spec.w / 9);
  const top = spec.y + 26;
  const titleTop = top + brandSize + 26;
  const sizeFont = fitFont(spec.size, spec.w - 30, 22, 12);
  return `<g>
    <rect x="${spec.x}" y="${spec.y}" width="${spec.w}" height="${spec.h}" rx="${Math.min(22, spec.w / 8)}" fill="#ffffff" opacity="0.97"/>
    ${brandMark(cx - brandSize * 3.25, top - brandSize * 0.85, brandSize * 1.15, BRAND.green)}
    <text x="${cx - brandSize * 1.75}" y="${top + brandSize * 0.2}" text-anchor="start" font-family="${FONT}" font-size="${brandSize}" font-weight="800" letter-spacing="${brandSize * 0.22}" fill="${BRAND.green}">OVELIA</text>
    <line x1="${spec.x + 22}" x2="${spec.x + spec.w - 22}" y1="${top + brandSize * 0.9}" y2="${top + brandSize * 0.9}" stroke="${lighten(spec.color, 0.3)}" stroke-width="2"/>
    ${titleLines
      .map(
        (line, i) =>
          `<text x="${cx}" y="${titleTop + i * (titleSize * 1.08)}" text-anchor="middle" font-family="${FONT}" font-size="${titleSize}" font-weight="800" fill="${BRAND.ink}">${esc(line)}</text>`,
      )
      .join("")}
    <text x="${cx}" y="${titleTop + titleLines.length * titleSize * 1.08 + 8}" text-anchor="middle" font-family="${FONT}" font-size="${Math.min(17, titleSize * 0.62)}" font-weight="600" fill="${darken(spec.accent, 0.05)}">${esc(spec.subtitle)}</text>
    <rect x="${spec.x}" y="${spec.y + spec.h - bandH}" width="${spec.w}" height="${bandH}" rx="${Math.min(22, spec.w / 8)}" fill="${spec.color}"/>
    <rect x="${spec.x}" y="${spec.y + spec.h - bandH}" width="${spec.w}" height="${bandH / 2}" fill="${spec.color}"/>
    <text x="${cx}" y="${spec.y + spec.h - bandH / 2 + sizeFont * 0.36}" text-anchor="middle" font-family="${FONT}" font-size="${sizeFont}" font-weight="800" fill="#ffffff">${esc(spec.size)}</text>
  </g>`;
}

/* ------------------------------------------------------------------ */
/* Bottles (local box 300 x 520)                                       */
/* ------------------------------------------------------------------ */

interface BottleSpec {
  shape: BottleShape;
  color: string;
  accent: string;
  title: string;
  subtitle: string;
  size: string;
  cap?: string;
  hideLabel?: boolean;
}

function bodyGradient(color: string): { defs: string; fill: string } {
  const g = id("body");
  return {
    fill: `url(#${g})`,
    defs: `<linearGradient id="${g}" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="${darken(color, 0.18)}"/>
      <stop offset="0.35" stop-color="${lighten(color, 0.12)}"/>
      <stop offset="0.65" stop-color="${color}"/>
      <stop offset="1" stop-color="${darken(color, 0.25)}"/>
    </linearGradient>`,
  };
}

function gloss(x: number, y: number, h: number): string {
  return `<rect x="${x}" y="${y}" width="14" height="${h}" rx="7" fill="#ffffff" opacity="0.32"/>`;
}

function bottle(spec: BottleSpec): string {
  const body = bodyGradient(spec.color);
  const cap = spec.cap ?? BRAND.green;
  const capShade = darken(cap, 0.25);
  const L = (x: number, y: number, w: number, h: number) =>
    spec.hideLabel ? "" : label({ x, y, w, h, title: spec.title, subtitle: spec.subtitle, size: spec.size, color: spec.color, accent: spec.accent });

  switch (spec.shape) {
    case "squeeze":
      return `<defs>${body.defs}</defs>
        <rect x="134" y="-12" width="32" height="20" rx="7" fill="${capShade}"/>
        <rect x="108" y="2" width="84" height="62" rx="14" fill="${cap}"/>
        <rect x="108" y="44" width="84" height="8" fill="${capShade}" opacity="0.5"/>
        <rect x="118" y="62" width="64" height="20" rx="4" fill="${darken(spec.color, 0.12)}"/>
        <path d="M120 78 C120 104 40 106 40 152 L40 470 Q40 516 86 516 L214 516 Q260 516 260 470 L260 152 C260 106 180 104 180 78 Z" fill="${body.fill}"/>
        ${gloss(58, 160, 300)}
        ${L(62, 196, 176, 240)}`;

    case "jug":
      return `<defs>${body.defs}</defs>
        <path d="M178 108 C176 52 262 50 262 150" fill="none" stroke="${darken(spec.color, 0.2)}" stroke-width="30" stroke-linecap="round"/>
        <rect x="66" y="14" width="76" height="54" rx="12" fill="${cap}"/>
        <rect x="66" y="50" width="76" height="8" fill="${capShade}" opacity="0.5"/>
        <path d="M74 66 L134 66 L140 104 L238 104 Q272 104 272 150 L272 470 Q272 516 228 516 L72 516 Q28 516 28 470 L28 150 Q28 110 70 104 Z" fill="${body.fill}"/>
        ${gloss(46, 150, 320)}
        ${L(54, 206, 192, 246)}`;

    case "spray":
      return `<defs>${body.defs}</defs>
        <path d="M82 66 L198 66 Q214 66 214 82 L214 120 L124 120 L124 102 L84 102 Q70 102 70 90 L70 78 Q70 66 82 66 Z" fill="${cap}"/>
        <rect x="56" y="80" width="20" height="12" rx="4" fill="${capShade}"/>
        <path d="M150 118 Q128 150 138 190 L152 190 Q146 152 168 124 Z" fill="${capShade}"/>
        <rect x="120" y="118" width="64" height="40" rx="6" fill="${capShade}"/>
        <path d="M118 156 L182 156 L182 176 C238 186 250 214 250 252 L250 474 Q250 516 210 516 L90 516 Q50 516 50 474 L50 252 C50 214 62 186 118 176 Z" fill="${body.fill}"/>
        ${gloss(66, 250, 230)}
        ${L(66, 262, 168, 214)}`;

    case "duck":
      return `<defs>${body.defs}</defs>
        <g transform="rotate(-14 110 70)">
          <rect x="84" y="-6" width="56" height="40" rx="10" fill="${cap}"/>
          <path d="M92 30 L132 30 L140 132 L92 132 Z" fill="${darken(spec.color, 0.1)}"/>
        </g>
        <path d="M58 174 Q58 126 104 124 L204 120 Q248 120 248 166 L248 470 Q248 516 206 516 L100 516 Q58 516 58 470 Z" fill="${body.fill}"/>
        ${gloss(74, 180, 290)}
        ${L(76, 214, 156, 232)}`;

    case "wide":
      return `<defs>${body.defs}</defs>
        <rect x="116" y="14" width="68" height="58" rx="12" fill="${cap}"/>
        <rect x="116" y="54" width="68" height="8" fill="${capShade}" opacity="0.5"/>
        <path d="M112 70 L188 70 L190 96 C258 102 276 132 276 176 L276 470 Q276 516 230 516 L70 516 Q24 516 24 470 L24 176 C24 132 42 102 110 96 Z" fill="${body.fill}"/>
        <rect x="30" y="250" width="16" height="150" rx="8" fill="${darken(spec.color, 0.25)}" opacity="0.6"/>
        <rect x="254" y="250" width="16" height="150" rx="8" fill="${darken(spec.color, 0.3)}" opacity="0.6"/>
        ${gloss(52, 180, 300)}
        ${L(58, 200, 184, 248)}`;

    case "tin":
      return `<defs>${body.defs}</defs>
        <rect x="96" y="132" width="108" height="82" rx="14" fill="${cap}"/>
        <rect x="96" y="190" width="108" height="10" fill="${capShade}" opacity="0.5"/>
        <rect x="40" y="208" width="220" height="308" rx="34" fill="${body.fill}"/>
        ${gloss(58, 230, 250)}
        ${L(62, 262, 176, 214)}`;

    case "pump":
      return `<defs>${body.defs}</defs>
        <rect x="150" y="40" width="94" height="22" rx="9" fill="${cap}"/>
        <rect x="232" y="54" width="12" height="18" rx="4" fill="${capShade}"/>
        <rect x="136" y="40" width="30" height="86" rx="8" fill="${cap}"/>
        <rect x="110" y="116" width="82" height="42" rx="10" fill="${capShade}"/>
        <path d="M92 156 L210 156 Q234 156 236 180 L250 470 Q252 516 206 516 L94 516 Q48 516 50 470 L64 180 Q66 156 92 156 Z" fill="${body.fill}"/>
        ${gloss(76, 190, 280)}
        ${L(70, 222, 162, 224)}`;

    case "kit":
      return kitArt(spec);
  }
}

function kitArt(spec: BottleSpec): string {
  const minis: { shape: BottleShape; color: string; x: number; s: number }[] = spec.title.toLowerCase().startsWith("car ")
    ? [
        { shape: "wide", color: "#1d4ed8", x: 20, s: 0.55 },
        { shape: "tin", color: "#d4a017", x: 150, s: 0.55 },
      ]
    : [
        { shape: "squeeze", color: "#f2c94c", x: -10, s: 0.46 },
        { shape: "jug", color: "#9b8ce8", x: 70, s: 0.5 },
        { shape: "duck", color: "#3b82f6", x: 150, s: 0.46 },
        { shape: "spray", color: "#38bdf8", x: 220, s: 0.42 },
      ];
  const bottles = minis
    .map(
      (m) =>
        `<g transform="translate(${m.x} ${300 - 520 * m.s + 40}) scale(${m.s})">${bottle({ shape: m.shape, color: m.color, accent: darken(m.color, 0.3), title: "", subtitle: "", size: "", cap: BRAND.green, hideLabel: true })}</g>`,
    )
    .join("");
  return `${bottles}
    <rect x="6" y="292" width="288" height="224" rx="26" fill="${BRAND.green}"/>
    <rect x="6" y="292" width="288" height="30" rx="14" fill="${darken(BRAND.green, 0.25)}"/>
    ${brandMark(77, 346, 26, "#ffffff")}
    <text x="111" y="368" text-anchor="start" font-family="${FONT}" font-size="22" font-weight="800" letter-spacing="5" fill="#ffffff">OVELIA</text>
    <text x="150" y="420" text-anchor="middle" font-family="${FONT}" font-size="30" font-weight="800" fill="#ffffff">${esc(spec.title)}</text>
    <text x="150" y="452" text-anchor="middle" font-family="${FONT}" font-size="18" font-weight="600" fill="${lighten(spec.accent, 0.1)}">${esc(spec.subtitle)}</text>
    <rect x="96" y="472" width="108" height="30" rx="15" fill="${spec.accent}"/>
    <text x="150" y="493" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="800" fill="${BRAND.ink}">${esc(spec.size)}</text>`;
}

/* ------------------------------------------------------------------ */
/* Scenes                                                              */
/* ------------------------------------------------------------------ */

function bubbles(color: string, seed: number, w: number, h: number, count = 9): string {
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: count }, () => {
    const r = 10 + rand() * 38;
    const x = rand() * w;
    const y = rand() * h * 0.8;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#ffffff" fill-opacity="0.55" stroke="${color}" stroke-opacity="0.22" stroke-width="2"/>`;
  }).join("");
}

function shadow(cx: number, cy: number, rx: number, color: string): string {
  const f = id("blur");
  return `<defs><filter id="${f}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter></defs>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${rx * 0.12}" fill="${darken(color, 0.5)}" opacity="0.22" filter="url(#${f})"/>`;
}

function svg(w: number, h: number, inner: string, title: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${inner}</svg>\n`;
}

function placeBottle(spec: BottleSpec, cx: number, bottomY: number, height: number): string {
  const scale = height / 530;
  const x = cx - 150 * scale;
  const y = bottomY - 516 * scale;
  return `${shadow(cx, bottomY + 6, 150 * scale * 0.95, spec.color)}<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(4)})">${bottle(spec)}</g>`;
}

function specFor(product: SeedProduct, variantIndex = 0): BottleSpec {
  return {
    shape: product.shape,
    color: product.color,
    accent: product.accent,
    title: product.artTitle,
    subtitle: product.artSubtitle,
    size: product.variants[variantIndex]?.label ?? "",
    cap: product.category === "car-care" ? "#0f172a" : BRAND.green,
  };
}

function frontScene(product: SeedProduct): string {
  const bg = id("bg");
  const spec = specFor(product);
  return svg(
    800,
    800,
    `<defs><radialGradient id="${bg}" cx="50%" cy="42%" r="70%">
      <stop offset="0" stop-color="${lighten(product.color, 0.72)}"/>
      <stop offset="0.65" stop-color="${lighten(product.color, 0.9)}"/>
      <stop offset="1" stop-color="#ffffff"/>
    </radialGradient></defs>
    <rect width="800" height="800" fill="url(#${bg})"/>
    ${bubbles(product.color, product.slug.length * 13, 800, 800)}
    <ellipse cx="400" cy="705" rx="300" ry="34" fill="${lighten(product.color, 0.6)}" opacity="0.6"/>
    ${placeBottle(spec, 400, 700, 600)}`,
    `${product.name} — ${spec.size}`,
  );
}

function wrapText(text: string, max: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > max) {
      if (current) lines.push(current);
      current = word;
    } else current = `${current} ${word}`.trim();
  }
  if (current) lines.push(current);
  return lines;
}

function highlightsScene(product: SeedProduct): string {
  const bg = id("bg");
  const spec = specFor(product, product.variants.length > 1 ? 1 : 0);
  let y = 300;
  const items = product.highlights.slice(0, 4).map((h) => {
    const lines = wrapText(h, 24);
    const block = `<g>
      <circle cx="476" cy="${y - 7}" r="15" fill="${product.color}"/>
      <path d="M469 ${y - 7} l5 5 l9 -10" stroke="#ffffff" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      ${lines.map((l, i) => `<text x="504" y="${y + i * 30}" font-family="${FONT}" font-size="23" font-weight="600" fill="${BRAND.ink}">${esc(l)}</text>`).join("")}
    </g>`;
    y += lines.length * 30 + 34;
    return block;
  });
  return svg(
    800,
    800,
    `<defs><linearGradient id="${bg}" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${lighten(product.color, 0.8)}"/>
      <stop offset="1" stop-color="#ffffff"/>
    </linearGradient></defs>
    <rect width="800" height="800" fill="url(#${bg})"/>
    ${bubbles(product.color, product.slug.length * 7 + 3, 420, 800, 6)}
    ${placeBottle(spec, 230, 690, 560)}
    <rect x="440" y="170" width="330" height="${Math.max(260, y - 120)}" rx="28" fill="#ffffff" opacity="0.94"/>
    ${brandMark(468, 200, 26)}
    <text x="504" y="222" font-family="${FONT}" font-size="20" font-weight="800" letter-spacing="3" fill="${BRAND.green}">KEY FEATURES</text>
    <line x1="468" x2="742" y1="246" y2="246" stroke="${lighten(product.color, 0.4)}" stroke-width="2"/>
    ${items.join("")}`,
    `${product.name} highlights`,
  );
}

function lineupScene(product: SeedProduct): string {
  const bg = id("bg");
  const variants = product.variants;
  const n = variants.length;
  const maxSize = Math.max(...variants.map((v) => v.sizeValue));
  const slots = variants.map((v, i) => {
    const relative = n === 1 ? 1 : 0.62 + 0.38 * (v.sizeValue / maxSize);
    const cx = n === 1 ? 400 : 140 + (520 / (n - 1)) * i;
    const height = 520 * relative;
    return `${placeBottle({ ...specFor(product, i) }, cx, 640, height)}
      <rect x="${cx - 70}" y="672" width="140" height="44" rx="22" fill="#ffffff" stroke="${lighten(product.color, 0.3)}" stroke-width="2"/>
      <text x="${cx}" y="701" text-anchor="middle" font-family="${FONT}" font-size="21" font-weight="800" fill="${BRAND.ink}">${esc(v.label)}</text>`;
  });
  return svg(
    800,
    800,
    `<defs><linearGradient id="${bg}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${BRAND.mint}"/>
      <stop offset="1" stop-color="#ffffff"/>
    </linearGradient></defs>
    <rect width="800" height="800" fill="url(#${bg})"/>
    <text x="400" y="86" text-anchor="middle" font-family="${FONT}" font-size="26" font-weight="800" letter-spacing="2" fill="${BRAND.green}">${n > 1 ? "AVAILABLE SIZES" : "WHAT'S INSIDE"}</text>
    ${slots.join("")}`,
    `${product.name} sizes`,
  );
}

function categoryScene(category: (typeof SEED_CATEGORIES)[number]): string {
  const bg = id("bg");
  const members = SEED_PRODUCTS.filter((p) => p.category === category.slug).slice(0, 2);
  const placements =
    members.length === 2
      ? [
          { product: members[0], cx: 215, height: 420 },
          { product: members[1], cx: 395, height: 360 },
        ]
      : members.map((product) => ({ product, cx: 300, height: 440 }));
  return svg(
    600,
    600,
    `<defs><radialGradient id="${bg}" cx="50%" cy="40%" r="75%">
      <stop offset="0" stop-color="${lighten(category.color, 0.65)}"/>
      <stop offset="1" stop-color="${lighten(category.color, 0.88)}"/>
    </radialGradient></defs>
    <rect width="600" height="600" fill="url(#${bg})"/>
    ${bubbles(category.color, category.sortOrder * 31, 600, 600, 7)}
    ${placements
      .sort((a, b) => b.height - a.height)
      .reverse()
      .map(({ product, cx, height }) => placeBottle(specFor(product, product.variants.length > 1 ? 1 : 0), cx, 545, height))
      .join("")}`,
    category.name,
  );
}

function heroScene(): string {
  const pick = (slug: string, size?: string) => {
    const p = SEED_PRODUCTS.find((x) => x.slug === slug)!;
    return { ...specFor(p), size: size ?? p.variants[0].label };
  };
  const arrangement: [BottleSpec, number, number, number][] = [
    [pick("lavender-floor-cleaner", "1 L"), 250, 690, 470],
    [pick("kitchen-degreaser-spray"), 640, 690, 440],
    [pick("car-shampoo"), 790, 700, 400],
    [pick("lemon-fresh-dishwash-liquid"), 450, 720, 520],
    [pick("thick-gel-toilet-cleaner"), 100, 720, 380],
  ];
  return svg(
    900,
    760,
    `${bubbles(BRAND.teal, 77, 900, 700, 12)}
    <ellipse cx="450" cy="722" rx="430" ry="30" fill="${BRAND.green}" opacity="0.08"/>
    ${arrangement.map(([spec, cx, bottom, h]) => placeBottle(spec, cx, bottom, h)).join("")}`,
    "Ovelia cleaning products",
  );
}

function bannerScene(slugs: string[], tint: string, title: string): string {
  const bg = id("bg");
  const parts = slugs.map((slug, i) => {
    const p = SEED_PRODUCTS.find((x) => x.slug === slug)!;
    const spec = specFor(p, p.variants.length > 1 ? 1 : 0);
    return placeBottle(spec, 200 + i * 230, 470, 400 - i * 20);
  });
  return svg(
    700,
    500,
    `<defs><radialGradient id="${bg}" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="${lighten(tint, 0.55)}"/><stop offset="1" stop-color="${lighten(tint, 0.85)}"/></radialGradient></defs>
    <rect width="700" height="500" fill="url(#${bg})"/>
    ${bubbles(tint, slugs.join("").length, 700, 500, 8)}
    ${parts.join("")}`,
    title,
  );
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function write(rel: string, content: string) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

function main() {
  for (const product of SEED_PRODUCTS) {
    write(`products/${product.slug}-1.svg`, frontScene(product));
    write(`products/${product.slug}-2.svg`, highlightsScene(product));
    write(`products/${product.slug}-3.svg`, lineupScene(product));
  }
  for (const category of SEED_CATEGORIES) write(`categories/${category.slug}.svg`, categoryScene(category));
  write("hero/hero-products.svg", heroScene());
  write("banners/kitchen-combo.svg", bannerScene(["lemon-fresh-dishwash-liquid", "lavender-floor-cleaner"], "#f2c94c", "Kitchen and floor combo"));
  write("banners/car-care.svg", bannerScene(["car-shampoo", "car-polish"], "#3b82f6", "Car care"));
  write("banners/home-kit.svg", bannerScene(["complete-home-care-kit"], "#0e8f80", "Home care kit"));
  console.log(`Generated art for ${SEED_PRODUCTS.length} products and ${SEED_CATEGORIES.length} categories in ${OUT}`);
}

main();
