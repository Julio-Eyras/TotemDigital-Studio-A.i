import path from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@shared/holograph-adapter': path.resolve(__dirname, '../shared/holograph-adapter'),
    },
  },
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'HoloGraphEngine',
      fileName: 'holograph-engine'
    }
  }
})
