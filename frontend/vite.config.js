import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': "https://mern-app-task-gpp9.vercel.app" //'http://localhost:5000'
    }
  }
});
