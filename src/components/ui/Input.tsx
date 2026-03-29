import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Optional label rendered above the input */
  label?: string;
}

export function Input({
  label,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div>
      {label && (
        <label
          htmlFor={inputId}
          className="label text-gray-500 mb-1.5 block"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={[
          'w-full bg-surface-2 shadow-input rounded-md',
          'px-3.5 py-2.5 text-body text-gray-300',
          'placeholder:text-gray-500',
          'focus:shadow-input-focus focus:outline-none',
          'transition-shadow',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />
    </div>
  );
}
