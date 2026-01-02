
import React, { useState, useRef } from 'react';
import { BackgroundType, Attributes, Trait, GameSettings } from '../types';
import { generateInitialTraits, generateBackstory, generateHistoricalProfile, generateTimeTravelerProfile } from '../services/geminiService';
import { StepBackground } from './creation/StepBackground';
import { StepAttributes } from './creation/StepAttributes';
import { StepBackstory } from './creation/StepBackstory';
import { StepTraits } from './creation/StepTraits';
import { StepTimeTraveler } from './creation/StepTimeTraveler';

interface Props {
  onStart: (name: string, background: BackgroundType, attributes: Attributes, backstory: string, traits: Trait[], birthYear: number, foreignInfo?: { faction: string }) => void;
  isLoading: boolean;
  onOpenSettings: () => void;
  gameSettings: GameSettings;
  onLoadSave: (file: File) => void;
}

const TOTAL_POINTS = 20;
const BASE_VALUE = 3;
const MAX_VALUE = 10;

const CharacterCreation: React.FC<Props> = ({ onStart, isLoading, onOpenSettings, gameSettings, onLoadSave }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [background, setBackground] = useState<BackgroundType>(BackgroundType.ORDINARY);
  const [backstory, setBackstory] = useState('');
  const [generatedTraits, setGeneratedTraits] = useState<Trait[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  // Reset function to clear cached character data
  const resetCharacterData = () => {
      setAttributes({
        physique: BASE_VALUE,
        intelligence: BASE_VALUE,
        spirit: BASE_VALUE,
        agility: BASE_VALUE,
        charisma: BASE_VALUE,
        politics: BASE_VALUE,
      });
      setBackstory('');
      setGeneratedTraits([]);
      setForeignFaction(undefined);
      setBirthYear(1948);
  };

  const handleNextStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (background === BackgroundType.HISTORICAL) {
       await handleVerifyHistoricalFigure();
    } else if (background === BackgroundType.TIME_TRAVELER) {
       // Just go to next step (StepTimeTraveler)
       resetCharacterData();
       setStep(1.5);
       setErrorMsg(null);
    } else {
       // Normal flow
       resetCharacterData(); 
       setStep(prev => prev + 1);
       setErrorMsg(null);
    }
  };

  const handleVerifyHistoricalFigure = async () => {
    if (isVerifyingHistorical) return;
    setIsVerifyingHistorical(true);
    setErrorMsg(null);
    resetCharacterData();

    try {
      const result = await generateHistoricalProfile(name, gameSettings.historyStyle);
      if (result.valid && result.data) {
        let fixedAttrs = result.data.attributes;
        const totalPoints = Object.values(fixedAttrs).reduce((sum, val) => sum + val, 0);
        if (totalPoints > 45) {
            const scale = 40 / totalPoints;
            const scaledAttrs = { ...fixedAttrs };
            (Object.keys(scaledAttrs) as Array<keyof Attributes>).forEach(k => {
                scaledAttrs[k] = Math.max(3, Math.round(fixedAttrs[k] * scale));
            });
            fixedAttrs = scaledAttrs;
        }
        (Object.keys(fixedAttrs) as Array<keyof Attributes>).forEach(k => {
             fixedAttrs[k] = Math.min(10, Math.max(3, fixedAttrs[k]));
        });

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
        setName(""); 
      }
    } catch (e) {
      setErrorMsg("历史数据库连接失败，请稍后重试。");
    } finally {
      setIsVerifyingHistorical(false);
    }
  };

  // --- TIME TRAVELER LOGIC ---
  const handleGenerateTimeTraveler = async (travelerName: string, tag: string, age: number, location: string) => {
      if (isVerifyingHistorical) return;
      setIsVerifyingHistorical(true); // Reuse this loading state
      setErrorMsg(null);
      setName(travelerName); // Update main name if changed in sub-step

      try {
          const result = await generateTimeTravelerProfile(travelerName, tag, age, location, gameSettings.historyStyle);
          
          if (result.valid && result.data) {
              setAttributes(result.data.attributes);
              setBackstory(result.data.backstory);
              setGeneratedTraits(result.data.traits);
              setBirthYear(1966 - age); // Set birth year based on arrival age
              setStep(4);
          } else {
              setErrorMsg(result.reason || "时空穿梭失败：目标人物判定无效。");
          }
      } catch (e) {
          setErrorMsg("时空隧道塌陷（连接超时），请重试。");
      } finally {
          setIsVerifyingHistorical(false);
      }
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
  
  const handleReselect = () => {
      // Explicitly clear all cached data when returning to start
      resetCharacterData();
      setStep(1);
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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-2 md:p-4 old-paper">
      <div className="w-full max-w-3xl bg-[#fdfbf7] shadow-2xl border-4 border-double border-red-900 p-4 md:p-8 relative min-h-[500px] flex flex-col transition-all duration-500 animate-scale-in">
        
        <div className="absolute top-1 right-1 md:top-2 md:right-2 z-20 flex gap-2">
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
            <button
               onClick={handleImportClick}
               className="text-gray-500 hover:text-red-800 transition-colors p-2"
               title="导入存档"
            >
               📥
            </button>
            <button
               onClick={onOpenSettings}
               className="text-gray-500 hover:text-red-800 transition-colors p-2"
               title="设置"
            >
               ⚙️
            </button>
        </div>

        <div className="absolute -top-4 md:-top-6 left-1/2 transform -translate-x-1/2 bg-red-700 text-[#fdfbf7] px-4 md:px-8 py-1 md:py-2 font-black text-lg md:text-2xl tracking-[0.2em] md:tracking-[0.5em] shadow-lg whitespace-nowrap z-10">
          {step === 1 && "出身成分"}
          {step === 1.5 && "时空定位"}
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

        {step === 1 && (
          <StepBackground 
            name={name}
            setName={setName}
            background={background}
            setBackground={setBackground}
            onSubmit={handleNextStep}
            isVerifying={isVerifyingHistorical}
            errorMsg={errorMsg}
          />
        )}

        {step === 1.5 && (
            <StepTimeTraveler 
                initialName={name}
                onGenerate={handleGenerateTimeTraveler}
                onBack={() => setStep(1)}
                isGenerating={isVerifyingHistorical}
                errorMsg={errorMsg}
            />
        )}

        {step === 2 && (
          <StepAttributes 
            attributes={attributes}
            onAttributeChange={handleAttributeChange}
            onRandomize={handleRandomizeAttributes}
            remainingPoints={remainingPoints}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
            baseValue={BASE_VALUE}
            maxValue={MAX_VALUE}
          />
        )}

        {step === 3 && (
           <StepBackstory 
             backstory={backstory}
             setBackstory={setBackstory}
             isGeneratingProfile={isGeneratingProfile}
             isGeneratingTraits={isGeneratingTraits}
             errorMsg={errorMsg}
             onGenerate={handleGenerateBackstory}
             onSubmit={handleBackstorySubmit}
             onBack={() => setStep(2)}
           />
        )}

        {step === 4 && (
          <StepTraits 
            traits={generatedTraits}
            name={name}
            background={background}
            birthYear={birthYear}
            foreignFaction={foreignFaction}
            isLoading={isLoading}
            onStart={handleFinalSubmit}
            onReselect={handleReselect}
          />
        )}
        
      </div>
    </div>
  );
};

export default CharacterCreation;
