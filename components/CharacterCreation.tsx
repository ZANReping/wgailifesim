import React, { useState } from 'react';
import { BackgroundType, Attributes, Trait, TraitRarity, TRAIT_SORT_ORDER, GameSettings } from '../types';
import { generateInitialTraits, generateBackstory, generateHistoricalProfile } from '../services/geminiService';

interface Props {
  onStart: (name: string, background: BackgroundType, attributes: Attributes, backstory: string, traits: Trait[], birthYear: number, foreignInfo?: { faction: string }) => void;
  isLoading: boolean;
  onOpenSettings: () => void;
  gameSettings: GameSettings;
}

const TOTAL_POINTS = 20;
const BASE_VALUE = 3;
const MAX_VALUE = 10;

// Local random name data for instant feedback
const SURNAMES = ['李', '王', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '林', '郭', '何', '高', '郑'];
const GIVEN_NAMES = ['卫红', '卫东', '国庆', '建国', '向阳', '红兵', '胜利', '解放', '援朝', '跃进', '东方', '红梅', '立功', '志强', '爱国', '秀英', '建设', '勇', '军', '平', '向东', '文革', '学军', '卫疆', '继红'];

// Safe render helper for local usage
const safeRender = (value: any): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
     return value.text || value.name || value.message || JSON.stringify(value);
  }
  return String(value);
};

const CharacterCreation: React.FC<Props> = ({ onStart, isLoading, onOpenSettings, gameSettings }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [background, setBackground] = useState<BackgroundType>(BackgroundType.ORDINARY);
  const [backstory, setBackstory] = useState('');
  const [generatedTraits, setGeneratedTraits] = useState<Trait[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [foreignFaction, setForeignFaction] = useState<string | undefined>(undefined);
  
  // Default birth year is 1948 (18 years old in 1966). Updated if historical.
  const [birthYear, setBirthYear] = useState<number>(1948);

  // Specific loading states
  const [isGeneratingTraits, setIsGeneratingTraits] = useState(false);
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  const [isVerifyingHistorical, setIsVerifyingHistorical] = useState(false);
  
  const [attributes, setAttributes] = useState<Attributes>({
    physique: BASE_VALUE,
    intelligence: BASE_VALUE,
    spirit: BASE_VALUE,
    agility: BASE_VALUE,
    charisma: BASE_VALUE,
    politics: BASE_VALUE,
  });

  const getPointsUsed = () => {
    return (Object.values(attributes) as number[]).reduce((sum, val) => sum + (val - BASE_VALUE), 0);
  };

  const remainingPoints = TOTAL_POINTS - getPointsUsed();

  const handleAttributeChange = (key: keyof Attributes, delta: number) => {
    const currentValue = attributes[key];
    const newValue = currentValue + delta;

    if (newValue < BASE_VALUE || newValue > MAX_VALUE) return;
    if (delta > 0 && remainingPoints <= 0) return;

    setAttributes(prev => ({ ...prev, [key]: newValue }));
  };

  const handleRandomizeAttributes = () => {
    const keys = Object.keys(attributes) as (keyof Attributes)[];
    const newAttrs = {
      physique: BASE_VALUE,
      intelligence: BASE_VALUE,
      spirit: BASE_VALUE,
      agility: BASE_VALUE,
      charisma: BASE_VALUE,
      politics: BASE_VALUE,
    };
    
    let points = TOTAL_POINTS;
    
    let safety = 0;
    while (points > 0 && safety < 1000) {
      safety++;
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      if (newAttrs[randomKey] < MAX_VALUE) {
        newAttrs[randomKey]++;
        points--;
      }
    }
    setAttributes(newAttrs);
  };

  const backgrounds = [
    {
      type: BackgroundType.RED_FIVE,
      desc: "出身革命军人、干部、工人、贫下中农。根正苗红，备受信任。",
      color: "border-red-600 bg-red-50 text-red-900",
      difficulty: "简单",
      diffColor: "bg-green-600"
    },
    {
      type: BackgroundType.ORDINARY,
      desc: "普通市民。试图在风暴中明哲保身，但往往身不由己。",
      color: "border-amber-700 bg-amber-50 text-amber-900",
      difficulty: "普通",
      diffColor: "bg-blue-600"
    },
    {
      type: BackgroundType.INTELLECTUAL,
      desc: "教师、学者、技术人员。在反智的浪潮中战战兢兢。",
      color: "border-indigo-800 bg-indigo-50 text-indigo-900",
      difficulty: "较难",
      diffColor: "bg-orange-600"
    },
    {
      type: BackgroundType.BLACK_FIVE,
      desc: "出身地主、富农、反革命、坏分子、右派。生而带有原罪。",
      color: "border-gray-800 bg-gray-900 text-gray-100",
      difficulty: "困难",
      diffColor: "bg-red-800"
    },
    {
      type: BackgroundType.HISTORICAL,
      desc: "历史真实人物。无论当时是支持者还是受害者，重走他/她的人生路。",
      color: "border-yellow-700 bg-yellow-50 text-yellow-900 ring-2 ring-yellow-400",
      difficulty: "特殊",
      diffColor: "bg-purple-700"
    }
  ];

  const handleNextStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (background === BackgroundType.HISTORICAL) {
       await handleVerifyHistoricalFigure();
    } else {
       setBirthYear(1948); // Reset to default 18 years old for custom chars
       setForeignFaction(undefined);
       setStep(prev => prev + 1);
       setErrorMsg(null);
    }
  };

  const handleVerifyHistoricalFigure = async () => {
    if (isVerifyingHistorical) return;
    setIsVerifyingHistorical(true);
    setErrorMsg(null);

    try {
      const result = await generateHistoricalProfile(name, gameSettings.historyStyle);
      if (result.valid && result.data) {
        
        // Sanitize attributes to prevent game breaking stats
        let fixedAttrs = result.data.attributes;
        const totalPoints = Object.values(fixedAttrs).reduce((sum, val) => sum + val, 0);
        
        // If total points exceed 45 (allow some legendary bonus), scale them down to ~40
        if (totalPoints > 45) {
            const scale = 40 / totalPoints;
            const scaledAttrs = { ...fixedAttrs };
            (Object.keys(scaledAttrs) as Array<keyof Attributes>).forEach(k => {
                scaledAttrs[k] = Math.max(3, Math.round(fixedAttrs[k] * scale));
            });
            fixedAttrs = scaledAttrs;
        }
        
        // Hard clamp single values to 10
        (Object.keys(fixedAttrs) as Array<keyof Attributes>).forEach(k => {
             fixedAttrs[k] = Math.min(10, Math.max(3, fixedAttrs[k]));
        });

        // Auto-fill everything and jump to Step 4
        setAttributes(fixedAttrs);
        setBackstory(result.data.backstory);
        setGeneratedTraits(result.data.traits);
        setBirthYear(result.data.birthYear);
        
        if (result.data.foreignInfo?.isForeign) {
            setForeignFaction(result.data.foreignInfo.foreignFaction);
        } else {
            setForeignFaction(undefined);
        }

        setStep(4);
      } else {
        setErrorMsg(result.reason || "该人物未在文革历史中找到显著记录，或系统无法确认。请重试或更换人物。");
        setName(""); // Clear invalid name
      }
    } catch (e) {
      setErrorMsg("历史数据库连接失败，请稍后重试。");
    } finally {
      setIsVerifyingHistorical(false);
    }
  };

  // Local random name generation for instant feedback
  const handleRandomName = (e: React.MouseEvent) => {
    e.preventDefault();
    const s = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
    const g = GIVEN_NAMES[Math.floor(Math.random() * GIVEN_NAMES.length)];
    setName(s + g);
  };

  // New: AI Generate Backstory with Context
  const handleGenerateBackstory = async () => {
    if (isGeneratingProfile) return;
    setErrorMsg(null);
    setIsGeneratingProfile(true);
    try {
      const story = await generateBackstory(name, background, attributes, gameSettings.historyStyle);
      setBackstory(story);
    } catch(e) {
      setErrorMsg("历史迷雾重重（生成超时），请重试。");
    } finally {
      setIsGeneratingProfile(false);
    }
  };

  const handleBackstorySubmit = async () => {
    if (!backstory.trim()) return;
    setErrorMsg(null);
    setIsGeneratingTraits(true);
    try {
      const traits = await generateInitialTraits(name, background, attributes, backstory, gameSettings.historyStyle);
      setGeneratedTraits(traits);
      setStep(4);
    } catch (e) {
      setErrorMsg("档案审阅超时（生成失败），请重试。");
    } finally {
      setIsGeneratingTraits(false);
    }
  };

  const handleFinalSubmit = () => {
    onStart(name, background, attributes, backstory, generatedTraits, birthYear, foreignFaction ? { faction: foreignFaction } : undefined);
  };

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

  const sortedTraits = [...generatedTraits].sort((a, b) => {
    return (TRAIT_SORT_ORDER[a.rarity] ?? 99) - (TRAIT_SORT_ORDER[b.rarity] ?? 99);
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-2 md:p-4 old-paper">
      <div className="w-full max-w-3xl bg-[#fdfbf7] shadow-2xl border-4 border-double border-red-900 p-4 md:p-8 relative min-h-[500px] flex flex-col transition-all duration-500 animate-scale-in">
        <button
           onClick={onOpenSettings}
           className="absolute top-1 right-1 md:top-2 md:right-2 text-gray-500 hover:text-red-800 transition-colors p-2 z-20"
           title="设置"
        >
           ⚙️
        </button>

        <div className="absolute -top-4 md:-top-6 left-1/2 transform -translate-x-1/2 bg-red-700 text-[#fdfbf7] px-4 md:px-8 py-1 md:py-2 font-black text-lg md:text-2xl tracking-[0.2em] md:tracking-[0.5em] shadow-lg whitespace-nowrap z-10">
          {step === 1 && "出身成分"}
          {step === 2 && "个人档案"}
          {step === 3 && "生平经历"}
          {step === 4 && "命运特质"}
        </div>
        
        <div className="mt-8 mb-4 md:mb-6 text-center animate-scale-in">
            <h1 className="text-4xl md:text-6xl font-black font-serif tracking-widest text-[#881337] relative z-10 leading-tight"
                style={{
                    textShadow: "1px 1px 0 #f59e0b, 2px 2px 0 #f59e0b, 4px 4px 0 #1f2937, 6px 6px 2px rgba(0,0,0,0.4)",
                    WebkitTextStroke: "1px #450a0a"
                }}
            >
                革命风暴
                <span className="inline-block md:block text-2xl md:text-5xl mt-1 md:mt-2 text-[#991b1b]" 
                      style={{ textShadow: "1px 1px 0 #f59e0b, 3px 3px 0 #1f2937" }}>
                   ：1966
                </span>
            </h1>
        </div>

        {/* ... Steps 1, 2, 3 ... */}
        {step === 1 && (
          <form onSubmit={handleNextStep} className="space-y-4 md:space-y-6 flex-1 flex flex-col animate-slide-up">
            <div>
              <label className="block text-base md:text-lg font-bold text-gray-800 mb-1 md:mb-2">
                {background === BackgroundType.HISTORICAL ? "历史人物姓名" : "革命姓名"}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  maxLength={10}
                  placeholder={background === BackgroundType.HISTORICAL ? "真实人物姓名" : "输入名字（如：卫东）"}
                  className="flex-1 bg-transparent border-b-2 border-gray-400 focus:border-red-600 outline-none py-2 text-xl md:text-2xl text-center font-serif transition-colors placeholder:text-gray-400 text-gray-900"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {background !== BackgroundType.HISTORICAL && (
                  <button
                     type="button"
                     onClick={handleRandomName}
                     className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold px-3 py-2 rounded shadow-sm text-sm border border-gray-400 whitespace-nowrap transition-colors"
                  >
                    🎲 随机
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 overflow-y-auto max-h-[40vh] md:max-h-none pr-1">
              {backgrounds.map((bg) => (
                <div
                  key={bg.type}
                  onClick={() => setBackground(bg.type)}
                  className={`cursor-pointer p-3 md:p-4 border-2 transition-all duration-300 relative rounded-sm ${
                    background === bg.type 
                      ? `${bg.color} scale-[1.02] shadow-md` 
                      : "border-gray-300 hover:border-gray-500 opacity-70 grayscale"
                  }`}
                >
                  <div className={`absolute top-0 right-0 px-2 py-0.5 text-[10px] text-white font-bold ${bg.diffColor}`}>
                    {bg.difficulty}
                  </div>
                  {background === bg.type && (
                    <div className="absolute top-6 right-2 text-red-600 text-xl animate-bounce-subtle">★</div>
                  )}
                  <h3 className="font-bold text-base md:text-lg mb-1 mt-1">{bg.type}</h3>
                  <p className="text-xs opacity-90 leading-relaxed">{bg.desc}</p>
                </div>
              ))}
            </div>

            {errorMsg && (
                <div className="text-center text-red-700 font-bold animate-pulse text-xs md:text-sm">
                  ⚠️ {errorMsg}
                </div>
            )}

            <div className="flex-1 min-h-[10px]"></div>
            <button
              type="submit"
              disabled={!name.trim() || isVerifyingHistorical}
              className="w-full bg-red-800 hover:bg-red-900 text-[#fdfbf7] text-lg md:text-xl font-bold py-3 md:py-3 shadow-lg border-2 border-red-950 transition-transform active:scale-95 disabled:opacity-50"
            >
              {isVerifyingHistorical 
                ? "正在核对历史档案..." 
                : background === BackgroundType.HISTORICAL 
                  ? "验证并生成历史档案" 
                  : "下一步：建立档案"
              }
            </button>
          </form>
        )}

        {/* STEP 2: Attributes */}
        {step === 2 && (
          <div className="flex-1 flex flex-col space-y-4 md:space-y-6 animate-slide-up">
            <div className="text-center relative">
              <p className="mb-2 text-gray-700 text-sm md:text-base">请分配你的基础属性点</p>
              <div className="text-3xl md:text-4xl font-black text-red-800 mb-1">{remainingPoints}</div>
              <div className="text-xs md:text-sm text-gray-500">剩余点数</div>
              
              <button
                onClick={handleRandomizeAttributes}
                className="absolute top-0 right-0 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs px-2 py-1 rounded shadow border border-gray-400 transition-colors"
              >
                🎲 随机分配
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 overflow-y-auto max-h-[50vh] md:max-h-none pr-1">
              {[
                { k: 'physique', label: '体格', desc: '影响健康、抗击打能力' },
                { k: 'intelligence', label: '智力', desc: '影响学习、思考' },
                { k: 'spirit', label: '精神', desc: '影响意志力、抗压' },
                { k: 'agility', label: '身手', desc: '影响逃跑、躲避' },
                { k: 'charisma', label: '魅力', desc: '影响煽动群众' },
                { k: 'politics', label: '政治', desc: '影响政治敏感度' },
              ].map(({ k, label, desc }) => (
                <div key={k} className="bg-[#f4f1de] p-2 md:p-3 border border-gray-400 rounded relative shadow-sm">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-base md:text-lg text-gray-800">{label}</span>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleAttributeChange(k as keyof Attributes, -1)}
                        className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gray-300 text-gray-800 font-bold hover:bg-gray-400 disabled:opacity-30 transition-colors flex items-center justify-center"
                        disabled={attributes[k as keyof Attributes] <= BASE_VALUE}
                      >-</button>
                      <span className="w-5 md:w-6 text-center font-bold text-lg md:text-xl">{attributes[k as keyof Attributes]}</span>
                      <button 
                         onClick={() => handleAttributeChange(k as keyof Attributes, 1)}
                         className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-red-700 text-white font-bold hover:bg-red-800 disabled:opacity-30 transition-colors flex items-center justify-center"
                         disabled={attributes[k as keyof Attributes] >= MAX_VALUE || remainingPoints <= 0}
                      >+</button>
                    </div>
                  </div>
                  <p className="text-[10px] md:text-xs text-gray-500">{desc}</p>
                </div>
              ))}
            </div>

            <div className="flex-1 min-h-[10px]"></div>
            <div className="flex gap-3 md:gap-4">
               <button onClick={() => setStep(1)} className="w-1/3 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 shadow-lg border-2 border-gray-800 transition-transform active:scale-95 text-sm md:text-base">
                返回
              </button>
              <button onClick={() => remainingPoints === 0 && setStep(3)} disabled={remainingPoints !== 0} className="w-2/3 bg-red-700 hover:bg-red-800 text-[#fdfbf7] text-lg md:text-xl font-bold py-3 shadow-lg disabled:opacity-50 border-2 border-red-900 transition-transform active:scale-95">
                下一步
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Backstory */}
        {step === 3 && (
           <div className="flex-1 flex flex-col space-y-4 md:space-y-6 animate-slide-up">
              <div className="text-center">
                 <p className="mb-2 text-gray-700 font-bold text-sm md:text-base">简述你的前18年人生经历</p>
                 <p className="text-xs text-gray-500 mb-2">系统将根据你的经历生成3个【特质】</p>
              </div>
              
              <div className="relative flex-1">
                <textarea 
                  className="w-full h-48 md:h-64 bg-[#f4f1de] border-2 border-gray-400 p-3 md:p-4 font-serif text-base md:text-lg focus:border-red-800 outline-none resize-none shadow-inner transition-colors rounded-sm"
                  placeholder="例如：我从小体弱多病，但喜欢看书。父亲是因伤退伍的军人，对我要求很严..."
                  value={backstory}
                  onChange={(e) => setBackstory(e.target.value)}
                  maxLength={200}
                />
                <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                    <button
                        onClick={handleGenerateBackstory}
                        disabled={isGeneratingProfile}
                        className="bg-gray-200/90 hover:bg-gray-300 text-gray-700 text-xs font-bold px-3 py-1.5 rounded shadow border border-gray-400 transition-colors backdrop-blur-sm"
                    >
                    {isGeneratingProfile ? "生成中..." : "✨ AI 生成经历"}
                    </button>
                    <div className="text-xs text-gray-500 bg-[#f4f1de]/80 px-1 rounded">{backstory.length}/200</div>
                </div>
              </div>

              {errorMsg && (
                <div className="text-center text-red-700 font-bold animate-pulse text-xs md:text-sm">
                  ⚠️ {errorMsg}
                </div>
              )}

              <div className="flex gap-3 md:gap-4 mt-auto">
                 <button onClick={() => setStep(2)} className="w-1/3 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 shadow-lg border-2 border-gray-800 transition-transform active:scale-95 text-sm md:text-base">
                  返回
                </button>
                <button 
                  onClick={handleBackstorySubmit} 
                  disabled={!backstory.trim() || isGeneratingTraits}
                  className="w-2/3 bg-red-700 hover:bg-red-800 text-[#fdfbf7] text-lg md:text-xl font-bold py-3 shadow-lg disabled:opacity-50 border-2 border-red-900 flex justify-center items-center transition-transform active:scale-95"
                >
                  {isGeneratingTraits ? (
                    <span className="animate-pulse">正在审阅档案...</span>
                  ) : "生成特质"}
                </button>
              </div>
           </div>
        )}

        {/* STEP 4: Reveal Traits */}
        {step === 4 && (
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
                       <h3 className="font-bold text-base md:text-lg">{safeRender(trait.name)}</h3>
                       <span className="text-[10px] px-2 py-0.5 bg-black/10 rounded uppercase font-bold tracking-wider">{trait.rarity}</span>
                    </div>
                    <p className="text-xs md:text-sm opacity-90">{safeRender(trait.description)}</p>
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
                <button onClick={() => setStep(1)} className="w-full mb-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 shadow-sm border border-gray-800 text-sm">
                   重选人物
                </button>
             )}

             <button
               onClick={handleFinalSubmit}
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
        )}
        
      </div>
    </div>
  );
};

export default CharacterCreation;