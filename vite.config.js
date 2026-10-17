import { defineConfig } from 'vite'

export default defineConfig({
  base: './', // 相对路径，便于部署到任意子目录
  server: { port: 5173 },
})
