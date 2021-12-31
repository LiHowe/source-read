<script setup lang="ts">
  import Nav from './components/Nav.vue'
</script>

<template>
  <Nav />
  <main>
    <router-view></router-view>
  </main>
</template>

<style>
html, body {
  margin: 0;
  padding: 0;
}
* {
  box-sizing: border-box;
}
a {
  text-decoration: none;
  color: #42b983;
}
a:visited {
  color: #42b983;
}
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}
</style>
