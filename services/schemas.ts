
import { Type, Schema } from "@google/genai";
import { TraitRarity, BackgroundType } from "../types";

export const traitSchema: Schema = {
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

export const factionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    percentage: { type: Type.NUMBER },
    leaders: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "List of specific HISTORICAL PERSON NAMES (e.g. 'Jiang Qing', 'Zhang Chunqiao', 'Tan Zhenlin'). Do NOT use titles like 'Chairman' or 'General'. For 'Wanderers' (逍遥派) or leaderless groups, leave empty."
    },
    color: { type: Type.STRING, description: "Hex color code. Rebel(造反派) MUST be '#D62828' (Crimson Red). Conservatives(保皇派/保守派) MUST be '#1e3a8a' (Dark Blue). Lin Biao: Green; Wanderers: Yellow/White." },
    alliedWith: { type: Type.STRING, nullable: true },
    description: { type: Type.STRING, nullable: true }
  },
  required: ["name", "percentage", "leaders", "color"]
};

export const successorSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    name: { type: Type.STRING },
    description: { type: Type.STRING, description: "Brief relationship to the former leader (e.g. 'Loyal Secretary', 'Ambitious General')." },
    background: { type: Type.STRING, enum: Object.values(BackgroundType) }
  },
  required: ["id", "name", "description", "background"]
};

export const gameStateSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        year: { type: Type.INTEGER },
        month: { type: Type.INTEGER },
        name: { type: Type.STRING },
        background: { type: Type.STRING, enum: Object.values(BackgroundType) },
        supremeLeader: { type: Type.STRING },
        supremeLeaderSlogan: { type: Type.STRING },
        rulingPartySymbol: { type: Type.STRING },
        isGameOver: { type: Type.BOOLEAN },
        gameOverReason: { type: Type.STRING, nullable: true },
        backstory: { type: Type.STRING },
        turnsSinceLastCritical: { type: Type.INTEGER },
        designatedSuccessor: { type: Type.STRING, nullable: true },
        suggestedHeirs: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
        stats: {
            type: Type.OBJECT,
            properties: {
                birthYear: { type: Type.INTEGER },
                politicalStanding: { type: Type.INTEGER },
                health: { type: Type.INTEGER },
                mental: { type: Type.INTEGER },
                redStars: { type: Type.INTEGER },
                powerPoints: { type: Type.INTEGER },
                currentFaction: { type: Type.STRING },
                isLeader: { type: Type.BOOLEAN },
                inventory: { type: Type.ARRAY, items: { type: Type.STRING } },
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
                traits: { type: Type.ARRAY, items: traitSchema }
            },
            required: ["politicalStanding", "health", "mental", "redStars", "powerPoints", "currentFaction", "isLeader", "attributes", "traits"]
        },
        factions: { type: Type.ARRAY, items: factionSchema },
        historySummary: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    year: { type: Type.INTEGER },
                    month: { type: Type.INTEGER },
                    text: { type: Type.STRING },
                    result: { type: Type.STRING },
                }
            }
        }
    },
    required: ["year", "month", "name", "background", "stats", "factions", "supremeLeader"]
};

export const gameResponseSchema: Schema = {
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
          difficulty: { type: Type.INTEGER, description: "MANDATORY. Base difficulty (0-100) of the task BEFORE attribute modifiers. 30=Easy, 50=Medium, 70=Hard, 90=Extreme. ALL choices must have a difficulty." },
        },
        required: ["id", "text", "intent", "difficulty"],
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
        description: "If the player was the Supreme Leader OR a Faction Leader and has died/retired, provide 3 potential successors to continue the timeline.",
        nullable: true
    },
    designatedSuccessorUpdate: {
        type: Type.STRING,
        description: "If the player explicitly chose to Write Testament, return the designated heir's name here.",
        nullable: true
    },
    suggestedHeirs: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "If 'action_write_testament' is generated, provide 3 potential heir names/descriptions here (e.g. 'Wang Hongwen (Worker)', 'Zhang Chunqiao (Ally)').",
        nullable: true
    }
  },
  required: ["narrative", "year", "month", "statsDelta", "choices", "isGameOver"],
};
