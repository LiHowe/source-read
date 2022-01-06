<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: 'LifecycleDemo',
  beforeRouteEnter () {
    console.log('beforeRouteEnter')
  },
  beforeRouteUpdate() {
    console.log('beforeRouteUpdate')
  },
  beforeRouteLeave() {
    console.log('beforeRouteLeave')
  },
  beforeCreate() {
    console.log('beforeCreate')
  },
  created(){
    console.log('created')
  },
  beforeUpdate() {
    console.log('beforeUpdata')
  },
  updated(){
    console.log('updated')
  },
  beforeMount() {
    console.log('beforeMount')
  },
  mounted(){
    console.log('mounted')
  },
  beforeUnmount() {
    console.log('beforeUnmount')
  },
  unmounted () {
    console.log('unmounted')
  },
  
})
</script>

<template>
  This is Hello World Component
</template>

<style scoped>
a {
  color: #42b983;
}

label {
  margin: 0 0.5em;
  font-weight: bold;
}

code {
  background-color: #eee;
  padding: 2px 4px;
  border-radius: 4px;
  color: #304455;
}
</style>
