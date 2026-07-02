#!/usr/bin/env node
/**
 * Konvertiert eine SVG-Datei in ein paths[]-Array für Morph.vue
 *
 * Namenskonvention in Inkscape (Objekt-IDs):
 *   morph_1        → from-Pfad für atClick: 1
 *   morph_1_to     → to-Pfad für atClick: 1
 *   morph_2        → from-Pfad für atClick: 2
 *   morph_2_to     → to-Pfad für atClick: 2
 *   (alle anderen IDs werden ignoriert)
 *
 * Verwendung:
 *   node scripts/svg-to-paths.mjs path/to/file.svg
 */

import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Verwendung: node scripts/svg-to-paths.mjs <datei.svg>');
  process.exit(1);
}

const svg = readFileSync(file, 'utf-8');

// SVG viewBox extrahieren
const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 200 200';
const [, , svgW, svgH] = viewBox.split(/[\s,]+/).map(Number);

// Alle <path>-Elemente extrahieren
const pathRegex = /<path([^/]*)\/?>/gs;
const getAttr = (str, name) => {
  // \b stellt sicher, dass z.B. 'd' nicht in 'id' matcht
  const m = str.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return m ? m[1] : null;
};

const rawPaths = [];
let m;
while ((m = pathRegex.exec(svg)) !== null) {
  const attrs = m[1];
  rawPaths.push({
    id: getAttr(attrs, 'id') ?? '',
    d: getAttr(attrs, 'd') ?? '',
    fill: getAttr(attrs, 'fill') ?? 'none',
    stroke: getAttr(attrs, 'stroke') ?? 'none',
    strokeWidth: parseFloat(getAttr(attrs, 'stroke-width') ?? '0'),
  });
}

// Nach Namenskonvention gruppieren
const staticPaths = [];
const morphMap = {};

for (const p of rawPaths) {
  const { id } = p;

  // morph_N_to → to-Pfad
  const toMatch = id.match(/^morph_(\d+)_to$/);
  if (toMatch) {
    const n = toMatch[1];
    morphMap[n] ??= {};
    morphMap[n].to = p.d;
    morphMap[n].fill ??= p.fill;
    morphMap[n].stroke ??= p.stroke;
    morphMap[n].strokeWidth ??= p.strokeWidth;
    continue;
  }

  // morph_N → from-Pfad
  const fromMatch = id.match(/^morph_(\d+)$/);
  if (fromMatch) {
    const n = fromMatch[1];
    morphMap[n] ??= {};
    morphMap[n].from = p.d;
    morphMap[n].fill ??= p.fill;
    morphMap[n].stroke ??= p.stroke;
    morphMap[n].strokeWidth ??= p.strokeWidth;
    continue;
  }

  // Alles andere → statisch (inkl. static_*, square-4, background, etc.)
  staticPaths.push(p);
}

// Ausgabe formatieren
const indent = '    ';
const fmtD = (d) => d.replace(/\s+/g, ' ').trim();

const lines = [];

// Statische Pfade
for (const p of staticPaths) {
  lines.push(
    `${indent}{ label: '${p.id}', d: '${fmtD(p.d)}',`,
    `${indent}  fill: '${p.fill}', stroke: '${p.stroke}', strokeWidth: ${p.strokeWidth} },`,
  );
}

// Morph-Paare (sortiert nach Click-Nummer)
for (const n of Object.keys(morphMap).sort((a, b) => +a - +b)) {
  const mp = morphMap[n];
  if (!mp.from || !mp.to) {
    console.warn(`⚠️  morph_${n}: from oder to fehlt – wird übersprungen`);
    continue;
  }
  lines.push(
    `${indent}{ label: 'morph_${n}', atClick: ${n},`,
    `${indent}  from: '${fmtD(mp.from)}',`,
    `${indent}  to:   '${fmtD(mp.to)}',`,
    `${indent}  fill: '${mp.fill}', stroke: '${mp.stroke}', strokeWidth: ${mp.strokeWidth} },`,
  );
}

if (lines.length === 0) {
  console.warn('Keine passenden Pfade gefunden. Prüfe die ID-Namenskonvention.');
  process.exit(1);
}

const maxClick = Math.max(0, ...Object.keys(morphMap).map(Number));

console.log(`// viewBox="${viewBox}"  (${svgW} × ${svgH})`);
console.log(`// → Frontmatter der Slide: clicks: ${maxClick}`);
console.log('const paths = [');
console.log(lines.join('\n'));
console.log('];');
