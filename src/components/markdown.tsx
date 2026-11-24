import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Safe Markdown: raw HTML is never rendered (react-markdown escapes it by default). */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-soar">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
          img: () => null,
          // GFM task-list boxes are a printed checklist, not a form control.
          input: ({ type, checked }) => (type === "checkbox" ? <span aria-hidden className={`mr-2 inline-block size-4 translate-y-0.5 rounded border-2 ${checked ? "border-navy-800 bg-navy-800" : "border-navy-700/60 bg-white"}`} /> : null),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
