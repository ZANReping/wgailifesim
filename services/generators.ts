
import { Type, Schema } from "@google/genai";
import { unifiedGenerate } from "./api";
import { getSystemInstruction, sanitizeTraits } from "./prompts";
import { traitSchema, gameStateSchema } from "./schemas";
import { cleanJsonString, safeString } from "./utils";
import { BackgroundType, Attributes, HistoryStyle, Trait, GameState } from "../types";

export const generateBackstory = async (name: string, background: BackgroundType, attributes: Attributes, historyStyle: HistoryStyle): Promise<string> => {
  const prompt = `
    GENERATE BACKSTORY:
    Name: ${name}
    Background: ${background}
    Attributes: ${JSON.stringify(attributes)}
    Style: ${historyStyle}
    
    Write a short, immersive backstory (approx. 100-150 words) for this character living in 1966 China. 
    Focus on their upbringing and current situation.
    
    IMPORTANT: Output pure text only. Do not wrap in JSON.
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
    
    Generate 3-4 initial traits for this character AS OF MAY 1966.
    
    TIME CONSTRAINT:
    - Current Date is MAY 1966.
    - DO NOT generate traits based on events that happen AFTER May 1966.
    
    PRIORITY RULES FOR TRAIT GENERATION:
    1. **UNIQUE IDENTITY (HIGHEST PRIORITY)**: If the backstory or name implies a specific nickname, famous title, or unique role (e.g., "Red Manager" (红色掌柜), "Little Cannon" (小钢炮), "Committee Leader" (委员长)), YOU MUST generate a Trait for it.
       - Set Rarity to **LEGENDARY (独特)**.
       - These specific titles are much more important than generic stats.
    2. **GENERIC TRAITS (LOW PRIORITY)**: Avoid generic personality traits like "Perseverance" (坚韧不拔), "Kindness" (善良), "Brave" (勇敢) unless absolutely necessary. These are boring. Prefer specific narrative traits.
    
    One must be related to background.
    One must be related to their highest attribute.
    
    NEGATIVE CONSTRAINT: 
    DO NOT generate the trait "Supreme Leader" (最高领袖) or "Chairman" (主席) here. 
    Even if the name is "Mao Zedong", do not give him the "Supreme Leader" trait yet. 
    That trait is reserved for Game State Logic only.
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
    Check if '${name}' is a real historical figure relevant to the Cultural Revolution or Cold War era.
    If yes, generate a profile including stats, traits, and backstory AS OF MAY 1966.
    
    CRITICAL HISTORICAL CONSTRAINT (TIME PARADOX):
    - Current Date is MAY 1966.
    - DO NOT generate traits or backstory details based on events that happened AFTER May 1966.
    - Example: Do not give Lin Biao "Traitor" trait (happened in 1971). Do not mention the arrest of Gang of Four (1976).
    - Only use historical facts available up to early 1966.
    
    LANGUAGE CONSTRAINT:
    - All names, traits, and text MUST be in Simplified Chinese.
    
    PRIORITY RULES FOR TRAIT GENERATION:
    1. **UNIQUE TITLES (HIGHEST PRIORITY)**: If the person has a specific historical nickname or title (e.g., "The Theoretical Authority" (理论权威), "General" (大将军)), generate a **LEGENDARY (独特)** trait for it.
    2. **GENERIC TRAITS (LOW PRIORITY)**: Do not use generic traits like "Smart" or "Strong" if a more specific historical trait fits.
    
    STRICT ATTRIBUTE GENERATION RULES:
    - You MUST balance the attributes.
    - The SUM of all 6 attributes (physique, intelligence, spirit, agility, charisma, politics) MUST BE APPROXIMATELY 38 (Standard Max for players).
    - DO NOT generate overpowered stats. Even Mao Zedong or Lin Biao should adhere to this limit (e.g. high Politics/Charisma but lower Agility/Physique).
    - Range for each attribute: 3 (Weak) to 10 (Legendary).
    - Example of balanced stats: Physique 4, Int 8, Spirit 6, Agility 4, Charisma 8, Politics 8. (Sum = 38).
    
    AGE & TRAIT COUNT RULES (Based on Age in 1966):
    - Calculate Age = 1966 - Birth Year.
    - If Age < 25: Generate 3 traits.
    - If Age 25-40: Generate 4 traits.
    - If Age 41-60: Generate 5 traits.
    - If Age > 60: Generate 6 traits.
    - Older characters have more accumulated life experience (Traits).
    
    NEGATIVE CONSTRAINT: 
    DO NOT generate the trait "Supreme Leader" (最高领袖) in the trait list. This is handled by game logic.
    
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

export const generateTimeTravelerProfile = async (
    name: string, 
    tag: string, 
    age: number, 
    location: string, 
    historyStyle: HistoryStyle
): Promise<{
    valid: boolean;
    reason?: string;
    data?: {
        attributes: Attributes;
        backstory: string;
        traits: Trait[];
    }
}> => {
    const prompt = `
    GENERATE TIME TRAVELER PROFILE:
    Name: ${name}
    Tag/Source: ${tag}
    Arrival Age: ${age}
    Arrival Location: ${location}
    Target Year: 1966
    
    TASK 1: IDENTITY VERIFICATION
    Identify the character based on the Name and Tag. 
    - Can be a real person from History (Ancient/Modern/Future).
    - Can be a Fictional Character.
    
    TASK 2: CONFLICT CHECK (CRITICAL)
    Check if this exact person was ACTUALLY ALIVE and ACTIVE in China during the Cultural Revolution (1966-1976).
    - If yes (e.g. name="Mao Zedong", tag="Chairman"), set 'valid': false, 'reason': "此人已在当当前时空中活跃，请选择'历史人物'出身以避免时空悖论。".
    - If they existed but were dead by 1966 (e.g. Lu Xun), it is VALID (Time Travel).
    - If they are born after 1976 (e.g. Ma Huateng), it is VALID (Time Travel).
    - If they are fictional (e.g. Sun Wukong), it is VALID.
    
    TASK 3: PROFILE GENERATION
    If valid, generate attributes and traits based on their **FULL LORE/HISTORY** (including future knowledge or magical abilities if fictional).
    
    - **Attributes**: Adapt their abilities to the game scale (3-10).
      - Example: Sun Wukong -> High Physique/Agility/Spirit.
      - Example: Ma Huateng -> High Intelligence/Charisma/Money(Politics?).
    - **Traits**: Generate 4-6 traits reflecting their unique abilities or future knowledge.
      - Use **LEGENDARY (独特)** traits for their defining powers/titles.
      - *Note*: Magical/Sci-fi abilities should be adapted to "Low Magic/Realism" flavor where possible, or kept as "Unexplainable" traits.
    - **Backstory**: Describe their sudden arrival in ${location} in 1966. How do they look? What are they wearing?
    
    LANGUAGE: Simplified Chinese.
    `;

    const travelerSchema: Schema = {
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
                    traits: { type: Type.ARRAY, items: traitSchema }
                },
                nullable: true
            }
        },
        required: ["valid"]
    };

    const text = await unifiedGenerate({
        prompt,
        systemInstruction: getSystemInstruction(1.0, historyStyle),
        responseSchema: travelerSchema
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

export const repairSaveData = async (partialData: any, historyStyle: HistoryStyle): Promise<GameState> => {
    const prompt = `
      REPAIR SAVE FILE:
      I have a potentially incomplete or corrupted JSON save file for the "Revolutionary Storm: 1966" RPG.
      
      INPUT DATA:
      ${JSON.stringify(partialData).substring(0, 10000)} // Truncate to avoid context limit if huge, but usually safe.
      
      TASK:
      1. Validate the structure against the standard GameState schema.
      2. If fields are missing (e.g., missing attributes, missing faction list, missing backstory), FILL THEM IN using context cues from the existing data.
      3. If 'stats.attributes' are missing, generate balanced attributes based on the character's background/history.
      4. If 'factions' are missing, generate standard factions for the provided year (e.g. 1966: Rebels, Conservatives).
      5. If 'historySummary' is missing, generate a short 1-line summary saying "History data recovered." or reconstruct from 'year'.
      6. Ensure 'supremeLeader' is valid for the year.
      
      Return the FULL, VALID GameState object.
    `;

    const text = await unifiedGenerate({
        prompt,
        systemInstruction: getSystemInstruction(1.0, historyStyle),
        responseSchema: gameStateSchema
    });

    try {
        const repairedState = JSON.parse(cleanJsonString(text));
        // Post-process traits to ensure modifiers are valid numbers
        if (repairedState.stats && repairedState.stats.traits) {
            repairedState.stats.traits = sanitizeTraits(repairedState.stats.traits, historyStyle);
        }
        return repairedState as GameState;
    } catch (e) {
        console.error("Save repair failed", e);
        throw new Error("Unable to repair save file.");
    }
};
