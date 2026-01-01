import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GameState, GameSceneResponse, BackgroundType, Attributes, RollResult, Trait, TraitRarity, GameSettings, Faction, HistoryStyle, HistoryEntry, PotentialSuccessor } from "../types";

// Configuration State
let config = {
  apiKey: process.env.API_KEY || "",
  baseUrl: "",
  modelName: "",
  apiType: 'gemini' as 'gemini' | 'openai'
};

let genAI: GoogleGenAI | null = null;

// Helper to get Gemini Client
const getGeminiClient = () => {
  if (!genAI) {
    const options: any = { apiKey: config.apiKey };
    if (config.baseUrl) {
      options.baseUrl = config.baseUrl;
    }
    genAI = new GoogleGenAI(options);
  }
  return genAI;
};

export const updateGeminiConfig = (apiKey?: string, baseUrl?: string, modelName?: string, apiType?: 'gemini' | 'openai') => {
  const type = apiType || 'gemini';
  
  // Logic Fix: Only fallback to process.env.API_KEY if we are using Gemini.
  // For OpenAI, if the user leaves the key blank, we respect that (it might fail, but we shouldn't send the Google Key).
  let finalApiKey = apiKey || "";
  
  if (type === 'gemini') {
    if (!finalApiKey) {
        finalApiKey = process.env.API_KEY || "";
    }
  }

  config = {
    apiKey: finalApiKey,
    baseUrl: baseUrl || "",
    modelName: modelName || "",
    apiType: type
  };
  // Reset Gemini client to force recreation with new settings
  genAI = null;
};

// Helper to determine the effective model name
const getModel = () => {
  if (config.modelName && config.modelName.trim() !== '') {
    return config.modelName;
  }
  return config.apiType === 'openai' ? 'gpt-3.5-turbo' : 'gemini-3-flash-preview';
};

// --- Retry Logic ---
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const callWithRetry = async <T>(fn: () => Promise<T>, retries = 3, initialDelay = 2000): Promise<T> => {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (error: any) {
      // Check for rate limit errors (429) or quota exhaustion
      const isRateLimit = 
        error?.status === 429 || 
        error?.code === 429 || 
        error?.message?.includes('429') || 
        error?.message?.includes('quota') ||
        error?.message?.includes('RESOURCE_EXHAUSTED') ||
        error?.toString().includes('429');
      
      if (isRateLimit && attempt < retries) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(`API Rate limit hit. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${retries})`);
        await wait(delay);
        attempt++;
      } else {
        throw error;
      }
    }
  }
  throw new Error("Max retries exceeded due to rate limiting.");
};

// --- OpenAI Compatible Implementation ---
const generateContentOpenAI = async (
  prompt: string, 
  systemInstruction: string | undefined, 
  responseSchema: Schema | undefined
): Promise<string> => {
  let url = config.baseUrl || "https://api.openai.com/v1";
  // Remove trailing slash
  url = url.replace(/\/$/, "");
  // Append /chat/completions if not present
  if (!url.endsWith("/chat/completions")) {
    url += "/chat/completions";
  }

  const model = getModel();
  
  // Construct System Message
  let finalSystemInstruction = systemInstruction || "";
  if (responseSchema) {
    finalSystemInstruction += `\n\nIMPORTANT: You must output strictly valid JSON. The JSON must adhere to the following schema:\n${JSON.stringify(responseSchema, null, 2)}`;
  }

  const messages = [
    { role: "system", content: finalSystemInstruction },
    { role: "user", content: prompt }
  ];

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        response_format: { type: "json_object" } // Enforce JSON mode
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      // Try to parse error json if possible to get code
      let errorCode = res.status;
      try {
          const errJson = JSON.parse(errorText);
          if (errJson.error?.code) errorCode = errJson.error.code;
      } catch (e) {}

      // Create an error object that matches what callWithRetry expects
      const err: any = new Error(`OpenAI API Error ${res.status}: ${errorText}`);
      err.status = errorCode;
      err.code = errorCode;
      throw err;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content in OpenAI response");
    
    return content;
  } catch (e) {
    console.error("OpenAI Call Failed", e);
    throw e;
  }
};

// --- Unified Generator ---
const unifiedGenerate = async (params: {
  prompt: string;
  systemInstruction?: string;
  responseSchema?: Schema;
}): Promise<string> => {
  return callWithRetry(async () => {
    if (config.apiType === 'openai') {
      return await generateContentOpenAI(params.prompt, params.systemInstruction, params.responseSchema);
    } else {
      // Gemini Mode
      const client = getGeminiClient();
      const model = getModel();
      const response = await client.models.generateContent({
        model,
        contents: params.prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: params.responseSchema,
          systemInstruction: params.systemInstruction
        }
      });
      const text = response.text;
      if (!text) throw new Error("Empty response from Gemini");
      return text;
    }
  });
};

// --- Test Connection ---
export const testConnection = async (apiKey: string, baseUrl: string, modelName: string, apiType: 'gemini' | 'openai'): Promise<boolean> => {
    // Temporarily apply settings for the test
    const prevConfig = { ...config };
    updateGeminiConfig(apiKey, baseUrl, modelName, apiType);

    try {
        const testPrompt = "Reply with JSON: {\"status\": \"ok\"}";
        await unifiedGenerate({ prompt: testPrompt });
        
        // Restore config
        updateGeminiConfig(prevConfig.apiKey, prevConfig.baseUrl, prevConfig.modelName, prevConfig.apiType);
        return true;
    } catch (e) {
        console.error("Connection test failed", e);
        // Restore config
        updateGeminiConfig(prevConfig.apiKey, prevConfig.baseUrl, prevConfig.modelName, prevConfig.apiType);
        return false;
    }
};

// --- Shared Helper for Cleaning JSON ---
const cleanJsonString = (str: string) => {
  return str.replace(/```json\n?|```/g, '').trim();
};

const safeString = (val: any, defaultVal = ""): string => {
  if (val === null || val === undefined) return defaultVal;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
     return val.text || val.content || val.value || val.name || JSON.stringify(val);
  }
  return String(val);
};

// --- Schemas and Logic ---

const traitSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    name: { type: Type.STRING },
    description: { type: Type.STRING },
    rarity: { type: Type.STRING, enum: Object.values(TraitRarity) },
    modifiers: {
      type: Type.OBJECT,
      properties: {
        physique: { type: Type.INTEGER },
        intelligence: { type: Type.INTEGER },
        spirit: { type: Type.INTEGER },
        agility: { type: Type.INTEGER },
        charisma: { type: Type.INTEGER },
        politics: { type: Type.INTEGER },
      },
      nullable: true
    },
    duration: { 
      type: Type.INTEGER, 
      description: "Optional duration in months. Use for temporary states (injuries, sickness, morale boosts). If null/undefined, trait is permanent.",
      nullable: true 
    }
  },
  required: ["id", "name", "description", "rarity"]
};

const factionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    percentage: { type: Type.NUMBER },
    leaders: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "List of names of the faction leaders. MUST be specific PERSON NAMES (e.g. 'Jiang Qing', 'Zhou Enlai'), NOT job titles (e.g. 'General', 'Secretary')."
    },
    color: { type: Type.STRING, description: "Hex color code. Rebel(造反派) MUST be '#D62828' (Crimson Red). Conservatives(保皇派/保守派) MUST be '#1e3a8a' (Dark Blue). Lin Biao: Green; Wanderers: Yellow/White." },
    alliedWith: { type: Type.STRING, nullable: true },
    description: { type: Type.STRING, nullable: true }
  },
  required: ["name", "percentage", "leaders", "color"]
};

const successorSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    name: { type: Type.STRING },
    description: { type: Type.STRING, description: "Brief relationship to the former leader (e.g. 'Loyal Secretary', 'Ambitious General')." },
    background: { type: Type.STRING, enum: Object.values(BackgroundType) }
  },
  required: ["id", "name", "description", "background"]
};

const gameResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    narrative: {
      type: Type.STRING,
      description: "The main story text.",
    },
    year: { type: Type.INTEGER },
    month: { type: Type.INTEGER },
    statsDelta: {
      type: Type.OBJECT,
      properties: {
        politicalStanding: { type: Type.INTEGER },
        health: { type: Type.INTEGER },
        mental: { type: Type.INTEGER },
        powerPoints: { type: Type.INTEGER, description: "Change in political power points." }
      },
      required: ["politicalStanding", "health", "mental"],
    },
    choices: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          text: { type: Type.STRING },
          intent: { type: Type.STRING },
          requiredAttribute: { type: Type.STRING },
          difficulty: { type: Type.INTEGER, description: "Base difficulty (0-100) of the task BEFORE attribute modifiers. 30=Easy, 50=Medium, 70=Hard, 90=Extreme." },
        },
        required: ["id", "text", "intent"],
      },
    },
    isGameOver: { type: Type.BOOLEAN },
    gameOverReason: { type: Type.STRING },
    inventoryUpdate: {
      type: Type.OBJECT,
      properties: {
        add: { type: Type.ARRAY, items: { type: Type.STRING } },
        remove: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    },
    traitsUpdate: {
      type: Type.OBJECT,
      properties: {
        add: { type: Type.ARRAY, items: traitSchema },
        removeIds: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    },
    factionsUpdate: {
      type: Type.ARRAY,
      items: factionSchema,
      description: "Return the FULL list of all factions and their current percentages if there are any changes. Sum of percentages must be 100."
    },
    supremeLeaderUpdate: {
        type: Type.OBJECT,
        properties: {
           name: { type: Type.STRING, description: "Name of the Supreme Leader." },
           slogan: { type: Type.STRING, description: "A political slogan associated with this leader. (e.g., '大海航行靠舵手' for Mao, '实践是检验真理的唯一标准' for Reformists, or custom for Player)." },
           symbol: { type: Type.STRING, description: "A single unicode symbol representing the ruling ideology. (e.g., '☭' for CPC, '☀' for KMT/Nationalists, '⚔️' for Junta, '🕊️' for Pacifists)." }
        },
        description: "The name, slogan and symbol of the current Supreme Leader. Return only if changed or initialized.",
        nullable: true
    },
    playerFactionUpdate: {
        type: Type.OBJECT,
        properties: {
            factionName: { type: Type.STRING },
            isLeader: { type: Type.BOOLEAN }
        },
        nullable: true
    },
    potentialSuccessors: {
        type: Type.ARRAY,
        items: successorSchema,
        description: "If the player was the Supreme Leader and has died/retired, provide 3 potential successors to continue the timeline.",
        nullable: true
    }
  },
  required: ["narrative", "year", "month", "statsDelta", "choices", "isGameOver"],
};

const getSystemInstruction = (baseLuck: number = 1.0, historyStyle: HistoryStyle = HistoryStyle.REALISM) => {
  let styleInstruction = "";
  switch (historyStyle) {
    case HistoryStyle.ROMANTICISM:
      styleInstruction = "STYLE: ROMANTICISM (浪漫主义). Traits should be heroic, idealized, and stronger. Modifiers should be higher (e.g., +3 to +6) and generally positive. Minimize negative tradeoffs unless necessary for plot.";
      break;
    case HistoryStyle.DRAMATIZATION:
      styleInstruction = "STYLE: DRAMATIZATION (戏剧化). Traits should be extreme and volatile. Use high values (e.g., +5 to +8) but often pair high positives with significant negatives (e.g., +8 Pol, -5 Health). Create a rollercoaster experience.";
      break;
    case HistoryStyle.REALISM:
    default:
      styleInstruction = "STYLE: REALISM (现实主义). Traits should be grounded and realistic. Modifiers are conservative (usually -2 to +3). Rare traits should feel earned and not overpowered.";
      break;
  }

  return `
You are a hardcore historical RPG engine simulating China's Cultural Revolution (1966-1976).
You must be historically accurate, gritty, and unforgiving, BUT allow for Alternate History based on Faction dynamics.
LANGUAGE: All output MUST be in Simplified Chinese (zh-CN).

TRAIT SCALING RULES (STRICT):
Attributes modifiers MUST strictly follow these ranges based on Rarity:
- COMMON (普通): Total sum of modifiers must be 1 to 2. (e.g., +1 or +1/+1).
- RARE (稀有): Total sum of modifiers must be 3 to 4. (e.g., +3 or +2/+2).
- EPIC (罕见): Total sum of modifiers must be 5 to 7. (e.g., +5 or +4/+2).
- LEGENDARY (独特): Total sum of modifiers must be 8 to 15. (e.g., +10 or +5/+5).
- NEGATIVE (恶劣): Total sum of modifiers must be -10 to -1.
- DO NOT generate traits with 0 modifiers unless purely narrative.

FACTION SYSTEM & ALT-HISTORY:
- You must track National Factions (percentages sum to 100).
- Standard factions in 1966: "造反派" (Rebels), "保皇派/保守派" (Conservatives/Loyalists).
- Later factions: "林彪集团" (Lin Biao Faction, ~1969-1971), "四人帮" (Gang of Four, late period), "逍遥派" (Wanderers/Apolitical, grow over time).
- SUPREME LEADER (最高领袖): Starts as "毛泽东". If history changes (e.g., Lin Biao succeeds) or time passes (Mao dies in 1976, Hua Guofeng takes over), update this field.
- RULING IDEOLOGY/SYMBOL: 
  * If the ruling party is CCP/CPC, symbol is "☭".
  * If the player creates an alt-history ruling party (e.g., Nationalist restoration), change symbol (e.g., "☀").
  * If Military Junta, use "⚔️".
- LEADER SLOGAN: Update the slogan associated with the leader (e.g. Mao: "大海航行靠舵手"). If a new leader rises, create a plausible slogan.
- PLAYER AS SUPREME LEADER: If the player attains the status of Supreme Leader, they get the "Supreme Leader" trait.
- FACTION NAME PERSISTENCE: If a faction leader (Player or NPC) becomes Supreme Leader, their faction name DOES NOT change to "Supreme Leader". It remains their original faction name (e.g., "Conservatives" remains "Conservatives").
- SUCCESSION SYSTEM: If the player is Supreme Leader and dies:
  * You MUST provide 3 'potentialSuccessors' in the JSON response.
  * They should be characters related to the player (e.g. designated heir, rival coup leader, loyal secretary).
- FACTION EVOLUTION (IMPORTANT):
  * If the ruling faction eliminates major opposition, it MUST splinter/subdivide to maintain conflict.
  * Example 1: If Conservatives/Beneficiaries (Hua Guofeng) win, they split into "Two Whatevers" (凡是派 - Wang Dongxing) vs "Reformists" (改革派 - Deng Xiaoping).
  * Example 2: If Reformists (Deng) win later, they split into "Radical Reformers" (改革派 - Hu Yaobang/Zhao Ziyang) vs "Conservatives" (保守派 - Chen Yun).
  * Characters MUST migrate factions based on ideology (e.g., Chen Yonggui -> Two Whatevers).
- DYNAMIC FACTIONS: Factions appear/disappear based on history OR player intervention.
- ALT-HISTORY RULE: If a specific faction maintains high percentage when they should historically fall (e.g., Lin Biao Faction > 40% in late 1971), HISTORICAL EVENTS CHANGE (e.g., Lin Biao might survive 913).
- COLOR CODING: 
  * "造反派" (Rebels) MUST ALWAYS be #D62828 (Red). 
  * "保皇派" or "保守派" (Conservatives) MUST ALWAYS be #1e3a8a (Blue). 
  * Other factions should have distinct colors. If factions split/evolve, assign new thematic colors.

FOREIGN LEADER RULES (HISTORICAL):
- If the player character is a historical Foreign Political Figure (e.g., Brezhnev, LBJ, Enver Hoxha):
  1. Their 'currentFaction' MUST be their foreign party (e.g. "苏共", "美国民主党").
  2. THIS FOREIGN FACTION MUST NOT APPEAR IN THE 'factionsUpdate' list (The Revolutionary Situation Map) unless they have successfully infiltrated the mainland. The 'factionsUpdate' list must remain 100% focused on Mainland Chinese factions initially.
  3. INTERVENTION: If a foreign leader uses "Manipulate Scales", interpret it as "Fostering a Proxy" (扶植代理人) or "Infiltration". A success means a NEW faction allied with them appears in China, or an existing faction moves closer to them.
  4. TRAIT: They must start with a 'LEGENDARY' trait denoting their specific foreign office/position (e.g. "苏共总书记").

POLITICAL POWER & SCALES:
- Players have "Power Points" (权势点).
- If Player is a Faction Leader: They gain +1 Power Point every 12 months (1 year) automatically (Backend logic).
- ACTION "Manipulate Scales" (摆弄天平):
  * Check Result = SUCCESS: Increase player's faction by 5-10%, decrease others.
  * Check Result = CRITICAL SUCCESS: Increase player's faction heavily, significantly reduce the largest rival.
  * Check Result = FAILURE: No change.
  * Check Result = CRITICAL FAILURE: Decrease player's faction by 5%.
  * NOTE: "Supreme Leader" (if player achieves this status) can boost ANY faction.

SUPREME LEADER TRAIT RULE:
- RESTRICTION: "Supreme Leader" (最高领袖) status/trait is EXCLUSIVE to the paramount leader of the Mainland Chinese Government (PRC). Leaders of other regions, independent factions, or other countries DO NOT qualify.
- TRIGGER: If the player attains this specific status (Name matches Supreme Leader Name), they MUST automatically receive the following trait in 'traitsUpdate.add':
  * Name: "最高领袖"
  * Rarity: "独特" (Legendary)
  * Modifiers: politics +10, charisma +10. (DO NOT ADD SPIRIT/MENTAL or other stats).
  * Description: "天下大乱，达到天下大治。"

HIDDEN HEALTH & AGE SYSTEM:
- Perform hidden 'Health Check' based on Age (<40 safe, >40 decline) and Physique.
- If check fails, reduce health.

DIFFICULTY GENERATION RULES:
- When creating Choices, the 'difficulty' field represents the BASE COMPLEXITY of the task itself (0-100).
- DO NOT subtract player attributes in the JSON. The frontend engine will handle the subtraction.
- DO NOT use round numbers consistently (avoid 50, 60, 70). Use varied numbers like 47, 63, 82 to feel organic.
- Scale: 30 (Routine), 50 (Challenging), 70 (Hard), 90 (Extreme).

${styleInstruction}
`;
};

// --- Helper Functions ---

const sanitizeTraits = (traits: any[], historyStyle: HistoryStyle): Trait[] => {
    if (!Array.isArray(traits)) return [];
    return traits.map((t: any) => ({
        id: t.id || `trait_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: safeString(t.name),
        description: safeString(t.description),
        rarity: t.rarity || TraitRarity.COMMON,
        modifiers: t.modifiers || {},
        duration: t.duration
    }));
};

// --- Generation Functions ---

export const generateBackstory = async (name: string, background: BackgroundType, attributes: Attributes, historyStyle: HistoryStyle): Promise<string> => {
  const prompt = `
    GENERATE BACKSTORY:
    Name: ${name}
    Background: ${background}
    Attributes: ${JSON.stringify(attributes)}
    Style: ${historyStyle}
    
    Write a short, immersive backstory (approx. 100-150 words) for this character living in 1966 China. 
    Focus on their upbringing and current situation.
    Output in Simplified Chinese.
  `;
  return await unifiedGenerate({ 
    prompt,
    systemInstruction: getSystemInstruction(1.0, historyStyle) 
  });
};

export const generateInitialTraits = async (name: string, background: BackgroundType, attributes: Attributes, backstory: string, historyStyle: HistoryStyle): Promise<Trait[]> => {
  const prompt = `
    GENERATE TRAITS:
    Name: ${name}
    Background: ${background}
    Backstory: ${backstory}
    Attributes: ${JSON.stringify(attributes)}
    
    Generate 3-4 initial traits for this character.
    One must be related to background.
    One must be related to their highest attribute.
    One should be a personality quirk.
  `;
  
  const schema: Schema = {
      type: Type.OBJECT,
      properties: {
          traits: { type: Type.ARRAY, items: traitSchema }
      },
      required: ["traits"]
  };
  
  const text = await unifiedGenerate({ 
      prompt, 
      systemInstruction: getSystemInstruction(1.0, historyStyle), 
      responseSchema: schema 
  });
  
  try {
      const data = JSON.parse(cleanJsonString(text));
      return sanitizeTraits(data.traits, historyStyle);
  } catch (e) {
      console.error("Trait generation failed", e);
      return [];
  }
};

export const generateHistoricalProfile = async (name: string, historyStyle: HistoryStyle): Promise<{
    valid: boolean;
    reason?: string;
    data?: {
        attributes: Attributes;
        backstory: string;
        traits: Trait[];
        birthYear: number;
        foreignInfo?: { isForeign: boolean; foreignFaction: string };
    }
}> => {
    const prompt = `
    Check if '${name}' is a real historical figure relevant to the Cultural Revolution or Cold War era (approx 1966).
    If yes, generate a profile including stats, traits, and backstory.
    
    STRICT ATTRIBUTE GENERATION RULES:
    - You MUST balance the attributes.
    - The SUM of all 6 attributes (physique, intelligence, spirit, agility, charisma, politics) MUST BE APPROXIMATELY 38 (Standard Max for players).
    - DO NOT generate overpowered stats. Even Mao Zedong or Lin Biao should adhere to this limit (e.g. high Politics/Charisma but lower Agility/Physique).
    - Range for each attribute: 3 (Weak) to 10 (Legendary).
    - Example of balanced stats: Physique 4, Int 8, Spirit 6, Agility 4, Charisma 8, Politics 8. (Sum = 38).
    
    If no, set valid to false.
    `;
    
    const profileSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            valid: { type: Type.BOOLEAN },
            reason: { type: Type.STRING },
            data: {
                type: Type.OBJECT,
                properties: {
                    attributes: {
                        type: Type.OBJECT,
                        properties: {
                            physique: { type: Type.INTEGER },
                            intelligence: { type: Type.INTEGER },
                            spirit: { type: Type.INTEGER },
                            agility: { type: Type.INTEGER },
                            charisma: { type: Type.INTEGER },
                            politics: { type: Type.INTEGER },
                        },
                        required: ["physique", "intelligence", "spirit", "agility", "charisma", "politics"]
                    },
                    backstory: { type: Type.STRING },
                    traits: { type: Type.ARRAY, items: traitSchema },
                    birthYear: { type: Type.INTEGER },
                    foreignInfo: {
                        type: Type.OBJECT,
                        properties: {
                            isForeign: { type: Type.BOOLEAN },
                            foreignFaction: { type: Type.STRING }
                        },
                        nullable: true
                    }
                },
                nullable: true
            }
        },
        required: ["valid"]
    };

    const text = await unifiedGenerate({ 
        prompt, 
        systemInstruction: getSystemInstruction(1.0, historyStyle), 
        responseSchema: profileSchema 
    });

    try {
        const res = JSON.parse(cleanJsonString(text));
        if (res.data && res.data.traits) {
            res.data.traits = sanitizeTraits(res.data.traits, historyStyle);
        }
        return res;
    } catch (e) {
        return { valid: false, reason: "Parsing Error" };
    }
};

// --- Updated Game Functions ---

export const startGame = async (
    name: string, 
    background: BackgroundType, 
    attributes: Attributes, 
    traits: Trait[], 
    backstory: string, 
    birthYear: number, 
    gameSettings: GameSettings,
    previousGameState?: { 
        year: number, 
        month: number, 
        factions: Faction[], 
        history: HistoryEntry[],
        supremeLeader: string
    }
): Promise<GameSceneResponse> => {
  const effectiveAttributes = { ...attributes };
  traits.forEach(t => {
    if (t.modifiers) {
      Object.entries(t.modifiers).forEach(([k, v]) => {
        const key = k as keyof Attributes;
        effectiveAttributes[key] = (effectiveAttributes[key] || 0) + (v as number);
      });
    }
  });

  const isForeign = background === BackgroundType.HISTORICAL; 
  const currentAge = (previousGameState ? previousGameState.year : 1966) - birthYear;

  let prompt = "";

  if (previousGameState) {
      // SUCCESSION START
      prompt = `
        CONTINUE GAME AS SUCCESSOR:
        New Player: ${name} (${background}).
        Age: ${currentAge}.
        Backstory: "${backstory}"
        Traits: ${JSON.stringify(traits)}
        Attributes: ${JSON.stringify(effectiveAttributes)}
        
        INHERITED WORLD STATE:
        Date: ${previousGameState.year}-${previousGameState.month}
        Previous Supreme Leader (Deceased/Retired): ${previousGameState.supremeLeader}
        Factions: ${JSON.stringify(previousGameState.factions)}
        Recent History: ${JSON.stringify(previousGameState.history.slice(-3))}

        Task:
        1. Generate an opening scene where the new character takes the stage in this EXISTING timeline.
        2. Define the NEW Supreme Leader (could be the player or a rival).
        3. Assign the Ruling Symbol and Slogan appropriate for the new leader.
        4. Update factions if immediate power shifts occur.
        5. Provide 3 initial choices.
      `;
  } else {
      // FRESH START
      prompt = `
        INITIALIZE GAME:
        Player: ${name}, Background: ${background}.
        Birth Year: ${birthYear} (Age: ${currentAge}).
        Backstory: "${backstory}"
        Traits: ${JSON.stringify(traits)}
        Effective Attributes: ${JSON.stringify(effectiveAttributes)}
        Starting Year: 1966, Month: 5.
        
        Task:
        1. Generate an immersive opening scene in Simplified Chinese.
        2. Define initial National Factions for 1966 (Rebels, Conservatives, etc.) with percentages summing to 100.
        3. IMPORTANT: If the player is a Foreign Leader (e.g. Brezhnev), their personal faction (e.g. CPSU) MUST NOT be in this percentage list initially (it is external).
        4. Identify the Supreme Leader (e.g. Mao Zedong). Provide slogan ("大海航行靠舵手") and symbol ("☭").
        5. Assign player to a faction: If foreign, assign them to their foreign party (e.g. "苏共"). If domestic, assign based on background.
        6. Provide 3 initial choices with calculated difficulty.
      `;
  }

  try {
    const text = await unifiedGenerate({ 
      prompt, 
      systemInstruction: getSystemInstruction(gameSettings.baseLuck, gameSettings.historyStyle), 
      responseSchema: gameResponseSchema 
    });
    
    const data = JSON.parse(cleanJsonString(text));
    
    // Deep Sanitize response
    data.narrative = safeString(data.narrative);
    data.gameOverReason = safeString(data.gameOverReason);
    data.choices = (data.choices || []).map((c: any) => ({
        ...c,
        text: safeString(c.text),
        intent: safeString(c.intent)
    }));

    if (data.traitsUpdate?.add) data.traitsUpdate.add = sanitizeTraits(data.traitsUpdate.add, gameSettings.historyStyle);
    if (data.supremeLeaderUpdate) {
        data.supremeLeaderUpdate.name = safeString(data.supremeLeaderUpdate.name);
        data.supremeLeaderUpdate.slogan = safeString(data.supremeLeaderUpdate.slogan, "大海航行靠舵手");
        data.supremeLeaderUpdate.symbol = safeString(data.supremeLeaderUpdate.symbol, "☭");
    }
    
    // Safety check for factions
    if (data.factionsUpdate && !Array.isArray(data.factionsUpdate)) {
        console.warn("API returned invalid factionsUpdate, defaulting to null");
        data.factionsUpdate = undefined; 
    }

    return data as GameSceneResponse;

  } catch (error) {
    console.error("Game Start Error", error);
    throw error;
  }
};

export const makeTurn = async (currentState: GameState, choiceId: string, choiceText: string, rollResult: RollResult = 'NONE', gameSettings: GameSettings): Promise<GameSceneResponse> => {
  const effectiveAttributes = { ...currentState.stats.attributes };
  currentState.stats.traits.forEach(t => {
    if (t.modifiers) {
      Object.entries(t.modifiers).forEach(([k, v]) => {
        const key = k as keyof Attributes;
        effectiveAttributes[key] = (effectiveAttributes[key] || 0) + (v as number);
      });
    }
  });

  const historyTextLog = currentState.historySummary.slice(-3).map(h => 
    `${h.year}年${h.month}月: ${h.text} [${h.result}]`
  );

  const currentAge = currentState.year - currentState.stats.birthYear;

  const isLeader = currentState.stats.isLeader;
  // UPDATE: Leader power gain changed from 6mo to 12mo
  const powerPointHint = isLeader ? "Player is a Faction Leader. If 12 months have passed since last grant, award +1 Power Point." : "";
  
  // Detect if foreign faction (heuristic: name contains foreign country/party or is not in standard list)
  const isForeignFaction = !currentState.factions.find(f => f.name === currentState.stats.currentFaction) && currentState.background === BackgroundType.HISTORICAL;

  // UPDATE: Special instruction for 'Manipulate Scales' choice
  let manipulateChoiceInstruction = "";
  if (currentState.stats.powerPoints > 0) {
      manipulateChoiceInstruction = "IMPORTANT: The player has Power Points. You MUST include an additional choice option with id 'special_manipulate_scales'. ";
      if (isForeignFaction) {
          manipulateChoiceInstruction += "Since player is FOREIGN, this action represents 'Fostering a Proxy/Infiltration'. Narrative should reflect supporting a domestic faction or introducing a new proxy.";
      } else {
          manipulateChoiceInstruction += "Describes using political power to intervene/manipulate the situation relevant to the narrative.";
      }
  } else {
      manipulateChoiceInstruction = "IMPORTANT: The player has 0 Power Points. You MUST NOT generate the 'special_manipulate_scales' choice. Only normal choices.";
  }

  const prompt = `
    CURRENT STATE:
    Date: ${currentState.year}-${currentState.month}
    Player: ${currentState.name} (${currentState.background})
    Age: ${currentAge}
    Faction: ${currentState.stats.currentFaction} (Leader: ${isLeader})
    Power Points: ${currentState.stats.powerPoints}
    Current Factions: ${JSON.stringify(currentState.factions)}
    Current Supreme Leader: ${currentState.supremeLeader} (Symbol: ${currentState.rulingPartySymbol})
    Traits: ${JSON.stringify(currentState.stats.traits)}
    Effective Attributes: ${JSON.stringify(effectiveAttributes)}
    Stats: Political=${currentState.stats.politicalStanding}, Health=${currentState.stats.health}, Mental=${currentState.stats.mental}
    History: ${historyTextLog.join(" -> ")}
    
    ACTION:
    Choice: "${choiceText}"
    ROLL RESULT: ${rollResult}
    
    TASK:
    1. Resolve action based on ROLL RESULT.
    2. Consider adding/removing traits.
    3. Update traits duration.
    4. PERFORM HIDDEN HEALTH CHECK.
    5. FACTION SYSTEM: Update faction percentages. Total must = 100. 
       (If Foreign Leader uses 'special_manipulate_scales', they can introduce a new proxy faction into this list or boost an ally).
    6. Update 'supremeLeaderUpdate' if the leader changes (e.g. Mao dies). IF LEADER CHANGES, you MUST update 'slogan' and 'symbol'.
    7. ${powerPointHint}
    8. Advance time by ${gameSettings.monthsPerTurn} month(s).
    9. Generate 3 normal choices.
    10. ${manipulateChoiceInstruction}
    11. SUCCESSOR CHECK: If isGameOver=true AND Player was Supreme Leader, generate 3 'potentialSuccessors'.
    Output in Simplified Chinese.
  `;

  try {
    const text = await unifiedGenerate({
      prompt,
      systemInstruction: getSystemInstruction(gameSettings.baseLuck, gameSettings.historyStyle),
      responseSchema: gameResponseSchema
    });

    const data = JSON.parse(cleanJsonString(text));

    // Deep Sanitize response
    data.narrative = safeString(data.narrative);
    data.gameOverReason = safeString(data.gameOverReason);
    data.choices = (data.choices || []).map((c: any) => ({
        ...c,
        text: safeString(c.text),
        intent: safeString(c.intent)
    }));

    if (data.traitsUpdate?.add) data.traitsUpdate.add = sanitizeTraits(data.traitsUpdate.add, gameSettings.historyStyle);
    if (data.supremeLeaderUpdate) {
        data.supremeLeaderUpdate.name = safeString(data.supremeLeaderUpdate.name);
        // Do not overwrite with defaults if undefined here, handle in UI/State merge
        if(data.supremeLeaderUpdate.slogan) data.supremeLeaderUpdate.slogan = safeString(data.supremeLeaderUpdate.slogan);
        if(data.supremeLeaderUpdate.symbol) data.supremeLeaderUpdate.symbol = safeString(data.supremeLeaderUpdate.symbol);
    }
    
    // Safety check for factions
    if (data.factionsUpdate && !Array.isArray(data.factionsUpdate)) {
        console.warn("API returned invalid factionsUpdate, ignoring");
        data.factionsUpdate = undefined;
    }

    return data as GameSceneResponse;
  } catch (error) {
    console.error("Game Turn Error:", error);
    throw error;
  }
};