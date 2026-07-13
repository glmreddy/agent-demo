"use client";

import type { ReactNode } from "react";

export const OPEN_WIDGET_EVENT = "wanderlust:open-widget";

export default function OpenWidgetButton({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(OPEN_WIDGET_EVENT))}
    >
      {children}
    </button>
  );
}
