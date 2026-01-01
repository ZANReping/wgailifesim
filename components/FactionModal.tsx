import React, { useMemo } from 'react';
import { Faction, PlayerStats } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  factions: Faction[];
  playerStats: PlayerStats;
  onExchangeRedStars: () => void;
  onManipulateScales: () => void;
  canManipulate: boolean;
  supremeLeader: string;
  themeColor: string;
  slogan?: string;
  symbol?: string;
}

const safeString = (val: any, fallback = ""): string => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) return val.map(item => safeString(item)).join(", ");
  if (typeof val === 'object') return val.name || val.text || fallback;
  return String(val);
};

export const FactionModal: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  factions, 
  playerStats, 
  onExchangeRedStars,
  onManipulateScales,
  canManipulate,
  supremeLeader,
  themeColor,
  slogan,
  symbol
}) => {
  if (!isOpen) return null;

  const safeFactions = useMemo(() => {
    if (!Array.isArray(factions)) return [];
    return factions.map(f => ({
      name: safeString(f?.name, "未知组织"),
      percentage: Number(f?.percentage) || 0,
      leaders: Array.isArray(f?.leaders) ? f.leaders.map(l => safeString(l)) : [safeString(f?.leaders)],
      color: safeString(f?.color, "#333"),
      description: safeString(f?.description, "")
    })).sort((a, b) => b.percentage - a.percentage);
  }, [factions]);

  const currentLeader = safeString(supremeLeader, "毛泽东");
  const myFaction = safeString(playerStats.currentFaction, "逍遥派");
  const isLeader = playerStats.isLeader;
  const isSupremeLeader = myFaction === "最高领袖";
  const displaySlogan = slogan || "大海航行靠舵手";
  const displaySymbol = symbol || "☭";
  
  const exchangeCost = isSupremeLeader ? 2 : 3;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-2 md:p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#fdfbf7] w-full max-w-6xl h-full md:h-[85vh] flex flex-col md:flex-row relative shadow-2xl overflow-hidden border-4 rounded-sm" style={{ borderColor: themeColor }}>
        {/* Background Texture */}
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/aged-paper.png')]"></div>
        
        {/* Close Button */}
        <button 
           onClick={onClose}
           className="absolute top-0 right-0 z-20 text-white w-10 h-10 md:w-12 md:h-12 flex items-center justify-center transition-colors font-bold text-xl md:text-2xl shadow-md leading-none hover:opacity-90"
           style={{ backgroundColor: themeColor }}
        >
           ✕
        </button>

        {/* Left Panel: The Situation */}
        <div className="w-full md:w-2/3 flex-1 md:flex-auto flex flex-col border-b md:border-b-0 md:border-r-2 border-red-900/30 bg-[#f4f1de] min-h-0">
            <div className="p-4 md:p-8 flex-shrink-0 text-center border-b-2" style={{ borderColor: themeColor }}>
                <h2 className="text-2xl md:text-4xl font-black font-serif tracking-widest mb-1 md:mb-2" style={{ color: themeColor }}>革命形势图</h2>
                <div className="flex items-center justify-center gap-2 text-xs md:text-sm font-bold text-red-800/80">
                    <span className="text-yellow-700">★</span>
                    <span>最高指示：{displaySlogan}</span>
                    <span className="text-yellow-700">★</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
                <div className="mb-6 md:mb-8 bg-red-50 border-2 border-red-200 p-3 md:p-4 rounded-sm shadow-sm flex items-center justify-between">
                    <div>
                        <div className="text-xs font-bold text-red-800 uppercase tracking-wider mb-1">当前最高领袖</div>
                        <div className="text-xl md:text-2xl font-black text-gray-900 font-serif">{currentLeader}</div>
                    </div>
                    <div className="text-3xl md:text-4xl opacity-20" style={{ color: themeColor }}>{displaySymbol}</div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-base md:text-lg font-bold text-gray-800 border-l-4 pl-3 mb-2 md:mb-4" style={{ borderColor: themeColor }}>各派系力量对比</h3>
                    {safeFactions.map((f, idx) => (
                        <div key={idx} className="relative pt-1">
                            <div className="flex justify-between items-end mb-1">
                                <div className="flex items-baseline gap-2 max-w-[80%]">
                                    <span className="font-bold text-gray-900 text-base md:text-lg leading-none truncate">{f.name}</span>
                                    {f.leaders.length > 0 && (
                                        <span className="text-[10px] md:text-xs text-gray-500 truncate hidden sm:inline">
                                            (代表: {f.leaders.join('、')})
                                        </span>
                                    )}
                                </div>
                                <span className="font-black font-mono text-red-900">{f.percentage}%</span>
                            </div>
                            <div className="h-2 md:h-3 bg-gray-200 w-full rounded-full overflow-hidden border border-gray-300 shadow-inner">
                                <div 
                                    className="h-full relative transition-all duration-500"
                                    style={{ width: `${f.percentage}%`, backgroundColor: f.color }}
                                >
                                    <div className="absolute inset-0 bg-white/20"></div>
                                </div>
                            </div>
                            {f.description && <p className="text-[9px] md:text-[10px] text-gray-500 mt-1 truncate">{f.description}</p>}
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Right Panel: Player Actions - Dynamic Flex Layout */}
        <div className="w-full md:w-1/3 h-auto md:h-full text-[#fdfbf7] flex flex-col relative overflow-hidden shrink-0" style={{ backgroundColor: themeColor }}>
            {/* Texture Overlay */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col h-full p-4 md:p-8 overflow-y-auto custom-scrollbar">
                
                {/* Profile Section */}
                <div className="flex-shrink-0 mb-4 md:mb-6">
                    <h3 className="text-lg md:text-xl font-bold text-yellow-500 mb-4 border-b border-yellow-500/30 pb-2">我的政治档案</h3>
                    
                    <div className="space-y-4 md:space-y-6">
                        <div>
                            <div className="text-xs text-red-200 uppercase tracking-widest mb-1">当前身份</div>
                            <div className="text-xl md:text-2xl font-black text-white font-serif">{myFaction}</div>
                            {isLeader && <div className="inline-block bg-yellow-600 text-red-900 text-xs font-black px-2 py-0.5 rounded mt-1">派系领袖</div>}
                        </div>

                        <div className="grid grid-cols-2 gap-3 md:gap-4">
                            <div className="bg-black/20 p-2 md:p-3 rounded border border-white/20">
                                <div className="text-[10px] md:text-xs text-red-200 mb-1">政治权势</div>
                                <div className="text-2xl md:text-3xl font-black text-white">{playerStats.powerPoints}</div>
                            </div>
                            <div className="bg-black/20 p-2 md:p-3 rounded border border-white/20">
                                <div className="text-[10px] md:text-xs text-red-200 mb-1">命运红星</div>
                                <div className="text-2xl md:text-3xl font-black text-yellow-400">★ {playerStats.redStars}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-h-[10px]"></div>

                {/* Actions Section */}
                <div className="flex-shrink-0 space-y-3 md:space-y-4 pt-3 md:pt-4 mt-2 md:mt-4 border-t border-white/20 pb-4 md:pb-0">
                    <p className="text-xs text-red-200 italic text-center mb-1">“与天斗，与地斗，与人斗，其乐无穷。”</p>
                    
                    <button
                        onClick={onExchangeRedStars}
                        disabled={playerStats.redStars < exchangeCost}
                        className="w-full group relative overflow-hidden bg-yellow-600 hover:bg-yellow-500 text-red-900 font-black py-3 md:py-4 px-4 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed border-b-4 border-yellow-800 active:border-b-0 active:translate-y-1"
                    >
                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex flex-col items-start">
                                <span className="text-base md:text-lg">动用气运</span>
                                <span className="text-[10px] opacity-80">消耗{exchangeCost}颗红星 兑换 1点权势</span>
                            </div>
                            <span className="text-xl md:text-2xl group-hover:rotate-180 transition-transform duration-500">🔄</span>
                        </div>
                    </button>
                    
                    <button
                        onClick={onManipulateScales}
                        disabled={!canManipulate}
                        className="w-full group relative overflow-hidden bg-black/40 hover:bg-black/50 text-white font-black py-3 md:py-4 px-4 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed border-b-4 border-black/60 active:border-b-0 active:translate-y-1"
                    >
                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex flex-col items-start">
                                <span className="text-base md:text-lg">{isSupremeLeader ? "下达最高指示" : "摆弄天平"}</span>
                                <span className="text-[10px] opacity-80">消耗1点权势 干预派系力量</span>
                            </div>
                            <span className="text-xl md:text-2xl group-hover:scale-110 transition-transform duration-300">⚖️</span>
                        </div>
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};