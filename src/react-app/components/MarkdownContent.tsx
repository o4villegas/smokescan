/**
 * MarkdownContent Component
 * Renders markdown strings with proper formatting and custom table→card conversion
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

type MarkdownContentProps = {
  children: string;
  className?: string;
};

/**
 * Convert a markdown table into a card-based layout.
 * Each row becomes a card with header labels.
 */
function TableCard({ children }: { children: React.ReactNode }) {
  // Extract thead and tbody from children
  const childArray = Array.isArray(children) ? children : [children];
  let headers: string[] = [];
  let rows: React.ReactNode[][] = [];

  for (const child of childArray) {
    if (!child || typeof child !== 'object' || !('type' in child)) continue;
    const el = child as React.ReactElement<{ children?: React.ReactNode }>;

    if (el.type === 'thead') {
      // Extract header text from thead > tr > th elements
      const tr = Array.isArray(el.props.children) ? el.props.children[0] : el.props.children;
      if (tr && typeof tr === 'object' && 'props' in tr) {
        const ths = Array.isArray(tr.props.children) ? tr.props.children : [tr.props.children];
        headers = ths.map((th: React.ReactElement<{ children?: React.ReactNode }>) => {
          if (!th || typeof th !== 'object' || !('props' in th)) return '';
          return extractText(th.props.children);
        });
      }
    }

    if (el.type === 'tbody') {
      const trs = Array.isArray(el.props.children) ? el.props.children : [el.props.children];
      for (const tr of trs) {
        if (!tr || typeof tr !== 'object' || !('props' in tr)) continue;
        const tds = Array.isArray(tr.props.children) ? tr.props.children : [tr.props.children];
        const row = tds.map((td: React.ReactElement<{ children?: React.ReactNode }>) => {
          if (!td || typeof td !== 'object' || !('props' in td)) return '';
          return td.props.children;
        });
        rows.push(row);
      }
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="space-y-2 my-3">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="rounded-lg border p-3 space-y-1">
          {row.map((cell, cellIndex) => (
            <div key={cellIndex} className="flex gap-2">
              {headers[cellIndex] && (
                <span className="text-xs font-medium text-muted-foreground shrink-0 min-w-[80px]">
                  {headers[cellIndex]}:
                </span>
              )}
              <span className="text-sm">{cell}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Recursively extract text content from React nodes */
function extractText(node: React.ReactNode): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && 'props' in node) {
    return extractText((node as React.ReactElement<{ children?: React.ReactNode }>).props.children);
  }
  return '';
}

const components: Components = {
  table: ({ children }) => <TableCard>{children}</TableCard>,
  p: ({ children }) => <p className="leading-relaxed mb-2">{children}</p>,
  h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-semibold mt-3 mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold mt-2 mb-1">{children}</h3>,
  ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
  li: ({ children }) => <li className="text-sm">{children}</li>,
  hr: () => <hr className="my-3 border-border" />,
};

export function MarkdownContent({ children, className }: MarkdownContentProps) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
