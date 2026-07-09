#!/usr/bin/env node
/**
 * sync-shores.mjs
 *
 * Leitet fill-shore-left und fill-shore-right automatisch aus den
 * Innenkanten-Pfaden inner-line-left und inner-line-right ab.
 *
 * Hintergrund:
 *   fill-shore-left  = [fixer Außenrand links] + [innere Kante aus inner-line-left]
 *   fill-shore-right = [innere Kante aus inner-line-right] + [fixer Außenrand rechts]
 *
 * Workflow nach Inkscape-Bearbeitung von inner-line-*:
 *   pnpm run sync:shores
 *
 * Danach:
 *   pnpm run build:svg   (generiert die Folie)
 *
 * Oder beides in einem:
 *   pnpm run sync:shores && pnpm run build:svg
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const svgPath = resolve(__dir, "..", process.argv[2] ?? "assetts/venepump.svg");

// ── Fixe Außenkanten (ändern sich nie, nur inner-line-* wird in Inkscape editiert) ──
//
//   fill-shore-left:  äußerer Rand = outer-line-left (selbe Beziers)
//   Pfad:  M outer-top  →  L inner-top  →  [inner beziers down]
//          →  L outer-bottom  →  [outer beziers reversed up]  →  Z
const SHORE_LEFT_OUTER_TOP = "M 864.7941,788.10417 L ";
const SHORE_LEFT_OUTER_BACK =
	" L 871.32578,844.46853" +
	" c -3.16821,-11.48978 -4.48934,-17.84663 -5.9722,-29.68093" +
	" -1.55639,-9.64941 -1.40214,-16.97984 -0.55948,-26.68343 Z";

//   fill-shore-right: äußerer Rand = outer-line-right (selbe Beziers)
//   Pfad:  M inner-top  →  [inner beziers down]
//          →  L outer-bottom  →  [outer beziers up]  →  Z
const SHORE_RIGHT_OUTER_BACK =
	" L 925.15141,844.99599" +
	" c 1.79843,-7.99672 2.90524,-10.93955 3.48189,-19.15122" +
	" 1.22062,-13.59079 0.75036,-23.64649 -0.35146,-37.22185 Z";

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

/** Gibt den vollständigen <path .../> Block für id="{id}" zurück. */
function findElement(svg, id) {
	// Matcht <path ... id="..." ... /> ohne eine andere <path-Öffnung zu überspringen
	const re = new RegExp(
		`<path(?:(?!<path)[\\s\\S])*?\\bid="${id}"(?:(?!<path)[\\s\\S])*?/>`,
	);
	const match = svg.match(re);
	if (!match)
		throw new Error(`Element id="${id}" nicht gefunden in ${svgPath}`);
	return match[0];
}

/** Liest das d-Attribut eines <path>-Elements. */
function getD(element, id) {
	const d = element.match(/\bd="([^"]+)"/)?.[1];
	if (!d) throw new Error(`Kein d-Attribut in id="${id}"`);
	return d;
}

/** Ersetzt das d-Attribut in einem Element-String. */
function setD(element, newD) {
	return element.replace(/\bd="[^"]*"/, `d="${newD}"`);
}

// ── Sync ──────────────────────────────────────────────────────────────────────

let svg = readFileSync(svgPath, "utf-8");

// fill-shore-left ← inner-line-left
{
	const innerEl = findElement(svg, "inner-line-left");
	const innerD = getD(innerEl, "inner-line-left");
	// inner-line-left: "M x,y c ..." → strip "M " für den Mittelteil
	const innerBody = innerD.replace(/^M\s*/, "");
	const newD = SHORE_LEFT_OUTER_TOP + innerBody + SHORE_LEFT_OUTER_BACK;

	const shoreEl = findElement(svg, "fill-shore-left");
	svg = svg.replace(shoreEl, setD(shoreEl, newD));
	console.log("✓ fill-shore-left  ←  inner-line-left");
}

// fill-shore-right ← inner-line-right
{
	const innerEl = findElement(svg, "inner-line-right");
	const innerD = getD(innerEl, "inner-line-right");
	// fill-shore-right beginnt am gleichen M-Punkt wie inner-line-right
	const newD = innerD + SHORE_RIGHT_OUTER_BACK;

	const shoreEl = findElement(svg, "fill-shore-right");
	svg = svg.replace(shoreEl, setD(shoreEl, newD));
	console.log("✓ fill-shore-right ←  inner-line-right");
}

writeFileSync(svgPath, svg, "utf-8");
console.log(`→  ${svgPath} aktualisiert`);
