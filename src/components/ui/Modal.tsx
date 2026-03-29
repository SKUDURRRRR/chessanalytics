import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional icon element rendered at the top */
  icon?: React.ReactNode;
  title?: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, icon, title, children }: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-sm mx-4 bg-surface-1 shadow-modal rounded-lg p-6 animate-scale-in"
        role="dialog"
        aria-modal="true"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-400 transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Icon */}
        {icon && (
          <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center mb-4 text-gray-300">
            {icon}
          </div>
        )}

        {/* Title */}
        {title && (
          <h2 className="text-section font-semibold tracking-section text-[#f0f0f0] mb-3">
            {title}
          </h2>
        )}

        {/* Content */}
        {children}
      </div>
    </div>
  );
}
