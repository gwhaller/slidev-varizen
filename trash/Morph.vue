<script setup>
import { computed } from "vue";
import { useTransition, TransitionPresets } from "@vueuse/core";
import { useNav } from "@slidev/client";
import { interpolate } from "flubber";

/**
 * paths[i] – statischer Pfad:
 *   { d, fill?, stroke?, strokeWidth? }
 *
 * paths[i] – Formmorph:
 *   { from, to, atClick?, duration?, fill?, stroke?, strokeWidth?, flubber? }
 *
 * paths[i] – Transform-Animation:
 *   { d, atClick?, duration?,
 *     rotate?:     { from: 0, to: 90 },
 *     scale?:      { from: 1, to: 1.5 },
 *     translateX?: { from: 0, to: 50 },
 *     translateY?: { from: 0, to: 20 },
 *   }
 */
const props = defineProps({
  width: { type: Number, default: 200 },
  height: { type: Number, default: 200 },
  viewBox: { type: String, default: null },
  duration: { type: Number, default: 600 },
  paths: { type: Array, required: true },
});

const { clicks } = useNav();
const computedViewBox = computed(
  () => props.viewBox ?? `0 0 ${props.width} ${props.height}`,
);

// Alle Transitions auf Top-Level anlegen (Vue-Regel: Composables nur auf Top-Level)
const transitions = props.paths.map((p) => {
  const duration = p.duration ?? props.duration;
  const atClick = p.atClick ?? 1;
  const trigger = () => (clicks.value >= atClick ? 1 : 0);
  const opts = { duration, transition: TransitionPresets.easeInOut };

  return {
    morph: p.from ? useTransition(trigger, opts) : null,
    rotate: p.rotate ? useTransition(trigger, opts) : null,
    scale: p.scale ? useTransition(trigger, opts) : null,
    translateX: p.translateX ? useTransition(trigger, opts) : null,
    translateY: p.translateY ? useTransition(trigger, opts) : null,
  };
});

const pathData = props.paths.map((p, i) => {
  const fill = p.fill ?? "none";
  const stroke = p.stroke ?? "none";
  const strokeWidth = p.strokeWidth ?? 0;
  const duration = p.duration ?? props.duration;
  const atClick = p.atClick ?? 1;
  const tr = transitions[i];

  // Statischer Pfad ohne Transform
  if (
    p.d !== undefined &&
    !p.rotate &&
    !p.scale &&
    !p.translateX &&
    !p.translateY
  ) {
    return { fill, stroke, strokeWidth, style: {}, d: () => p.d };
  }

  // Statischer Pfad mit Transform-Animation
  if (p.d !== undefined) {
    return {
      fill,
      stroke,
      strokeWidth,
      d: () => p.d,
      style: computed(() => {
        const parts = [];
        if (p.translateX || p.translateY) {
          const tx = p.translateX
            ? p.translateX.from +
              (p.translateX.to - p.translateX.from) * tr.translateX.value
            : 0;
          const ty = p.translateY
            ? p.translateY.from +
              (p.translateY.to - p.translateY.from) * tr.translateY.value
            : 0;
          parts.push(`translate(${tx}px, ${ty}px)`);
        }
        if (p.rotate) {
          const r =
            p.rotate.from + (p.rotate.to - p.rotate.from) * tr.rotate.value;
          parts.push(`rotate(${r}deg)`);
        }
        if (p.scale) {
          const s = p.scale.from + (p.scale.to - p.scale.from) * tr.scale.value;
          parts.push(`scale(${s})`);
        }
        return {
          transform: parts.join(" "),
          transformBox: "fill-box",
          transformOrigin: "center",
        };
      }),
    };
  }

  // Formmorph: CSS transition:d
  if (p.flubber === false) {
    return {
      fill,
      stroke,
      strokeWidth,
      style: { transition: `d ${duration}ms ease` },
      d: () => (clicks.value >= atClick ? p.to : p.from),
    };
  }

  // Formmorph: Flubber
  const interp = interpolate(p.from, p.to, { maxSegmentLength: 4 });
  return {
    fill,
    stroke,
    strokeWidth,
    style: {},
    d: () => interp(tr.morph.value),
  };
});

const resolvedPaths = computed(() =>
  pathData.map((p) => ({
    ...p,
    d: p.d(),
    style: p.style?.value ?? p.style,
  })),
);
</script>

<template>
  <svg :width="width" :height="height" :viewBox="computedViewBox">
    <path
      v-for="(p, i) in resolvedPaths"
      :key="i"
      :d="p.d"
      :fill="p.fill"
      :stroke="p.stroke"
      :stroke-width="p.strokeWidth"
      stroke-linejoin="round"
      :style="p.style"
    />
  </svg>
</template>
