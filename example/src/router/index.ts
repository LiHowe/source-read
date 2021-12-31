import { createRouter, createWebHistory } from 'vue-router'

export const routes = [
  {
    path: '/',
    name: '首页',
    component: () => import('../views/HelloWorld.vue')
  },
  {
    path: '/demo',
    name: 'Demo',
    component: () => import('../views/Demo.vue')
  }
]
const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router