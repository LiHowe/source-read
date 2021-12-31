import { defineConfig } from 'vite'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default () => defineConfig({
  root: resolve(process.cwd(), 'example'),
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.vue'],
  },
  plugins: [vue()],
  define: {
    __DEV__: JSON.stringify(!process.env.prod),
    __BROWSER__: 'true',
    'process.env': {
      NODE_ENV: JSON.stringify(process.env.NODE_ENV),
    },
  },
})
