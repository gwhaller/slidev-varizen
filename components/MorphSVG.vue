<script setup>
import { watch, onMounted, useTemplateRef, ref } from "vue";
import { useNav, onSlideEnter } from "@slidev/client";
import { useMorph } from "../composables/useMorph";

const props = defineProps({
	duration: { type: Number, default: 600 },
	viewBox: { type: String, default: "0 0 1920 1080" },
	/** Roher SVG-String (Vite ?raw-Import). */
	src: { type: String, default: "" },
});

const { clicks, currentSlideNo } = useNav();
const svgRef = useTemplateRef("svgEl");
const slideNo = ref(null);

// morph-click="0" oder kein morph-click → on enter; sonst per Klick
const morphInstances = [];

onSlideEnter(() => {
	if (slideNo.value === null) slideNo.value = currentSlideNo.value;
	morphInstances
		.filter(({ atClick }) => atClick === 0)
		.forEach(({ m, shapeA, shapeB }) => m.morph(shapeA, shapeB));
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
	if (obj.x != null)
		t.push(`translateX(${typeof obj.x === "string" ? obj.x : obj.x + "px"})`);
	if (obj.y != null)
		t.push(`translateY(${typeof obj.y === "string" ? obj.y : obj.y + "px"})`);
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
		const props2 = [
			"transform",
			state?.opacity != null ? "opacity" : null,
			state?.clipPath != null ? "clip-path" : null,
		]
			.filter(Boolean)
			.map((p) => `${p} ${d}ms ${cssEase} ${delay}ms`)
			.join(", ");
		el.style.transition = props2;
	} else {
		el.style.transition = "";
	}
	el.style.transform = transform;
	if (state?.opacity != null) el.style.opacity = state.opacity;
	if (state?.clipPath != null) el.style.clipPath = state.clipPath;
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

	// ── src-Modus: motion-* und morph verarbeiten ────────────────────────────
	const motionElements = [];
	if (props.src) {
		// motion-* → CSS-Transformationen
		svg.querySelectorAll("[motion-initial]").forEach((el) => {
			const initial = parseMotionObj(el.getAttribute("motion-initial"));
			const motionStyle = el.getAttribute("motion-style");
			const previewTx = el.getAttribute("motion-preview-transform");

			if (previewTx && el.getAttribute("transform") === previewTx)
				el.removeAttribute("transform");
			el.removeAttribute("motion-preview-transform");

			if (motionStyle) {
				// Bestehende Style-Properties erhalten, nur motion-style-Properties mergen
				motionStyle.split(";").forEach((decl) => {
					const [prop, ...rest] = decl.split(":");
					if (prop?.trim())
						el.style.setProperty(prop.trim(), rest.join(":").trim());
				});
				el.removeAttribute("motion-style");
			}

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

		// morph="from" → morpht beim Betreten der Folie
		// morph="to"   → Zielpfad (gleiches inkscape:label, wird entfernt)
		const unhide = (el) => {
			const s = el.getAttribute("style") ?? "";
			if (/display\s*:\s*none/.test(s))
				el.setAttribute(
					"style",
					s.replace(/display\s*:\s*none\s*;?\s*/g, "").trim(),
				);
		};

		svg.querySelectorAll('path[morph="from"]').forEach((fromEl) => {
			const label = fromEl.getAttribute("inkscape:label");
			if (!label) return;

			const toEl = [
				...svg.querySelectorAll(`[inkscape\\:label="${label}"]`),
			].find((el) => el !== fromEl && el.getAttribute("morph") === "to");
			if (!toEl) {
				console.warn(
					`[MorphSVG] kein Morph-Ziel mit Label "${label}" gefunden`,
				);
				return;
			}

			unhide(fromEl);
			fromEl.setAttribute("from", fromEl.getAttribute("d") ?? "");
			fromEl.setAttribute("to", toEl.getAttribute("d") ?? "");

			const morphClick = fromEl.getAttribute("morph-click") ?? "";
			if (morphClick === "0" || morphClick === "") {
				fromEl.setAttribute("at-click", "0");
			} else {
				const cm = morphClick.match(/^(\d+)(?:-(\d+))?$/);
				if (cm) {
					fromEl.setAttribute("at-click", cm[1]);
					if (cm[2]) fromEl.setAttribute("at-click-back", cm[2]);
				}
			}
			fromEl.removeAttribute("morph");
			fromEl.removeAttribute("morph-click");
			toEl.remove();
		});
	}

	// ── Morph-Pfade (path[from]) ──────────────────────────────────────────────
	svg.querySelectorAll("path[from]").forEach((el) => {
		const shapeA = el.getAttribute("from");
		const shapeB = el.getAttribute("to");
		const atClick = parseInt(el.getAttribute("at-click") ?? "0");
		const atClickBack = el.hasAttribute("at-click-back")
			? parseInt(el.getAttribute("at-click-back"))
			: null;
		const m = useMorph({ duration: props.duration });
		el.setAttribute("d", shapeA);
		m.pathD.value = shapeA;
		watch(m.pathD, (d) => el.setAttribute("d", d));
		morphInstances.push({ m, shapeA, shapeB, atClick, atClickBack });
	});

	// ── Klick-Watcher ─────────────────────────────────────────────────────────
	watch(
		() => [currentSlideNo.value, clicks.value],
		([slide, n], [prevSlide, prev]) => {
			if (slideNo.value === null || slide !== slideNo.value) return;
			const animated = prevSlide === slideNo.value;

			morphInstances.forEach(({ m, shapeA, shapeB, atClick, atClickBack }) => {
				if (atClick === 0) {
					// on-enter: bei Direktsprung sofort auf shapeB setzen
					if (!animated) m.pathD.value = shapeB;
					return;
				}
				if (!animated) {
					let state = n >= atClick ? shapeB : shapeA;
					if (atClickBack !== null && n >= atClickBack) state = shapeA;
					m.pathD.value = state;
					return;
				}
				if (n === atClick && prev === atClick - 1) m.morph(shapeA, shapeB);
				if (n === atClick - 1 && prev === atClick) m.morph(shapeB, shapeA);
				if (atClickBack !== null) {
					if (n === atClickBack && prev === atClickBack - 1)
						m.morph(shapeB, shapeA);
					if (n === atClickBack - 1 && prev === atClickBack)
						m.morph(shapeA, shapeB);
				}
			});

			motionElements.forEach(({ el, initial, clickStates }) => {
				let target = { ...initial };
				for (let c = 1; c <= n; c++) {
					if (clickStates[c]) Object.assign(target, clickStates[c]);
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
