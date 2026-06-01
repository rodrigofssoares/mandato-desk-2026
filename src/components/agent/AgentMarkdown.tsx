import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

/**
 * Renderizador de Markdown seguro para output do LLM.
 *
 * Segurança:
 * - SEM rehype-raw (impede HTML inline / XSS)
 * - Links externos: rel="noopener noreferrer" target="_blank"
 * - Imagens: bloqueadas completamente (admin não espera imagens no contexto do agente)
 * - Elementos permitidos: apenas o que o remark-parser produz por padrão
 */

const MARKDOWN_COMPONENTS: Components = {
  // Links externos com rel de segurança
  a: ({ href, children, ...props }) => {
    const isExternal = href?.startsWith('http') || href?.startsWith('//');
    return (
      <a
        href={href}
        {...(isExternal
          ? { rel: 'noopener noreferrer', target: '_blank' }
          : {})}
        className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
        {...props}
      >
        {children}
      </a>
    );
  },

  // Bloqueia imagens completamente
  img: () => null,

  // Code inline
  code: ({ children, className, ...props }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <code
          className="block bg-muted rounded-md p-3 my-2 text-[13px] leading-relaxed font-mono overflow-x-auto"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className="bg-muted rounded px-1.5 py-0.5 text-[13px] font-mono text-foreground"
        {...props}
      >
        {children}
      </code>
    );
  },

  // Pre (bloco de código)
  pre: ({ children, ...props }) => (
    <pre className="overflow-x-auto rounded-md my-2" {...props}>
      {children}
    </pre>
  ),

  // Blockquote estilo institucional
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="my-2.5 pl-4 border-l-[3px] border-accent/70 italic text-foreground bg-accent/8 rounded-r-[10px] py-2 pr-3"
      {...props}
    >
      {children}
    </blockquote>
  ),

  // Parágrafos
  p: ({ children, ...props }) => (
    <p className="mb-2 last:mb-0 leading-[1.65]" {...props}>
      {children}
    </p>
  ),

  // Listas
  ul: ({ children, ...props }) => (
    <ul className="list-disc pl-5 mb-2 space-y-0.5" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="list-decimal pl-5 mb-2 space-y-0.5" {...props}>
      {children}
    </ol>
  ),

  // Cabeçalhos (menos frequentes mas suportados)
  h1: ({ children, ...props }) => (
    <h1 className="text-lg font-semibold mt-3 mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }} {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-base font-semibold mt-3 mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }} {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-sm font-semibold mt-2 mb-1" {...props}>
      {children}
    </h3>
  ),

  // Separador
  hr: ({ ...props }) => (
    <hr className="my-3 border-border" {...props} />
  ),

  // Tabelas (remark-gfm)
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border-collapse" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th className="border border-border bg-muted px-3 py-1.5 text-left font-semibold" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-border px-3 py-1.5" {...props}>
      {children}
    </td>
  ),
};

interface AgentMarkdownProps {
  content: string;
  className?: string;
}

export function AgentMarkdown({ content, className }: AgentMarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={MARKDOWN_COMPONENTS}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
