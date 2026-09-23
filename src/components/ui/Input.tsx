"use client";

import React, { forwardRef, useId } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  errorMessage?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      containerClassName,
      label,
      helperText,
      errorMessage,
      startIcon,
      endIcon,
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const hasError = Boolean(errorMessage);

    return (
      <div className={cn("w-full flex flex-col gap-1.5", containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium tracking-wide text-text uppercase opacity-90 select-none"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center w-full">
          {startIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-text-muted">
              {startIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={hasError ? "true" : undefined}
            aria-describedby={
              hasError ? errorId : helperText ? helperId : undefined
            }
            className={cn(
              "w-full h-10 px-3.5 text-sm font-sans rounded-md bg-surface text-text",
              "border border-border shadow-2xs placeholder:text-text-muted/50",
              "outline-none transition-colors duration-150 motion-reduce:transition-none",
              "hover:border-text/25",
              "focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface/50",
              startIcon && "pl-9",
              (endIcon || hasError) && "pr-9",
              hasError &&
                "border-red-600/70 focus-visible:border-red-600 focus-visible:ring-red-600/30",
              className
            )}
            {...props}
          />

          {hasError ? (
            <div className="absolute right-3 flex items-center pointer-events-none text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4" />
            </div>
          ) : (
            endIcon && (
              <div className="absolute right-3 flex items-center pointer-events-none text-text-muted">
                {endIcon}
              </div>
            )
          )}
        </div>

        {hasError ? (
          <p id={errorId} className="text-xs text-red-600 dark:text-red-400 mt-0.5">
            {errorMessage}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-text-muted mt-0.5">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
