import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Render the subtle top gradient highlight line */
  highlight?: boolean;
  /** Use elevated (surface-2) background for nested cards */
  elevated?: boolean;
  /** Use highlighted ring for selected/active state */
  active?: boolean;
  children: React.ReactNode;
}

export function Card({
  highlight = false,
  elevated = false,
  active = false,
  className = '',
  children,
  ...props
}: CardProps) {
  const bg = elevated ? 'bg-surface-2' : 'bg-surface-1';
  const shadow = active ? 'shadow-card-highlight' : 'shadow-card';

  return (
    <div
      className={[
        bg,
        shadow,
        'rounded-lg overflow-hidden',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {highlight && (
        <div
          className="h-px -mx-px"
          style={{
            background:
              'linear-gradient(to right, transparent, rgba(255,255,255,0.06), transparent)',
          }}
        />
      )}
      {children}
    </div>
  );
}
