"use client";

import { useActionState } from "react";

type State = { ok?: string; error?: string } | null;

/** A form wired to a server action that returns {ok} / {error}, with inline feedback. */
export function ActionForm({
  action,
  children,
  submit,
  className = "",
  buttonClass = "btn btn-green",
  confirm,
}: {
  action: (s: State, fd: FormData) => Promise<State>;
  children?: React.ReactNode;
  submit: string;
  className?: string;
  buttonClass?: string;
  confirm?: string;
}) {
  const [state, run, pending] = useActionState<State, FormData>(action, null);
  return (
    <form
      action={run}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {state?.error && <p role="alert" className="err mt-3">{state.error}</p>}
      {state?.ok && <p role="status" className="mt-3 text-sm text-ok">{state.ok}</p>}
      <button className={`${buttonClass} mt-4`} disabled={pending}>{pending ? "Please wait…" : submit}</button>
    </form>
  );
}
