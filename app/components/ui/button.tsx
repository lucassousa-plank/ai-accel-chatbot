import * as React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline";
  size?: "default" | "icon";
}

export function Button({ className = "", variant = "default", size = "default", ...props }: ButtonProps) {
  const baseStyles = "rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
  
  const variantStyles = {
    default: "bg-blue-500 text-white hover:bg-blue-600",
    outline: "border border-gray-300 bg-white hover:bg-gray-50"
  };

  const sizeStyles = {
    default: "h-9 px-4 py-2",
    icon: "h-9 w-9"
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    />
  );
} 