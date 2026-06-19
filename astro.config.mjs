// @ts-check
import { defineConfig } from 'astro/config';

// Static output. Content-first, ships minimal JS, islands for the interactive bits.
// `site` is intentionally generic; set it to your deploy URL for canonical links.
export default defineConfig({
  site: 'https://example.com',
  output: 'static',
  // Keep the build lean; no integrations required for a hand-authored canvas site.
  build: {
    inlineStylesheets: 'auto',
  },
});
