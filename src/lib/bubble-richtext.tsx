import React from "react";

// ─── BUBBLE RICH-TEXT RENDERER ────────────────────────────────
// Legacy PMS news bodies are stored in bubble.io's bbcode-ish markup, e.g.
//   [b]bold[/b]  [i]italic[/i]  [u]underline[/u]
//   [h1]/[h2]/[h3] headings
//   [ml][ul][li indent=0 align=left]item[/li][/ul][/ml]   (bullet list)
//   [ml][ol]...[/ol][/ml]                                  (numbered list)
//   newlines are literal "\n"
// This renders that markup to safe React nodes (no dangerouslySetInnerHTML),
// so untrusted tags are simply ignored rather than injected as HTML.

type Token =
  | { type: "text"; value: string }
  | { type: "open"; tag: string; attrs: string }
  | { type: "close"; tag: string };

// Split raw text into text / tag tokens.
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const re = /\[(\/?)([a-zA-Z0-9]+)([^\]]*)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (m.index > last) {
      tokens.push({ type: "text", value: input.slice(last, m.index) });
    }
    const isClose = m[1] === "/";
    const tag = m[2].toLowerCase();
    if (isClose) {
      tokens.push({ type: "close", tag });
    } else {
      tokens.push({ type: "open", tag, attrs: m[3] || "" });
    }
    last = re.lastIndex;
  }
  if (last < input.length) {
    tokens.push({ type: "text", value: input.slice(last) });
  }
  return tokens;
}

// Apply newline → <br/> within a text run.
function renderText(value: string, keyBase: string): React.ReactNode[] {
  const parts = value.split("\n");
  const out: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    if (i > 0) out.push(<br key={`${keyBase}-br-${i}`} />);
    if (part) out.push(<React.Fragment key={`${keyBase}-t-${i}`}>{part}</React.Fragment>);
  });
  return out;
}

const INLINE_TAGS = new Set(["b", "i", "u", "s", "strong", "em"]);
const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
const SKIP_WRAPPER_TAGS = new Set(["ml"]); // bubble list wrapper — transparent

interface ParseState {
  pos: number;
}

// Recursively build React nodes until we hit the matching close tag (or EOF).
function parseNodes(
  tokens: Token[],
  state: ParseState,
  stopTag: string | null,
  keyBase: string
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let k = 0;

  while (state.pos < tokens.length) {
    const tok = tokens[state.pos];

    if (tok.type === "close") {
      if (stopTag && tok.tag === stopTag) {
        state.pos++; // consume the matching close
        return nodes;
      }
      // Stray/unmatched close — skip it.
      state.pos++;
      continue;
    }

    if (tok.type === "text") {
      nodes.push(...renderText(tok.value, `${keyBase}-${k}`));
      state.pos++;
      k++;
      continue;
    }

    // open tag
    const { tag, attrs } = tok;
    state.pos++;
    const childKey = `${keyBase}-${k}`;
    const children = parseNodes(tokens, state, tag, childKey);
    k++;

    if (INLINE_TAGS.has(tag)) {
      if (tag === "b" || tag === "strong") nodes.push(<strong key={childKey}>{children}</strong>);
      else if (tag === "i" || tag === "em") nodes.push(<em key={childKey}>{children}</em>);
      else if (tag === "u") nodes.push(<u key={childKey}>{children}</u>);
      else if (tag === "s") nodes.push(<s key={childKey}>{children}</s>);
    } else if (HEADING_TAGS.has(tag)) {
      const cls =
        tag === "h1"
          ? "text-2xl font-bold mt-5 mb-2 text-gray-900"
          : tag === "h2"
          ? "text-xl font-bold mt-4 mb-2 text-gray-900"
          : "text-lg font-bold mt-4 mb-2 text-gray-900";
      // Skip headings that contain only whitespace/breaks (bubble uses empty
      // [h3] tags purely as vertical spacers).
      const isEmpty =
        children.length === 0 ||
        children.every(
          (c) => typeof c === "object" && (c as any)?.type === "br"
        );
      if (isEmpty) {
        nodes.push(<div key={childKey} className="h-2" />);
      } else {
        nodes.push(
          <h3 key={childKey} className={cls}>
            {children}
          </h3>
        );
      }
    } else if (tag === "ul") {
      nodes.push(
        <ul key={childKey} className="list-disc pl-6 space-y-1.5 my-2">
          {children}
        </ul>
      );
    } else if (tag === "ol") {
      nodes.push(
        <ol key={childKey} className="list-decimal pl-6 space-y-1.5 my-2">
          {children}
        </ol>
      );
    } else if (tag === "li") {
      void attrs; // indent/align attrs ignored — handled by list styling
      nodes.push(
        <li key={childKey} className="text-gray-700 leading-relaxed">
          {children}
        </li>
      );
    } else if (SKIP_WRAPPER_TAGS.has(tag)) {
      // Transparent wrapper — splice children straight in.
      nodes.push(<React.Fragment key={childKey}>{children}</React.Fragment>);
    } else {
      // Unknown tag — render children only (drops the tag, keeps content).
      nodes.push(<React.Fragment key={childKey}>{children}</React.Fragment>);
    }
  }

  return nodes;
}

export function renderBubbleRichText(body: string | null | undefined): React.ReactNode {
  if (!body) return null;
  const tokens = tokenize(body);
  const state: ParseState = { pos: 0 };
  return parseNodes(tokens, state, null, "rt");
}

// News bodies come in two flavours: legacy bubble.io bbcode ("[b]...[/b]") and
// HTML produced by the new TipTap rich-text editor ("<p>...</p>"). Detect the
// latter so the detail view can render each with the right renderer.
export function isHtmlBody(body: string | null | undefined): boolean {
  if (!body) return false;
  // HTML if it contains a real tag and no bubble-style [tag] markup.
  const hasHtmlTag = /<\/?[a-z][\s\S]*>/i.test(body);
  const hasBubbleTag = /\[[a-zA-Z0-9]+[^\]]*\]/.test(body);
  return hasHtmlTag && !hasBubbleTag;
}

// Plain-text preview (strips bubble tags OR html tags + collapses whitespace)
// for list cards — works for both body flavours.
export function bubblePlainText(body: string | null | undefined): string {
  if (!body) return "";
  return body
    .replace(/<[^>]+>/g, " ") // strip html tags
    .replace(/\[[^\]]*\]/g, "") // strip bubble tags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}
