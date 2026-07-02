<!-- components/MorphShape.vue -->
<script setup>
import { watch, onMounted, useTemplateRef, ref } from "vue";
import { useNav, onSlideEnter } from "@slidev/client";
import { useMorph } from "../composables/useMorph";

const props = defineProps({
  duration: { type: Number, default: 600 },
  viewBox: { type: String, default: "0 0 1920 1080" },
});

const { clicks, currentSlideNo } = useNav();
const svgRef = useTemplateRef("svgEl");
const slideNo = ref(null);

onSlideEnter(() => {
  if (slideNo.value === null) slideNo.value = currentSlideNo.value;
});

onMounted(() => {
  const morphPaths = [...svgRef.value.querySelectorAll("path[from]")];

  const morphInstances = morphPaths.map((el) => {
    const shapeA = el.getAttribute("from");
    const shapeB = el.getAttribute("to");
    const atClick = parseInt(el.getAttribute("at-click") ?? "1");
    const m = useMorph({ duration: props.duration });

    el.setAttribute("d", shapeA);
    m.pathD.value = shapeA;

    watch(m.pathD, (d) => el.setAttribute("d", d));
    return { m, shapeA, shapeB, atClick };
  });

  watch(
    () => [currentSlideNo.value, clicks.value],
    ([slide, n], [prevSlide, prev]) => {
      if (slideNo.value === null || slide !== slideNo.value) return;

      morphInstances.forEach(({ m, shapeA, shapeB, atClick }) => {
        if (prevSlide !== slideNo.value) {
          m.pathD.value = n < atClick ? shapeA : shapeB;
          return;
        }
        if (n === atClick && prev === atClick - 1) m.morph(shapeA, shapeB);
        if (n === atClick - 1 && prev === atClick) m.morph(shapeB, shapeA);
      });
    },
  );
});
</script>

<template>
  <svg ref="svgEl" :viewBox="viewBox">
    <slot />
  </svg>
</template>
