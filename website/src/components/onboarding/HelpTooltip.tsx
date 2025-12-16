'use client';

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface HelpTooltipProps {
  content: string;
  title?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  id?: string;
}

export function HelpTooltip({ 
  content, 
  title, 
  position = 'top',
  id 
}: HelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="inline-flex items-center justify-center w-5 h-5 text-gray-400 hover:text-primary transition-colors"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        aria-label="Help"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {isVisible && (
        <div
          className={`absolute z-50 w-64 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg ${positionClasses[position]}`}
          role="tooltip"
        >
          {title && (
            <div className="font-semibold mb-1">{title}</div>
          )}
          <div className="text-gray-200">{content}</div>
          
          {/* Arrow */}
          <div
            className={`absolute w-2 h-2 bg-gray-900 rotate-45 ${
              position === 'top' ? 'bottom-[-4px] left-1/2 -translate-x-1/2' :
              position === 'bottom' ? 'top-[-4px] left-1/2 -translate-x-1/2' :
              position === 'left' ? 'right-[-4px] top-1/2 -translate-y-1/2' :
              'left-[-4px] top-1/2 -translate-y-1/2'
            }`}
          />
        </div>
      )}
    </div>
  );
}
