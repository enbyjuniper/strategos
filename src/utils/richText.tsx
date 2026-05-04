import React from 'react';

const KW_RE = /\^\^\*\*(.*?)(?:\^\^\*\*|\*\*\^\^)|(\[[^\]]+\])/g;

export function renderRichText(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  KW_RE.lastIndex = 0;
  while ((match = KW_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    // match[1] = marker content (brackets stripped), match[2] = bracket content (kept)
    const content = match[1] !== undefined ? match[1] : match[2];
    parts.push(<span key={match.index} className="kw-tag">{content}</span>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length <= 1 ? (parts[0] ?? text) : <>{parts}</>;
}
