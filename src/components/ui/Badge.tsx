"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "subtle" | "amber" | "forest" | "caramel" | "sage" | "outline" | "text";
  size?: "sm" | "md";
  dot?: boolean;
  dotColor?: "amber" | "forest" | "caramel" | "sage" | "muted";
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      variant = "subtle",
      size = "md",
      dot = false,
      dotColor = "amber",
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center gap-1.5 font-sans font-medium tracking-wide transition-colors duration-150";

    const variantStyles = {
      subtle:
        "rounded-md bg-surface text-text-muted border border-border shadow-2xs",
      amber:
        "rounded-md bg-accent/12 text-accent border border-accent/25 dark:bg-accent/20",
      caramel:
        "rounded-md bg-accent/12 text-accent border border-accent/25 dark:bg-accent/20",
      forest:
        "rounded-md bg-accent-secondary/12 text-accent-secondary border border-accent-secondary/30 dark:bg-accent-secondary/20",
      sage:
        "rounded-md bg-accent-secondary/12 text-accent-secondary border border-accent-secondary/30 dark:bg-accent-secondary/20",
      outline:
        "rounded-md bg-transparent text-text-muted border border-border",
      text:
        "bg-transparent text-text-muted uppercase text-[10px] tracking-wider font-medium p-0 border-0",
    };

    const sizeStyles = {
      sm: variant === "text" ? "" : "text-[11px] px-2 py-0.5",
      md: variant === "text" ? "" : "text-xs px-2.5 py-1",
    };

    const dotColorStyles = {
      amber: "bg-accent",
      caramel: "bg-accent",
      forest: "bg-accent-secondary",
      sage: "bg-accent-secondary",
      muted: "bg-text-muted",
    };

    return (
      <span
        ref={ref}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              dotColorStyles[dotColor]
            )}
            aria-hidden="true"
          />
        )}
        <span>{children}</span>
      </span>
    );
  }
);

Badge.displayName = "Badge";

/**
 * EditorialMetadata is a helper component following the zero-pill discipline:
 * renders quiet inline text separated by subtle typographic mid-dots (·).
 */
export function EditorialMetadata({
  items,
  className,
}: {
  items: React.ReactNode[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 text-xs text-text-muted font-sans",
        className
      )}
    >
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span className="text-text-muted/40 select-none" aria-hidden="true">
              ·
            </span>
          )}
          <span className="inline-flex items-center">{item}</span>
        </React.Fragment>
      ))}
    </div>
  );
}
