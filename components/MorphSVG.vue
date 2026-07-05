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

onSlideEnter(() => {
	if (slideNo.value === null) {
		slideNo.value = currentSlideNo.value;
		console.log("slideNo eingefroren:", slideNo.value);
	}
});

// ── Motion-Hilfsfunktionen ───────────────────────────────────────────────────

function parseMotionObj(str) {
	if (!str) return null;
	try {
		return new Function(`return (${str})`)();
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

		// motion-from-* / motion-to-* Paar-Morphing
		// Namenskonvention in Inkscape: id="motion-from-<name>" (Ausgangspfad)
		//                               id="motion-to-<name>"   (Zielpfad, wird entfernt)
		// Optionales at-click Attribut auf einem der beiden Elemente setzen.
		const shoreClipId = idMap.get("shoreClip") ?? "shoreClip";
		const unhide = (el) => {
			const s = el.getAttribute("style") ?? "";
			if (/display\s*:\s*none/.test(s))
				el.setAttribute(
					"style",
					s.replace(/display\s*:\s*none\s*;?\s*/g, "").trim(),
				);
		};

		svg.querySelectorAll('[id^="motion-to-"]').forEach((toEl) => {
			const fromId = toEl.id.replace("motion-to-", "motion-from-");
			const fromEl = svg.querySelector(`#${CSS.escape(fromId)}`);
			if (fromEl) {
				unhide(fromEl);
				fromEl.setAttribute("from", fromEl.getAttribute("d") ?? "");
				fromEl.setAttribute("to", toEl.getAttribute("d") ?? "");
				const atClick =
					toEl.getAttribute("at-click") ??
					fromEl.getAttribute("at-click") ??
					"1";
				fromEl.setAttribute("at-click", atClick);
				if (!fromEl.getAttribute("clip-path"))
					fromEl.setAttribute("clip-path", `url(#${shoreClipId})`);
				toEl.remove();
			}
		});

		// d_to → from + to + clip-path (Shore-Morphing, Legacy)
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

		// Reihenfolge in g2: body_frame_* vor shore_* (wie build-svg.mjs Schritt 4)
		const g2 = svg.querySelector(`#${idMap.get("g2") ?? "g2"}`);
		if (g2) {
			const firstShore = g2.querySelector(
				`#${idMap.get("shore_left") ?? "shore_left"}`,
			);
			if (firstShore) {
				for (const origId of ["body_frame_left", "body_frame_right"]) {
					const frame = g2.querySelector(`#${idMap.get(origId) ?? origId}`);
					if (frame) g2.insertBefore(frame, firstShore);
				}
			}
		}
	}

	// ── Morph-Pfade (path[from]) ──────────────────────────────────────────────
	const morphInstances = [...svg.querySelectorAll("path[from]")].map((el) => {
		const shapeA = el.getAttribute("from");
		const shapeB = el.getAttribute("to");
		const atClick = parseInt(el.getAttribute("at-click") ?? "1");
		const m = useMorph({ duration: props.duration });
		el.setAttribute("d", shapeA);
		m.pathD.value = shapeA;
		watch(m.pathD, (d) => el.setAttribute("d", d));
		return { m, shapeA, shapeB, atClick };
	});

	// ── Klick-Watcher ─────────────────────────────────────────────────────────
	watch(
		() => [currentSlideNo.value, clicks.value],
		([slide, n], [prevSlide, prev]) => {
			if (slideNo.value === null || slide !== slideNo.value) return;

			const animated = prevSlide === slideNo.value;

			// Shore-Morphing
			morphInstances.forEach(({ m, shapeA, shapeB, atClick }) => {
				if (!animated) {
					m.pathD.value = n < atClick ? shapeA : shapeB;
					return;
				}
				if (n === atClick && prev === atClick - 1) m.morph(shapeA, shapeB);
				if (n === atClick - 1 && prev === atClick) m.morph(shapeB, shapeA);
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
