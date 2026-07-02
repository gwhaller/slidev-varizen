<!-- components/MorphShape.vue -->
<script setup>
import { watch, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useNav } from "@slidev/client";
import { useMorph } from "../composables/useMorph";

const shapeA =
  "M 100,10 L 120,80 L 190,80 L 130,120 L 150,190 L 100,150 L50,190L 70,120 L 10,80 L 80,80 Z";
const shapeB =
  "M 100,10 L 129,35 L 190,45 L145,88L 155,150 L 100,120 L 45,150 L 55,88 L 10,45 L 71,35 Z";

const { pathD, morph } = useMorph({ duration: 600 });
const { clicks, currentSlideNo } = useNav();
const route = useRoute();

onMounted(() => {
  pathD.value = shapeA;

  watch(
    () => [currentSlideNo.value, clicks.value],
    ([slide, n], [prevSlide, prev]) => {
      const slideNo = parseInt(route.params.no);
      if (slide !== slideNo) return;

      if (prevSlide !== slideNo) {
        pathD.value = n === 0 ? shapeA : shapeB;
        return;
      }

      if (n === 1 && prev === 0) morph(shapeA, shapeB);
      if (n === 0 && prev === 1) morph(shapeB, shapeA);
    },
  );
});
</script>

<template>
  <svg viewBox="0 0 200 200">
    <path :d="pathD" fill="#4f46e5" />
  </svg>
</template>

const shapeA = "M 100,10 L 120,80 L 190,80 L 130,120 L 150,190 L 100,150 L50,190
L 70,120 L 10,80 L 80,80 Z"; const shapeB = "M 100,10 L 129,35 L 190,45 L145,88
L 155,150 L 100,120 L 45,150 L 55,88 L 10,45 L 71,35 Z";
