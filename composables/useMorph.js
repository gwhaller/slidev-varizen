import { ref, onUnmounted } from "vue";

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

export function useMorph({ duration = 600 } = {}) {
  const pathD = ref("");
  let rafId = null;

  function morph(from, to) {
    if (rafId) cancelAnimationFrame(rafId);

    const a = from.match(/-?[\d.]+/g).map(Number);
    const b = to.match(/-?[\d.]+/g).map(Number);
    const start = performance.now();

    const tick = (now) => {
      const t = easeInOut(Math.min((now - start) / duration, 1));
      let i = 0;
      pathD.value = from.replace(/-?[\d.]+/g, () => {
        const v = a[i] + (b[i] - a[i]) * t;
        i++;
        return v.toFixed(3);
      });
      if (t < 1) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
  }

  onUnmounted(() => rafId && cancelAnimationFrame(rafId));
  return { pathD, morph };
}
