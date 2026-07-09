import { onMounted, nextTick, onUnmounted } from "vue";

/**
 * useShore — leitet fill-shore-* Pfade in Echtzeit aus inner-line-* ab.
 *
 * Venepump-spezifische Logik, bewusst außerhalb von MorphSVG.vue gehalten.
 *
 * Konvention in der SVG (auf den fill-shore-* Elementen):
 *   shore-inner="inner-line-left"   ← ID des Quellpfads (vor Uniquifizierung)
 *   shore-pre="M 864... L "         ← vorangestellter fixer Außenrand-Teil
 *   shore-post=" L 871... Z"        ← angehängter fixer Außenrand-Teil
 *
 * Ableitung:
 *   left:  shore-pre + innerD (ohne führendes "M x,y ") + shore-post
 *   right: innerD + shore-post  (shore-pre leer)
 *
 * @param {import('vue').Ref} morphRef  Template-Ref auf die <MorphSVG>-Instanz
 */
export function useShore(morphRef) {
	const observers = [];

	onMounted(() => {
		// nextTick: MorphSVG.vue's onMounted (Kind) läuft vor dem Eltern-onMounted,
		// aber der DOM-Patch wird erst mit nextTick vollständig abgeschlossen.
		nextTick(() => {
			// $el ist das <svg>-Root-Element von MorphSVG
			const svgEl = morphRef.value?.$el;
			if (!svgEl) return;

			svgEl.querySelectorAll("path[shore-inner]").forEach((shoreEl) => {
				const innerIdBase = shoreEl.getAttribute("shore-inner");
				const pre = shoreEl.getAttribute("shore-pre") ?? "";
				const post = shoreEl.getAttribute("shore-post") ?? "";
				shoreEl.removeAttribute("shore-inner");
				shoreEl.removeAttribute("shore-pre");
				shoreEl.removeAttribute("shore-post");

				// MorphSVG uniquifiziert IDs: "inner-line-left" → "inner-line-left_xyz"
				// Suche nach dem Element, dessen ID mit dem Basisnamen beginnt.
				const innerEl = svgEl.querySelector(
					`[id^="${innerIdBase}_"], [id="${innerIdBase}"]`,
				);
				if (!innerEl) {
					console.warn(`[useShore] Element "${innerIdBase}" nicht gefunden`);
					return;
				}

				const derive = (d) =>
					pre ? pre + d.replace(/^M\s*/, "") + post : d + post;

				// Initialen Pfad setzen
				const d0 = innerEl.getAttribute("d");
				if (d0) shoreEl.setAttribute("d", derive(d0));

				// MutationObserver: bei jeder Änderung des d-Attributs neu ableiten
				const obs = new MutationObserver(() => {
					const d = innerEl.getAttribute("d");
					if (d) shoreEl.setAttribute("d", derive(d));
				});
				obs.observe(innerEl, { attributes: true, attributeFilter: ["d"] });
				observers.push(obs);
			});
		});
	});

	onUnmounted(() => {
		observers.forEach((obs) => obs.disconnect());
		observers.length = 0;
	});
}
