import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@builder': path.resolve(__dirname, '..'),
      'reactflow': path.resolve(__dirname, 'node_modules/reactflow'),
      '@mantine/core': path.resolve(__dirname, 'node_modules/@mantine/core'),
      '@mantine/hooks': path.resolve(__dirname, 'node_modules/@mantine/hooks'),
      'react': path.resolve(__dirname, 'node_modules/react')
    }
  },
  server: {
    port: 5175,
    fs: {
      allow: [path.resolve(__dirname, '..')]
    }
  }
});
