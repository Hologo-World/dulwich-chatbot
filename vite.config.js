import react from '@vitejs/plugin-react'
import fs from 'fs'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const keyPath = './certs/localhost-key.pem'
  const certPath = './certs/localhost.pem'

  // Only use local HTTPS certs when running `npm run dev` and the certs exist
  const useLocalHttps =
    command === 'serve' && fs.existsSync(keyPath) && fs.existsSync(certPath)

  return {
    plugins: [react()],
    server: useLocalHttps
      ? {
        host: 'localhost',
        port: 5173,
        https: {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        },
      }
      : undefined,
  }
})