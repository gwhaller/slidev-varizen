<script setup>
import { ref, watch, watchEffect, onMounted, onActivated } from "vue";
import fullbodyUrl from "../assetts/fullbody.svg?url";
import zoombodyUrl from "../assetts/zoombody.svg?url";

const viewBoxFull = "0 0 1920 1080";
const boxX = 850;
const boxY = 790.0625;
const boxWidth = 94;
const boxHeight = 52.875;
const viewBoxZoom = `${boxX} ${boxY} ${boxWidth} ${boxHeight}`;
const perimeter = 2 * (boxWidth + boxHeight);

const viewBox = ref(viewBoxFull);
const zoombodyOpacity = ref(0);
let fadeRaf = null;
let viewBoxRaf = null;

// ── Reset bei Slide-Eintritt (Vorwärts- und Rückwärts-Navigation) ─────────
function resetState() {
	if (fadeRaf) {
		cancelAnimationFrame(fadeRaf);
		fadeRaf = null;
	}
	if (viewBoxRaf) {
		cancelAnimationFrame(viewBoxRaf);
		viewBoxRaf = null;
	}
	viewBox.value = viewBoxFull;
	zoombodyOpacity.value = 0;
}

onMounted(resetState); // frisches Mounten (kein keep-alive)
onActivated(resetState); // Reaktivierung via keep-alive

// ── Klick-Animationen ($clicks ist per-Slide, kein Page-Check nötig) ──────
watch($clicks, (val) => {
	if (val >= 2) {
		animateViewBox(viewBoxZoom);
		animateFade(zoombodyOpacity.value, 1);
	} else {
		animateViewBox(viewBoxFull);
		animateFade(zoombodyOpacity.value, 0);
	}
});

function animateFade(from, to) {
	if (Math.abs(from - to) < 0.001) return;
	if (fadeRaf) cancelAnimationFrame(fadeRaf);
	const duration = 1000;
	const startTime = performance.now();
	function step(now) {
		const t = Math.min((now - startTime) / duration, 1);
		const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
		zoombodyOpacity.value = from + (to - from) * ease;
		if (t < 1) {
			fadeRaf = requestAnimationFrame(step);
		} else {
			fadeRaf = null;
		}
	}
	fadeRaf = requestAnimationFrame(step);
}

function animateViewBox(to) {
	const start = viewBox.value.split(" ").map(Number);
	const end = to.split(" ").map(Number);
	if (start.every((v, i) => Math.abs(v - end[i]) < 0.01)) return;
	if (viewBoxRaf) cancelAnimationFrame(viewBoxRaf);
	const duration = 1000;
	const startTime = performance.now();
	function step(now) {
		const t = Math.min((now - startTime) / duration, 1);
		const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
		viewBox.value = start.map((v, i) => v + (end[i] - v) * ease).join(" ");
		if (t < 1) {
			viewBoxRaf = requestAnimationFrame(step);
		} else {
			viewBoxRaf = null;
		}
	}
	viewBoxRaf = requestAnimationFrame(step);
}
</script>

<div class="flex justify-center">
  <svg class="w-full h-full absolute inset-0" :viewBox="viewBox">
    <image
      :href="fullbodyUrl"
      width="1920"
      height="1080"
      :style="{ opacity: 1 - zoombodyOpacity }"
    />
    <image
      :href="zoombodyUrl"
      width="1920"
      height="1080"
      :style="{ opacity: zoombodyOpacity }"
    />
    <rect
      :x="boxX"
      :y="boxY"
      :width="boxWidth"
      :height="boxHeight"
      fill="none"
      stroke="red"
      stroke-width="4"
      :stroke-dasharray="perimeter"
      v-motion
      :initial="{ strokeDashoffset: perimeter, opacity: 1 }"
      :click-1="{
        strokeDashoffset: 0,
        transition: { duration: 1000, ease: 'easeInOut' },
      }"
      :click-2="{
        opacity: 0,
        transition: { duration: 1000, ease: 'easeInOut', delay: 200 },
      }"
    />
  </svg>
</div>
