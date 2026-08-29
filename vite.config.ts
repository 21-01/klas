import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()], // basicSsl() dimatikan sementara
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    host: true,
    allowedHosts: [
      "fork-agriculture-collecting-anthony.trycloudflare.com",
	  "klas.unj.ac.id"
    ],
	port: 80
  },
});
