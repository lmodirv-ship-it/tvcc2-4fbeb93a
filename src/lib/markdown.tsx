import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**"))
      return <strong key={i} className="text-foreground font-semibold">{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`"))
      return <code key={i} className="px-1.5 py-0.5 rounded bg-secondary text-xs">{p.slice(1, -1)}</code>;
    return <span key={i}>{p}</span>;
  });
}

/** Minimal markdown renderer: headings, bullet lists, ordered lists, paragraphs. */
export function Markdown({ source }: { source: string }) {
  const lines = source.split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let ordered = false;

  const flush = () => {
    if (!list.length) return;
    const items = list.map((l, i) => <li key={i}>{inline(l)}</li>);
    blocks.push(
      ordered ? (
        <ol key={blocks.length} className="list-decimal pr-6 space-y-2 text-muted-foreground">{items}</ol>
      ) : (
        <ul key={blocks.length} className="list-disc pr-6 space-y-2 text-muted-foreground">{items}</ul>
      ),
    );
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }
    if (line.startsWith("### ")) { flush(); blocks.push(<h3 key={blocks.length} className="text-xl font-bold mt-8 mb-3">{inline(line.slice(4))}</h3>); continue; }
    if (line.startsWith("## ")) { flush(); blocks.push(<h2 key={blocks.length} className="text-2xl font-bold mt-10 mb-4">{inline(line.slice(3))}</h2>); continue; }
    if (line.startsWith("# ")) { flush(); blocks.push(<h2 key={blocks.length} className="text-3xl font-bold mt-10 mb-4">{inline(line.slice(2))}</h2>); continue; }
    const ol = line.match(/^(\d+)\.\s+(.*)$/);
    if (ol) { if (!ordered) flush(); ordered = true; list.push(ol[2]); continue; }
    if (line.startsWith("- ")) { if (ordered) flush(); ordered = false; list.push(line.slice(2)); continue; }
    flush();
    blocks.push(<p key={blocks.length} className="text-muted-foreground leading-8">{inline(line)}</p>);
  }
  flush();

  return <div className="space-y-4">{blocks}</div>;
}
