import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: {
    sourcemap: false,
    rolldownOptions: { output: { codeSplitting: { groups: [
      { name: 'supabase', test: /[\\/]node_modules[\\/]@supabase[\\/]/ },
      { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
    ] } } },
  },
})
