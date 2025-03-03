import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import topLevelAwait from "vite-plugin-top-level-await";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [nodePolyfills(), react(), topLevelAwait(), wasm()],
  optimizeDeps: {
    esbuildOptions: {
      supported: {
        "top-level-await": true
      }
    }
  }
  
})
