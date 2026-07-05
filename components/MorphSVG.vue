<script setup>
import { watch, onMounted, useTemplateRef, ref } from "vue";
import { useNav, onSlideEnter } from "@slidev/client";
import { useMorph } from "../composables/useMorph";

const props = defineProps({
	duration: { type: Number, default: 600 },
	viewBox: { type: String, default: "0 0 1920 1080" },
	/** Roher SVG-String (Vite ?raw-Import). Wenn angegeben, übernimmt die
	 *  Komponente runtime alle Aufgaben von build-svg.mjs:
	 *  motion-*, d_to → from/to, Clip-Pfade, Element-Reihenfolge. */
	src: { type: String, default: "" },
});

const { clicks, currentSlideNo } = useNav();
const svgRef = useTemplateRef("svgEl");
const slideNo = ref(null);

// Morph-Instanzen ohne Klick-Zahl (on-enter), werden von onSlideEnter gefeuert
const enterMorphs = [];

onSlideEnter(() => {
	if (slideNo.value === null) {
		slideNo.value = currentSlideNo.value;
	}
	enterMorphs.forEach(({ m, shapeA, shapeB }) => m.morph(shapeA, shapeB));
});

// ── Motion-Hilfsfunktionen ───────────────────────────────────────────────────

function parseMotionObj(str) {
	if (!str) return null;
	try {
		return JSON.parse(str);
	} catch {
		return null;
	}
}

function motionToTransform(obj) {
	if (!obj) return "";
	const t = [];
	if (obj.scaleX != null) t.push(`scaleX(${obj.scaleX})`);
	if (obj.scaleY != null) t.push(`scaleY(${obj.scaleY})`);
	if (obj.scale != null) t.push(`scale(${obj.scale})`);
	if (obj.x != null) t.push(`translateX(${obj.x}px)`);
	if (obj.y != null) t.push(`translateY(${obj.y}px)`);
	if (obj.rotate != null) t.push(`rotate(${obj.rotate}deg)`);
	if (obj.rotateX != null) t.push(`rotateX(${obj.rotateX}deg)`);
	if (obj.rotateY != null) t.push(`rotateY(${obj.rotateY}deg)`);
	if (obj.rotateZ != null) t.push(`rotateZ(${obj.rotateZ}deg)`);
	if (obj.skewX != null) t.push(`skewX(${obj.skewX}deg)`);
	if (obj.skewY != null) t.push(`skewY(${obj.skewY}deg)`);
	if (obj.perspective != null) t.push(`perspective(${obj.perspective}px)`);
	return t.join(" ");
}

function applyMotionState(el, state, animated = false) {
	const transform = motionToTransform(state);
	if (animated) {
		const d = state?.transition?.duration ?? props.duration;
		const delay = state?.transition?.delay ?? 0;
		const rawEase =
			state?.transition?.ease ?? state?.transition?.easing ?? "easeInOut";
		const cssEase = rawEase
			.replace("easeInOut", "ease-in-out")
			.replace("easeIn", "ease-in")
			.replace("easeOut", "ease-out");
		const props2 = ["transform", state?.opacity != null ? "opacity" : null]
			.filter(Boolean)
			.map((p) => `${p} ${d}ms ${cssEase} ${delay}ms`)
			.join(", ");
		el.style.transition = props2;
	} else {
		el.style.transition = "";
	}
	el.style.transform = transform;
	if (state?.opacity != null) el.style.opacity = state.opacity;
}

onMounted(() => {
	const svg = svgRef.value;

	// SVG-Inhalt aus src injizieren (wenn angegeben)
	if (props.src) {
		const m = props.src.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/);
		if (m) svg.innerHTML = m[1].replace(/\n[ \t]*\n/g, "\n");
	}

	// ── ID-Uniquifizierung ────────────────────────────────────────────────────
	const uid = Math.random().toString(36).slice(2, 8);
	const idMap = new Map();
	svg.querySelectorAll("[id]").forEach((el) => {
		idMap.set(el.id, el.id + "_" + uid);
		el.id = el.id + "_" + uid;
	});

	const rewriteUrl = (v) =>
		v.replace(
			/url\(["']?#([^)"']+)["']?\)/g,
			(_, id) => `url(#${idMap.get(id) ?? id})`,
		);
	const rewriteHash = (v) =>
		v.startsWith("#") ? "#" + (idMap.get(v.slice(1)) ?? v.slice(1)) : v;

	svg.querySelectorAll("*").forEach((el) => {
		for (const attr of [
			"clip-path",
			"fill",
			"stroke",
			"filter",
			"mask",
			"marker-start",
			"marker-mid",
			"marker-end",
		]) {
			const v = el.getAttribute(attr);
			if (v?.includes("url(#")) el.setAttribute(attr, rewriteUrl(v));
		}
		const href = el.getAttribute("href");
		if (href?.startsWith("#")) el.setAttribute("href", rewriteHash(href));
		const xlinkHref = el.getAttributeNS("http://www.w3.org/1999/xlink", "href");
		if (xlinkHref?.startsWith("#"))
			el.setAttributeNS(
				"http://www.w3.org/1999/xlink",
				"href",
				rewriteHash(xlinkHref),
			);
		const style = el.getAttribute("style");
		if (style?.includes("url(")) el.setAttribute("style", rewriteUrl(style));
	});

	// ── src-Modus: motion-* und d_to verarbeiten ──────────────────────────────
	const motionElements = [];
	if (props.src) {
		// motion-* → CSS-Transformationen (ersetzt v-motion-Direktive)
		svg.querySelectorAll("[motion-initial]").forEach((el) => {
			const initial = parseMotionObj(el.getAttribute("motion-initial"));
			const motionStyle = el.getAttribute("motion-style");
			const previewTx = el.getAttribute("motion-preview-transform");

			// Inkscape-Vorschau-Transform entfernen
			if (previewTx && el.getAttribute("transform") === previewTx)
				el.removeAttribute("transform");
			el.removeAttribute("motion-preview-transform");

			// motion-style als inline-style übernehmen
			if (motionStyle) {
				el.setAttribute("style", motionStyle);
				el.removeAttribute("motion-style");
			}

			// motion-click-N einlesen (1–9)
			const clickStates = {};
			for (let n = 1; n <= 9; n++) {
				const val = el.getAttribute(`motion-click-${n}`);
				if (val) {
					clickStates[n] = parseMotionObj(val);
					el.removeAttribute(`motion-click-${n}`);
				}
			}
			el.removeAttribute("motion-initial");

			applyMotionState(el, initial, false);
			motionElements.push({ el, initial, clickStates });
		});

		// Morph-Paar-Matching:
		// - Ausgangspfad hat Attribut morph="enter" oder morph="click-N" oder morph="click-N-M"
		// - Zielpfad hat dasselbe inkscape:label, aber kein morph-Attribut
		// - clip-path direkt in Inkscape am Ausgangspfad setzen
		//
		// Beispiele (inkscape:label gleich, morph-Attribut am Ausgangspfad):
		//   morph="enter"      → morpht beim Betreten der Folie
		//   morph="click-1"    → morpht bei Klick 1
		//   morph="click-1-3"  → morpht bei Klick 1, rück bei Klick 3
		const unhide = (el) => {
			const s = el.getAttribute("style") ?? "";
			if (/display\s*:\s*none/.test(s))
				el.setAttribute(
					"style",
					s.replace(/display\s*:\s*none\s*;?\s*/g, "").trim(),
				);
		};

		svg.querySelectorAll("path[morph]").forEach((fromEl) => {
			const morphVal = fromEl.getAttribute("morph") ?? "";
			if (!morphVal) return;

			const label = fromEl.getAttribute("inkscape:label");
			if (!label) return;

			// Zielpfad: gleiches Label, kein morph-Attribut
			const toEl = [
				...svg.querySelectorAll(`[inkscape\\:label="${label}"]`),
			].find((el) => el !== fromEl && !el.hasAttribute("morph"));
			if (!toEl) {
				console.warn(
					`[MorphSVG] kein Morph-Ziel mit Label "${label}" gefunden`,
				);
				return;
			}

			unhide(fromEl);
			fromEl.setAttribute("from", fromEl.getAttribute("d") ?? "");
			fromEl.setAttribute("to", toEl.getAttribute("d") ?? "");

			if (morphVal === "enter") {
				fromEl.setAttribute("at-click", "0");
			} else {
				const cm = morphVal.match(/^click-(\d+)(?:-(\d+))?$/);
				if (cm) {
					fromEl.setAttribute("at-click", cm[1]);
					if (cm[2]) fromEl.setAttribute("at-click-back", cm[2]);
				}
			}
			fromEl.removeAttribute("morph");
			toEl.remove();
		});

		// d_to → from + to + clip-path (Shore-Morphing, Legacy)
		const shoreClipId = idMap.get("shoreClip") ?? "shoreClip";
		svg.querySelectorAll("path[d_to]").forEach((el) => {
			const from = el.getAttribute("d") ?? "";
			const rawTo = el.getAttribute("d_to") ?? "";
			const to = rawTo.replace(/&#10;/g, " ").replace(/\s+/g, " ").trim();
			el.setAttribute("from", from);
			el.setAttribute("to", to);
			el.removeAttribute("d_to");
			if (!el.getAttribute("clip-path"))
				el.setAttribute("clip-path", `url(#${shoreClipId})`);
		});
	}

	// ── Morph-Pfade (path[from]) ──────────────────────────────────────────────
	const morphInstances = [...svg.querySelectorAll("path[from]")].map((el) => {
		const shapeA = el.getAttribute("from");
		const shapeB = el.getAttribute("to");
		// at-click="0" = on enter; Legacy-Pfade ohne Attribut → Default 1
		const atClick = parseInt(el.getAttribute("at-click") ?? "1");
		const atClickBack = el.hasAttribute("at-click-back")
			? parseInt(el.getAttribute("at-click-back"))
			: null;
		const m = useMorph({ duration: props.duration });
		el.setAttribute("d", shapeA);
		m.pathD.value = shapeA;
		watch(m.pathD, (d) => el.setAttribute("d", d));
		const instance = { m, shapeA, shapeB, atClick, atClickBack };
		if (atClick === 0) enterMorphs.push(instance);
		return instance;
	});

	// ── Klick-Watcher ─────────────────────────────────────────────────────────
	watch(
		() => [currentSlideNo.value, clicks.value],
		([slide, n], [prevSlide, prev]) => {
			if (slideNo.value === null || slide !== slideNo.value) return;

			const animated = prevSlide === slideNo.value;

			// Morph-Animationen
			morphInstances.forEach(({ m, shapeA, shapeB, atClick, atClickBack }) => {
				if (atClick === 0) {
					// on-enter: onSlideEnter übernimmt die Animation;
					// bei Direktsprung sofort auf shapeB setzen
					if (!animated) m.pathD.value = shapeB;
					return;
				}
				if (!animated) {
					// Sofortzustand bei Click n berechnen
					let state = n >= atClick ? shapeB : shapeA;
					if (atClickBack !== null && n >= atClickBack) state = shapeA;
					m.pathD.value = state;
					return;
				}
				// Vorwärts-Morph bei atClick
				if (n === atClick && prev === atClick - 1) m.morph(shapeA, shapeB);
				if (n === atClick - 1 && prev === atClick) m.morph(shapeB, shapeA);
				// Rückwärts-Morph bei atClickBack (morph-click-N-M)
				if (atClickBack !== null) {
					if (n === atClickBack && prev === atClickBack - 1)
						m.morph(shapeB, shapeA);
					if (n === atClickBack - 1 && prev === atClickBack)
						m.morph(shapeA, shapeB);
				}
			});

			// CSS-Transform-Animationen (motion-Elemente)
			motionElements.forEach(({ el, initial, clickStates }) => {
				let target = initial;
				for (let c = 1; c <= n; c++) {
					if (clickStates[c]) target = clickStates[c];
				}
				applyMotionState(el, target, animated);
			});
		},
	);
});
</script>

<template>
	<svg ref="svgEl" :viewBox="viewBox">
		<template v-if="!src">
			<slot />
		</template>
	</svg>
</template>
