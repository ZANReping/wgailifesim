
import { unifiedGenerate } from "./api";
import { getSystemInstruction, sanitizeTraits } from "./prompts";
import { gameResponseSchema } from "./schemas";
import { cleanJsonString, safeString } from "./utils";
import { BackgroundType, Attributes, Trait, GameSettings, Faction, HistoryEntry, GameSceneResponse, GameState, RollResult, TraitRarity } from "../types";

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
        4. **STRICT FACTION CONTINUITY**: The faction percentages MUST start exactly or very similarly to the Inherited World State. 
           - **DO NOT** arbitrarily make the player's faction the winner (100%) unless the narrative logic explicitly dictates an immediate coup or victory in this opening scene. 
           - If the previous leader died leaving a power vacuum, the factions should remain balanced/chaotic, not instantly resolved.
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
        intent: safeString(c.intent),
        difficulty: typeof c.difficulty === 'number' ? c.difficulty : 50 // Enforce default if missing
    }));

    if (data.traitsUpdate?.add) data.traitsUpdate.add = sanitizeTraits(data.traitsUpdate.add, gameSettings.historyStyle);
    if (data.supremeLeaderUpdate) {
        data.supremeLeaderUpdate.name = safeString(data.supremeLeaderUpdate.name);
        data.supremeLeaderUpdate.slogan = safeString(data.supremeLeaderUpdate.slogan, "大海航行靠舵手");
        data.supremeLeaderUpdate.symbol = safeString(data.supremeLeaderUpdate.symbol, "☭");
    }
    
    // Auto-Grant "Supreme Leader" trait if applicable
    const isNowLeader = data.supremeLeaderUpdate ? (data.supremeLeaderUpdate.name === name) : (previousGameState?.supremeLeader === name);
    if (isNowLeader) {
        if (!data.traitsUpdate) data.traitsUpdate = {};
        if (!data.traitsUpdate.add) data.traitsUpdate.add = [];
        
        // Add the unique trait
        data.traitsUpdate.add.push({
            id: 'trait_supreme_leader_auto',
            name: '最高领袖',
            description: '普天之下，莫非王土。你掌握着国家的最高权力。',
            rarity: TraitRarity.LEGENDARY,
            modifiers: { politics: 10, charisma: 10, spirit: 5 }
        });
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
  const hasSupremeTrait = currentState.stats.traits.some(t => t.name === '最高领袖');
  
  // --- Power Points Logic (Leader Only + Cooldown) ---
  const lastGrant = currentState.lastPowerPointGrantDate;
  // Calculate months passed since last grant. If null, treat as infinite time passed.
  const monthsSinceGrant = lastGrant 
    ? ((currentState.year - lastGrant.year) * 12 + (currentState.month - lastGrant.month))
    : 999;
  
  const COOLDOWN_MONTHS = 3;
  let powerPointInstruction = "";
  
  if (!isLeader) {
      powerPointInstruction = "CONSTRAINT (Power Points): Player is NOT a Faction Leader. DO NOT award Power Points (statsDelta.powerPoints must be 0 or negative).";
  } else if (monthsSinceGrant < COOLDOWN_MONTHS) {
      powerPointInstruction = `CONSTRAINT (Power Points): Leader Power Point Cooldown is ACTIVE (${monthsSinceGrant}/${COOLDOWN_MONTHS} months). DO NOT award Power Points this turn (statsDelta.powerPoints must be 0 or negative).`;
  } else {
      powerPointInstruction = "CONSTRAINT (Power Points): Player is Faction Leader and Cooldown is READY. You MAY award +1 Power Point if the narrative involves a significant political victory. Max +1.";
  }
  // ---------------------------------------------------

  const isForeignFaction = !currentState.factions.find(f => f.name === currentState.stats.currentFaction) && currentState.background === BackgroundType.HISTORICAL;

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

  // Updated: Instruction for 'Write Testament' choice. STRICT Health < 20
  let testamentInstruction = "";
  // Check if already designated a successor
  if (!currentState.designatedSuccessor && isLeader && currentState.stats.health < 20) {
      testamentInstruction = "CRITICAL: Player is a dying Faction Leader (Health < 20) AND has NOT designated an heir yet. You MUST include an additional choice option with id 'action_write_testament' (Text: '立下遗嘱'). This allows them to designate an heir before death. If you include this choice, you MUST also populate the 'suggestedHeirs' field with 3 potential names.";
  }

  // Handle Testament Action Logic in Prompt
  let specialContext = "";
  if (choiceId === 'action_write_testament') {
      specialContext = `PLAYER ACTION: WRITE TESTAMENT. The player text contains the designated heir's name. You MUST extract this name and return it in the 'designatedSuccessorUpdate' JSON field.`;
  }
  
  // Handle Death & Succession Logic in Prompt
  let successionConstraint = "";
  if (currentState.designatedSuccessor) {
      successionConstraint = `IMPORTANT: The player has already designated an heir: "${currentState.designatedSuccessor}". If the player dies (isGameOver=true), you MUST include this heir as the FIRST option in 'potentialSuccessors' list (assuming they are alive).`;
  }

  const prompt = `
    CURRENT STATE:
    Date: ${currentState.year}-${currentState.month}
    Player: ${currentState.name} (${currentState.background})
    Age: ${currentAge}
    Faction: ${currentState.stats.currentFaction} (Leader: ${isLeader})
    Power Points: ${currentState.stats.powerPoints}
    Designated Successor: ${currentState.designatedSuccessor || "None"}
    Current Factions: ${JSON.stringify(currentState.factions)}
    Current Supreme Leader: ${currentState.supremeLeader}
    Traits: ${JSON.stringify(currentState.stats.traits)}
    Effective Attributes: ${JSON.stringify(effectiveAttributes)}
    Stats: Political=${currentState.stats.politicalStanding}, Health=${currentState.stats.health}, Mental=${currentState.stats.mental}
    History: ${historyTextLog.join(" -> ")}
    
    ACTION:
    Choice: "${choiceText}"
    ROLL RESULT: ${rollResult}
    
    ${specialContext}
    
    TASK:
    1. Resolve action based on ROLL RESULT.
    2. TRAIT EVOLUTION: 
       - If an event justifies it, REMOVE conflicting traits (put in traitsUpdate.removeIds).
       - If a permanent trait should become temporary due to injury/setback, remove the old one and add a new one with 'duration'.
       - If the player becomes Supreme Leader this turn, you MUST add 'traitsUpdate.add' with the '最高领袖' (Supreme Leader) Legendary trait.
    3. Update traits duration.
    4. PERFORM HIDDEN HEALTH CHECK.
    5. FACTION SYSTEM: Update faction percentages. Total must = 100.
    6. Update 'supremeLeaderUpdate' if the leader changes. IF LEADER CHANGES, you MUST update 'slogan' and 'symbol'.
    7. ${powerPointInstruction}
    8. Advance time by ${gameSettings.monthsPerTurn} month(s).
    9. Generate 3 normal choices. **CRITICAL REQUIREMENT**: ALL choices MUST have a 'requiredAttribute' (e.g., 'politics', 'physique') and a 'difficulty' value. DO NOT leave 'requiredAttribute' null unless it is a pure narrative choice (which is rare).
    10. ${manipulateChoiceInstruction}
    11. ${testamentInstruction}
    12. SUCCESSOR CHECK: If isGameOver=true AND (Player was Supreme Leader OR Player was a Faction Leader), generate 3 'potentialSuccessors'. ${successionConstraint}
    
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
        intent: safeString(c.intent),
        difficulty: typeof c.difficulty === 'number' ? c.difficulty : 50 // Enforce default if missing
    }));

    if (data.traitsUpdate?.add) data.traitsUpdate.add = sanitizeTraits(data.traitsUpdate.add, gameSettings.historyStyle);
    if (data.supremeLeaderUpdate) {
        data.supremeLeaderUpdate.name = safeString(data.supremeLeaderUpdate.name);
        if(data.supremeLeaderUpdate.slogan) data.supremeLeaderUpdate.slogan = safeString(data.supremeLeaderUpdate.slogan);
        if(data.supremeLeaderUpdate.symbol) data.supremeLeaderUpdate.symbol = safeString(data.supremeLeaderUpdate.symbol);
    }
    
    // Auto-Grant "Supreme Leader" trait logic in MakeTurn as well (redundancy for mid-game promotion)
    const isNowLeader = data.supremeLeaderUpdate ? (data.supremeLeaderUpdate.name === currentState.name) : (currentState.supremeLeader === currentState.name);
    // Only grant if they don't already have it
    if (isNowLeader && !hasSupremeTrait) {
        if (!data.traitsUpdate) data.traitsUpdate = {};
        if (!data.traitsUpdate.add) data.traitsUpdate.add = [];
        
        // Check if we are already adding it to avoid duplicates
        const alreadyAdding = data.traitsUpdate.add.some((t: Trait) => t.name === '最高领袖');
        if (!alreadyAdding) {
            data.traitsUpdate.add.push({
                id: `trait_supreme_${Date.now()}`,
                name: '最高领袖',
                description: '普天之下，莫非王土。你掌握着国家的最高权力。',
                rarity: TraitRarity.LEGENDARY,
                modifiers: { politics: 10, charisma: 10, spirit: 5 }
            });
        }
    }

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
