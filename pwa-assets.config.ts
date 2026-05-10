import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { background: '#0a0c0f' },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { background: '#0a0c0f' },
    },
    transparent: {
      ...minimal2023Preset.transparent,
      resizeOptions: { background: '#0a0c0f' },
    },
  },
  images: ['public/icon-source.png'],
})
