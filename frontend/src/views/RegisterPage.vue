<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { register } from '../api/auth'
import { saveAuth } from '../utils/auth'

const router = useRouter()
const loading = ref(false)
const form = reactive({
  username: '',
  password: '',
  confirmPassword: ''
})

async function handleRegister() {
  if (!form.username || !form.password || !form.confirmPassword) {
    ElMessage.warning('请完整填写注册信息')
    return
  }

  if (form.password !== form.confirmPassword) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }

  loading.value = true

  try {
    const result = await register({
      username: form.username,
      password: form.password
    })
    saveAuth(result.token, result.user)
    router.push('/chat')
  } catch (error) {
    console.error(error)
    ElMessage.error('注册失败，请更换用户名后重试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-panel">
      <div class="auth-brand">AIChat</div>
      <h1>创建账号</h1>
      <el-input v-model="form.username" placeholder="用户名" />
      <el-input v-model="form.password" type="password" show-password placeholder="密码" />
      <el-input v-model="form.confirmPassword" type="password" show-password placeholder="确认密码" />
      <el-button type="primary" :loading="loading" @click="handleRegister">注册</el-button>
      <router-link to="/login" class="auth-link">已有账号？去登录</router-link>
    </div>
  </div>
</template>
