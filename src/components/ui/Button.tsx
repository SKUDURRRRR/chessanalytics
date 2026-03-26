import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, { base: string; hover: string }> = {
  primary: {
    base: 'bg-cta text-[#111] shadow-btn-primary',
    hover: 'hover:bg-cta-hover',
  },
  secondary: {
    base: 'text-gray-400 shadow-card',
    hover: 'hover:text-gray-300 hover:bg-white/[0.04]',
  },
  ghost: {
    base: 'text-gray-500',
    hover: 'hover:text-gray-400 hover:bg-white/[0.03]',
  },
  danger: {
    base: 'bg-rose-500/10 text-rose-300',
    hover: 'hover:bg-rose-500/15',
  },
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-4 py-1.5 text-small',
  md: 'px-5 py-2 text-body',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  const v = variantStyles[variant];

  return (
    <button
      className={[
        'rounded-md font-medium tracking-section transition-colors',
        sizeStyles[size],
        v.base,
        disabled ? 'opacity-50 cursor-not-allowed' : v.hover,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
