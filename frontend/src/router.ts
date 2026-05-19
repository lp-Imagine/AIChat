import { createRouter, createWebHistory } from 'vue-router'
import { getToken } from './utils/auth'

const ChatPage = () => import('./views/ChatPage.vue')
const LoginPage = () => import('./views/LoginPage.vue')
const RegisterPage = () => import('./views/RegisterPage.vue')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/chat'
    },
    {
      path: '/login',
      component: LoginPage
    },
    {
      path: '/register',
      component: RegisterPage
    },
    {
      path: '/chat',
      component: ChatPage,
      meta: {
        requiresAuth: true
      }
    }
  ]
})

router.beforeEach((to) => {
  const token = getToken()

  if (to.meta.requiresAuth && !token) {
    return '/login'
  }

  if ((to.path === '/login' || to.path === '/register') && token) {
    return '/chat'
  }
})

export default router
