import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import remarkEmoji from 'remark-emoji';
import mermaid from 'astro-mermaid';

// https://astro.build/config
export default defineConfig({
  site: 'https://blog.safia.rocks',
  integrations: [mdx(), sitemap(), mermaid({
    theme: 'forest',
    autoTheme: true
  })],
  markdown: {
    remarkPlugins: [remarkEmoji],
    shikiConfig: {
      theme: 'github-light',
    },
    syntaxHighlight: {
      excludeLangs: ['mermaid'],
    },
  },
});
