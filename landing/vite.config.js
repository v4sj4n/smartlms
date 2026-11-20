import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

// One static page, no framework: the landing page is the app.
// The Cloudflare Vite plugin emits the Workers build output that `cf deploy` uploads.
export default defineConfig({
	build: { target: "esnext" },
	server: { port: 5174 },
	plugins: [cloudflare()],
});
