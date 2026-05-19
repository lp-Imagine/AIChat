import { onUnmounted, ref } from 'vue'

export function useTypewriter() {
  const displayText = ref('')
  const isTyping = ref(false)
  let buffer = ''
  let timer: number | null = null
  let pendingResolvers: Array<() => void> = []
  let updateHandler: ((value: string) => void) | null = null

  const resolvePending = () => {
    const resolvers = pendingResolvers
    pendingResolvers = []
    resolvers.forEach((resolve) => resolve())
  }

  const stopTyping = () => {
    if (timer !== null) {
      window.clearInterval(timer)
      timer = null
    }
    isTyping.value = false
  }

  const startTyping = (speed = 50, chunkSize = 3) => {
    if (timer !== null) {
      return
    }

    isTyping.value = true
    timer = window.setInterval(() => {
      if (buffer.length === 0) {
        stopTyping()
        resolvePending()
        return
      }

      const charsToAdd = buffer.slice(0, chunkSize)
      buffer = buffer.slice(chunkSize)
      displayText.value += charsToAdd
      updateHandler?.(displayText.value)
    }, speed)
  }

  const appendBuffer = (text: string, speed = 50, chunkSize = 3) => {
    buffer += text

    if (timer === null && buffer.length > 0) {
      startTyping(speed, chunkSize)
    }
  }

  const waitForIdle = () => {
    if (buffer.length === 0 && timer === null) {
      return Promise.resolve()
    }

    if (timer === null && buffer.length > 0) {
      startTyping()
    }

    return new Promise<void>((resolve) => {
      pendingResolvers.push(resolve)
    })
  }

  const setUpdateHandler = (handler: ((value: string) => void) | null) => {
    updateHandler = handler
  }

  const clear = () => {
    stopTyping()
    displayText.value = ''
    buffer = ''
    updateHandler?.(displayText.value)
    resolvePending()
  }

  onUnmounted(() => {
    stopTyping()
  })

  return {
    displayText,
    isTyping,
    appendBuffer,
    waitForIdle,
    setUpdateHandler,
    clear
  }
}
