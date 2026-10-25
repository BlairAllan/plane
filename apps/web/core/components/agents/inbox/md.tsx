/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";

/**
 * The little Markdown agents write (headings, lists, quotes, code, bold, links), as React elements.
 *
 * Built as elements, never as an HTML string, so nothing an agent writes can become markup. The
 * workspace's react-markdown cannot be bundled (its remark-rehype and mdast-util-to-hast versions
 * disagree), and this is all the Inbox needs.
 */

const INLINE =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\((?:https?:\/\/|\/)[^)\s]+\))|(https?:\/\/[^\s)]+)|((?<![\w/.])_[^_\s][^_]*_(?![\w/.]))/g;

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const tok = m[0];
    const k = `${key}-${n++}`;
    if (tok.startsWith("`")) out.push(<code key={k}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("**")) out.push(<strong key={k}>{inline(tok.slice(2, -2), k)}</strong>);
    else if (tok.startsWith("[")) {
      const [, label, href] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok) ?? [];
      out.push(
        <a key={k} href={href} target="_blank" rel="noreferrer">
          {label}
        </a>
      );
    } else if (tok.startsWith("http"))
      out.push(
        <a key={k} href={tok} target="_blank" rel="noreferrer">
          {tok}
        </a>
      );
    else out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = at + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const LIST_ITEM = /^\s*([-*]|\d+\.)\s/;
const inList = (r: string | undefined) => r !== undefined && (LIST_ITEM.test(r) || /^\s{2,}\S/.test(r));

// Keys are positions: the text is rendered once from a fixed source, so a position is its identity.
function lines(block: string[], key: string): ReactNode[] {
  // oxlint-disable-next-line react/no-array-index-key
  return block.flatMap((l, i) =>
    i ? [<br key={`${key}-br${i}`} />, ...inline(l, `${key}-${i}`)] : inline(l, `${key}-${i}`)
  );
}

export function renderMarkdown(src: string): ReactNode[] {
  const rows = src.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    const key = `b${i}`;
    if (!row.trim()) {
      i++;
    } else if (row.startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < rows.length && !rows[i].startsWith("```")) body.push(rows[i++]);
      i++;
      out.push(
        <pre key={key}>
          <code>{body.join("\n")}</code>
        </pre>
      );
    } else if (/^#{1,6}\s/.test(row)) {
      const level = /^#+/.exec(row)![0].length;
      const text = inline(row.replace(/^#+\s*/, ""), key);
      out.push(
        level <= 1 ? <h1 key={key}>{text}</h1> : level === 2 ? <h2 key={key}>{text}</h2> : <h3 key={key}>{text}</h3>
      );
      i++;
    } else if (row.startsWith(">")) {
      const body: string[] = [];
      while (i < rows.length && rows[i].startsWith(">")) body.push(rows[i++].replace(/^>\s?/, ""));
      out.push(<blockquote key={key}>{renderMarkdown(body.join("\n"))}</blockquote>);
    } else if (/^\s*([-*]|\d+\.)\s/.test(row)) {
      const ordered = /^\s*\d+\./.test(row);
      const start = ordered ? Number(/\d+/.exec(row)![0]) : 1;
      const items: string[][] = [];
      while (i < rows.length) {
        if (!rows[i].trim()) {
          // a loose list: blank lines between items (Plane wraps every item in a paragraph)
          let j = i;
          while (j < rows.length && !rows[j].trim()) j++;
          if (!inList(rows[j])) break;
          i = j;
        }
        if (!inList(rows[i])) break;
        if (/^\s*([-*]|\d+\.)\s/.test(rows[i]) && !/^\s{3,}/.test(rows[i]))
          items.push([rows[i].replace(/^\s*([-*]|\d+\.)\s+/, "")]);
        else items[items.length - 1]?.push(rows[i].trim().replace(/^([-*])\s+/, "• "));
        i++;
      }
      // oxlint-disable-next-line react/no-array-index-key
      const lis = items.map((it, n) => <li key={`${key}-${n}`}>{lines(it, `${key}-${n}`)}</li>);
      out.push(
        ordered ? (
          <ol key={key} start={start}>
            {lis}
          </ol>
        ) : (
          <ul key={key}>{lis}</ul>
        )
      );
    } else {
      const body: string[] = [];
      while (i < rows.length && rows[i].trim() && !/^(#{1,6}\s|>|```|\s*([-*]|\d+\.)\s)/.test(rows[i]))
        body.push(rows[i++]);
      out.push(<p key={key}>{lines(body, key)}</p>);
    }
  }
  return out;
}
