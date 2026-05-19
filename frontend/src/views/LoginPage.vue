<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { login } from '../api/auth'
import { saveAuth } from '../utils/auth'

const router = useRouter()
const loading = ref(false)
const form = reactive({
  username: '',
  password: ''
})

async function handleLogin() {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }

  loading.value = true

  try {
    const result = await login(form)
    saveAuth(result.token, result.user)
    router.push('/chat')
  } catch (error) {
    console.error(error)
    ElMessage.error('登录失败，请检查用户名和密码')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-panel">
      <div class="auth-brand">AIChat</div>
      <h1>登录账号</h1>
      <el-input v-model="form.username" placeholder="用户名" />
      <el-input v-model="form.password" type="password" show-password placeholder="密码" />
      <el-button type="primary" :loading="loading" @click="handleLogin">登录</el-button>
      <router-link to="/register" class="auth-link">没有账号？去注册</router-link>
    </div>
  </div>
</template>
