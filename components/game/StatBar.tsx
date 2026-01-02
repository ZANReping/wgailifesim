
import React from 'react';

export const StatBar: React.FC<{ label: string; value: number; color: string; mini?: boolean }> = ({ label, value, color, mini }) => (
  <div className={`flex items-center gap-2 ${mini ? 'mb-0' : 'mb-2'}`}>
    {!mini && <div className="w-16 md:w-20 text-xs md:text-sm font-bold text-gray-700 text-right shrink-0">{label}</div>}
    <div className={`flex-1 ${mini ? 'h-1.5 w-12' : 'h-3 md:h-4'} bg-gray-300 border border-gray-500 relative rounded-sm overflow-hidden`}>
      <div 
        className={`h-full transition-all duration-500 ${color}`} 
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
      {!mini && (
        <div className="absolute inset-0 flex items-center justify-center text-[9px] md:text-[10px] text-white font-bold drop-shadow-md">
          {value}%
        </div>
      )}
    </div>
  </div>
);
