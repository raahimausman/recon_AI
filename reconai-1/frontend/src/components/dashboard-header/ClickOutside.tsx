'use client';

import React, { useRef, useEffect, RefObject, ReactNode } from 'react';

interface ClickOutsideProps {
  children: ReactNode;
  exceptionRef?: RefObject<HTMLElement>;
  onClick: () => void;
  className?: string;
}

const ClickOutside: React.FC<ClickOutsideProps> = ({
  children,
  exceptionRef,
  onClick,
  className = '',
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickListener = (event: MouseEvent) => {
      const target = event.target as Node;

      const clickedInsideWrapper = wrapperRef.current?.contains(target);
      const clickedInsideException = exceptionRef?.current?.contains(target) || exceptionRef?.current === target;

      const clickedInside = clickedInsideWrapper || clickedInsideException;

      if (!clickedInside) {
        onClick();
      }
    };

    document.addEventListener('mousedown', handleClickListener);
    return () => {
      document.removeEventListener('mousedown', handleClickListener);
    };
  }, [exceptionRef, onClick]);

  return (
    <div ref={wrapperRef} className={className}>
      {children}
    </div>
  );
};

export default ClickOutside;
