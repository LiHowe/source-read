<template>
  <nav class="nav">
    <router-link
    v-for="r in routes"
    :key="r.path"
    :to="r.path"
    >
      {{ r.name }}
    </router-link>
  </nav>
</template>
<script setup lang="ts">
import { routes } from '../router'
</script>
<style scoped>

</style>