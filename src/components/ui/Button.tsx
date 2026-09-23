"use client";

import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "sage" | "outline" | "ghost";
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
      "inline-flex items-center justify-center font-medium tracking-wide rounded-md select-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg transition-colors duration-150 motion-safe:active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 cursor-pointer";

    const variantStyles = {
      primary:
        "bg-accent text-accent-contrast hover:bg-accent-hover shadow-sm active:bg-accent-hover",
      secondary:
        "bg-surface text-text border border-border hover:bg-surface-hover hover:border-text/25 shadow-xs",
      sage: "bg-accent-secondary text-[#FDFBF7] hover:bg-accent-secondary-hover shadow-sm",
      outline:
        "border border-accent/40 text-accent hover:border-accent hover:bg-accent/10",
      ghost: "text-text hover:bg-surface/75 hover:text-text",
    };

    const sizeStyles = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-10 px-4 text-sm gap-2",
      lg: "h-11 px-5 text-base gap-2.5",
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
