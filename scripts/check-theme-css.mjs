#!/usr/bin/env node
/**
 * check-theme-css.mjs — feedback loop for the theme-toggle bug.
 *
 * Parses frontend/src/styles.css, resolves the CSS cascade for custom
 * properties on <html> under four scenarios (OS light/dark x data-theme
 * light/dark) and asserts that switching data-theme changes the computed
 * values REGARDLESS of the OS setting — the exact user symptom
 * ("dark and light doesn't change anything").
 *
 * Exit 0 = green, exit 1 = red. Run: node scripts/check-theme-css.mjs
 */

import { readFileSync } from "node:fs";

const CSS_PATH = new URL("../frontend/src/styles.css", import.meta.url);
const SENTINEL_VARS = [
  "--bg-canvas",
  "--bg-surface",
  "--bg-subtle",
  "--text-primary",
  "--text-secondary",
  "--primary",
  "--divider",
  "--hover",
];

// ---------------------------------------------------------------------------
// Minimal CSS parser: rules -> { selector, media, declarations, order }
// Handles comments and one level of @media nesting; enough for token files.
// ---------------------------------------------------------------------------

function strip_comments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, "");
}

function parse_declarations(body) {
  const decls = {};
  for (const raw of body.split(";")) {
    const m = raw.match(/^\s*(--[\w-]+)\s*:\s*([\s\S]+)$/);
    if (m) decls[m[1]] = m[2].trim();
  }
  return decls;
}

function parse_css(css) {
  const rules = [];
  let order = 0;
  const src = strip_comments(css);
  let i = 0;
  const n = src.length;

  function read_block(start) {
    // start points at '{'; returns index just past matching '}'
    let depth = 0;
    let j = start;
    while (j < n) {
      if (src[j] === "{") depth += 1;
      else if (src[j] === "}") {
        depth -= 1;
        if (depth === 0) return j + 1;
      }
      j += 1;
    }
    throw new Error("Unbalanced braces in CSS");
  }

  function walk(from, media) {
    let i = from;
    while (i < n) {
      const open = src.indexOf("{", i);
      if (open === -1) break;
      const brace_end = read_block(open);
      const prelude = strip_comments(src.slice(i, open)).trim();
      const body = src.slice(open + 1, brace_end - 1);
      if (prelude.startsWith("@media")) {
        walk(open + 1, prelude.replace(/\s+/g, " ").trim());
      } else if (prelude.startsWith("@")) {
        // @import/@font-face/... — ignore bodies with nested braces
        if (!body.includes("{")) {
          // flat at-rule, ignore
        }
      } else if (prelude) {
        const decls = parse_declarations(body);
        if (Object.keys(decls).length > 0) {
          rules.push({ selector: prelude, media, declarations: decls, order: order++ });
        }
      }
      i = brace_end;
    }
  }

  walk(0, null);
  return rules;
}

// ---------------------------------------------------------------------------
// Cascade resolution restricted to our token selectors on <html>
// ---------------------------------------------------------------------------

function rule_matches(selector, data_theme) {
  const parts = selector.split(/,(?![^(]*\))/); // top-level commas
  return parts.some((part) => part_matches(part.trim(), data_theme));
}

function part_matches(part, data_theme) {
  // Only selectors that can target <html> are valid for token resolution.
  if (part === ":root" || part === "html") return true;
  const not = part.match(/^html:not\(\s*\[data-theme=["'](\w+)["']\]\s*\)$/);
  if (not) return data_theme !== not[1];
  const attr = part.match(/^html\[data-theme=["'](\w+)["']\]$/);
  if (attr) return data_theme === attr[1];
  return false;
}

function media_applies(media, os_scheme) {
  if (!media) return true;
  // Handle simple (prefers-color-scheme: X) conditions joined (not supported: 'and')
  const m = media.match(/prefers-color-scheme:\s*(light|dark)/);
  if (!m) return true;
  return m[1] === os_scheme;
}

function specificity(selector_part) {
  // Simplified: class/attr/pseudo-class level vs element level
  let classes = 0;
  let elements = 0;
  for (const m of selector_part.matchAll(/:root|\[[^\]]+\]|:not\(/g)) classes += 1;
  for (const m of selector_part.matchAll(/(^|[\s>+~])html/g)) elements += 1;
  return { classes, elements };
}

function best_part(selector, data_theme) {
  // highest-specificity matching comma-part (for :not overrides)
  const parts = selector.split(/,(?![^(]*\))/).map((p) => p.trim());
  let best = null;
  for (const part of parts) {
    if (!part_matches(part, data_theme)) continue;
    const spec = specificity(part);
    if (!best || spec.classes > best.classes) best = spec;
  }
  return best;
}

function resolve(rules, { data_theme, os_scheme }) {
  const computed = {};
  const applied = [];
  for (const rule of rules) {
    if (!media_applies(rule.media, os_scheme)) continue;
    const spec = best_part(rule.selector, data_theme);
    if (!spec) continue;
    applied.push({ rule, spec });
  }
  // Cascade: higher specificity wins; among equal specificity, later wins.
  applied.sort(
    (a, b) =>
      a.spec.classes - b.spec.classes ||
      a.spec.elements - b.spec.elements ||
      a.rule.order - b.rule.order
  );
  for (const { rule } of applied) Object.assign(computed, rule.declarations);
  return computed;
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

const css = readFileSync(CSS_PATH, "utf8");
const rules = parse_css(css);
const failures = [];
let checked = 0;

for (const os_scheme of ["light", "dark"]) {
  for (const v of SENTINEL_VARS) {
    const light = resolve(rules, { data_theme: "light", os_scheme })[v];
    const dark = resolve(rules, { data_theme: "dark", os_scheme })[v];
    checked += 1;
    if (light === undefined || dark === undefined) {
      failures.push(`os=${os_scheme} ${v}: undefined value (light=${light}, dark=${dark})`);
    } else if (light === dark) {
      failures.push(
        `os=${os_scheme} ${v}: toggle does NOT change the value both ways → ${light}`
      );
    }
  }
}

// The light theme must actually be light even on a dark-mode OS.
for (const v of ["--bg-canvas", "--bg-surface"]) {
  const val = resolve(rules, { data_theme: "light", os_scheme: "dark" })[v];
  const light_root = resolve(rules, { data_theme: "light", os_scheme: "light" })[v];
  checked += 1;
  if (val !== light_root) {
    failures.push(
      `os=dark + data-theme=light: ${v} = ${val}, expected the light value ${light_root}`
    );
  }
}

if (failures.length > 0) {
  console.error(`RED — theme toggle broken (${failures.length}/${checked} checks failed):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`GREEN — theme toggle changes computed values in all ${checked} checks.`);
