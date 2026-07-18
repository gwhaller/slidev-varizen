---
clicks: 7
layout: none
---

<script setup>
import { ref } from "vue";
import venepumpSvg from "../assetts/venepump.svg?raw";
import { useShore } from "../composables/useShore";

const morphRef = ref(null);
useShore(morphRef);
</script>

<!-- <MorphSVG :src="venepumpSvg" viewBox="0 0 1920 1080" :duration="700" /> -->
<MorphSVG ref="morphRef" :src="venepumpSvg" viewBox="850 790.0625 94 52.875" :duration="700" />
