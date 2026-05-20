"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

interface SubmitButtonProps {
  children: ReactNode;
  pendingLabel: string;
}

export function SubmitButton({ children, pendingLabel }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
