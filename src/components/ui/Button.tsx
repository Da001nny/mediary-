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
      "relative inline-flex items-center justify-center select-none font-semibold text-center whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg transition-all duration-150 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-[0.985] motion-reduce:transition-none motion-reduce:hover:transform-none motion-reduce:active:scale-100 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 disabled:hover:transform-none cursor-pointer";

    const variantStyles = {
      primary:
        "bg-accent text-[#0E0902] dark:text-[#0A0702] font-semibold border border-amber-950/20 dark:border-black/35 shadow-[0_1px_2.5px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.16)] hover:bg-accent-hover hover:shadow-[0_4px_16px_rgba(200,116,20,0.30)] active:bg-accent-hover active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.22)]",
      secondary:
        "bg-surface text-text font-semibold border border-border/90 shadow-[0_1px_2px_rgba(35,37,38,0.05),inset_0_1px_0_rgba(255,255,255,0.45)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-surface-hover hover:border-text/25 hover:shadow-xs active:bg-surface-hover/80 active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]",
      forest:
        "bg-accent-secondary text-white font-semibold border border-black/20 shadow-[0_1px_2.5px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.16)] hover:bg-accent-secondary-hover hover:shadow-[0_4px_14px_rgba(46,94,61,0.30)] active:bg-accent-secondary-hover active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.22)]",
      sage:
        "bg-accent-secondary text-white font-semibold border border-black/20 shadow-[0_1px_2.5px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.16)] hover:bg-accent-secondary-hover hover:shadow-[0_4px_14px_rgba(46,94,61,0.30)] active:bg-accent-secondary-hover active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.22)]",
      outline:
        "bg-transparent text-accent font-semibold border border-accent/60 shadow-2xs hover:border-accent hover:bg-accent/10 hover:shadow-xs active:bg-accent/20 active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]",
      ghost:
        "bg-transparent text-text font-semibold border border-transparent hover:bg-surface-hover/70 hover:text-text hover:border-border/40 hover:shadow-none hover:-translate-y-0 active:bg-surface-hover/90 active:border-border/70",
    };

    const sizeStyles = {
      sm: "h-9 min-h-[36px] px-3.5 sm:px-4 py-1.5 text-xs sm:text-[13px] font-semibold tracking-[-0.01em] gap-2 rounded-lg",
      md: "h-10.5 min-h-[42px] px-5 sm:px-5.5 py-2 text-sm font-semibold tracking-[-0.015em] gap-2.5 rounded-xl",
      lg: "h-12.5 min-h-[50px] px-6.5 sm:px-7 py-2.5 text-[15px] sm:text-base font-semibold tracking-[-0.02em] gap-3 rounded-xl",
    };

    const iconSizeClasses = {
      sm: "w-3.5 h-3.5 sm:w-4 sm:h-4",
      md: "w-4 h-4 sm:w-4.5 sm:h-4.5",
      lg: "w-5 h-5",
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
          <span
            className={cn(
              "inline-flex items-center justify-center shrink-0",
              iconSizeClasses[size]
            )}
            aria-hidden="true"
          >
            <Loader2 className="w-full h-full animate-spin motion-reduce:animate-none" />
          </span>
        ) : leftIcon ? (
          <span
            className={cn(
              "inline-flex items-center justify-center shrink-0 [&>svg]:w-full [&>svg]:h-full",
              iconSizeClasses[size]
            )}
            aria-hidden="true"
          >
            {leftIcon}
          </span>
        ) : null}

        {children ? (
          <span className="truncate leading-tight inline-flex items-center">
            {children}
          </span>
        ) : null}

        {!isLoading && rightIcon ? (
          <span
            className={cn(
              "inline-flex items-center justify-center shrink-0 [&>svg]:w-full [&>svg]:h-full",
              iconSizeClasses[size]
            )}
            aria-hidden="true"
          >
            {rightIcon}
          </span>
        ) : null}
      </button>
    );
  }
);

Button.displayName = "Button";
