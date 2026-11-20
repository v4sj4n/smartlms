import { defineConfig } from "@cloudflare/config";

// The landing page: static assets only, no Worker script.
// Deploy with `cf deploy` from this folder.
export default defineConfig({
	accountId: "3c0bfd69fb4fbb0f10661b03d7ee76f7",
	worker: {
		name: "optimolms-landing",
		compatibilityDate: "2026-11-21",
		domains: ["optimolms.com", "www.optimolms.com"],
	},
});
