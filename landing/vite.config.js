import { defineConfig } from "vite";

// One static page, no framework: the landing page is the app.
export default defineConfig({
	build: { target: "esnext" },
	server: { port: 5174 },
});
