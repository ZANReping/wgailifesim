
import React, { useMemo } from 'react';
import { Attributes, Trait } from '../../types';

interface Props { 
    label: string; 
    value: number; 
    base: number; 
    attrKey: keyof Attributes;
    traits: Trait[];
    onHover: (rect: DOMRect, key: keyof Attributes, relevantTraits: Trait[]) => void;
    onLeave: () => void;
}

export const AttrBadge: React.FC<Props> = ({ label, value, base, attrKey, traits, onHover, onLeave }) => {
  const diff = value - base;

  const relevantTraits = useMemo(() => {
      return (traits || []).filter(t => t.modifiers && t.modifiers[attrKey] !== undefined && t.modifiers[attrKey] !== 0);
  }, [traits, attrKey]);

  return (
    <div 
        className="relative flex flex-col items-center bg-[#f4f1de] p-1 border border-gray-400 rounded min-w-[3rem] md:min-w-[3.5rem] group cursor-help transition-transform hover:scale-105 shrink-0"
        onMouseEnter={(e) => relevantTraits.length > 0 && onHover(e.currentTarget.getBoundingClientRect(), attrKey, relevantTraits)}
        onMouseLeave={onLeave}
        onClick={(e) => relevantTraits.length > 0 && onHover(e.currentTarget.getBoundingClientRect(), attrKey, relevantTraits)}
    >
      <span className="text-[9px] md:text-[10px] text-gray-600 font-serif">{label}</span>
      <div className="flex items-baseline">
        <span className={`font-bold text-base md:text-lg leading-none ${diff > 0 ? 'text-green-800' : diff < 0 ? 'text-red-800' : 'text-gray-900'}`}>
           {value}
        </span>
      </div>
      {diff !== 0 && (
        <span className="text-[8px] md:text-[10px] text-gray-500 absolute -top-1.5 -right-1 bg-white border border-gray-300 rounded-full px-1 shadow-sm">
          {diff > 0 ? `+${diff}` : diff}
        </span>
      )}
    </div>
  );
};
