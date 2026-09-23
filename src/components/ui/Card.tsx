"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "book" | "editorial" | "flat" | "interactive";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    const baseStyles =
      "relative rounded-lg bg-surface text-text overflow-hidden transition-colors duration-150";

    const variantStyles = {
      default: "border border-border shadow-xs",
      book: "border border-border shadow-xs border-l-4 border-l-accent/80",
      editorial:
        "border border-border shadow-xs border-t-2 border-t-accent-secondary/70",
      flat: "border border-border/80 bg-surface/80",
      interactive:
        "border border-border shadow-xs cursor-pointer hover:border-accent/40 motion-safe:hover:-translate-y-0.5 motion-safe:transition-all motion-reduce:hover:translate-y-0 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    };

    return (
      <div
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

export const CardHeader = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "font-serif text-xl font-semibold leading-snug tracking-tight text-text",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-text-muted leading-relaxed font-sans", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0 font-sans", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0 font-sans text-sm", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export const CardDivider = forwardRef<
  HTMLHRElement,
  React.HTMLAttributes<HTMLHRElement>
>(({ className, ...props }, ref) => (
  <hr
    ref={ref}
    className={cn("border-0 border-t border-border my-4", className)}
    {...props}
  />
));
CardDivider.displayName = "CardDivider";
