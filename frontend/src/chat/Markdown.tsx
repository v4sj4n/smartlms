import { Check, Copy } from "@phosphor-icons/react";
import "katex/dist/katex.min.css";
import { memo, type ReactNode, useEffect, useId, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

/** Whether the app is currently painted dark (explicit theme or system). */
function useIsDark(): boolean {
	const read = () => {
		const theme = document.documentElement.dataset.theme;
		if (theme === "dark") return true;
		if (theme === "light") return false;
		return window.matchMedia("(prefers-color-scheme: dark)").matches;
	};
	const [dark, setDark] = useState(read);
	useEffect(() => {
		const observer = new MutationObserver(() => setDark(read()));
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["data-theme"],
		});
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => setDark(read());
		media.addEventListener("change", onChange);
		return () => {
			observer.disconnect();
			media.removeEventListener("change", onChange);
		};
	}, []);
	return dark;
}

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<button
			type="button"
			className="md-code__copy"
			aria-label={copied ? "Copied" : "Copy code"}
			onClick={() => {
				void navigator.clipboard.writeText(text).then(() => {
					setCopied(true);
					window.setTimeout(() => setCopied(false), 1500);
				});
			}}
		>
			{copied ? <Check size={14} weight="bold" /> : <Copy size={14} />}
			<span>{copied ? "Copied" : "Copy"}</span>
		</button>
	);
}

/** Shiki is large, so it loads on the first code block only. */
let highlighterPromise: Promise<typeof import("shiki")> | null = null;

function CodeBlock({ code, language }: { code: string; language: string }) {
	const dark = useIsDark();
	const [html, setHtml] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		// Debounce so a streaming block isn't re-highlighted on every token.
		const timer = window.setTimeout(() => {
			highlighterPromise ??= import("shiki");
			void highlighterPromise
				.then(({ codeToHtml }) =>
					codeToHtml(code, {
						lang: language || "text",
						theme: dark ? "github-dark-default" : "github-light-default",
					}),
				)
				.catch(() => null)
				.then((result) => {
					if (!cancelled) setHtml(result);
				});
		}, 120);
		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, [code, language, dark]);

	return (
		<div className="md-code">
			<div className="md-code__bar">
				<span className="md-code__lang">{language || "text"}</span>
				<CopyButton text={code} />
			</div>
			{html ? (
				<div
					className="md-code__body"
					dangerouslySetInnerHTML={{ __html: html }}
				/>
			) : (
				<pre className="md-code__body">
					<code>{code}</code>
				</pre>
			)}
		</div>
	);
}

let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;

function MermaidBlock({ code }: { code: string }) {
	const dark = useIsDark();
	const id = useId().replace(/[^a-zA-Z0-9]/g, "");
	const [svg, setSvg] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);
	const [showSource, setShowSource] = useState(false);

	useEffect(() => {
		let cancelled = false;
		// Wait for the stream to settle: half-written diagrams don't parse.
		const timer = window.setTimeout(async () => {
			try {
				mermaidPromise ??= import("mermaid").then((module) => module.default);
				const mermaid = await mermaidPromise;
				mermaid.initialize({
					startOnLoad: false,
					securityLevel: "strict",
					theme: "base",
					fontFamily: "inherit",
					// Painted to match the app's surfaces and primary blue.
					themeVariables: dark
						? {
								darkMode: true,
								background: "transparent",
								primaryColor: "#1a2a40",
								primaryBorderColor: "#3b8bf0",
								primaryTextColor: "#e6e9ee",
								lineColor: "#7d8590",
								secondaryColor: "#1a1f27",
								tertiaryColor: "#151a21",
								edgeLabelBackground: "#151a21",
							}
						: {
								background: "transparent",
								primaryColor: "#e8f1fd",
								primaryBorderColor: "#156cdd",
								primaryTextColor: "#171b20",
								lineColor: "#8a919b",
								secondaryColor: "#f2f5f8",
								tertiaryColor: "#ffffff",
								edgeLabelBackground: "#ffffff",
							},
				});
				const result = await mermaid.render(
					`mermaid-${id}-${Date.now()}`,
					code,
				);
				if (!cancelled) {
					setSvg(result.svg);
					setFailed(false);
				}
			} catch {
				if (!cancelled) setFailed(true);
			}
		}, 400);
		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, [code, dark, id]);

	if (failed && !svg) return <CodeBlock code={code} language="mermaid" />;

	return (
		<div className="md-diagram">
			<div className="md-code__bar">
				<span className="md-code__lang">diagram</span>
				<span className="md-diagram__actions">
					<button
						type="button"
						className="md-code__copy"
						onClick={() => setShowSource((value) => !value)}
					>
						{showSource ? "Diagram" : "Source"}
					</button>
					<CopyButton text={code} />
				</span>
			</div>
			{showSource ? (
				<pre className="md-code__body">
					<code>{code}</code>
				</pre>
			) : svg ? (
				<div
					className="md-diagram__canvas"
					dangerouslySetInnerHTML={{ __html: svg }}
				/>
			) : (
				<div className="md-diagram__canvas md-diagram__canvas--loading">
					Rendering diagram…
				</div>
			)}
		</div>
	);
}

function textOf(node: ReactNode): string {
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(textOf).join("");
	return "";
}

const components: Components = {
	pre: ({ children }) => <>{children}</>,
	code: ({ className, children }) => {
		const match = /language-([\w-]+)/.exec(className ?? "");
		const code = textOf(children).replace(/\n$/, "");
		// Fenced blocks carry a language class or span lines; the rest is inline.
		if (!match && !code.includes("\n")) {
			return <code className="md-inline-code">{children}</code>;
		}
		const language = match?.[1] ?? "";
		if (language === "mermaid") return <MermaidBlock code={code} />;
		return <CodeBlock code={code} language={language} />;
	},
	table: ({ children }) => (
		<div className="md-table">
			<table>{children}</table>
		</div>
	),
	a: ({ href, children }) => (
		<a href={href} target="_blank" rel="noreferrer noopener">
			{children}
		</a>
	),
};

/**
 * Renders assistant replies: GitHub-flavoured markdown (tables, task lists),
 * KaTeX math ($inline$ and $$block$$, plus \( \) and \[ \]), Mermaid diagrams
 * and Shiki-highlighted code with a copy button.
 */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
	// Models often write LaTeX delimiters; remark-math only knows dollars.
	const normalized = text
		.replace(
			/\\\[([\s\S]+?)\\\]/g,
			(_, body: string) => `\n$$\n${body.trim()}\n$$\n`,
		)
		.replace(/\\\(([\s\S]+?)\\\)/g, (_, body: string) => `$${body.trim()}$`);

	return (
		<div className="md">
			<ReactMarkdown
				remarkPlugins={[
					remarkGfm,
					[remarkMath, { singleDollarTextMath: true }],
				]}
				rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
				components={components}
			>
				{normalized}
			</ReactMarkdown>
		</div>
	);
});
