
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { GameState, Choice, Attributes, RollResult, TraitRarity, TRAIT_SORT_ORDER, Trait, PotentialSuccessor } from '../types';
import { safeString } from '../services/utils';
import { StatBar } from './game/StatBar';
import { AttrBadge } from './game/AttrBadge';
import { TimelineItem } from './game/TimelineItem';

interface Props {
  gameState: GameState;
  effectiveAttributes: Attributes;
  choices: Choice[];
  onChoice: (choiceId: string, choiceText: string, rollResult: RollResult, earnStar: boolean, consumedRedStars: number) => void;
  onConsumeRedStar: () => void;
  isLoading: boolean;
  gameScene: string;
  onRestart: (type: 'current' | 'new') => void;
  onOpenSettings: () => void;
  onOpenFaction: () => void;
  isSupremeLeader?: boolean;
  themeColor: string;
  onInheritWorld?: (successor: PotentialSuccessor) => void;
  onLoadSave?: (file: File) => void;
}

const ATTRIBUTE_LABELS: Record<string, string> = {
  physique: '体格',
  intelligence: '智力',
  spirit: '精神',
  agility: '身手',
  charisma: '魅力',
  politics: '政治'
};

const normalizeAttrKey = (key?: string): keyof Attributes | null => {
  if (!key) return null;
  const k = key.toLowerCase().trim();
  
  if (k.startsWith('pol') || k.includes('政治')) return 'politics';
  if (k.startsWith('phy') || k.startsWith('str') || k.startsWith('bod') || k.includes('体格')) return 'physique';
  if (k.startsWith('int') || k.startsWith('wis') || k.startsWith('sma') || k.startsWith('zhi') || k.includes('智力')) return 'intelligence';
  if (k.startsWith('spi') || k.startsWith('wil') || k.startsWith('men') || k.startsWith('jing') || k.includes('精神')) return 'spirit';
  if (k.startsWith('agi') || k.startsWith('dex') || k.startsWith('spe') || k.startsWith('shen') || k.includes('身手')) return 'agility';
  if (k.startsWith('cha') || k.startsWith('app') || k.startsWith('per') || k.startsWith('mei') || k.includes('魅力')) return 'charisma';
  
  // Fallback: check if it matches existing keys directly
  if (Object.keys(ATTRIBUTE_LABELS).includes(k)) return k as keyof Attributes;
  
  return null;
};

const getTraitColor = (rarity: TraitRarity) => {
  switch (rarity) {
    case TraitRarity.COMMON: return 'bg-gray-200 text-gray-800 border-gray-400';
    case TraitRarity.RARE: return 'bg-blue-100 text-blue-900 border-blue-300';
    case TraitRarity.EPIC: return 'bg-purple-100 text-purple-900 border-purple-300';
    case TraitRarity.LEGENDARY: return 'bg-yellow-50 text-yellow-800 border-yellow-500 ring-1 ring-yellow-400';
    case TraitRarity.CRIME: return 'bg-black text-red-100 border-red-900 ring-2 ring-red-700';
    case TraitRarity.NEGATIVE: return 'bg-red-50 text-red-900 border-red-300';
    case TraitRarity.HIDDEN: return 'bg-gray-800 text-gray-300 border-gray-600';
    default: return 'bg-white';
  }
};

const GameUI: React.FC<Props> = ({ gameState, effectiveAttributes, choices, onChoice, onConsumeRedStar, isLoading, gameScene, onRestart, onOpenSettings, onOpenFaction, isSupremeLeader, themeColor, onInheritWorld, onLoadSave }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);
  const [isTraitsExpanded, setIsTraitsExpanded] = useState(false); // New state for trait collapsing
  
  const [rollingChoice, setRollingChoice] = useState<Choice | null>(null);
  const [rollValue, setRollValue] = useState(0);
  const [finalResult, setFinalResult] = useState<RollResult | null>(null);
  const [calculatedThreshold, setCalculatedThreshold] = useState(0);
  const [activeCritThreshold, setActiveCritThreshold] = useState(95);

  // Modals
  const [showRerollModal, setShowRerollModal] = useState(false); // On Failure
  const [showCriticalCustomModal, setShowCriticalCustomModal] = useState(false); // On Critical Success
  
  const [pendingFailure, setPendingFailure] = useState<{choice: Choice, result: RollResult} | null>(null);
  const [pendingCritical, setPendingCritical] = useState<{choice: Choice} | null>(null);

  const [showRestartMenu, setShowRestartMenu] = useState(false);
  // Confirmation for hard reset if heirs exist
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  
  // Custom Action State
  const [isInputtingCustom, setIsInputtingCustom] = useState(false);
  const [customActionText, setCustomActionText] = useState("");
  // Flag to reuse the custom input modal for Supreme Leader's manipulate ability
  const [isLeaderManipulating, setIsLeaderManipulating] = useState(false);
  // Flag for Pity Custom Action (Free)
  const [isPityAction, setIsPityAction] = useState(false);

  // Testament State
  const [isWritingTestament, setIsWritingTestament] = useState(false);
  const [testamentText, setTestamentText] = useState("");
  const [testamentChoice, setTestamentChoice] = useState<Choice | null>(null);
  const [showTestamentCustomInput, setShowTestamentCustomInput] = useState(false);

  // Successor Confirmation State
  const [confirmSuccessor, setConfirmSuccessor] = useState<PotentialSuccessor | null>(null);

  // Tooltip States
  const [activeTraitTooltip, setActiveTraitTooltip] = useState<{ trait: Trait; rect: DOMRect; align: 'left' | 'right' } | null>(null);
  const [activeAttrTooltip, setActiveAttrTooltip] = useState<{
      key: keyof Attributes;
      rect: DOMRect;
      traits: Trait[];
  } | null>(null);

  // Stats Tracking for current interaction
  const [interactionStarsConsumed, setInteractionStarsConsumed] = useState(0);

  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        if(scrollRef.current) {
           scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [gameScene, choices]);

  // Compute displayed history
  const displayedHistory = useMemo(() => {
    const list = gameState.historySummary || [];
    if (isTimelineExpanded) {
      return list;
    }
    return list.slice(-3);
  }, [gameState.historySummary, isTimelineExpanded]);

  const dateStr = `${gameState.year}年${gameState.month}月`;
  const currentAge = gameState.year - gameState.stats.birthYear;
  
  const traits = [...gameState.stats.traits].sort((a, b) => {
    return (TRAIT_SORT_ORDER[a.rarity] ?? 99) - (TRAIT_SORT_ORDER[b.rarity] ?? 99);
  });

  const rawFaction = gameState.stats.currentFaction;
  const displayFaction = (typeof rawFaction === 'string' ? rawFaction : (rawFaction as any)?.name) || "无";

  const safeGameScene = useMemo(() => safeString(gameScene), [gameScene]);
  const safeGameOverReason = useMemo(() => safeString(gameState.gameOverReason), [gameState.gameOverReason]);

  // Separate choices
  // Filter out normal choices
  const normalChoices = (choices || []).filter(c => c.id !== 'special_manipulate_scales' && c.id !== 'pity_custom_action' && c.id !== 'action_write_testament');
  
  // Strict condition: Special choice is ONLY valid if points > 0.
  const specialChoice = (gameState.stats.powerPoints > 0) 
      ? (choices || []).find(c => c.id === 'special_manipulate_scales') 
      : undefined;

  const pityChoice = (choices || []).find(c => c.id === 'pity_custom_action');
  
  // Testament choice
  const testamentChoiceOption = (choices || []).find(c => c.id === 'action_write_testament');

  const getRollStats = (choice: Choice) => {
      const baseDifficulty = choice.difficulty ?? 50;
      const attrKey = normalizeAttrKey(choice.requiredAttribute);
      const attrVal = attrKey ? (effectiveAttributes[attrKey] || 0) : 0;
      
      const rawThreshold = baseDifficulty - (attrVal * 2);
      // Ensure basic success threshold is reasonable
      const effectiveThreshold = Math.max(5, Math.min(95, rawThreshold));
      
      // Calculate overflow if stats are super high (rawThreshold < 5)
      // Example: Diff 40, Attr 25. Raw = 40 - 50 = -10. Overflow = 5 - (-10) = 15.
      let overflow = 0;
      if (rawThreshold < 5) {
          overflow = 5 - rawThreshold;
      }
      
      // Reduce critical threshold by overflow. Default 95. Max reduction to 50?
      // Example: 95 - 15 = 80. Crit Range 80-100.
      const critThreshold = Math.max(20, 95 - overflow);

      return { effectiveThreshold, critThreshold, rawThreshold };
  };

  const handleChoiceClick = (choice: Choice) => {
    if (isLoading || rollingChoice) return;
    
    if (choice.id === 'special_manipulate_scales' && isSupremeLeader) {
        setRollingChoice(choice);
        setIsLeaderManipulating(true);
        setIsInputtingCustom(false);
        setIsPityAction(false);
        setShowCriticalCustomModal(true); 
        return;
    }

    if (choice.id === 'pity_custom_action') {
        setRollingChoice(choice);
        setIsPityAction(true);
        setIsLeaderManipulating(false);
        setIsInputtingCustom(false);
        setShowCriticalCustomModal(true);
        return;
    }

    if (choice.id === 'action_write_testament') {
        setTestamentChoice(choice);
        setShowTestamentCustomInput(false);
        setIsWritingTestament(true);
        setInteractionStarsConsumed(0);
        return;
    }
    
    // Always start roll animation for standard choices as now everything has difficulty
    startRoll(choice);
  };

  const submitTestament = (textOverride?: string) => {
      const finalTestamentText = textOverride || testamentText;
      if (!testamentChoice || !finalTestamentText.trim()) return;
      
      const actionText = `[立下遗嘱] 指定继承人安排：${finalTestamentText}`;
      setIsWritingTestament(false);
      setTestamentText("");
      setTestamentChoice(null);
      setShowTestamentCustomInput(false);
      
      // Pass the consumed stars if custom input was used
      startRoll(testamentChoice, actionText);
  };

  const startRoll = (choice: Choice, overrideText?: string) => {
      // Calculate thresholds
      const { effectiveThreshold, critThreshold } = getRollStats(choice);
      
      setCalculatedThreshold(effectiveThreshold);
      setActiveCritThreshold(critThreshold);

      // If we have override text (like testament), create a temp choice
      const effectiveChoice = overrideText ? { ...choice, text: overrideText } : choice;
      
      setRollingChoice(effectiveChoice);
      setFinalResult(null);
      setPendingFailure(null);
      setPendingCritical(null);
      setShowRerollModal(false);
      setShowCriticalCustomModal(false);
      setIsLeaderManipulating(false);
      setIsPityAction(false);
      // Don't reset consumed stars here if it came from testament custom input
      if (!overrideText?.includes("立下遗嘱")) {
          setInteractionStarsConsumed(0);
      }
      
      runRollAnimation(effectiveChoice, effectiveThreshold, critThreshold);
  };

  const runRollAnimation = (choice: Choice, threshold: number, critThreshold: number) => {
      let duration = 1500;
      let start = Date.now();
      const animate = () => {
        const now = Date.now();
        if (now - start < duration) {
          setRollValue(Math.floor(Math.random() * 100) + 1);
          requestAnimationFrame(animate);
        } else {
          const roll = Math.floor(Math.random() * 100) + 1;
          setRollValue(roll);
          
          let result: RollResult = 'FAILURE';
          
          if (roll <= 5) result = 'CRITICAL_FAILURE';
          else if (roll >= critThreshold) result = 'CRITICAL_SUCCESS';
          else if (roll > threshold) result = 'SUCCESS'; 
          
          setFinalResult(result);
          
          if (result === 'CRITICAL_SUCCESS') {
              setTimeout(() => {
                  setPendingCritical({ choice });
                  setShowCriticalCustomModal(true);
              }, 1000);
              return;
          }

          if ((result === 'FAILURE' || result === 'CRITICAL_FAILURE') && gameState.stats.redStars > 0) {
              setTimeout(() => {
                  setPendingFailure({ choice, result });
                  setShowRerollModal(true);
              }, 1000);
          } else {
             setTimeout(() => {
                 const earnStar = (roll > 85 && (result === 'SUCCESS'));
                 const choiceText = safeString(choice.text);
                 onChoice(choice.id, choiceText, result, earnStar, interactionStarsConsumed);
                 
                 setRollingChoice(null);
                 setFinalResult(null);
             }, 1500);
          }
        }
      };
      animate();
  };

  const confirmReroll = () => {
      if (!pendingFailure) return;
      if (gameState.stats.redStars <= 0) return; // Strict Check

      // Decrease difficulty by 5 for the reroll
      const newThreshold = Math.max(5, calculatedThreshold - 5);
      setCalculatedThreshold(newThreshold);

      onConsumeRedStar();
      setInteractionStarsConsumed(prev => prev + 1);
      setShowRerollModal(false);
      
      // Rerun with new threshold AND same crit threshold
      runRollAnimation(pendingFailure.choice, newThreshold, activeCritThreshold);
  };

  const cancelReroll = () => {
      if (!pendingFailure) return;
      setShowRerollModal(false);
      const choiceText = safeString(pendingFailure.choice.text); 
      onChoice(pendingFailure.choice.id, choiceText, pendingFailure.result, false, interactionStarsConsumed);
      setRollingChoice(null);
      setFinalResult(null);
      setPendingFailure(null);
  };

  const handleProceedCritical = () => {
     if (isLeaderManipulating && rollingChoice) {
         onChoice(rollingChoice.id, safeString(rollingChoice.text), 'SUCCESS', false, interactionStarsConsumed);
         setRollingChoice(null);
         setFinalResult(null);
         setIsLeaderManipulating(false);
         setIsPityAction(false);
         setShowCriticalCustomModal(false);
         return;
     }

     if (!pendingCritical) return;
     setShowCriticalCustomModal(false);
     onChoice(pendingCritical.choice.id, safeString(pendingCritical.choice.text), 'CRITICAL_SUCCESS', true, interactionStarsConsumed);
     setRollingChoice(null);
     setFinalResult(null);
     setPendingCritical(null);
  };

  const handleStartCustomAction = () => {
      setIsInputtingCustom(true);
  };

  const submitCustomAction = () => {
      if (!customActionText.trim()) return;

      if (isLeaderManipulating && rollingChoice) {
          const actionText = `[最高领袖] 动用权势：${customActionText}`;
          setShowCriticalCustomModal(false);
          setIsInputtingCustom(false);
          setIsLeaderManipulating(false);
          setCustomActionText("");
          
          onChoice(rollingChoice.id, actionText, 'SUCCESS', false, interactionStarsConsumed);
          setRollingChoice(null);
          return;
      }

      if (isPityAction && rollingChoice) {
           const actionText = `[厚积薄发] ${customActionText}`;
           setShowCriticalCustomModal(false);
           setIsInputtingCustom(false);
           setIsPityAction(false);
           setCustomActionText("");

           onChoice(rollingChoice.id, actionText, 'SUCCESS', false, interactionStarsConsumed);
           setRollingChoice(null);
           return;
      }
      
      if (!pendingCritical) return;
      
      onConsumeRedStar();
      setInteractionStarsConsumed(prev => prev + 1);
      
      setShowCriticalCustomModal(false);
      setIsInputtingCustom(false);
      setCustomActionText("");
      
      const tempChoice: Choice = {
          ...pendingCritical.choice,
          text: `[自定义] ${customActionText}`,
          id: `custom_${Date.now()}`
      };
      
      runRollAnimation(tempChoice, calculatedThreshold, activeCritThreshold);
  };

  const getResultColor = (res: RollResult | null) => {
    switch (res) {
      case 'CRITICAL_SUCCESS': return 'text-yellow-600';
      case 'SUCCESS': return 'text-green-700';
      case 'FAILURE': return 'text-red-700';
      case 'CRITICAL_FAILURE': return 'text-purple-900';
      default: return 'text-gray-900';
    }
  };
  
  const getResultText = (res: RollResult | null) => {
    switch (res) {
      case 'CRITICAL_SUCCESS': return '大成功!';
      case 'SUCCESS': return '检定成功';
      case 'FAILURE': return '检定失败';
      case 'CRITICAL_FAILURE': return '大失败!';
      default: return '...';
    }
  };

  const handleTraitMouseEnter = (e: React.MouseEvent, trait: Trait) => {
     const rect = e.currentTarget.getBoundingClientRect();
     const isRightHalf = rect.left > window.innerWidth / 2;
     setActiveTraitTooltip({ trait, rect, align: isRightHalf ? 'right' : 'left' });
  };
  
  const handleTraitMouseLeave = () => {
      setActiveTraitTooltip(null);
  };

  const handleAttrHover = (rect: DOMRect, key: keyof Attributes, relevantTraits: Trait[]) => {
      setActiveAttrTooltip({ rect, key, traits: relevantTraits });
  };

  const handleExportSave = () => {
    const saveString = JSON.stringify(gameState, null, 2);
    const blob = new Blob([saveString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `save_${gameState.name}_${gameState.year}_${gameState.month}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
        fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && onLoadSave) {
          onLoadSave(file);
      }
      e.target.value = ''; // Reset
  };

  // Logic for restart confirmation (Heir protection)
  const handleNewLifeClick = () => {
      const hasHeirs = (gameState.potentialSuccessors && gameState.potentialSuccessors.length > 0) || !!gameState.designatedSuccessor;
      if (hasHeirs) {
          setShowRestartConfirm(true);
      } else {
          onRestart('new');
      }
  };

  // Resolve roll modal attributes safely
  const rollAttrKey = normalizeAttrKey(rollingChoice?.requiredAttribute);
  // Default to 0 if key not found, ensuring numbers are always numbers
  const rollAttrVal = rollAttrKey ? (effectiveAttributes[rollAttrKey] || 0) : 0;

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto old-paper border-x-0 md:border-x-4 border-double shadow-2xl overflow-hidden relative transition-all duration-300" style={{ borderColor: themeColor }}>
      
      {activeAttrTooltip && (
          <div 
            className="fixed z-[9999] bg-white border-2 border-gray-800 shadow-xl p-2 animate-fade-in min-w-[150px] max-w-[250px] pointer-events-none"
            style={{
              left: Math.min(window.innerWidth - 125, Math.max(125, activeAttrTooltip.rect.left + activeAttrTooltip.rect.width / 2)),
              top: activeAttrTooltip.rect.top - 8,
              transform: 'translate(-50%, -100%)'
            }}
          >
              <div className="font-bold border-b border-gray-200 mb-1 pb-1 text-center text-xs">
                  {ATTRIBUTE_LABELS[activeAttrTooltip.key]} 影响来源
              </div>
              {activeAttrTooltip.traits.map((t, idx) => (
                  <div key={idx} className="flex justify-between items-center mb-0.5 text-[10px]">
                      <span className="truncate max-w-[70%] mr-2">{safeString(t.name)}</span>
                      <span className={t.modifiers![activeAttrTooltip.key]! > 0 ? 'text-green-700 font-bold' : 'text-red-700 font-bold'}>
                          {t.modifiers![activeAttrTooltip.key]! > 0 ? '+' : ''}{t.modifiers![activeAttrTooltip.key]}
                      </span>
                  </div>
              ))}
          </div>
      )}

      {activeTraitTooltip && (
          <div 
            className="fixed z-[9999] bg-white border-2 border-gray-800 p-2 shadow-xl animate-fade-in pointer-events-none min-w-[160px] max-w-[220px]"
            style={{
              top: activeTraitTooltip.rect.bottom + 8,
              left: activeTraitTooltip.align === 'left' ? activeTraitTooltip.rect.left : 'auto',
              right: activeTraitTooltip.align === 'right' ? (window.innerWidth - activeTraitTooltip.rect.right) : 'auto',
            }}
          >
             <div className="font-bold text-gray-900 border-b border-gray-300 pb-1 mb-1 flex justify-between text-xs">
                 <span>{activeTraitTooltip.trait.rarity}</span>
                 {activeTraitTooltip.trait.duration && <span className="text-red-600">剩余{activeTraitTooltip.trait.duration}月</span>}
             </div>
             <p className="text-gray-700 mb-2 text-xs whitespace-normal break-words">{safeString(activeTraitTooltip.trait.description)}</p>
             {activeTraitTooltip.trait.modifiers && (
                 <div className="flex flex-wrap gap-1">
                     {Object.entries(activeTraitTooltip.trait.modifiers).filter(([k,v]) => v !== 0).map(([k, v]) => (
                         <span key={k} className={`px-1 rounded text-[10px] ${(v as number) > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                             {ATTRIBUTE_LABELS[k]}: {(v as number) > 0 ? `+${v}` : v}
                         </span>
                     ))}
                 </div>
             )}
          </div>
      )}

      {showRestartMenu && (
        <div className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center animate-fade-in backdrop-blur-sm px-4">
          <div className="bg-[#fdfbf7] p-6 md:p-8 rounded border-4 border-double border-red-900 shadow-2xl text-center w-full max-w-sm animate-scale-in relative">
            <h3 className="text-xl md:text-2xl font-black text-red-800 mb-6 font-serif tracking-widest">重新开始</h3>
            <div className="space-y-4">
               <button onClick={() => { setShowRestartMenu(false); onRestart('current'); }} className="w-full py-3 bg-red-700 text-white font-bold hover:bg-red-800 border border-red-900 shadow-md transition-colors">重新书写历史<div className="text-[10px] font-normal opacity-80 mt-1">保留当前角色与特质</div></button>
               <button onClick={() => { setShowRestartMenu(false); handleNewLifeClick(); }} className="w-full py-3 bg-gray-200 text-gray-900 font-bold hover:bg-gray-300 border border-gray-400 shadow-md transition-colors">重新创建角色<div className="text-[10px] font-normal opacity-70 mt-1">返回开始菜单</div></button>
               <button onClick={() => setShowRestartMenu(false)} className="w-full py-2 text-gray-500 hover:text-gray-800 text-sm mt-2 transition-colors">取消</button>
            </div>
          </div>
        </div>
      )}

      {/* Restart Confirmation Modal (Heir Protection) */}
      {showRestartConfirm && (
          <div className="absolute inset-0 z-[80] bg-black/80 flex items-center justify-center animate-fade-in backdrop-blur-sm px-4">
             <div className="bg-[#fdfbf7] p-6 rounded border-4 border-double border-red-900 shadow-2xl text-center w-full max-w-sm animate-scale-in">
                <h3 className="text-xl font-black text-red-900 mb-4">警告：家族断绝</h3>
                <p className="text-gray-700 mb-6 font-serif text-sm">
                    您已确立了继承人或遗嘱。<br/>
                    选择<span className="font-bold text-red-800">新的人生</span>将<span className="font-bold">永久丢弃</span>当前的家族传承和已指定的继承人。<br/>
                    <span className="text-xs text-gray-500 block mt-2">如果您想继续家族的故事，请选择取消。</span>
                </p>
                <div className="flex gap-4">
                   <button onClick={() => setShowRestartConfirm(false)} className="flex-1 py-3 border border-gray-400 text-gray-600 hover:bg-gray-100 font-bold">取消</button>
                   <button 
                       onClick={() => { setShowRestartConfirm(false); onRestart('new'); }} 
                       className="flex-1 py-3 bg-red-800 text-white font-bold hover:bg-red-900 shadow-md"
                   >
                       确定重开
                   </button>
                </div>
             </div>
          </div>
      )}

      {/* Successor Confirmation Modal */}
      {confirmSuccessor && (
          <div className="absolute inset-0 z-[80] bg-black/80 flex items-center justify-center animate-fade-in backdrop-blur-sm px-4">
             <div className="bg-[#fdfbf7] p-6 rounded border-4 border-double border-gray-800 shadow-2xl text-center w-full max-w-sm animate-scale-in">
                <h3 className="text-xl font-black text-gray-900 mb-4 font-serif">确认继承人</h3>
                <p className="text-gray-700 mb-6">
                    您选择 <span className="font-bold text-red-800">{confirmSuccessor.name}</span> 作为故事的延续者。<br/>
                    <span className="text-sm text-gray-500 block mt-2">一旦确定，新的历史篇章即将开启，无法悔棋。</span>
                </p>
                <div className="flex gap-4">
                   <button onClick={() => setConfirmSuccessor(null)} className="flex-1 py-3 border border-gray-400 text-gray-600 hover:bg-gray-100 font-bold">再想想</button>
                   <button 
                       onClick={() => { 
                           if (onInheritWorld) onInheritWorld(confirmSuccessor); 
                           setConfirmSuccessor(null); 
                       }} 
                       className="flex-1 py-3 bg-red-800 text-white font-bold hover:bg-red-900 shadow-md"
                   >
                       确定交接
                   </button>
                </div>
             </div>
          </div>
      )}

      {/* Reroll (Failure) Modal */}
      {showRerollModal && (
          <div className="absolute inset-0 z-[70] bg-black/60 flex items-center justify-center animate-fade-in backdrop-blur-sm px-4">
             <div className="bg-[#fdfbf7] p-6 rounded border-4 border-red-800 shadow-2xl text-center w-full max-w-sm animate-scale-in">
                <h3 className="text-xl font-black text-red-900 mb-4">检定失败</h3>
                <p className="text-gray-700 mb-6 font-serif text-sm md:text-base">
                  虽然结果不尽人意，但你仍有<span className="font-bold text-red-700 mx-1">★ {gameState.stats.redStars}</span>颗红星。<br/>
                  是否消耗一颗红星，重掷命运？<br/>
                  <span className="text-xs text-green-700 font-bold mt-1 block">(重掷将使本次难度降低 5 点)</span>
                </p>
                <div className="flex gap-4">
                   <button onClick={cancelReroll} className="flex-1 py-3 border border-gray-400 text-gray-600 hover:bg-gray-100 text-sm font-bold">接受命运</button>
                   <button onClick={confirmReroll} className="flex-1 py-3 bg-red-700 text-white font-bold hover:bg-red-800 shadow-md text-sm">消耗红星重掷</button>
                </div>
             </div>
          </div>
      )}

      {/* Write Testament Modal */}
      {isWritingTestament && (
          <div className="absolute inset-0 z-[80] bg-black/90 flex items-center justify-center animate-fade-in backdrop-blur-sm px-4">
             <div className="bg-[#f3f3f3] p-6 rounded border-4 border-gray-800 shadow-2xl text-center w-full max-w-md animate-scale-in relative">
                <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-4xl text-gray-400 drop-shadow-md grayscale">
                    📜
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-2 mt-4 tracking-widest font-serif border-b-2 border-gray-800 pb-2 inline-block">
                    立下遗嘱
                </h3>
                
                {!showTestamentCustomInput ? (
                    <>
                        <p className="text-gray-700 mb-4 font-serif text-sm leading-relaxed mt-2">
                            作为派系领袖，您可指定继承人延续事业。<br/>
                            <span className="text-xs text-gray-500 italic">请选择一位继承人，或消耗红星指定他人。</span>
                        </p>
                        
                        <div className="space-y-2 mb-4">
                            {(gameState.suggestedHeirs || []).map((heir, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => submitTestament(heir)}
                                    className="w-full py-3 bg-white border border-gray-400 hover:border-red-800 hover:bg-red-50 text-gray-800 font-bold shadow-sm transition-all text-sm flex items-center justify-center group"
                                >
                                    <span className="group-hover:text-red-800">{heir}</span>
                                </button>
                            ))}
                        </div>

                        <div className="border-t border-gray-300 pt-3">
                            <button 
                                onClick={() => {
                                    if (gameState.stats.redStars >= 3) {
                                        onConsumeRedStar();
                                        onConsumeRedStar();
                                        onConsumeRedStar();
                                        setInteractionStarsConsumed(prev => prev + 3);
                                        setShowTestamentCustomInput(true);
                                    }
                                }}
                                disabled={gameState.stats.redStars < 3}
                                className="w-full py-3 bg-gray-900 text-yellow-500 font-bold hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-sm border border-yellow-600/30"
                            >
                                自定义继承人 (消耗3★)
                                {gameState.stats.redStars < 3 && <span className="block text-[10px] font-normal text-gray-400">红星不足</span>}
                            </button>
                        </div>
                        
                        <button onClick={() => { setIsWritingTestament(false); setTestamentChoice(null); }} className="w-full mt-3 py-2 text-gray-500 text-sm hover:underline">
                            稍后再立
                        </button>
                    </>
                ) : (
                    <>
                        <p className="text-gray-700 mb-2 font-serif text-sm mt-2">
                            已消耗3颗红星。请输入您意属的继承人姓名：
                        </p>
                        <textarea
                            value={testamentText}
                            onChange={(e) => setTestamentText(e.target.value)}
                            placeholder="例如：我的忠实战友..."
                            className="w-full h-24 p-3 mb-4 bg-white border-2 border-gray-400 focus:border-gray-900 outline-none text-sm font-serif resize-none shadow-inner"
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button onClick={() => { setShowTestamentCustomInput(false); setInteractionStarsConsumed(0); }} className="flex-1 py-2 text-gray-600 text-sm border border-gray-300 hover:bg-gray-100">
                                返回
                            </button>
                            <button onClick={() => submitTestament()} disabled={!testamentText.trim()} className="flex-1 py-2 bg-gray-900 text-white font-bold hover:bg-black disabled:opacity-50 text-sm shadow-lg">
                                确定
                            </button>
                        </div>
                    </>
                )}
             </div>
          </div>
      )}

      {/* Critical Custom Action Modal */}
      {showCriticalCustomModal && (
          <div className="absolute inset-0 z-[70] bg-black/70 flex items-center justify-center animate-fade-in backdrop-blur-sm px-4">
             <div className="bg-[#fdfbf7] p-6 rounded border-4 border-yellow-500 shadow-2xl text-center w-full max-w-md animate-scale-in">
                <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-4xl text-yellow-400 drop-shadow-md">
                    {isLeaderManipulating ? "👑" : isPityAction ? "⚡" : "★"}
                </div>
                <h3 className="text-xl md:text-2xl font-black text-yellow-700 mb-2 mt-4 tracking-widest">
                    {isLeaderManipulating ? "最高指示" : isPityAction ? "厚积薄发" : "时代眷顾了你"}
                </h3>
                
                {!isInputtingCustom ? (
                    <>
                        <p className="text-gray-700 mb-6 font-serif leading-relaxed text-sm md:text-base">
                            {isLeaderManipulating ? (
                                <>
                                    作为最高领袖，你可以直接干预局势。<br/>
                                    你可以选择<span className="font-bold text-red-800">按计划行事</span>，或者<span className="font-bold text-red-800">自定义具体手段</span>。<br/>
                                    <span className="text-xs opacity-70">（消耗1权势点）</span>
                                </>
                            ) : isPityAction ? (
                                <>
                                    长久的隐忍磨砺了你的意志。<br/>
                                    你找到了一个绝佳的机会，可以<span className="font-bold text-red-800">免费自定义一次行动</span>。<br/>
                                    <span className="text-xs opacity-70">（不消耗红星）</span>
                                </>
                            ) : (
                                <>
                                    时代的大潮将你推上了浪尖！<br/>
                                    你可以按原计划完美执行，<br/>
                                    或者<span className="font-bold text-red-800">消耗1颗红星</span>来自定义你的传奇行动。
                                </>
                            )}
                        </p>
                        <div className="flex flex-col gap-3">
                           {!isPityAction && (
                               <button onClick={handleProceedCritical} className="w-full py-3 bg-gray-200 text-gray-800 font-bold hover:bg-gray-300 border border-gray-400 text-sm md:text-base">
                                   按原计划执行
                               </button>
                           )}
                           
                           <button 
                                onClick={handleStartCustomAction} 
                                disabled={!isLeaderManipulating && !isPityAction && gameState.stats.redStars < 1}
                                className="w-full py-3 bg-red-700 text-white font-bold hover:bg-red-800 shadow-md border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
                           >
                               {isLeaderManipulating ? "自定义指示" : isPityAction ? "开始行动" : "自定义行动 (消耗1★)"}
                               {!isLeaderManipulating && !isPityAction && gameState.stats.redStars < 1 && <span className="block text-[10px] font-normal">红星不足</span>}
                           </button>
                           
                           {isPityAction && (
                               <button onClick={() => {
                                   setIsInputtingCustom(false);
                                   if(isLeaderManipulating || isPityAction) {
                                       setShowCriticalCustomModal(false);
                                       setRollingChoice(null); 
                                       setIsPityAction(false);
                                       setIsLeaderManipulating(false);
                                   }
                               }} className="w-full py-2 text-gray-500 hover:text-gray-800 text-sm mt-1 transition-colors">
                                   取消
                               </button>
                           )}
                        </div>
                    </>
                ) : (
                    <>
                        <p className="text-gray-700 mb-4 font-serif text-sm">
                            {isLeaderManipulating 
                                ? "作为最高领袖，你可以直接干预局势。\n描述你希望增强的派系和具体手段。" 
                                : isPityAction
                                ? "机会稍纵即逝。\n描述你想采取的关键行动。"
                                : "这一刻将载入史册。\n你想做什么？(需要额外检定)"}
                        </p>
                        <textarea
                            value={customActionText}
                            onChange={(e) => setCustomActionText(e.target.value)}
                            placeholder={isLeaderManipulating ? "例如：大力支持造反派，号召..." : "描述你的惊人举动..."}
                            className="w-full h-24 p-2 mb-4 bg-[#f4f1de] border border-gray-400 focus:border-red-800 outline-none text-sm resize-none"
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button onClick={() => { 
                                setIsInputtingCustom(false); 
                                if(isLeaderManipulating || isPityAction) { 
                                    setShowCriticalCustomModal(false); 
                                    setRollingChoice(null);
                                    setIsPityAction(false);
                                    setIsLeaderManipulating(false);
                                } 
                            }} className="flex-1 py-2 text-gray-600 text-sm border border-gray-300">
                                {isLeaderManipulating || isPityAction ? "取消" : "返回"}
                            </button>
                            <button onClick={submitCustomAction} disabled={!customActionText.trim()} className="flex-1 py-2 bg-red-700 text-white font-bold disabled:opacity-50 text-sm">执行</button>
                        </div>
                    </>
                )}
             </div>
          </div>
      )}

      {rollingChoice && !showRerollModal && !showCriticalCustomModal && (
        <div className="absolute inset-0 z-50 bg-black/70 flex flex-col items-center justify-center pointer-events-auto animate-fade-in px-4">
          <div className="bg-[#f4f1de] p-6 md:p-8 border-4 border-double border-gray-800 rounded shadow-2xl flex flex-col items-center w-full max-w-sm relative animate-scale-in">
             <div className="absolute top-0 left-0 right-0 h-2 bg-red-800"></div>
             <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-2 tracking-widest">{rollAttrKey ? ATTRIBUTE_LABELS[rollAttrKey] : '属性'} 检定</h3>
             <div className="flex flex-col items-center text-sm text-gray-600 mb-6 gap-1">
                <div className="flex items-center gap-2">
                    <span>基础难度: {rollingChoice.difficulty}</span>
                    <span className="text-red-800 font-bold">- (属性 {rollAttrVal} × 2)</span>
                </div>
                <div className="flex items-center gap-2">
                    <span>= 目标阈值: <span className="font-bold text-red-700 text-lg">{calculatedThreshold}</span></span>
                    <span className="text-[10px] text-gray-400">(需 > {calculatedThreshold})</span>
                </div>
                {activeCritThreshold < 95 && (
                    <div className="flex items-center gap-1 text-green-700 mt-1 font-bold animate-pulse">
                        <span>⚡ 属性碾压：大成功范围扩大 ({activeCritThreshold}-100)</span>
                    </div>
                )}
             </div>
             <div className={`w-28 h-28 md:w-32 md:h-32 border-8 rounded-full flex items-center justify-center text-5xl md:text-6xl font-serif font-black bg-white shadow-inner mb-6 transition-colors duration-300 ${finalResult ? (finalResult.includes('SUCCESS') ? 'border-green-700 text-green-800' : 'border-red-800 text-red-800') : 'border-gray-800 text-gray-900'}`}>{rollValue}</div>
             {finalResult ? (
                <div className={`text-2xl md:text-3xl font-black tracking-[0.2em] animate-bounce-subtle ${getResultColor(finalResult)}`}>{getResultText(finalResult)}</div>
             ) : (
                <div className="text-sm text-gray-500 animate-pulse">命运回转中...</div>
             )}
          </div>
        </div>
      )}

      <div className={`bg-[#e6e2d3] border-b-4 shadow-md z-10 transition-all duration-500 ease-in-out shrink-0 ${isHeaderCollapsed ? 'p-2' : 'p-3 md:p-4'}`} style={{ borderColor: themeColor }}>
        {/* ... (Header content unchanged) ... */}
        <div className="flex justify-between items-start md:items-center">
          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
            <div className="flex items-center gap-2">
                <button onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)} className="text-gray-600 hover:text-red-800 transition-colors focus:outline-none p-1">
                {isHeaderCollapsed ? '▼' : '▲'}
                </button>
                <div className="flex items-baseline gap-2">
                    <h2 className="font-black tracking-widest transition-all duration-300 truncate max-w-[120px] md:max-w-none" style={{ fontSize: isHeaderCollapsed ? '1rem' : '1.25rem', color: themeColor }}>{safeString(gameState.name)}</h2>
                    <span className="text-[10px] bg-gray-800 text-white px-1 py-0.5 rounded-sm whitespace-nowrap">{safeString(gameState.background)}</span>
                </div>
            </div>
            {!isHeaderCollapsed && (
                <div className="text-[10px] md:text-xs text-gray-600 ml-6 md:ml-0 animate-fade-in">
                    {currentAge}岁 • {1976 - gameState.year > 0 ? `距结束 ${1976 - gameState.year} 年` : `后文革时代 (${gameState.year})`}
                </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 md:gap-4">
             <button onClick={onOpenFaction} className="group flex items-center gap-2 px-2 py-1 text-[#fdfbf7] border-2 border-yellow-600/50 rounded-sm shadow-sm transition-all hover:opacity-90" style={{ backgroundColor: themeColor }}>
                <div className="flex flex-col items-end leading-none">
                    <span className="text-[8px] text-yellow-500/80 font-bold uppercase tracking-wider hidden md:block">当前派系</span>
                    <span className="text-xs md:text-sm font-black text-white max-w-[80px] truncate">{safeString(displayFaction)}</span>
                </div>
                <div className="w-px h-6 bg-yellow-600/30 mx-1 hidden md:block"></div>
                 <div className="flex flex-col items-end leading-none">
                    <span className="text-[8px] text-yellow-500/80 font-bold uppercase tracking-wider hidden md:block">权势</span>
                    <span className="text-sm md:text-xl font-black text-yellow-400 leading-none">{gameState.stats.powerPoints}</span>
                </div>
             </button>

             <div className="flex items-center gap-1 bg-[#fdfbf7] border border-gray-300 px-2 py-1 rounded-sm shadow-sm" title="红星 (命运值)">
                 <span className="font-black text-sm md:text-lg" style={{ color: themeColor }}>★</span>
                 <span className="text-gray-900 font-black font-serif text-sm md:text-lg">{gameState.stats.redStars}</span>
             </div>

             <div className={`font-serif font-bold text-gray-900 transition-all duration-300 hidden sm:block ${isHeaderCollapsed ? 'text-lg' : 'text-2xl'}`}>{dateStr}</div>
             
             <div className="flex gap-1">
                <button onClick={onOpenSettings} className="bg-gray-300 hover:bg-gray-400 text-gray-700 p-1.5 rounded border border-gray-400 shadow-sm transition-colors text-xs" title="设置">⚙️</button>
                <button onClick={handleExportSave} className="bg-gray-300 hover:bg-gray-400 text-gray-700 p-1.5 rounded border border-gray-400 shadow-sm transition-colors text-xs" title="导出存档">📤</button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
                <button onClick={handleImportClick} className="bg-gray-300 hover:bg-gray-400 text-gray-700 p-1.5 rounded border border-gray-400 shadow-sm transition-colors text-xs" title="导入存档">📥</button>
                <button onClick={() => setShowRestartMenu(true)} className="bg-gray-300 hover:bg-gray-400 text-gray-700 p-1.5 rounded border border-gray-400 shadow-sm transition-colors text-xs" title="重新开始">↺</button>
             </div>
          </div>
        </div>
        
        {!isHeaderCollapsed && <div className="font-serif font-bold text-gray-900 text-lg sm:hidden mt-2 text-right">{dateStr}</div>}
        
        {!isHeaderCollapsed && (
          <div className="mt-3 md:mt-4 animate-slide-up">
            {traits.length > 0 && (
              <div className="mb-3 md:mb-4 relative">
                <div className={`flex flex-wrap gap-2 transition-all duration-300 ${isTraitsExpanded ? '' : 'max-h-[85px] overflow-hidden'}`}>
                    {traits.map(t => (
                      <div 
                        key={t.id} 
                        className="relative group shrink-0" 
                        onClick={(e) => handleTraitMouseEnter(e, t)} 
                        onMouseEnter={(e) => handleTraitMouseEnter(e, t)} 
                        onMouseLeave={handleTraitMouseLeave}
                      >
                        <div className={`text-[10px] md:text-xs px-2 py-1 border rounded shadow-sm cursor-help transition-transform hover:scale-105 ${getTraitColor(t.rarity)}`}>
                          <span className="font-bold">{safeString(t.name)}</span>
                          {t.duration && <span className="ml-1 text-[9px] opacity-70">({t.duration}月)</span>}
                        </div>
                      </div>
                    ))}
                </div>
                {traits.length > 8 && (
                     <button 
                        onClick={() => setIsTraitsExpanded(!isTraitsExpanded)}
                        className="text-[10px] text-gray-500 hover:text-red-800 underline mt-1 w-full text-center"
                     >
                        {isTraitsExpanded ? "收起特质" : `查看更多 (${traits.length - 8}...)`}
                     </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-y-2 gap-x-6 mb-3 md:mb-4">
              <StatBar label="政治面貌" value={gameState.stats.politicalStanding} color="bg-red-600" />
              <StatBar label="身体状况" value={gameState.stats.health} color="bg-green-700" />
              <StatBar label="精神意志" value={gameState.stats.mental} color="bg-blue-700" />
            </div>

            <div className="flex justify-between md:justify-start gap-2 md:gap-4 overflow-x-auto pb-1 pt-2 border-t border-gray-300 no-scrollbar">
               {Object.entries(ATTRIBUTE_LABELS).map(([key, label]) => (
                   <AttrBadge 
                        key={key}
                        label={label}
                        attrKey={key as keyof Attributes}
                        value={effectiveAttributes[key as keyof Attributes]} 
                        base={gameState.stats.attributes[key as keyof Attributes]} 
                        traits={gameState.stats.traits}
                        onHover={handleAttrHover}
                        onLeave={() => setActiveAttrTooltip(null)}
                    />
               ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 font-serif text-base md:text-lg leading-relaxed relative scroll-smooth" ref={scrollRef}>
        
        {gameState.historySummary.length > 0 && (
          <div className="mb-6 md:mb-8 border-l-2 border-dashed border-gray-300 pl-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xs md:text-sm font-bold text-gray-500 uppercase tracking-widest">{isTimelineExpanded ? "完整历史" : "近期事件"}</h4>
              <button onClick={() => setIsTimelineExpanded(!isTimelineExpanded)} className="text-xs hover:underline" style={{ color: themeColor }}>{isTimelineExpanded ? "收起" : `展开全部 (${gameState.historySummary.length})`}</button>
            </div>
            <div className={`space-y-3 transition-all ${isTimelineExpanded ? 'max-h-96 overflow-y-auto pr-2' : ''}`}>
               {displayedHistory.map((entry, i) => <TimelineItem key={`${entry.year}-${entry.month}-${i}`} entry={entry} />)}
            </div>
          </div>
        )}
        
        <div key={gameState.historySummary.length} className="prose prose-base md:prose-lg text-gray-900 max-w-none animate-fade-in whitespace-pre-line mb-8 min-h-[100px]">
           {gameState.isGameOver && (
              <div className="absolute top-1/4 right-5 md:right-10 w-24 h-24 md:w-32 md:h-32 border-4 border-red-700 rounded-full flex items-center justify-center text-red-700 font-black text-2xl md:text-4xl transform -rotate-12 opacity-40 stamp-texture pointer-events-none animate-scale-in">
                {gameState.stats.health <= 0 ? "死亡" : gameState.stats.politicalStanding <= 0 ? "清洗" : "结束"}
              </div>
           )}
           {safeGameScene}
        </div>
        
        {!gameState.isGameOver && !isLoading && (
          <div className="grid grid-cols-1 gap-3 md:gap-4 mt-6 md:mt-8 mb-4 border-t-2 border-dashed border-gray-400 pt-6 animate-slide-up pb-8 md:pb-0">
            {/* Standard Choices */}
            {normalChoices.map((choice, idx) => {
              const { effectiveThreshold, critThreshold } = getRollStats(choice);
              const normalizedKey = normalizeAttrKey(choice.requiredAttribute);
              
              return (
                <button
                  key={choice.id}
                  onClick={() => handleChoiceClick(choice)}
                  disabled={isLoading || rollingChoice !== null}
                  style={{ animationDelay: `${idx * 0.1}s`, borderColor: 'rgb(209 213 219)' }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = themeColor}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgb(209 213 219)'}
                  className="w-full text-left bg-[#fdfbf7] hover:bg-red-50 text-gray-900 font-bold py-3 px-4 md:py-4 md:px-6 border-2 shadow-md transform transition-all duration-200 hover:-translate-y-1 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden rounded-sm animate-slide-up"
                >
                  <div className="flex justify-between items-center relative z-10">
                    <div className="flex items-center flex-1">
                        <span className="mr-2 md:mr-3 text-lg md:text-xl transition-colors" style={{ color: themeColor }}>➤</span>
                        <span className="text-sm md:text-base leading-tight">{safeString(choice.text)}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                        <div className="flex items-center gap-1 md:gap-2 bg-gray-200 px-2 py-1 rounded text-[10px] md:text-xs text-gray-700 group-hover:bg-red-100 group-hover:text-red-800 transition-colors border border-gray-300">
                            {normalizedKey ? <span>🎲 {ATTRIBUTE_LABELS[normalizedKey]}</span> : <span>🎲 基础</span>}
                            <span className="font-bold text-red-700 hidden sm:inline">难度 {effectiveThreshold}</span>
                            <span className="font-bold text-red-700 sm:hidden">{effectiveThreshold}</span>
                        </div>
                        {critThreshold < 95 && (
                             <span className="text-[9px] text-green-700 font-bold bg-green-50 px-1 rounded border border-green-200 animate-pulse">
                                 大成功: {critThreshold}+
                             </span>
                        )}
                    </div>
                  </div>
                  <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIi8+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMwMDAiIG9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')]"></div>
                </button>
              );
            })}

            {/* Special Manipulate Choice */}
            {specialChoice && (
                <button
                  onClick={() => handleChoiceClick(specialChoice)}
                  disabled={isLoading || rollingChoice !== null}
                  className="w-full text-left bg-yellow-50 hover:bg-yellow-100 text-red-900 font-black py-3 px-4 md:py-4 md:px-6 border-2 border-yellow-600 shadow-lg transform transition-all duration-200 hover:-translate-y-1 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden rounded-sm animate-slide-up mt-2"
                >
                    <div className="flex justify-between items-center relative z-10">
                        <div className="flex items-center">
                            <span className="text-yellow-600 mr-2 md:mr-3 text-lg md:text-xl">⚖️</span>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-normal text-yellow-800 uppercase tracking-widest mb-0.5">{isSupremeLeader ? "最高指示" : "权势行动"}</span>
                                <span className="text-sm md:text-lg leading-tight">{safeString(specialChoice.text)}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 bg-yellow-200/50 px-2 py-1 rounded text-[10px] md:text-xs text-yellow-900 font-bold border border-yellow-400/50 shrink-0">
                             {isSupremeLeader ? (
                                 <span>👑 最高权限</span>
                             ) : (
                                 <span>🎲 {ATTRIBUTE_LABELS[normalizeAttrKey(specialChoice.requiredAttribute) || 'politics']}</span>
                             )}
                        </div>
                    </div>
                </button>
            )}

            {/* Testament Choice */}
            {testamentChoiceOption && (
                <button
                  onClick={() => handleChoiceClick(testamentChoiceOption)}
                  disabled={isLoading || rollingChoice !== null}
                  className="w-full text-left bg-gray-900 hover:bg-black text-gray-200 font-black py-3 px-4 md:py-4 md:px-6 border-2 border-gray-600 shadow-lg transform transition-all duration-200 hover:-translate-y-1 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden rounded-sm animate-slide-up mt-2"
                >
                    <div className="flex justify-between items-center relative z-10">
                        <div className="flex items-center">
                            <span className="text-gray-400 mr-2 md:mr-3 text-lg md:text-xl">📜</span>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-normal text-gray-400 uppercase tracking-widest mb-0.5">身后之事</span>
                                <span className="text-sm md:text-lg leading-tight">{safeString(testamentChoiceOption.text)}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-800 px-2 py-1 rounded text-[10px] md:text-xs text-gray-300 font-bold border border-gray-600 shrink-0">
                             <span>指定继承人</span>
                        </div>
                    </div>
                </button>
            )}

            {/* Pity Custom Choice (Free) */}
            {pityChoice && (
                <button
                  onClick={() => handleChoiceClick(pityChoice)}
                  disabled={isLoading || rollingChoice !== null}
                  className="w-full text-left bg-purple-50 hover:bg-purple-100 text-purple-900 font-black py-3 px-4 md:py-4 md:px-6 border-2 border-purple-600 shadow-lg transform transition-all duration-200 hover:-translate-y-1 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden rounded-sm animate-slide-up mt-2"
                >
                    <div className="flex justify-between items-center relative z-10">
                        <div className="flex items-center">
                            <span className="text-purple-600 mr-2 md:mr-3 text-lg md:text-xl">⚡</span>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-normal text-purple-800 uppercase tracking-widest mb-0.5">厚积薄发</span>
                                <span className="text-sm md:text-lg leading-tight">{safeString(pityChoice.text)}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 bg-purple-200/50 px-2 py-1 rounded text-[10px] md:text-xs text-purple-900 font-bold border border-purple-400/50 shrink-0">
                             <span>免费行动</span>
                        </div>
                    </div>
                </button>
            )}
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center my-8 py-8 border-t-2 border-dashed border-gray-300 animate-fade-in">
            <div className="animate-pulse flex flex-col items-center">
              <div className="h-1 w-24 mb-2" style={{ backgroundColor: themeColor }}></div>
              <span className="font-bold tracking-widest text-sm" style={{ color: themeColor }}>正在读取与修补历史...</span>
            </div>
          </div>
        )}

        {gameState.isGameOver && !confirmSuccessor && (
          <div className="text-center mt-8 p-6 bg-gray-800 text-gray-100 rounded shadow-inner animate-scale-in mb-8">
            <h3 className="text-lg md:text-xl mb-4 font-bold border-b border-gray-600 pb-4">{safeGameOverReason || "游戏结束"}</h3>
            
            {/* Show designated successor info if exists and game logic didn't auto-force (fallback) */}
            {gameState.designatedSuccessor && gameState.potentialSuccessors && gameState.potentialSuccessors.some(s => s.name === gameState.designatedSuccessor) && (
                 <div className="mb-2 text-yellow-400 font-bold text-sm">
                     已根据遗嘱指定继承人
                 </div>
            )}
            
            {gameState.potentialSuccessors && gameState.potentialSuccessors.length > 0 && onInheritWorld ? (
                <div className="mb-6 animate-slide-up">
                    <p className="text-sm text-gray-300 mb-3 uppercase tracking-wider font-bold">—— 薪火相传 / 阴谋延续 ——</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {gameState.potentialSuccessors.map((successor) => (
                            <button 
                                key={successor.id}
                                onClick={() => setConfirmSuccessor(successor)}
                                className={`bg-red-900/50 hover:bg-red-800 border border-red-700 p-3 rounded text-left transition-colors group ${successor.name === gameState.designatedSuccessor ? 'ring-2 ring-yellow-500' : ''}`}
                            >
                                <div className="font-bold text-yellow-500 mb-1 group-hover:text-yellow-300">
                                    {successor.name}
                                    {successor.name === gameState.designatedSuccessor && <span className="ml-2 text-[9px] bg-yellow-600 text-black px-1 rounded">遗嘱指定</span>}
                                </div>
                                <div className="text-xs text-gray-300 mb-1 opacity-80">{successor.background}</div>
                                <div className="text-[10px] text-gray-400 leading-tight">{successor.description}</div>
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}

            <div className="flex gap-4 justify-center">
              <button onClick={() => handleNewLifeClick()} className="text-white font-bold py-3 px-6 rounded shadow-lg tracking-widest uppercase transition-colors hover:opacity-90 text-sm md:text-base" style={{ backgroundColor: themeColor }}>重写历史</button>
              <button onClick={() => handleNewLifeClick()} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded shadow-lg tracking-widest uppercase transition-colors text-sm md:text-base">新的人生</button>
            </div>
          </div>
        )}
        <div className="h-4 md:h-8"></div>
      </div>
    </div>
  );
};

export default GameUI;
