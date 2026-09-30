import { createRouter, createWebHistory } from 'vue-router'

import QuizView from '@/views/QuizView.vue'
import AdminLogin from '@/views/AdminLogin.vue'
import AdminDashboard from '@/views/AdminDashboard.vue'
import { isAdminAuthenticated } from '@/composables/useAdminAuth'

const routes = [
  { path: '/', name: 'quiz', component: QuizView, meta: { title: 'Kuis Kelas' } },
  { path: '/admin', name: 'admin-login', component: AdminLogin, meta: { title: 'Masuk Guru' } },
  {
    path: '/admin/dashboard',
    name: 'admin-dashboard',
    component: AdminDashboard,
    meta: { title: 'Dashboard Guru', requiresAdmin: true },
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  if (to.meta.requiresAdmin && !isAdminAuthenticated()) {
    return { name: 'admin-login' }
  }
  return true
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} — KuisKita` : 'KuisKita'
})

export default router
