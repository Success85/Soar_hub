"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import type { ActionResult } from "@/lib/errors";

export type FormAction = (prev: ActionResult<unknown> | null, formData: FormData) => Promise<ActionResult<unknown>>;

const FieldErrorsContext = React.createContext<Record<string, string>>({});
export const useFieldError = (name: string) => React.useContext(FieldErrorsContext)[name];

export function ActionForm({
  action,
  children,
  className,
  successMessage,
  resetOnSuccess,
  redirectOnSuccess,
  refreshOnSuccess = true,
  onSuccess,
  showSuccess = true,
  id,
  "aria-label": ariaLabel,
}: {
  action: FormAction;
  children: React.ReactNode;
  className?: string;
  successMessage?: string;
  resetOnSuccess?: boolean;
  redirectOnSuccess?: string;
  refreshOnSuccess?: boolean;
  onSuccess?: (data: unknown) => void;
  showSuccess?: boolean;
  id?: string;
  "aria-label"?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = React.useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.(state.data);
      if (redirectOnSuccess) router.push(redirectOnSuccess);
      else if (refreshOnSuccess) router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <FieldErrorsContext.Provider value={fieldErrors}>
      <form ref={ref} action={formAction} className={className} id={id} aria-label={ariaLabel} noValidate>
        {state && !state.ok && (
          <Alert tone="danger" className="mb-4">
            {state.error}
          </Alert>
        )}
        {state?.ok && showSuccess && (state.message || successMessage) && (
          <Alert tone="success" className="mb-4">
            {state.message || successMessage}
          </Alert>
        )}
        {children}
      </form>
    </FieldErrorsContext.Provider>
  );
}

export function SubmitButton({ children, pendingLabel = "Saving…", ...props }: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function FieldError({ name }: { name: string }) {
  const err = useFieldError(name);
  if (!err) return null;
  return (
    <p id={`${name}-error`} role="alert" className="text-[13px] font-medium text-danger-700">
      {err}
    </p>
  );
}

/** A one-button form for simple actions (approve, delete, publish…). */
export function ActionButton({
  action,
  fields,
  children,
  confirm,
  pendingLabel,
  ...buttonProps
}: Omit<ButtonProps, "onClick"> & { action: FormAction; fields?: Record<string, string>; confirm?: string; pendingLabel?: string }) {
  const [state, formAction] = useActionState(action, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
  return (
    <form
      action={formAction}
      className="inline"
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(fields ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton pendingLabel={pendingLabel ?? "Working…"} {...buttonProps}>
        {children}
      </SubmitButton>
      {state && !state.ok && (
        <span role="alert" className="mt-1 block max-w-xs text-xs font-medium text-danger-700">
          {state.error}
        </span>
      )}
      {state?.ok && state.message && (
        <span role="status" className="mt-1 block max-w-md break-words text-xs font-medium text-success-700">
          {state.message}
        </span>
      )}
    </form>
  );
}
