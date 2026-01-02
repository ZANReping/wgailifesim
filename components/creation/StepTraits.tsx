
import React from 'react';
import { Trait, BackgroundType, TraitRarity, TRAIT_SORT_ORDER } from '../../types';
import { safeString } from '../../services/utils';

interface Props {
  traits: Trait[];
  name: string;
  background: BackgroundType;
  birthYear: number;
  foreignFaction: string | undefined;
  isLoading: boolean;
  onStart: () => void;
  onReselect: () => void;
}

const getRarityColor = (rarity: TraitRarity) => {
  switch (rarity) {
    case TraitRarity.COMMON: return 'bg-gray-200 text-gray-800 border-gray-400';
    case TraitRarity.RARE: return 'bg-blue-100 text-blue-900 border-blue-400';
    case TraitRarity.EPIC: return 'bg-purple-100 text-purple-900 border-purple-400';
    case TraitRarity.LEGENDARY: return 'bg-yellow-100 text-yellow-900 border-yellow-600';
    case TraitRarity.NEGATIVE: return 'bg-red-100 text-red-900 border-red-800';
    case TraitRarity.HIDDEN: return 'bg-gray-800 text-gray-200 border-gray-600';
    default: return 'bg-white';
  }
};

export const StepTraits: React.FC<Props> = ({ 
  traits, 
  name, 
  background, 
  birthYear, 
  foreignFaction, 
  isLoading, 
  onStart, 
  onReselect 
}) => {
  const sortedTraits = [...traits].sort((a, b) => {
    return (TRAIT_SORT_ORDER[a.rarity] ?? 99) - (TRAIT_SORT_ORDER[b.rarity] ?? 99);
  });

  return (
    <div className="flex-1 flex flex-col space-y-4 md:space-y-6 animate-slide-up">
       <div className="text-center mb-1 md:mb-2">
          <p className="text-lg md:text-xl font-black text-gray-900">档案评估完成</p>
          {background === BackgroundType.HISTORICAL ? (
            <p className="text-xs md:text-sm text-gray-600">
                已还原历史人物 {name} (生于{birthYear}年) 的特质：
            </p>
          ) : (
            <p className="text-xs md:text-sm text-gray-600">你获得了以下特质：</p>
          )}
       </div>

       <div className="space-y-3 overflow-y-auto max-h-[50vh] md:max-h-none pr-1">
         {sortedTraits.map((trait, index) => (
           <div 
            key={trait.id} 
            className={`p-3 md:p-4 border-l-4 shadow-md bg-[#f4f1de] flex flex-col relative ${getRarityColor(trait.rarity)} border-l-gray-700 animate-slide-up`}
            style={{ animationDelay: `${index * 0.1}s` }}
           >
              <div className="flex justify-between items-start mb-1">
                 <h3 className="font-bold text-base md:text-lg">{safeString(trait.name)}</h3>
                 <span className="text-[10px] px-2 py-0.5 bg-black/10 rounded uppercase font-bold tracking-wider">{trait.rarity}</span>
              </div>
              <p className="text-xs md:text-sm opacity-90">{safeString(trait.description)}</p>
              {trait.modifiers && (
                <div className="mt-2 text-xs flex gap-2 flex-wrap">
                  {Object.entries(trait.modifiers)
                     .filter(([_, val]) => val !== 0) // HIDE 0 MODIFIERS
                     .map(([key, val]) => (
                     <span key={key} className={(val as number) > 0 ? "text-green-700 font-bold" : "text-red-700 font-bold"}>
                       {key === 'physique' ? '体格' : key === 'intelligence' ? '智力' : key === 'spirit' ? '精神' : key === 'agility' ? '身手' : key === 'charisma' ? '魅力' : '政治'} 
                       {(val as number) > 0 ? `+${val}` : val}
                     </span>
                  ))}
                </div>
              )}
           </div>
         ))}
       </div>
       
       {foreignFaction && (
           <div className="p-2 md:p-3 bg-red-100 border border-red-300 rounded text-xs text-red-900 font-bold text-center animate-pulse">
               ⚠️ 检测到该人物为海外领袖 ({foreignFaction})，初始派系已调整。
           </div>
       )}

       <div className="flex-1"></div>
       
       {background === BackgroundType.HISTORICAL && (
          <button onClick={onReselect} className="w-full mb-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 shadow-sm border border-gray-800 text-sm">
             重选人物
          </button>
       )}

       <button
         onClick={onStart}
         disabled={isLoading}
         className="w-full bg-red-800 hover:bg-red-900 text-[#fdfbf7] text-xl font-bold py-3 md:py-4 shadow-lg border-2 border-red-950 tracking-widest disabled:opacity-70 disabled:cursor-not-allowed transition-transform active:scale-95"
       >
         {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
              <span>正在投入历史...</span>
            </span>
         ) : "开始模拟"}
       </button>
    </div>
  );
};
