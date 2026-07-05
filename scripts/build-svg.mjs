#!/usr/bin/env node
/**
 * Generiert morphsvg.md aus der Inkscape-SVG-Quelldatei.
 *
 * Workflow:
 *   1. SVG in Inkscape bearbeiten und speichern
 *   2. `pnpm run build:svg` ausführen
 *      explizit andere Dateien:
 *      'node scripts/build-svg.mjs [quelldatei.svg] [zieldatei.md]'
 *   3. morphsvg.md ist aktualisiert
 *
 * Konvention für animierbare Gruppen in Inkscape (Attribute werden bewahrt):
 *
 *   motion-preview-transform="matrix(…)"  → wird aus dem Output gestripped
 *   motion-initial="{ scaleX: 1 }"        → :initial="…"
 *   motion-click-1="{ scaleX: 1.7, … }"   → :click-1="…"
 *   motion-click-2="…"                    → :click-2="…"
 *   motion-style="transform-box: …"       → style="…"
 *
 * Konvention für Shore-Elemente (Morph):
 *   d="…"     → from="…" (Ausgangszustand)
 *   d_to="…"  → to="…"   (Zielzustand)
 *
 * MOTION_CONFIG dient als Fallback für Elemente ohne motion-* Attribute.
 *
 * Verwendung:
 *   node scripts/build-svg.mjs [quelldatei.svg] [zieldatei.md]
 *
 * Standardpfade:
 *   Quelle : assetts/venepump.svg
 *   Ziel   : pages/morphsvg.md
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");

const srcPath = resolve(root, process.argv[2] ?? "assetts/venepump.svg");
const outPath = resolve(root, process.argv[3] ?? "pages/morphsvg.md");

// ─── Konfiguration ────────────────────────────────────────────────────────────

const MD_CONFIG = {
	clicks: 3,
	layout: "none",
	morphDuration: 700,
	shoreIds: ["shore_left", "shore_right"],
	bodyFrameIds: ["body_frame_left", "body_frame_right"],
	shoreClip: { x: 879, y: 785, width: 42, height: 65 },
};

const MOTION_ATTR_MAP = {
	"motion-initial": ":initial",
	"motion-enter": ":enter",
	"motion-leave": ":leave",
	"motion-click-1": ":click-1",
	"motion-click-2": ":click-2",
	"motion-click-3": ":click-3",
};

/**
 * Fallback-Konfiguration für Elemente OHNE motion-* Attribute in der SVG.
 * Da motion-* Attribute nun direkt in der SVG gespeichert werden (Inkscape
 * bewahrt sie), ist dieser Block in der Regel leer – er bleibt als
 * Erweiterungspunkt für spezielle Fälle.
 */
const MOTION_CONFIG = {};

// ─── SVG einlesen ─────────────────────────────────────────────────────────────
let svg = readFileSync(srcPath, "utf-8");

// ─── 1) v-motion auto-detection ───────────────────────────────────────────────
const autoDetectedIds = new Set();

svg = svg.replace(/(<g\b[^>]*>)/gs, (match) => {
	if (!/\bmotion-/.test(match)) return match;

	const idMatch = match.match(/\bid="([^"]*)"/);
	if (idMatch) autoDetectedIds.add(idMatch[1]);

	let tag = match;

	const prevTxMatch = tag.match(/\s*motion-preview-transform="([^"]*)"/);
	if (prevTxMatch) {
		tag = tag.replace(
			new RegExp(`\\s*transform="${escapeRe(prevTxMatch[1])}"`),
			"",
		);
		tag = tag.replace(/\s*motion-preview-transform="[^"]*"/, "");
	}

	const motionStyleMatch = tag.match(/\s*motion-style="([^"]*)"/);
	if (motionStyleMatch) {
		tag = tag.replace(/\s*style="[^"]*"/, "");
		tag = tag.replace(/\s*motion-style="[^"]*"/, "");
	}

	const collected = {};
	for (const motionAttr of Object.keys(MOTION_ATTR_MAP)) {
		const re = new RegExp(`\\s*${escapeRe(motionAttr)}="([^"]*)"`, "s");
		const m = tag.match(re);
		if (m) {
			collected[motionAttr] = m[1];
			tag = tag.replace(re, "");
		}
	}

	let open = tag.slice(0, -1).trimEnd();
	if (!open.includes("v-motion")) open += `\n\t\t\t\t\tv-motion`;
	for (const [attr, vueAttr] of Object.entries(MOTION_ATTR_MAP)) {
		if (collected[attr] !== undefined)
			open += `\n\t\t\t\t\t${vueAttr}="${collected[attr]}"`;
	}
	if (motionStyleMatch) open += `\n\t\t\t\t\tstyle="${motionStyleMatch[1]}"`;

	return open + "\n\t\t\t\t>";
});

// ─── 2) Fallback: MOTION_CONFIG ────────────────────────────────────────────────
for (const [id, attrs] of Object.entries(MOTION_CONFIG)) {
	if (autoDetectedIds.has(id)) continue;

	const tagRe = new RegExp(`(<g\\b[^>]*\\bid="${escapeRe(id)}"[^>]*>)`, "gs");
	svg = svg.replace(tagRe, (match) => {
		if (attrs.previewTransform)
			match = match.replace(
				new RegExp(`\\s*transform="${escapeRe(attrs.previewTransform)}"`),
				"",
			);
		if ("style" in attrs) match = match.replace(/\s*style="[^"]*"/g, "");

		let tag = match.slice(0, -1).trimEnd();
		for (const [attr, value] of Object.entries(attrs)) {
			if (attr === "previewTransform") continue;
			tag +=
				value === null
					? `\n\t\t\t\t\t${attr}`
					: `\n\t\t\t\t\t${attr}="${value}"`;
		}
		return tag + "\n\t\t\t\t>";
	});
}

// ─── 3) Shore-Transformation: d + d_to → from + to + clip-path ───────────────
for (const shoreId of MD_CONFIG.shoreIds) {
	const shoreRe = new RegExp(
		`(<path\\b[^>]*\\bid="${escapeRe(shoreId)}"[^>]*/>)`,
		"gs",
	);
	svg = svg.replace(shoreRe, (match) => {
		const dMatch = match.match(/\bd="([^"]*)"/);
		const dToMatch = match.match(/\bd_to="([^"]*)"/);
		if (!dMatch) return match;

		const fromVal = dMatch[1];
		let tag = match;

		if (dToMatch) {
			const toVal = dToMatch[1]
				.replace(/&#10;/g, " ")
				.replace(/\s+/g, " ")
				.trim();
			tag = tag.replace(/\s*d_to="[^"]*"/, "");
			tag = tag.replace(
				`d="${fromVal}"`,
				`d="${fromVal}"\n        from="${fromVal}"\n        to="${toVal}"`,
			);
		} else {
			tag = tag.replace(
				`d="${fromVal}"`,
				`d="${fromVal}"\n        from="${fromVal}"`,
			);
		}

		if (!tag.includes('clip-path="url(#shoreClip)"')) {
			tag = tag.replace(
				/(\bid="[^"]*")/,
				`$1\n        clip-path="url(#shoreClip)"`,
			);
		}

		return tag;
	});
}

// ─── 4) Reihenfolge in g2: body_frames vor shores ────────────────────────────
const g2Re = /(<g\b[^>]*\bid="g2"[^>]*>)([\s\S]*?)(<\/g>)/;
const g2Match = svg.match(g2Re);
if (g2Match) {
	let g2Content = g2Match[2];

	const frameBlocks = [];
	for (const frameId of MD_CONFIG.bodyFrameIds) {
		const frameRe = new RegExp(
			`(\\s*<path\\b[^>]*\\bid="${escapeRe(frameId)}"[^>]*/>)`,
			"gs",
		);
		g2Content = g2Content.replace(frameRe, (m) => {
			frameBlocks.push(m);
			return "";
		});
	}

	if (frameBlocks.length > 0) {
		const firstShoreRe = new RegExp(
			`(<path\\b[^>]*\\bid="${escapeRe(MD_CONFIG.shoreIds[0])}")`,
		);
		g2Content = g2Content.replace(
			firstShoreRe,
			`${frameBlocks.join("")}\n\t\t\t$1`,
		);
	}

	svg = svg.replace(g2Re, `${g2Match[1]}${g2Content}${g2Match[3]}`);
}

// ─── 5) shoreClip in <defs> ───────────────────────────────────────────────────
if (!svg.includes('id="shoreClip"')) {
	const { x, y, width, height } = MD_CONFIG.shoreClip;
	const clipXml = `\n    <clipPath id="shoreClip" clipPathUnits="userSpaceOnUse">\n      <rect x="${x}" y="${y}" width="${width}" height="${height}" />\n    </clipPath>`;
	svg = svg.replace(/<defs\b[^>]*>/, `$&${clipXml}`);
}

// ─── Inneren SVG-Inhalt extrahieren ───────────────────────────────────────────
const innerMatch = svg.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/);
if (!innerMatch) {
	console.error("Fehler: Kein <svg>-Element gefunden in", srcPath);
	process.exit(1);
}
// Leerzeilen entfernen (Inkscape-Formatierung), die Slidev als Folientrenner interpretiert
const inner = innerMatch[1].replace(/\n[ \t]*\n/g, "\n").trim();

// ─── clicks aus bestehender Ausgabedatei übernehmen ──────────────────────────
// Wenn morphsvg.md bereits existiert, wird der dort eingetragene clicks-Wert
// beibehalten statt immer den Standardwert aus MD_CONFIG zu verwenden.
let clicks = MD_CONFIG.clicks;
try {
	const existingMd = readFileSync(outPath, "utf-8");
	const clicksMatch = existingMd.match(/^clicks:\s*(\d+)\s*$/m);
	if (clicksMatch) clicks = parseInt(clicksMatch[1], 10);
} catch {
	// Datei existiert noch nicht → MD_CONFIG.clicks verwenden
}

// ─── Ausgabe ──────────────────────────────────────────────────────────────────
const isMd = outPath.endsWith(".md");

const output = isMd
	? `---\nclicks: ${clicks}\nlayout: ${MD_CONFIG.layout}\n---\n\n` +
		`<MorphShape viewBox="0 0 1920 1080" :duration="${MD_CONFIG.morphDuration}">\n` +
		`${inner.trimEnd()}\n</MorphShape>\n`
	: `<script setup></script>\n\n<template>\n\t<svg class="w-full h-full absolute inset-0" viewBox="0 0 1920 1080">\n` +
		`${inner.trimEnd()}\n\t</svg>\n</template>\n`;

writeFileSync(outPath, output, "utf-8");
console.log(`✓ ${outPath} wurde aus ${srcPath} generiert.`);
if (autoDetectedIds.size > 0)
	console.log(`  v-motion auto-detected: ${[...autoDetectedIds].join(", ")}`);

// ─── Hilfsfunktion ────────────────────────────────────────────────────────────
function escapeRe(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
