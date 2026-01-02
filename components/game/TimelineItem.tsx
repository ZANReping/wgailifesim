
import React from 'react';
import { HistoryEntry, RollResult, TraitRarity } from '../../types';
import { safeString } from '../../services/utils';

interface Props { entry: HistoryEntry }

const getTraitColorStyle = (rarity: TraitRarity) => {
    switch (rarity) {
      case TraitRarity.COMMON: return 'bg-gray-100 text-gray-800 border-gray-300';
      case TraitRarity.RARE: return 'bg-blue-100 text-blue-800 border-blue-300';
      case TraitRarity.EPIC: return 'bg-purple-100 text-purple-800 border-purple-300';
      case TraitRarity.LEGENDARY: return 'bg-yellow-100 text-yellow-800 border-yellow-400';
      case TraitRarity.CRIME: return 'bg-gray-900 text-red-200 border-red-800';
      case TraitRarity.NEGATIVE: return 'bg-red-100 text-red-800 border-red-300';
      case TraitRarity.HIDDEN: return 'bg-gray-700 text-gray-200 border-gray-600';
      default: return 'bg-white text-gray-900 border-gray-200';
    }
  };

export const TimelineItem: React.FC<Props> = ({ entry }) => {
  const getResultBadge = (res: RollResult) => {
    switch (res) {
      case 'CRITICAL_SUCCESS': return <span className="bg-yellow-100 text-yellow-800 text-[10px] px-1 py-0.5 rounded border border-yellow-400 font-bold whitespace-nowrap">大成功</span>;
      case 'SUCCESS': return <span className="bg-green-100 text-green-800 text-[10px] px-1 py-0.5 rounded border border-green-400 font-bold whitespace-nowrap">成功</span>;
      case 'FAILURE': return <span className="bg-red-100 text-red-800 text-[10px] px-1 py-0.5 rounded border border-red-400 font-bold whitespace-nowrap">失败</span>;
      case 'CRITICAL_FAILURE': return <span className="bg-purple-100 text-purple-800 text-[10px] px-1 py-0.5 rounded border border-purple-400 font-bold whitespace-nowrap">大失败</span>;
      default: return null;
    }
  };

  const changes = entry.traitChanges || [];
  const added = changes.filter(c => c.type === 'ADD');
  const removed = changes.filter(c => c.type === 'REMOVE');
  const updatedNames = added.filter(a => removed.some(r => r.name === a.name)).map(a => a.name);
  
  const processedChanges: { name: string, type: 'ADD' | 'REMOVE' | 'UPDATE', rarity?: TraitRarity }[] = [];
  
  added.forEach(a => {
      if (updatedNames.includes(a.name)) {
          processedChanges.push({ name: a.name, type: 'UPDATE', rarity: a.rarity });
      } else {
          processedChanges.push({ name: a.name, type: 'ADD', rarity: a.rarity });
      }
  });

  removed.forEach(r => {
      if (!updatedNames.includes(r.name)) {
          processedChanges.push({ name: r.name, type: 'REMOVE', rarity: r.rarity });
      }
  });

  return (
    <div className="relative border-l-2 border-gray-400 pl-4 pb-4 animate-fade-in last:pb-0">
      <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-gray-600"></div>
      <div className="text-xs font-bold text-gray-600 mb-1 flex flex-wrap items-center gap-2">
         <span className="whitespace-nowrap">{entry.year}年{entry.month}月</span>
         {/* Badges for Deltas */}
         {entry.deltas && (
             <div className="flex gap-1 flex-wrap">
                 {entry.deltas.redStars !== 0 && (
                     <span className={`px-1 rounded border text-[10px] font-bold ${entry.deltas.redStars > 0 ? 'bg-yellow-100 border-yellow-300 text-red-700' : 'bg-gray-100 border-gray-300 text-gray-600'}`}>
                         ★ {entry.deltas.redStars > 0 ? '+' : ''}{entry.deltas.redStars}
                     </span>
                 )}
                 {entry.deltas.powerPoints !== 0 && (
                     <span className={`px-1 rounded border text-[10px] font-bold ${entry.deltas.powerPoints > 0 ? 'bg-yellow-100 border-yellow-400 text-yellow-800' : 'bg-gray-100 border-gray-300 text-gray-600'}`}>
                         权势 {entry.deltas.powerPoints > 0 ? '+' : ''}{entry.deltas.powerPoints}
                     </span>
                 )}
             </div>
         )}
         {/* Badge for Faction Change */}
         {entry.factionChange && (
             <span className="px-1 rounded border text-[10px] font-bold bg-blue-100 border-blue-400 text-blue-900 flex items-center gap-1">
                 <span>{safeString(entry.factionChange.from)}</span>
                 <span>→</span>
                 <span>{safeString(entry.factionChange.to)}</span>
             </span>
         )}
      </div>
      <div className="text-sm text-gray-900 font-serif leading-snug flex flex-wrap gap-2 items-center">
        <span>{safeString(entry.text)}</span>
        {getResultBadge(entry.result)}
      </div>
      {processedChanges.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {processedChanges.map((change, idx) => {
             const baseStyle = getTraitColorStyle(change.rarity || TraitRarity.COMMON);
             let statusStyle = "";
             let prefix = "";
             
             if (change.type === 'ADD') {
                 statusStyle = "font-bold";
                 prefix = "+";
             } else if (change.type === 'REMOVE') {
                 statusStyle = "line-through opacity-70";
                 prefix = "-";
             } else { // UPDATE
                 statusStyle = "underline decoration-double";
                 prefix = "↻";
             }

             return (
                <span key={idx} className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 border shadow-sm ${baseStyle} ${statusStyle}`}>
                  <span className="font-bold opacity-80">{prefix}</span>
                  {safeString(change.name)}
                </span>
             );
          })}
        </div>
      )}
    </div>
  );
};
