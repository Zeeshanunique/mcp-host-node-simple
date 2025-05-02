import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * A component that renders Markdown content with compact spacing
 */
export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  // More aggressive formatting to reduce excessive spacing
  const formattedContent = content
    // Replace any 2+ consecutive newlines with just one newline
    .replace(/\n{2,}/g, '\n')
    // Special handling for lists to ensure they're properly formatted
    .replace(/^(- .*)\n(?=- )/gm, '$1\n')
    .replace(/^(\d+\. .*)\n(?=\d+\. )/gm, '$1\n')
    // Add a small amount of spacing before headings (# headers)
    .replace(/\n(#+ )/g, '\n\n$1')
    // Trim leading/trailing whitespace
    .trim();
  
  return (
    <div className={`${className} prose prose-sm dark:prose-invert max-w-none`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {formattedContent}
      </ReactMarkdown>
    </div>
  );
} 