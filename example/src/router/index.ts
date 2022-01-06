import { createRouter, createWebHistory } from 'vue-router'
import HelloWorld from '../views/HelloWorld.vue'
export const routes = [
  {
    path: '/',
    name: '首页',
    component: HelloWorld
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

router.beforeEach((to, from) => {
  console.log('enter BeforeEach', { to, from })
  return true
})

router.afterEach((to, from) => {
  console.log('enter afterEach', { to, from })
  return true
})

router.beforeResolve(to => {
  console.log('enter beforeResolve', { to })
  return true
})

export default router