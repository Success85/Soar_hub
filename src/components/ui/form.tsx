import * as React from "react";
import { cn } from "@/lib/utils";

const base = "w-full rounded-lg border border-line bg-white px-3 py-2 text-[15px] text-navy-900 placeholder:text-muted/70 shadow-sm transition-colors focus:border-royal-600 focus:outline-none focus:ring-2 focus:ring-royal-600/25 disabled:bg-ivory-200 disabled:cursor-not-allowed aria-[invalid=true]:border-danger-700";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(base, "h-11", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(base, "min-h-28 leading-relaxed", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(base, "h-11 pr-8", className)} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-sm font-semibold text-navy-900", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor: string;
  hint?: React.ReactNode;
  error?: string | null;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="ml-1.5 text-xs font-normal text-muted">(optional)</span>}
      </Label>
      {hint && (
        <p id={`${htmlFor}-hint`} className="text-[13px] text-muted">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-[13px] font-medium text-danger-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function Checkbox({ label, id, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode; id: string }) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-5 shrink-0 rounded border-line accent-navy-900" {...props} />
      <label htmlFor={id} className="text-sm leading-snug text-navy-900">
        {label}
      </label>
    </div>
  );
}
