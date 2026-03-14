'use client';

import React from 'react';

export default function LoadingSpinner({ size = 48 }: { size?: number }) {
  return (
    <div
      className="inline-block"
      style={{ width: size, height: size }}
    >
      <svg
        className="spin"
        viewBox="0 0 50 50"
      >
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="#E0F7FA"
          strokeWidth="6"
        />
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="#059DC0"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="31.4 94.2"
          strokeDashoffset="0"
        />
      </svg>
    </div>
  );
}
