import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

function carbonExportDevLogger(): Plugin {
  return {
    name: 'carbon-export-dev-logger',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev/log', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        let body = ''
        req.on('data', (chunk) => {
          body += String(chunk)
          if (body.length > 10_000) {
            res.statusCode = 413
            res.end('Payload Too Large')
            req.destroy()
          }
        })

        req.on('end', () => {
          try {
            const payload = JSON.parse(body) as {
              tone?: 'info' | 'success' | 'warning' | 'error'
              icon?: string
              title?: string
              message?: string
            }
            const tone = payload.tone ?? 'info'
            const toneLabel = {
              info: 'กำลังทำงาน',
              success: 'สำเร็จ',
              warning: 'ยังไม่พร้อม',
              error: 'มีอะไรสะดุด',
            }[tone]
            const icon = payload.icon ?? {
              info: '🌾',
              success: '✅',
              warning: '🫠',
              error: '💥',
            }[tone]

            console.log(`\n${icon}  [Carbon Export | ${toneLabel}] ${payload.title ?? 'มี event ใหม่จากหน้าเว็บ'}`)
            if (payload.message) {
              console.log(`   ${payload.message}`)
            }
          } catch (error) {
            console.warn('[Carbon Export] รับ log จาก browser ไม่สำเร็จ', error)
          }

          res.statusCode = 204
          res.end()
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), carbonExportDevLogger()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['localhost', '127.0.0.1', '.ngrok-free.dev', '.ngrok.app'],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
