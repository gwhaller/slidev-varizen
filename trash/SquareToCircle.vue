<script setup>
import Morph from "./Morph.vue";

// const paths = [
//   {
//     label: 'SquareToCircle',
//     from:        'M50,50 L150,50 L150,150 L50,150 Z',
//     to:          'M100,50 C127.61,50 150,72.39 150,100 C150,127.61 127.61,150 100,150 C72.39,150 50,127.61 50,100 C50,72.39 72.39,50 100,50 Z',
//     atClick:     1,
//     fill:        '#4EC5D4',
//     stroke:      '#146b8c',
//     strokeWidth: 2,
//   },
// ];

const paths = [
  {
    label: "static_background",
    d: "M 29.007497,39.931078 H 185.56456 V 157.52526 H 29.007497 Z",
    fill: "#cccccc",
    stroke: "#000000",
    strokeWidth: 2.71368,
  },
  {
    label: "static_extra",
    d: "M 159,24 H 170 V 35 H 159 Z",
    fill: "#cccccc",
    stroke: "#000000",
    strokeWidth: 0.209662,
  },
  {
    label: "morph_1",
    atClick: 3,
    from: "M50,50 L150,50 L150,150 L50,150 Z",
    to: "m 99.836245,50 c 27.609995,0 49.999995,22.39 49.999995,50 0,27.61 -22.39,50 -49.999995,50 -27.61,0 -50,-22.39 -50,-50 0,-27.61 22.39,-50 50,-50 z",
    stroke: "#cccccc",
    stroke: "#000000",
    strokeWidth: 2,
  },
  {
    label: "mover",
    d: "M10,10 H40 V40 H10 Z",
    fill: "#3498db",
    atClick: 1,
    translateX: { from: 0, to: 80 },
    translateY: { from: 0, to: 50 },
    scale: { from: 1, to: 2 },
  },
  {
    label: "rotator",
    d: "M90,90 H110 V110 H90 Z",
    fill: "#e74c3c",
    atClick: 2,
    rotate: { from: 0, to: 90 },
  },
];
</script>

<template>
  <Morph
    :width="220"
    :height="220"
    view-box="0 0 200 200"
    :duration="1200"
    :paths="paths"
  />
</template>
