"use client";

import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "forest" | "sage" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium tracking-wide rounded-lg select-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg transition-all duration-200 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:transform-none motion-reduce:active:scale-100 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 disabled:hover:transform-none cursor-pointer";

    const variantStyles = {
      primary:
        "bg-accent text-accent-contrast hover:bg-accent-hover shadow-sm hover:shadow-md active:bg-accent-hover",
      secondary:
        "bg-surface text-text border border-border hover:bg-surface-hover hover:border-text/30 shadow-xs hover:shadow-sm",
      forest:
        "bg-accent-secondary text-accent-contrast hover:bg-accent-secondary-hover shadow-sm hover:shadow-md",
      sage: "bg-accent-secondary text-accent-contrast hover:bg-accent-secondary-hover shadow-sm hover:shadow-md",
      outline:
        "border border-accent/40 text-accent hover:border-accent hover:bg-accent/10 hover:shadow-xs",
      ghost: "text-text hover:bg-surface/75 hover:text-text hover:shadow-none hover:-translate-y-0",
    };

    const sizeStyles = {
      sm: "h-8 px-3.5 text-xs gap-1.5",
      md: "h-10 px-5 text-sm gap-2",
      lg: "h-12 px-6 text-base gap-2.5 font-semibold",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";
