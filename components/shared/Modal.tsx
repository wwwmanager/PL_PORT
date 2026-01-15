
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from '../Icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  isDirty?: boolean;
  isDraggable?: boolean;
  isResizable?: boolean;
  maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  isDirty = false,
  isDraggable = false,
  isResizable = false,
  maxWidth = 'md:max-w-4xl'
}) => {
  const isDirtyRef = useRef(isDirty);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  // Drag & Resize State
  const [position, setPosition] = useState<{ x: number, y: number } | null>(null);
  const [size, setSize] = useState<{ width: number, height: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{ x: number, y: number }>({ x: 0, y: 0 }); // Mouse pos on start
  const initialModalPos = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const initialModalSize = useRef<{ w: number, h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  const handleRequestClose = useCallback(() => {
    if (isDirtyRef.current) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  }, [onClose]);

  const handleConfirmClose = () => {
    setShowConfirmClose(false);
    onClose();
  };

  const handleCancelClose = () => {
    setShowConfirmClose(false);
  };

  // Center on mount if draggable
  useEffect(() => {
    if (isOpen && (isDraggable || isResizable) && modalRef.current && !position) {
      // Initial centering only if not already moved
      // We can't easily get dimensions before render, so we rely on CSS centering initially
      // BUT, to switch to absolute pos for dragging, we need coordinates.
      // We'll calculate them on first drag start.
    }
  }, [isOpen, isDraggable, isResizable, position]);

  // Drag Handlers
  const handleMouseDownHeader = (e: React.MouseEvent) => {
    if (!isDraggable || !modalRef.current) return;
    if ((e.target as HTMLElement).closest('button')) return; // Don't drag if clicking close button

    const rect = modalRef.current.getBoundingClientRect();

    // Ensure we have a concrete starting position to drag relative to
    if (!position) {
      const initialPos = { x: rect.left, y: rect.top };
      setPosition(initialPos);
      initialModalPos.current = initialPos;
      // Apply immediately to prevent jump
      modalRef.current.style.left = `${rect.left}px`;
      modalRef.current.style.top = `${rect.top}px`;
      modalRef.current.style.position = 'fixed';
      modalRef.current.style.margin = '0';
      modalRef.current.style.transform = 'none';
    } else {
      initialModalPos.current = { x: rect.left, y: rect.top };
    }

    dragStartPos.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);

    // Hint to browser to optimize for movement and DISABLE TRANSITIONS
    modalRef.current.style.willChange = 'transform';
    modalRef.current.style.transition = 'none'; // <--- CRITICAL FIX

    e.preventDefault();
  };

  // Resize Handlers
  const handleMouseDownResizer = (e: React.MouseEvent) => {
    // ... (existing code omitted for brevity) ...
    if (!isResizable || !modalRef.current) return;

    const rect = modalRef.current.getBoundingClientRect();

    if (!position) {
      const initialPos = { x: rect.left, y: rect.top };
      setPosition(initialPos);
      initialModalPos.current = initialPos;
    } else {
      initialModalPos.current = { x: rect.left, y: rect.top };
    }

    if (!size) {
      const initialDims = { width: rect.width, height: rect.height };
      setSize(initialDims);
      initialModalSize.current = { w: rect.width, h: rect.height };
    } else {
      initialModalSize.current = { w: rect.width, h: rect.height };
    }

    dragStartPos.current = { x: e.clientX, y: e.clientY };

    setIsResizing(true);

    // Optimization
    modalRef.current.style.willChange = 'width, height';
    modalRef.current.style.transition = 'none'; // <--- CRITICAL FIX

    e.preventDefault();
    e.stopPropagation();
  };

  // Global Mouse Move/Up
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!modalRef.current) return;

      if (isDragging) {
        const deltaX = e.clientX - dragStartPos.current.x;
        const deltaY = e.clientY - dragStartPos.current.y;
        modalRef.current.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
      }

      if (isResizing) {
        const deltaX = e.clientX - dragStartPos.current.x;
        const deltaY = e.clientY - dragStartPos.current.y;

        const newW = Math.max(300, initialModalSize.current.w + deltaX);
        const newH = Math.max(200, initialModalSize.current.h + deltaY);

        modalRef.current.style.width = `${newW}px`;
        modalRef.current.style.height = `${newH}px`;
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        if (modalRef.current) {
          const rect = modalRef.current.getBoundingClientRect();

          modalRef.current.style.transform = 'none';
          modalRef.current.style.left = `${rect.left}px`;
          modalRef.current.style.top = `${rect.top}px`;
          modalRef.current.style.willChange = 'auto';
          modalRef.current.style.transition = ''; // Restore transitions

          setPosition({ x: rect.left, y: rect.top });
        }
      }
      if (isResizing) {
        setIsResizing(false);
        if (modalRef.current) {
          modalRef.current.style.willChange = 'auto';
          modalRef.current.style.transition = ''; // Restore transitions
          const rect = modalRef.current.getBoundingClientRect();
          setSize({ width: rect.width, height: rect.height });
        }
      }
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing]);


  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showConfirmClose) {
          setShowConfirmClose(false);
        } else {
          handleRequestClose();
        }
      }
    };

    document.addEventListener('keydown', handleEsc);

    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, handleRequestClose, showConfirmClose]);

  if (!isOpen) return null;

  // Dynamic Styles
  const modalStyle: React.CSSProperties = {};

  // If we have explicit position/size (from drag/resize), use them.
  // Otherwise, default to CSS classes for centering/sizing.
  if (position || size) {
    modalStyle.position = 'fixed'; // Switch to fixed positioning relative to viewport
    modalStyle.left = position ? position.x : '50%';
    modalStyle.top = position ? position.y : '50%';
    modalStyle.transform = position ? 'none' : 'translate(-50%, -50%)'; // Only center if no pos
    if (size) {
      modalStyle.width = size.width;
      modalStyle.height = size.height;
      // Important: remove max-width/height constraints if resized manually
      modalStyle.maxWidth = 'none';
      modalStyle.maxHeight = 'none';
    }
    modalStyle.margin = 0;
  }

  // Determine classes
  // Default classes: centered flex layout for wrapper
  // If dragging enabled, we want the modal to be potentially absolute, but wrapper still fixed inset-0 for backdrop

  const wrapperClasses = `fixed inset-0 bg-black bg-opacity-60 z-50 flex ${!position ? 'justify-center items-end md:items-center' : ''} p-0 md:p-4 transition-opacity duration-300`;

  // If resized, override standard widths
  const containerClasses = `bg-white dark:bg-gray-800 rounded-t-2xl md:rounded-2xl shadow-xl flex flex-col transform transition-all duration-300 animate-slide-up md:animate-none ${!size ? `w-full h-full md:w-full md:h-auto ${maxWidth} md:max-h-[90vh]` : ''}`;

  const headerCursor = isDraggable ? 'cursor-move' : '';

  return createPortal(
    <div
      className={wrapperClasses}
      onClick={handleRequestClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className={containerClasses}
        style={modalStyle}
        onClick={e => e.stopPropagation()}
      >
        <header
          className={`flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 select-none ${headerCursor}`}
          onMouseDown={handleMouseDownHeader}
        >
          <h3 id="modal-title" className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={handleRequestClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Закрыть">
            <XIcon className="h-6 w-6" />
          </button>
        </header>
        <main className="p-6 overflow-y-auto flex-grow">
          {children}
        </main>
        {footer && (
          <footer className="flex justify-end gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
            {footer}
          </footer>
        )}

        {isResizable && (
          <div
            className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-end justify-end p-1 z-10"
            onMouseDown={handleMouseDownResizer}
          >
            <div className="w-3 h-3 border-r-2 border-b-2 border-gray-400 dark:border-gray-500"></div>
          </div>
        )}
      </div>

      {showConfirmClose && (
        <div
          className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-2xl max-w-sm w-full border border-gray-200 dark:border-gray-700 transform scale-100 transition-transform">
            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Несохраненные изменения</h4>
            <p className="text-gray-600 dark:text-gray-300 mb-6">У вас есть несохраненные изменения. Вы уверены, что хотите закрыть окно? Все изменения будут потеряны.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancelClose}
                className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleConfirmClose}
                className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Выйти без сохранения
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-up {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out forwards; }
        @media (min-width: 768px) {
          .md\\:animate-none { animation: none; }
        }
       `}</style>
    </div>,
    document.body
  );
};

export default Modal;
