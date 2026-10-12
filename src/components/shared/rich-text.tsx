import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Renders a small, safe subset of Markdown (headings, lists, paragraphs,
 * **bold**, [links](/path)) as React elements — no raw HTML is ever injected.
 * Bracketed text without a link, e.g. "[support email]", is highlighted as a
 * placeholder the store owner still needs to fill in.
 */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|\[([^\]]+)\]/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const key = `${keyPrefix}-${i++}`;
    if (match[1]) {
      nodes.push(<strong key={key}>{match[1]}</strong>);
    } else if (match[2] && match[3]) {
      const href = match[3];
      const safe = href.startsWith("/") || href.startsWith("https://") || href.startsWith("mailto:") || href.startsWith("tel:");
      nodes.push(
        safe ? (
          href.startsWith("/") ? (
            <Link key={key} href={href}>
              {match[2]}
            </Link>
          ) : (
            <a key={key} href={href} rel="noopener noreferrer">
              {match[2]}
            </a>
          )
        ) : (
          match[2]
        ),
      );
    } else if (match[4]) {
      nodes.push(
        <span key={key} className="placeholder">
          [{match[4]}]
        </span>,
      );
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      const key = `p-${blocks.length}`;
      blocks.push(<p key={key}>{inline(paragraph.join(" "), key)}</p>);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      const key = `l-${blocks.length}`;
      const items = list.items.map((item, i) => <li key={`${key}-${i}`}>{inline(item, `${key}-${i}`)}</li>);
      blocks.push(list.ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = line.match(/^(#{2,3})\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const numbered = line.match(/^\d+\.\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const key = `h-${blocks.length}`;
      blocks.push(heading[1].length === 2 ? <h2 key={key}>{inline(heading[2], key)}</h2> : <h3 key={key}>{inline(heading[2], key)}</h3>);
    } else if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return <div className={cn("prose-ovelia", className)}>{blocks}</div>;
}
