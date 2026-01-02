
export enum BackgroundType {
  RED_FIVE = '红五类', // Workers, Peasants, Soldiers
  BLACK_FIVE = '黑五类', // Landlords, Rich peasants, Counter-revolutionaries
  INTELLECTUAL = '知识分子', // Teachers, Experts (often precarious)
  ORDINARY = '普通市民',
  HISTORICAL = '历史人物', // Real historical figures
  TIME_TRAVELER = '穿越者' // Time travelers (Real or Fictional)
}

export enum TraitRarity {
  COMMON = '普通',
  RARE = '稀有',
  EPIC = '罕见',
  LEGENDARY = '独特',
  CRIME = '罪名', // New Category
  NEGATIVE = '恶劣',
  HIDDEN = '隐秘'
}

export const TRAIT_SORT_ORDER: Record<TraitRarity, number> = {
  [TraitRarity.LEGENDARY]: 0,
  [TraitRarity.CRIME]: 1,
  [TraitRarity.NEGATIVE]: 2, // Modified order per request
  [TraitRarity.EPIC]: 3,
  [TraitRarity.RARE]: 4,
  [TraitRarity.COMMON]: 5,
  [TraitRarity.HIDDEN]: 6
};

export enum HistoryStyle {
  REALISM = '现实主义',
  ROMANTICISM = '浪漫主义',
  DRAMATIZATION = '戏剧化'
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  modelName: string;
}

export interface GameSettings {
  monthsPerTurn: number; // 1-6, default 1
  baseLuck: number; // 0.5 - 2.0, default 1.0
  historyStyle: HistoryStyle; // Default REALISM
  cheatMode?: boolean; // ZAN mode: 99 Red Stars lock
  cheatCodeInput?: string; // The text entered by user for cheat mode
}

export interface AppSettings {
  apiType: 'gemini' | 'openai';
  gemini: ProviderConfig;
  openai: ProviderConfig;
  gameSettings: GameSettings;
}

export interface Trait {
  id: string;
  name: string;
  description: string;
  rarity: TraitRarity;
  modifiers?: Partial<Attributes>; // e.g., { physique: 2, politics: -1 }
  duration?: number; // Duration in months. If undefined, it's permanent.
}

export interface Attributes {
  physique: number; // 体格
  intelligence: number; // 智力
  spirit: number; // 精神
  agility: number; // 身手
  charisma: number; // 魅力
  politics: number; // 政治
}

export interface Faction {
  name: string; // e.g., "造反派", "保守派", "逍遥派"
  percentage: number; // 0-100
  leaders: string[]; // e.g., ["江青", "张春桥"]
  color: string; // Hex code e.g., "#FF0000"
  alliedWith?: string; // Name of another faction if allied
  description?: string;
}

export interface PlayerStats {
  birthYear: number; // Added to calculate age
  politicalStanding: number; // 0-100
  health: number; // 0-100
  mental: number; // 0-100
  redStars: number; // Fate points (0-5, usually start at 3)
  powerPoints: number; // Political Power Points
  currentFaction: string; // The name of the faction the player belongs to
  isLeader: boolean; // Is the player a leader of their faction?
  inventory: string[];
  attributes: Attributes; // This is the BASE attributes
  traits: Trait[];
}

export interface TraitChangeLog {
  type: 'ADD' | 'REMOVE';
  name: string;
  rarity?: TraitRarity;
}

export interface HistoryEntry {
  year: number;
  month: number;
  text: string;
  result: RollResult;
  traitChanges: TraitChangeLog[];
  deltas?: {
    redStars: number;
    powerPoints: number;
  };
  factionChange?: {
    from: string;
    to: string;
  };
}

export interface PotentialSuccessor {
  id: string;
  name: string;
  description: string;
  background: BackgroundType;
}

export interface GameState {
  year: number;
  month: number;
  background: BackgroundType;
  name: string;
  stats: PlayerStats;
  factions: Faction[]; // List of current factions
  supremeLeader: string; // Current Supreme Leader of the country
  supremeLeaderSlogan: string; // Dynamic slogan, e.g. "大海航行靠舵手"
  rulingPartySymbol: string; // Dynamic symbol, e.g. "☭"
  historySummary: HistoryEntry[];
  isGameOver: boolean;
  gameOverReason?: string;
  backstory: string; // Keep track of the user's initial backstory
  potentialSuccessors?: PotentialSuccessor[]; // Only present if game over and player was leader
  turnsSinceLastCritical: number; // Track turns without critical success for pity system
  designatedSuccessor?: string | null; // Name of the designated heir from testament
  suggestedHeirs?: string[]; // List of 3 suggested heirs for testament choice
  lastPowerPointGrantDate?: { year: number; month: number }; // Track when the last power point was granted
}

export interface Choice {
  id: string;
  text: string;
  intent: string;
  requiredAttribute?: string;
  difficulty?: number;
}

export type RollResult = 'CRITICAL_SUCCESS' | 'SUCCESS' | 'FAILURE' | 'CRITICAL_FAILURE' | 'NONE';

export interface GameSceneResponse {
  narrative: string;
  year: number;
  month: number;
  statsDelta: {
    politicalStanding: number;
    health: number;
    mental: number;
    powerPoints?: number; // Delta for power points (e.g. from events or time passing)
  };
  choices: Choice[];
  isGameOver: boolean;
  gameOverReason: string | null;
  inventoryUpdate?: {
    add?: string[];
    remove?: string[];
  };
  traitsUpdate?: {
    add?: Trait[]; // New traits acquired
    removeIds?: string[]; // Trait IDs to remove
  };
  factionsUpdate?: Faction[]; // If present, replace the entire faction list with this new state
  supremeLeaderUpdate?: {
      name: string;
      slogan?: string; // New slogan if leader changes
      symbol?: string; // New symbol if ideology changes
  };
  playerFactionUpdate?: {
    factionName: string;
    isLeader: boolean;
  };
  potentialSuccessors?: PotentialSuccessor[];
  designatedSuccessorUpdate?: string; // If player wrote a testament, return the name here
  suggestedHeirs?: string[]; // If choice is write testament, return 3 suggestions
}
