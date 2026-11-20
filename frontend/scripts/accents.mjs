#!/usr/bin/env node
/**
 * Accent palette generator and contrast gate.
 *
 * Each accent is a hue and a chroma in OKLCH. For every accent, theme (light,
 * dark) and contrast level (standard, high) this script searches lightness
 * until every pairing the UI paints meets its WCAG 2.2 target, then writes:
 *
 *   src/accents.css           the token sets, keyed on html[data-accent]
 *   src/accents.generated.ts  names and swatches for the picker
 *
 *   node scripts/accents.mjs          regenerate both files
 *   node scripts/accents.mjs --check  fail if a file is stale or a pair fails
 *
 * To add an accent, add one line to ACCENTS and regenerate. If no lightness
 * can satisfy every target the script fails instead of shipping a bad color.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/* ---------- the palette: edit here ---------- */

// on: the text color on a filled accent. "auto" uses white when the hue
// allows it; yellow cannot reach 4.5:1 with white while staying yellow.
const ACCENTS = [
	{ id: "blue", label: "Blue", hue: 256, chroma: 0.19, on: "auto" },
	{ id: "teal", label: "Teal", hue: 195, chroma: 0.12, on: "auto" },
	{ id: "green", label: "Green", hue: 148, chroma: 0.16, on: "auto" },
	{ id: "yellow", label: "Yellow", hue: 88, chroma: 0.17, on: "dark" },
	{ id: "orange", label: "Orange", hue: 50, chroma: 0.18, on: "auto" },
	{ id: "red", label: "Red", hue: 25, chroma: 0.2, on: "auto" },
	{ id: "pink", label: "Pink", hue: 350, chroma: 0.18, on: "auto" },
	{ id: "violet", label: "Violet", hue: 295, chroma: 0.19, on: "auto" },
];
const DEFAULT_ACCENT = "blue";

// Backgrounds the accent sits on, mirrored from styles.css (:root and dark).
const THEMES = {
	light: {
		bgs: {
			surface: "#ffffff",
			canvas: "#eef0f4",
			subtle: "#f2f5f8",
			sidebar: "#f3f5f8",
		},
		darkText: "#171b20",
		softAlpha: 0.1,
		softHoverAlpha: 0.16,
		// Fills step darker on hover/press; accent text prefers the lightest pass.
		step: -0.035,
		fillTarget: 0.58,
	},
	dark: {
		bgs: {
			surface: "#13171f",
			canvas: "#080b11",
			subtle: "#1d222a",
			sidebar: "#0c1117",
		},
		darkText: "#0b0e13",
		softAlpha: 0.13,
		softHoverAlpha: 0.19,
		step: -0.035,
		fillTarget: 0.6,
	},
};

// High contrast also firms up the neutral and status tokens. Every text color
// here is audited at 7:1 on every background of its theme.
const HIGH_CONTRAST_BASE = {
	light: {
		text: {
			"--text-secondary": "#30353b",
			"--text-muted": "#3a4047",
			"--success": "#0d5a28",
			"--warning": "#713800",
			"--error": "#9a111b",
		},
		other: {
			"--divider": "rgba(23, 27, 32, 0.2)",
			"--divider-strong": "rgba(23, 27, 32, 0.42)",
			"--success-line": "rgba(13, 90, 40, 0.55)",
			"--warning-line": "rgba(113, 56, 0, 0.55)",
			"--error-line": "rgba(154, 17, 27, 0.55)",
		},
	},
	dark: {
		text: {
			"--text-secondary": "#dadee4",
			"--text-muted": "#cfd4db",
			"--success": "#a8eac0",
			"--warning": "#f8d6aa",
			"--error": "#ffbdb6",
		},
		other: {
			"--divider": "rgba(242, 243, 246, 0.2)",
			"--divider-strong": "rgba(242, 243, 246, 0.42)",
			"--success-line": "rgba(168, 234, 192, 0.6)",
			"--warning-line": "rgba(248, 214, 170, 0.6)",
			"--error-line": "rgba(255, 189, 182, 0.6)",
		},
	},
};

const LEVELS = {
	standard: { text: 4.5, ui: 3 },
	// WCAG has no AAA level for non-text contrast (1.4.11 stays 3:1).
	high: { text: 7, ui: 3 },
};
// Aim a hair above each target so rounding to hex never lands under it.
const MARGIN = 0.08;

/* ---------- color math ---------- */

const toLinear = (c) =>
	c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const toGamma = (c) =>
	c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

function hexToRgb(hex) {
	const n = Number.parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
}

function rgbToHex(rgb) {
	return `#${rgb
		.map((v) =>
			Math.round(Math.min(1, Math.max(0, v)) * 255)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
}

function oklchToLinear(L, C, h) {
	const a = C * Math.cos((h * Math.PI) / 180);
	const b = C * Math.sin((h * Math.PI) / 180);
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	];
}

const inGamut = (lin) => lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** OKLCH -> hex, pulling chroma in until the color fits sRGB. */
function oklch(L, C, h) {
	let lo = 0;
	let hi = C;
	if (inGamut(oklchToLinear(L, C, h))) lo = C;
	else
		for (let i = 0; i < 24; i++) {
			const mid = (lo + hi) / 2;
			if (inGamut(oklchToLinear(L, mid, h))) lo = mid;
			else hi = mid;
		}
	return rgbToHex(oklchToLinear(L, lo, h).map(toGamma));
}

function luminance(hex) {
	const [r, g, b] = hexToRgb(hex).map(toLinear);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
	const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
	return (x + 0.05) / (y + 0.05);
}

/** A translucent color composited over an opaque one. */
function over(hex, alpha, base) {
	const f = hexToRgb(hex);
	const g = hexToRgb(base);
	return rgbToHex(f.map((v, i) => v * alpha + g[i] * (1 - alpha)));
}

const rgba = (hex, alpha) =>
	`rgba(${hexToRgb(hex)
		.map((v) => Math.round(v * 255))
		.join(", ")}, ${alpha})`;

/* ---------- solving ---------- */

const LIGHTNESS = Array.from({ length: 171 }, (_, i) => 0.12 + i * 0.005);

/** Every check one token set must pass, as [label, ratio, target]. */
function audit(set, theme, level) {
	const t = THEMES[theme];
	const need = LEVELS[level];
	const checks = [];
	for (const [name, bg] of Object.entries(t.bgs)) {
		checks.push([`accent text on ${name}`, contrast(set.text, bg), need.text]);
	}
	checks.push([
		"accent text on soft tint",
		contrast(set.text, over(set.text, t.softHoverAlpha, t.bgs.surface)),
		need.text,
	]);
	for (const key of ["fill", "hover", "active"]) {
		checks.push([
			`on-accent text on ${key}`,
			contrast(set.on, set[key]),
			need.text,
		]);
	}
	checks.push([
		"fill against surface",
		contrast(set.fill, t.bgs.surface),
		need.ui,
	]);
	checks.push([
		"fill against canvas",
		contrast(set.fill, t.bgs.canvas),
		need.ui,
	]);
	checks.push([
		"focus ring against surface",
		contrast(set.text, t.bgs.surface),
		need.ui,
	]);
	return checks;
}

function solve(accent, theme, level) {
	const t = THEMES[theme];
	const need = LEVELS[level];
	const { hue: h, chroma: c } = accent;

	// Accent text: the most vivid lightness that clears every background.
	const textOk = (hex) =>
		Object.values(t.bgs).every(
			(bg) => contrast(hex, bg) >= need.text + MARGIN,
		) &&
		contrast(hex, over(hex, t.softHoverAlpha, t.bgs.surface)) >=
			need.text + MARGIN;
	const textCandidates = LIGHTNESS.map((L) => ({
		L,
		hex: oklch(L, c, h),
	})).filter((x) => textOk(x.hex));
	if (textCandidates.length === 0) return null;
	// Light theme wants the lightest passing text, dark theme the darkest.
	const text =
		theme === "light" ? textCandidates.at(-1).hex : textCandidates[0].hex;

	// Fill: try white text first unless the accent asks for dark.
	const ons =
		accent.on === "dark" ? [t.darkText, "#ffffff"] : ["#ffffff", t.darkText];
	for (const on of ons) {
		// Dark text on the fill: hover lightens so the text keeps its contrast.
		const step = on === "#ffffff" ? t.step : -t.step;
		const fills = LIGHTNESS.map((L) => {
			const fill = oklch(L, c, h);
			const hover = oklch(L + step, c, h);
			const active = oklch(L + 2 * step, c, h);
			return { L, fill, hover, active };
		}).filter(
			(x) =>
				[x.fill, x.hover, x.active].every(
					(f) => contrast(on, f) >= need.text + MARGIN,
				) &&
				contrast(x.fill, t.bgs.surface) >= need.ui + MARGIN &&
				contrast(x.fill, t.bgs.canvas) >= need.ui + MARGIN,
		);
		if (fills.length === 0) continue;
		// Dark text wants the brightest fill that passes: that is what reads as yellow.
		const target = on === "#ffffff" ? t.fillTarget : 0.9;
		const best = fills.reduce((a, b) =>
			Math.abs(b.L - target) < Math.abs(a.L - target) ? b : a,
		);
		return {
			text,
			on,
			fill: best.fill,
			hover: best.hover,
			active: best.active,
		};
	}
	return null;
}

/* ---------- output ---------- */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cssPath = join(root, "src/accents.css");
const tsPath = join(root, "src/accents.generated.ts");

function build() {
	const failures = [];
	const css = [
		"/* Generated by scripts/accents.mjs. Do not edit; change ACCENTS there and rerun. */",
		"/* Every pair below is checked against WCAG 2.2 AA (standard) or AAA text (high contrast). */",
		"",
	];
	const swatches = {};

	for (const [theme, base] of Object.entries(HIGH_CONTRAST_BASE)) {
		for (const [token, color] of Object.entries(base.text)) {
			for (const [name, bg] of Object.entries(THEMES[theme].bgs)) {
				const ratio = contrast(color, bg);
				if (ratio < LEVELS.high.text)
					failures.push(
						`high contrast / ${theme}: ${token} on ${name} ${ratio.toFixed(2)} < 7`,
					);
			}
		}
		css.push(
			`html${theme === "dark" ? '[data-theme="dark"]' : ""}[data-contrast="high"] {`,
			...Object.entries({ ...base.text, ...base.other }).map(
				([k, v]) => `	${k}: ${v};`,
			),
			"}",
			"",
		);
	}

	for (const accent of ACCENTS) {
		swatches[accent.id] = {};
		for (const theme of Object.keys(THEMES)) {
			for (const level of Object.keys(LEVELS)) {
				const set = solve(accent, theme, level);
				if (!set) {
					failures.push(
						`${accent.id} / ${theme} / ${level}: no lightness meets every target`,
					);
					continue;
				}
				for (const [label, ratio, target] of audit(set, theme, level)) {
					if (ratio < target)
						failures.push(
							`${accent.id} / ${theme} / ${level}: ${label} ${ratio.toFixed(2)} < ${target}`,
						);
				}
				if (level === "standard") swatches[accent.id][theme] = set.fill;

				const t = THEMES[theme];
				const accentSel =
					accent.id === DEFAULT_ACCENT
						? `html:not([data-accent]), html[data-accent="${accent.id}"]`
						: `html[data-accent="${accent.id}"]`;
				const qualify = (sel) =>
					sel
						.split(", ")
						.map(
							(s) =>
								`${s}${theme === "dark" ? '[data-theme="dark"]' : ""}${level === "high" ? '[data-contrast="high"]' : ""}`,
						)
						.join(",\n");
				css.push(
					`${qualify(accentSel)} {`,
					`\t--primary: ${set.fill};`,
					`\t--primary-hover: ${set.hover};`,
					`\t--primary-active: ${set.active};`,
					`\t--primary-text: ${set.text};`,
					`\t--primary-soft: ${rgba(set.text, t.softAlpha)};`,
					`\t--primary-soft-hover: ${rgba(set.text, t.softHoverAlpha)};`,
					`\t--on-primary: ${set.on};`,
					`\t--focus-ring: ${set.text};`,
					"}",
					"",
				);
			}
		}
	}

	for (const accent of ACCENTS) {
		const sel =
			accent.id === DEFAULT_ACCENT
				? `html:not([data-accent]),
html[data-accent="${accent.id}"]`
				: `html[data-accent="${accent.id}"]`;
		css.push(
			`${sel} {`,
			`	--accent-swatch-light: ${swatches[accent.id].light};`,
			`	--accent-swatch-dark: ${swatches[accent.id].dark};`,
			"}",
			"",
		);
	}

	const ts = [
		"// Generated by scripts/accents.mjs. Do not edit; change ACCENTS there and rerun.",
		"",
		`export const ACCENT_IDS = ${JSON.stringify(ACCENTS.map((a) => a.id))} as const;`,
		"export type AccentPreference = (typeof ACCENT_IDS)[number];",
		`export const DEFAULT_ACCENT: AccentPreference = ${JSON.stringify(DEFAULT_ACCENT)};`,
		"",
		"/** Picker entries; swatch is the standard-contrast fill per theme. */",
		"export const ACCENT_OPTIONS: {",
		"\tvalue: AccentPreference;",
		"\tlabel: string;",
		"\tswatch: { light: string; dark: string };",
		"}[] = [",
		...ACCENTS.map(
			(a) =>
				`\t{ value: "${a.id}", label: "${a.label}", swatch: { light: "${swatches[a.id].light}", dark: "${swatches[a.id].dark}" } },`,
		),
		"];",
		"",
	];
	return { css: css.join("\n"), ts: ts.join("\n"), failures };
}

const { css, ts, failures } = build();
if (failures.length) {
	console.error(`Accent contrast failures:\n  ${failures.join("\n  ")}`);
	process.exit(1);
}

if (process.argv.includes("--check")) {
	const stale = [
		[cssPath, css],
		[tsPath, ts],
	].filter(([path, want]) => {
		try {
			return readFileSync(path, "utf8") !== want;
		} catch {
			return true;
		}
	});
	if (stale.length) {
		console.error(
			`Stale generated files (run npm run accents):\n  ${stale.map(([p]) => p).join("\n  ")}`,
		);
		process.exit(1);
	}
	console.log(
		`accents ok: ${ACCENTS.length} accents x 2 themes x 2 contrast levels, every pair passes`,
	);
} else {
	writeFileSync(cssPath, css);
	writeFileSync(tsPath, ts);
	console.log(
		`wrote ${ACCENTS.length} accents to src/accents.css and src/accents.generated.ts`,
	);
}
