<script setup lang="ts">

</script>

<template>
  <nav class="nav">
    <router-link to="/">HelloWorld</router-link>
    <router-link to="/demo">Demo</router-link>
  </nav>
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
