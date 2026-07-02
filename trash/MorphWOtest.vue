<script setup>
import { useRoute } from "vue-router";
import { watch, onMounted } from "vue";
import { useNav } from "@slidev/client";
import { useMorph } from "../composables/useMorph";

const shapeA = "...";
const shapeB = "...";

const { pathD, morph } = useMorph({ duration: 600 });
const { clicks, currentSlideNo } = useNav();
const route = useRoute();

console.log("route:", route);
console.log("route.params:", route.params);
</script>

<template>
  <div style="color: red; font-size: 12px">
    route params: {{ route.params }}<br />
    route name: {{ route.name }}<br />
    route path: {{ route.path }}
  </div>
</template>
