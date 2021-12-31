import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    component: () => import('../views/HelloWorld.vue')
  },
  {
    path: '/demo',
    component: () => import('../views/Demo.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router