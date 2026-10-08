"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned to the bottom, above the keyboard and the home indicator. */
  footer?: ReactNode;
}

/** Full-screen panel over the app, for opened photos and forms. */
export function Sheet({ title, onClose, children, footer }: SheetProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // Keep the page behind from scrolling while the sheet is open.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-40 flex flex-col bg-canvas">
      <header className="border-b border-line pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-header w-full max-w-app items-center justify-between pl-4 pr-1">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-tap items-center justify-center text-muted"
          >
            <X className="size-6" aria-hidden />
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-app">{children}</div>
      </div>
      {footer && (
        <footer className="border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto w-full max-w-app px-3 py-2">{footer}</div>
        </footer>
      )}
    </div>
  );
}
