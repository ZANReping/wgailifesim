import React, { useState, useEffect, useMemo } from 'react';
import CharacterCreation from './components/CharacterCreation';
import GameUI from './components/GameUI';
import { SettingsModal } from './components/SettingsModal';
import { FactionModal } from './components/FactionModal';
import { startGame, makeTurn, updateGeminiConfig, generateInitialTraits } from './services/geminiService';
import { GameState, BackgroundType, PlayerStats, Choice, Attributes, RollResult, Trait, AppSettings, HistoryEntry, TraitChangeLog, ProviderConfig, GameSettings, HistoryStyle, PotentialSuccessor } from './types';

// Initial dynamic stats based on background
const BASE_DYNAMIC_STATS: Record<BackgroundType, Omit<PlayerStats, 'attributes' | 'traits' | 'birthYear'>> = {
  [BackgroundType.RED_FIVE]: {
    politicalStanding: 85,
    health: 90,
    mental: 80,
    redStars: 3,
    powerPoints: 0,
    currentFaction: "保皇派",
    isLeader: false,
    inventory: ['红宝书', '军用水壶']
  },
  [BackgroundType.BLACK_FIVE]: {
    politicalStanding: 20,
    health: 80,
    mental: 60,
    redStars: 3,
    powerPoints: 0,
    currentFaction: "无",
    isLeader: false,
    inventory: ['藏起来的家书']
  },
  [BackgroundType.INTELLECTUAL]: {
    politicalStanding: 50,
    health: 70,
    mental: 75,
    redStars: 3,
    powerPoints: 0,
    currentFaction: "逍遥派",
    isLeader: false,
    inventory: ['钢笔', '眼镜']
  },
  [BackgroundType.ORDINARY]: {
    politicalStanding: 60,
    health: 85,
    mental: 70,
    redStars: 3,
    powerPoints: 0,
    currentFaction: "逍遥派",
    isLeader: false,
    inventory: ['粮票']
  },
  [BackgroundType.HISTORICAL]: {
    politicalStanding: 50,
    health: 80,
    mental: 80,
    redStars: 3,
    powerPoints: 0, 
    currentFaction: "未知",
    isLeader: false,
    inventory: ['历史档案']
  }
};

const TIMEOUT_MS = 90000; // Increased to 90s to allow for API Retries

interface InitialConfig {
  name: string;
  background: BackgroundType;
  attributes: Attributes;
  backstory: string;
  traits: Trait[];
  birthYear: number;
  foreignInfo?: { faction: string }; // Added to support proper restarts for foreign leaders
}

const DEFAULT_PROVIDER_CONFIG: ProviderConfig = { apiKey: '', baseUrl: '', modelName: '' };
const DEFAULT_GAME_SETTINGS: GameSettings = { monthsPerTurn: 1, baseLuck: 1.0, historyStyle: HistoryStyle.REALISM };
const DEFAULT_SETTINGS: AppSettings = {
  apiType: 'gemini',
  gemini: { ...DEFAULT_PROVIDER_CONFIG },
  openai: { ...DEFAULT_PROVIDER_CONFIG },
  gameSettings: { ...DEFAULT_GAME_SETTINGS }
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentScene, setCurrentScene] = useState<string>("");
  const [choices, setChoices] = useState<Choice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  
  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Faction Modal State
  const [isFactionModalOpen, setIsFactionModalOpen] = useState(false);

  // Supreme Leader Custom Action State (for Faction Modal trigger)
  const [isLeaderManipulateModalOpen, setIsLeaderManipulateModalOpen] = useState(false);
  const [leaderManipulateText, setLeaderManipulateText] = useState("");

  // Store initial configuration for restarting with the same character
  const [initialConfig, setInitialConfig] = useState<InitialConfig | null>(null);

  const [lastAction, setLastAction] = useState<{
    type: 'START' | 'TURN';
    params: any;
  } | null>(null);

  // Load settings on mount
  useEffect(() => {
    const saved = localStorage.getItem('gemini_rpg_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // ... (Migration logic same as before) ...
        let settings: AppSettings = {
             apiType: parsed.apiType || 'gemini',
             gemini: { ...DEFAULT_PROVIDER_CONFIG, ...parsed.gemini },
             openai: { ...DEFAULT_PROVIDER_CONFIG, ...parsed.openai },
             gameSettings: { ...DEFAULT_GAME_SETTINGS, ...parsed.gameSettings }
        };
        // Ensure default historyStyle if missing from saved settings
        if (!settings.gameSettings.historyStyle) {
            settings.gameSettings.historyStyle = HistoryStyle.REALISM;
        }
        setAppSettings(settings);
        const active = settings.apiType === 'openai' ? settings.openai : settings.gemini;
        updateGeminiConfig(active.apiKey, active.baseUrl, active.modelName, settings.apiType);
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    }
  }, []);

  const handleSaveSettings = (settings: AppSettings) => {
    setAppSettings(settings);
    localStorage.setItem('gemini_rpg_settings', JSON.stringify(settings));
    const active = settings.apiType === 'openai' ? settings.openai : settings.gemini;
    updateGeminiConfig(active.apiKey, active.baseUrl, active.modelName, settings.apiType);
  };

  const calculateEffectiveAttributes = (base: Attributes, traits: Trait[]): Attributes => {
    const effective = { ...base };
    traits.forEach(t => {
      if (t.modifiers) {
        Object.entries(t.modifiers).forEach(([k, v]) => {
          const key = k as keyof Attributes;
          effective[key] = (effective[key] || 0) + (v as number);
        });
      }
    });
    return effective;
  };

  const withTimeout = <T,>(promise: Promise<T>): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), TIMEOUT_MS)
      )
    ]);
  };

  const handleStartGame = async (name: string, background: BackgroundType, attributes: Attributes, backstory: string, traits: Trait[], birthYear: number, foreignInfo?: { faction: string }) => {
    setIsLoading(true);
    setIsError(false);
    // Include foreignInfo in initialConfig so restarts preserve the correct Foreign Leader status
    setInitialConfig({ name, background, attributes, backstory, traits, birthYear, foreignInfo });
    setLastAction({ type: 'START', params: { name, background, attributes, backstory, traits, birthYear, foreignInfo } });

    try {
      const response = await withTimeout(startGame(name, background, attributes, traits, backstory, birthYear, appSettings.gameSettings));
      
      const initialStats: PlayerStats = {
        ...BASE_DYNAMIC_STATS[background],
        birthYear: birthYear,
        attributes: attributes, // Store base attributes
        traits: traits
      };

      // Apply initial faction if returned, else default
      let factions = [];
      if (response.factionsUpdate && Array.isArray(response.factionsUpdate)) {
          factions = response.factionsUpdate;
      }
      
      // Determine initial Power Points
      const supremeLeaderName = response.supremeLeaderUpdate?.name || "毛泽东";
      const isSupremeLeader = (name === supremeLeaderName);

      if (foreignInfo && foreignInfo.faction) {
          // Foreign leader logic
          initialStats.currentFaction = foreignInfo.faction;
          initialStats.isLeader = true;
          initialStats.powerPoints = 0; // Strict Rule: Foreign leaders start with 0
          initialStats.redStars = 3;    // Strict Rule: Everyone except Supreme Leader has 3 (even if previously 5)
      } else {
          // Domestic logic
          if (response.playerFactionUpdate) {
              initialStats.currentFaction = response.playerFactionUpdate.factionName;
              initialStats.isLeader = response.playerFactionUpdate.isLeader;
          }

          if (isSupremeLeader) {
              initialStats.powerPoints = 3; // Supreme Leader gets 3 Power Points
              initialStats.isLeader = true;
              initialStats.redStars = 3;    // Standard Red Stars
          } else {
              initialStats.powerPoints = 0; // Everyone else gets 0
              initialStats.redStars = 3;    // Everyone else gets 3
          }
      }

      const initialState: GameState = {
        name,
        background,
        year: response.year,
        month: response.month,
        stats: initialStats,
        factions: factions,
        supremeLeader: supremeLeaderName,
        supremeLeaderSlogan: response.supremeLeaderUpdate?.slogan || "大海航行靠舵手",
        rulingPartySymbol: response.supremeLeaderUpdate?.symbol || "☭",
        historySummary: [],
        isGameOver: false,
        backstory
      };

      setGameState(initialState);
      updateGameStateFromResponse(response, initialState, null);
      
    } catch (error) {
      console.error(error);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInheritGame = async (successor: PotentialSuccessor) => {
      if (!gameState) return;
      setIsLoading(true);
      setIsError(false);

      // 1. Generate standard attributes/traits for the successor
      // For simplicity, we assign average attributes and generate traits based on description
      const defaultAttributes: Attributes = {
          physique: 5, intelligence: 5, spirit: 5, agility: 5, charisma: 5, politics: 5
      };
      // Give slightly better stats if leader
      defaultAttributes.politics = 7;
      defaultAttributes.charisma = 7;

      let newTraits: Trait[] = [];
      try {
         newTraits = await generateInitialTraits(successor.name, successor.background, defaultAttributes, successor.description, appSettings.gameSettings.historyStyle);
      } catch (e) {
         console.error("Trait gen failed for successor", e);
         newTraits = [];
      }
      
      // 2. Prepare Previous World State
      const previousState = {
          year: gameState.year,
          month: gameState.month,
          factions: gameState.factions,
          history: gameState.historySummary,
          supremeLeader: gameState.supremeLeader // The dead/retired leader
      };
      
      // 3. New Config
      // Birth year assumption: Successor is around 30-40 years old? Let's say 40 for stability.
      const newBirthYear = gameState.year - 40;
      
      const newConfig: InitialConfig = {
          name: successor.name,
          background: successor.background,
          attributes: defaultAttributes,
          backstory: successor.description,
          traits: newTraits,
          birthYear: newBirthYear
      };

      setInitialConfig(newConfig);
      setLastAction({ type: 'START', params: { ...newConfig } }); // Treat as a START action type but with inheritance logic implied by calling specific startGame flow

      try {
          // Call start game with previous state
          const response = await withTimeout(startGame(
              newConfig.name, 
              newConfig.background, 
              newConfig.attributes, 
              newConfig.traits, 
              newConfig.backstory, 
              newConfig.birthYear, 
              appSettings.gameSettings,
              previousState
          ));
          
          const supremeLeaderName = response.supremeLeaderUpdate?.name || "未知";
          const isSupremeLeader = (successor.name === supremeLeaderName);

          const initialStats: PlayerStats = {
            ...BASE_DYNAMIC_STATS[newConfig.background],
            birthYear: newBirthYear,
            attributes: defaultAttributes,
            traits: newTraits,
            powerPoints: isSupremeLeader ? 3 : 0, // Reset power points unless supreme leader
            redStars: 3 // Reset fate points
          };
          
          if (response.playerFactionUpdate) {
              initialStats.currentFaction = response.playerFactionUpdate.factionName;
              initialStats.isLeader = response.playerFactionUpdate.isLeader;
          }

          if (isSupremeLeader) {
               initialStats.isLeader = true;
          }

          const newState: GameState = {
            name: successor.name,
            background: successor.background,
            year: response.year,
            month: response.month,
            stats: initialStats,
            factions: response.factionsUpdate || gameState.factions,
            supremeLeader: supremeLeaderName,
            supremeLeaderSlogan: response.supremeLeaderUpdate?.slogan || gameState.supremeLeaderSlogan,
            rulingPartySymbol: response.supremeLeaderUpdate?.symbol || gameState.rulingPartySymbol,
            historySummary: gameState.historySummary, // Inherit History
            isGameOver: false,
            backstory: successor.description
          };
          
          setGameState(newState);
          updateGameStateFromResponse(response, newState, null);

      } catch (error) {
          console.error(error);
          setIsError(true);
      } finally {
          setIsLoading(false);
      }
  };

  const handleChoice = async (choiceId: string, choiceText: string, rollResult: RollResult = 'NONE', earnStar: boolean = false, consumedRedStars: number = 0) => {
    if (!gameState) return;
    setIsLoading(true);
    setIsError(false);
    setLastAction({ type: 'TURN', params: { choiceId, choiceText, rollResult, earnStar, consumedRedStars } });
    
    // Check for Manipulation Action
    const isManipulationAction = choiceId === 'action_manipulate_scales' || choiceId === 'special_manipulate_scales';
    const consumedPowerPoints = isManipulationAction ? 1 : 0;

    // Immediate Optimistic Update
    if (consumedPowerPoints > 0) {
        setGameState(prev => {
            if (!prev) return null;
            return {
                ...prev,
                stats: {
                    ...prev.stats,
                    powerPoints: Math.max(0, prev.stats.powerPoints - consumedPowerPoints)
                }
            };
        });
    }
    
    try {
      const response = await withTimeout(makeTurn(gameState, choiceId, choiceText, rollResult, appSettings.gameSettings));
      
      const actionContext = {
        text: choiceText,
        result: rollResult,
        date: { year: gameState.year, month: gameState.month },
        earnedStar: earnStar,
        consumedRedStars: consumedRedStars,
        consumedPowerPoints: consumedPowerPoints 
      };

      updateGameStateFromResponse(response, gameState, actionContext);
      
    } catch (error) {
       console.error(error);
       setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper check for Supreme Leader (By Name Match)
  const isSupremeLeader = gameState && (gameState.name === gameState.supremeLeader);

  // Calculate Theme Color based on Supreme Leader's original faction
  const themeColor = useMemo(() => {
      if (!gameState) return '#7f1d1d'; // Default Red-900
      
      const leaderName = gameState.supremeLeader;
      // Default color
      let color = '#7f1d1d'; 

      // If leader is Mao, stick to default heavy red
      if (leaderName.includes("毛") || leaderName === "毛泽东") {
          return '#7f1d1d';
      }

      // Find faction containing the leader
      const leaderFaction = gameState.factions.find(f => {
          if (!f.leaders) return false;
          // Handle both string and array just in case api varies
          if (Array.isArray(f.leaders)) return f.leaders.some(l => l.includes(leaderName));
          return (f.leaders as string).includes(leaderName);
      });

      if (leaderFaction && leaderFaction.color) {
          color = leaderFaction.color;
      }

      return color;
  }, [gameState]);

  const handleExchangeRedStars = () => {
    if (!gameState) return;
    // Cost is 2 if Supreme Leader, 3 otherwise
    const cost = isSupremeLeader ? 2 : 3;

    if (gameState.stats.redStars < cost) return;
    setGameState(prev => {
        if (!prev) return null;
        return {
            ...prev,
            stats: {
                ...prev.stats,
                redStars: prev.stats.redStars - cost,
                powerPoints: prev.stats.powerPoints + 1
            }
        };
    });
  };

  const handleManipulateScales = async () => {
     if (!gameState || gameState.stats.powerPoints < 1) return;
     
     // Close main modal first
     setIsFactionModalOpen(false); 

     // Special Leader Flow OR Foreign Leader (with power points): Open input modal
     if (isSupremeLeader || gameState.stats.powerPoints > 0) {
         // Note: We reuse this modal for all "Special" power actions now including foreign intervention
         setIsLeaderManipulateModalOpen(true);
         return;
     }
  };

  const handleLeaderManipulateSubmit = async () => {
      if (!gameState || !leaderManipulateText.trim()) return;
      
      setIsLeaderManipulateModalOpen(false);
      
      const prefix = isSupremeLeader ? "[最高领袖]" : "[境外干涉]";
      const actionText = `${prefix} 动用权势：${leaderManipulateText}`;

      await handleChoice("action_manipulate_scales", actionText, 'SUCCESS', false, 0);
      setLeaderManipulateText("");
  };

  const handleConsumeRedStar = () => {
    if (!gameState || gameState.stats.redStars <= 0) return;
    setGameState(prev => {
        if (!prev) return null;
        return {
            ...prev,
            stats: {
                ...prev.stats,
                redStars: prev.stats.redStars - 1
            }
        };
    });
  };

  const handleRetry = () => {
    if (!lastAction) return;
    if (lastAction.type === 'START') {
      const { name, background, attributes, backstory, traits, birthYear, foreignInfo } = lastAction.params;
      handleStartGame(name, background, attributes, backstory, traits, birthYear, foreignInfo);
    } else {
      const { choiceId, choiceText, rollResult, earnStar, consumedRedStars } = lastAction.params;
      handleChoice(choiceId, choiceText, rollResult, earnStar, consumedRedStars);
    }
  };

  const handleRestart = (type: 'current' | 'new') => {
    if (type === 'new') {
      setGameState(null);
      setInitialConfig(null);
      setChoices([]);
      setCurrentScene("");
    } else if (type === 'current' && initialConfig) {
      handleStartGame(
        initialConfig.name, 
        initialConfig.background, 
        initialConfig.attributes, 
        initialConfig.backstory, 
        initialConfig.traits,
        initialConfig.birthYear,
        initialConfig.foreignInfo // Correctly pass foreignInfo to ensure proper restart state
      );
    }
  };

  const updateGameStateFromResponse = (
    response: any, 
    prevState: GameState, 
    lastActionContext: { text: string; result: RollResult; date: { year: number; month: number }; earnedStar?: boolean; consumedRedStars?: number; consumedPowerPoints?: number } | null
  ) => {
    setCurrentScene(response.narrative);
    setChoices(response.choices);
    
    const monthsPassed = (response.year - prevState.year) * 12 + (response.month - prevState.month);

    const traitChanges: TraitChangeLog[] = [];
    let currentTraits = [...prevState.stats.traits];
    
    // Trait Logic
    if (response.traitsUpdate && response.traitsUpdate.removeIds) {
      const removed = currentTraits.filter(t => response.traitsUpdate.removeIds.includes(t.id));
      removed.forEach(t => traitChanges.push({ type: 'REMOVE', name: t.name, rarity: t.rarity }));
      currentTraits = currentTraits.filter(t => !response.traitsUpdate.removeIds.includes(t.id));
    }
    if (response.traitsUpdate && response.traitsUpdate.add) {
      response.traitsUpdate.add.forEach((t: Trait) => {
         const existingIndex = currentTraits.findIndex(existing => existing.name === t.name);
         if (existingIndex !== -1) currentTraits.splice(existingIndex, 1);
         traitChanges.push({ type: 'ADD', name: t.name, rarity: t.rarity });
         currentTraits.push(t);
      });
    }
    if (monthsPassed > 0) {
      currentTraits = currentTraits
        .map(t => {
          if (t.duration !== undefined && t.duration !== null) {
            return { ...t, duration: t.duration - monthsPassed };
          }
          return t;
        })
        .filter(t => t.duration === undefined || t.duration === null || t.duration > 0);
    }

    // Inventory
    let currentInventory = [...prevState.stats.inventory];
    if (response.inventoryUpdate) {
       if (response.inventoryUpdate.add) currentInventory = [...currentInventory, ...response.inventoryUpdate.add];
       if (response.inventoryUpdate.remove) currentInventory = currentInventory.filter((i: string) => !response.inventoryUpdate.remove.includes(i));
    }

    // Faction Update: Ensure it is an array if present, otherwise keep old
    let currentFactions = prevState.factions || [];
    if (response.factionsUpdate && Array.isArray(response.factionsUpdate)) {
        currentFactions = response.factionsUpdate;
    }
    
    // Player Faction Update
    let currentFactionName = prevState.stats.currentFaction;
    let isLeader = prevState.stats.isLeader;
    let factionChange = undefined;

    if (response.playerFactionUpdate) {
        if (response.playerFactionUpdate.factionName !== currentFactionName) {
           factionChange = {
             from: currentFactionName,
             to: response.playerFactionUpdate.factionName
           };
        }
        currentFactionName = response.playerFactionUpdate.factionName;
        isLeader = response.playerFactionUpdate.isLeader;
    }

    // Supreme Leader Update
    let currentSupremeLeader = prevState.supremeLeader;
    let currentSlogan = prevState.supremeLeaderSlogan;
    let currentSymbol = prevState.rulingPartySymbol;

    if (response.supremeLeaderUpdate) {
        if (response.supremeLeaderUpdate.name) currentSupremeLeader = response.supremeLeaderUpdate.name;
        if (response.supremeLeaderUpdate.slogan) currentSlogan = response.supremeLeaderUpdate.slogan;
        if (response.supremeLeaderUpdate.symbol) currentSymbol = response.supremeLeaderUpdate.symbol;
    }

    // History and Deltas
    let newHistory = [...prevState.historySummary];
    
    let redStarDelta = 0;
    if (lastActionContext?.earnedStar) redStarDelta += 1;
    if (lastActionContext?.consumedRedStars) redStarDelta -= lastActionContext.consumedRedStars;

    let powerPointDelta = 0;
    if (response.statsDelta.powerPoints) powerPointDelta += response.statsDelta.powerPoints;
    if (lastActionContext?.consumedPowerPoints) powerPointDelta -= lastActionContext.consumedPowerPoints;

    if (lastActionContext) {
      const newEntry: HistoryEntry = {
        year: lastActionContext.date.year,
        month: lastActionContext.date.month,
        text: lastActionContext.text,
        result: lastActionContext.result,
        traitChanges: traitChanges,
        deltas: {
            redStars: redStarDelta,
            powerPoints: powerPointDelta
        },
        factionChange: factionChange
      };
      newHistory.push(newEntry);
    }

    let newRedStars = prevState.stats.redStars;
    if (lastActionContext?.earnedStar) {
        newRedStars = Math.min(5, newRedStars + 1);
    }

    let newPowerPoints = prevState.stats.powerPoints;
    if (response.statsDelta.powerPoints) {
        newPowerPoints += response.statsDelta.powerPoints;
    }
    if (lastActionContext?.consumedPowerPoints) {
        newPowerPoints = Math.max(0, newPowerPoints - lastActionContext.consumedPowerPoints);
    }

    const newStats: PlayerStats = {
      birthYear: prevState.stats.birthYear,
      politicalStanding: Math.max(0, Math.min(100, prevState.stats.politicalStanding + response.statsDelta.politicalStanding)),
      health: Math.max(0, Math.min(100, prevState.stats.health + response.statsDelta.health)),
      mental: Math.max(0, Math.min(100, prevState.stats.mental + response.statsDelta.mental)),
      redStars: newRedStars,
      powerPoints: newPowerPoints,
      currentFaction: currentFactionName,
      isLeader: isLeader,
      inventory: currentInventory,
      attributes: prevState.stats.attributes, 
      traits: currentTraits
    };

    let isGameOver = response.isGameOver;
    let gameOverReason = response.gameOverReason;

    if (newStats.health <= 0) {
      isGameOver = true;
      gameOverReason = gameOverReason || "你因身体崩溃，病死在革命的征途中。";
    } else if (newStats.politicalStanding <= 0) {
      isGameOver = true;
      gameOverReason = gameOverReason || "你被彻底打倒，划为反革命分子，在劳改农场度过余生。";
    } else if (newStats.mental <= 0) {
      isGameOver = true;
      gameOverReason = gameOverReason || "你无法承受巨大的精神压力，疯了。";
    }

    setGameState({
      ...prevState,
      year: response.year,
      month: response.month,
      stats: newStats,
      factions: currentFactions,
      supremeLeader: currentSupremeLeader,
      supremeLeaderSlogan: currentSlogan,
      rulingPartySymbol: currentSymbol,
      isGameOver,
      gameOverReason,
      historySummary: newHistory,
      potentialSuccessors: response.potentialSuccessors
    });
  };

  return (
    <>
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
        initialSettings={appSettings}
      />

      {gameState && (
        <FactionModal
           isOpen={isFactionModalOpen}
           onClose={() => setIsFactionModalOpen(false)}
           factions={gameState.factions || []}
           playerStats={gameState.stats}
           onExchangeRedStars={handleExchangeRedStars}
           onManipulateScales={handleManipulateScales}
           canManipulate={gameState.stats.powerPoints >= 1}
           supremeLeader={gameState.supremeLeader}
           themeColor={themeColor}
           slogan={gameState.supremeLeaderSlogan}
           symbol={gameState.rulingPartySymbol}
        />
      )}
      
      {/* Supreme Leader / Foreign Leader Manipulate Input Modal */}
      {isLeaderManipulateModalOpen && (
          <div className="fixed inset-0 z-[110] bg-black/70 flex items-center justify-center animate-fade-in backdrop-blur-sm">
             <div className="bg-[#fdfbf7] p-6 rounded border-4 border-yellow-500 shadow-2xl text-center w-96 animate-scale-in max-w-[90%]">
                <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-4xl text-yellow-400 drop-shadow-md">
                    {isSupremeLeader ? "👑" : "🌍"}
                </div>
                <h3 className="text-2xl font-black text-yellow-800 mb-2 mt-4 tracking-widest">
                    {isSupremeLeader ? "最高指示" : "境外干涉"}
                </h3>
                <p className="text-gray-700 mb-4 font-serif text-sm">
                    {isSupremeLeader 
                      ? "作为最高领袖，你可以直接干预局势。" 
                      : "作为外国领袖，你可以扶植代理人或渗透。"}
                    <br/>描述你希望增强的派系和具体手段。
                </p>
                <textarea
                    value={leaderManipulateText}
                    onChange={(e) => setLeaderManipulateText(e.target.value)}
                    placeholder={isSupremeLeader ? "例如：大力支持造反派，号召..." : "例如：提供经费给某个团体，扶植..."}
                    className="w-full h-24 p-2 mb-4 bg-[#f4f1de] border border-gray-400 focus:border-red-800 outline-none text-sm resize-none"
                    autoFocus
                />
                <div className="flex gap-3">
                    <button onClick={() => { setIsLeaderManipulateModalOpen(false); setLeaderManipulateText(""); }} className="flex-1 py-2 text-gray-600 text-sm border border-gray-300">取消</button>
                    <button onClick={handleLeaderManipulateSubmit} disabled={!leaderManipulateText.trim()} className="flex-1 py-2 bg-red-800 text-white font-bold disabled:opacity-50">执行</button>
                </div>
             </div>
          </div>
      )}
      
      {isLoading && !gameState && (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#f4f1de] p-8 old-paper">
           <div className="flex flex-col items-center animate-fade-in">
              <div className="w-16 h-16 border-4 border-red-800 border-t-transparent rounded-full animate-spin mb-6"></div>
              <h2 className="text-2xl font-black text-red-900 mb-2 font-serif tracking-widest">历史演进中...</h2>
              <p className="text-gray-600 font-serif">正在生成1966年的世界...</p>
           </div>
        </div>
      )}

      {isError && !gameState && (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#f4f1de] p-8 old-paper">
          <div className="bg-red-50 border-4 border-red-800 p-8 shadow-2xl max-w-md text-center animate-scale-in">
            <h2 className="text-2xl font-black text-red-900 mb-4">历史生成受阻</h2>
            <p className="text-gray-800 mb-6">历史的迷雾过于浓重，导致连接中断或生成超时。</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleRetry} className="bg-red-800 text-white px-6 py-3 font-bold hover:bg-red-900 shadow-lg tracking-widest">重新尝试生成</button>
              <button onClick={() => { setIsError(false); setIsLoading(false); setGameState(null); }} className="text-gray-600 underline text-sm hover:text-red-800">放弃并返回</button>
            </div>
            <div className="mt-6 pt-4 border-t border-red-200">
              <button onClick={() => setIsSettingsOpen(true)} className="text-sm text-gray-500 hover:text-gray-800 flex items-center justify-center gap-1 mx-auto"><span>⚙️</span> 配置 API / 代理</button>
            </div>
          </div>
        </div>
      )}

      {!isLoading && !isError && !gameState && (
        <CharacterCreation 
            onStart={handleStartGame} 
            isLoading={isLoading} 
            onOpenSettings={() => setIsSettingsOpen(true)}
            gameSettings={appSettings.gameSettings}
        />
      )}

      {gameState && (
        <GameUI 
          gameState={gameState}
          effectiveAttributes={calculateEffectiveAttributes(gameState.stats.attributes, gameState.stats.traits)}
          choices={choices} 
          onChoice={handleChoice} 
          onConsumeRedStar={handleConsumeRedStar}
          isLoading={isLoading}
          gameScene={currentScene}
          onRestart={handleRestart}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenFaction={() => setIsFactionModalOpen(true)}
          isSupremeLeader={isSupremeLeader}
          themeColor={themeColor}
          onInheritWorld={handleInheritGame}
        />
      )}

      {isError && gameState && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#fdfbf7] p-6 rounded shadow-2xl border-2 border-red-800 text-center animate-bounce-subtle w-80">
            <h3 className="font-bold text-red-800 mb-2 text-xl">连接超时</h3>
             <p className="text-sm text-gray-600 mb-6">请检查网络配置或重新尝试。</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleRetry} className="w-full bg-red-700 text-white px-4 py-2 font-bold hover:bg-red-800 shadow-md">重试当前行动</button>
              <button onClick={() => setIsSettingsOpen(true)} className="w-full bg-gray-200 text-gray-700 px-4 py-2 font-bold hover:bg-gray-300 border border-gray-300">检查 API 设置</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default App;