import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Attached files are research context, not browser destinations. Render their
// citations as reference text; external web citations retain normal links.
function CitationLink({ href = '', children }) {
  if (href.startsWith('document-citation://')) {
    return (
      <span className="text-brand-700 font-semibold no-underline cursor-default" title="Citation from an attached document">
        {children}
      </span>
    );
  }

  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

export default function MarkdownContent({ children }) {
  const content = String(children || '').replaceAll('(doc://', '(document-citation://');

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{ a: CitationLink }}
      urlTransform={(url) =>
        url.startsWith('document-citation://') || /^https?:\/\//i.test(url) || url.startsWith('mailto:') ? url : ''
      }
    >
      {content}
    </ReactMarkdown>
  );
}
