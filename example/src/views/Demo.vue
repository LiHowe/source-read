<template>
  This is demo page
</template>

<script lang="ts">
export default {
  beforeRouteEnter() {
    console.log('[Demo] beforeRouteEnter')
  },
  beforeRouteUpdate() {
    console.log('[Demo] beforeRouteUpdate')
  },
  beforeCreate() {
    console.log('[Demo] beforeCreate')
  },
  created() {
    console.log('[Demo] created')

  }
}
</script>