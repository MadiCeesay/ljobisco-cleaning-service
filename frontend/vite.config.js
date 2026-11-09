import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const apiTarget = process.env.IJOBISCO_API_PROXY_TARGET || 'http://127.0.0.1:4000';
export default defineConfig({ plugins: [react(), tailwindcss()], server: { proxy: { '/api': { target: apiTarget } } } });
