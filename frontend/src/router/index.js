import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      redirect: '/dashboard'
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: () => import('@/views/Dashboard.vue'),
      meta: { title: '仪表板' }
    },
    {
      path: '/agents',
      name: 'AgentManagement',
      component: () => import('@/views/AgentManagement.vue'),
      meta: { title: '代理管理' }
    },
    {
      path: '/monitoring',
      name: 'Monitoring',
      component: () => import('@/views/Monitoring.vue'),
      meta: { title: '监控中心' }
    },
    {
      path: '/logs',
      name: 'Logs',
      component: () => import('@/views/Logs.vue'),
      meta: { title: '日志查看' }
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('@/views/Settings.vue'),
      meta: { title: '系统设置' }
    }
  ]
})

// 路由守卫
router.beforeEach((to, from, next) => {
  // 设置页面标题
  if (to.meta.title) {
    document.title = `${to.meta.title} - Agent Management System`
  }
  next()
})

export default router