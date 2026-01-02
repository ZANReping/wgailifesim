
import { HistoryStyle, Trait, TraitRarity, Attributes } from "../types";
import { safeString } from "./utils";

export const getSystemInstruction = (baseLuck: number = 1.0, historyStyle: HistoryStyle = HistoryStyle.REALISM) => {
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

### LANGUAGE RULES (STRICT):
- **OUTPUT LANGUAGE**: ALL narrative, choices, and data MUST be in **Simplified Chinese (zh-CN)**.
- **NAMES**: ALL Person Names (e.g., '江青', '林彪') and Faction Names (e.g., '造反派', '八三四一') MUST be in Simplified Chinese characters. Do NOT use Pinyin or English for Chinese names.

### HISTORICAL ACCURACY CONSTRAINT (ALIVE CHECK):
- When assigning Faction Leaders or the Supreme Leader, you MUST verify they are **ALIVE** at the current simulation date.
- Do NOT list deceased figures as active leaders. (e.g. Do not list Liu Shaoqi as a leader after he is purged/deceased in timeline, unless it's an alternate history where he survived).

### TRAIT RARITY & FLAVOR GUIDE (STRICT):
When generating traits, the *Name*, *Description*, and *Modifiers* MUST match the Rarity:

1. **LEGENDARY (独特)**: 
   - **Definition**: One-of-a-kind historical destiny. CANNOT be obtained by normal means.
   - **Examples**: "Supreme Leader" (最高领袖), "January Storm Leader" (一月风暴领袖), "Authorized Successor" (法定接班人).
   - **Modifiers**: Sum > +8. Can go up to +15.
   - **Flavor**: "Destined", "Messianic", "Supreme Authority".

2. **CRIME (罪名)**:
   - **Definition**: Serious political crimes or labels that are almost a death sentence.
   - **Examples**: "Active Counter-Revolutionary" (现行反革命), "Traitor" (叛徒), "Foreign Spy" (里通外国).
   - **Modifiers**: Sum must be **< -15** (Less than negative 15). MUST have **negative 'politics'**.
   - **Flavor**: "Condemned", "Enemy of the People", "Purged".

3. **EPIC (罕见)**: 
   - **Definition**: Exceptional talent seen once in a generation, or deep "Red" bloodline.
   - **Modifiers**: Sum +5 to +7.
   - **Flavor**: "War Hero", "Genius", "Deeply Connected".
   - *Example*: "Long March Veteran" (+4 Politics, +3 Spirit).

4. **RARE (稀有)**: 
   - **Definition**: Professional expertise, strong talent, or specific background advantage.
   - **Modifiers**: Sum +3 to +4.
   - **Flavor**: "Skilled", "Educated", "Connected".
   - *Example*: "Tsinghua Graduate" (+3 Intelligence).

5. **COMMON (普通)**: 
   - **Definition**: Everyday habits, minor personality quirks, or small background details.
   - **Modifiers**: Sum +1 to +2.
   - **Flavor**: "Hobby", "Physical Feature", "Minor Habit".
   - *Example*: "Good Handwriting" (+1 Politics), "Strong Legs" (+1 Agility).

6. **NEGATIVE (恶劣)**: 
   - **Definition**: Fatal flaws, political stains, or disabilities.
   - **Modifiers**: Sum -1 to -10.
   - **Flavor**: "Black Five Category", "Sickly", "Traitor".

### ATTRIBUTE DEFINITIONS:
- **Agility (身手)**: Affects escaping, physical dodging, **military combat ability**, and **operation of machinery/vehicles**.
- **Politics (政治)**: Political sensitivity, faction standing, propaganda ability.

### TRAIT EVOLUTION RULES:
- **Dynamic Change**: Traits are NOT permanent. If the narrative justifies it, REMOVE old traits or CHANGE them.
- **Degradation**: If a character loses power or health, downgrade a permanent trait to a temporary trait (set 'duration': 6).
- **Contradiction**: If a new event contradicts an old trait (e.g., "Healthy" trait but player gets "Crippled"), REMOVE the old trait.

### GAMEPLAY RULES:
- **Difficulty**: ALL choices MUST have a difficulty value (0-100). Do NOT return null.
  - Exception: Only "Pity Action" (Free) or pure narrative transitions have difficulty 0.
  - Standard actions: 30 (Routine) to 90 (Extreme).
- **Faction Leaders**: You must track National Factions (percentages sum to 100) and provide specific NAMES for leaders.
- **Succession**: If Leader dies, provide 3 successors. If a testament exists, respect it.

${styleInstruction}
`;
};

export const sanitizeTraits = (traits: any[], historyStyle: HistoryStyle): Trait[] => {
    if (!Array.isArray(traits)) return [];
    
    // Create a set of valid rarities for O(1) lookup
    const validRarities = new Set(Object.values(TraitRarity));

    return traits.map((t: any) => {
        // Sanitize modifiers to prevent hallucinations like "11222"
        const sanitizedModifiers: Partial<Attributes> = {};
        if (t.modifiers) {
            for (const [key, val] of Object.entries(t.modifiers)) {
                 const attrKey = key as keyof Attributes;
                 let numVal = parseInt(String(val), 10);
                 if (isNaN(numVal)) numVal = 0;
                 
                 // Clamp to reasonable range (-20 to +20)
                 numVal = Math.max(-20, Math.min(20, numVal));
                 
                 if (numVal !== 0) {
                     sanitizedModifiers[attrKey] = numVal;
                 }
            }
        }

        // --- NEW RULE: Enforce Negative / Crime Rarity for purely negative traits ---
        const modifierValues = Object.values(sanitizedModifiers) as number[];
        let finalRarity = t.rarity;

        // 1. Sanitize Rarity Name (Fix hallucinations like "稀you")
        if (!validRarities.has(finalRarity)) {
            finalRarity = TraitRarity.COMMON;
        }

        // 2. Logic Check for Negative/Crime
        if (modifierValues.length > 0) {
            const hasPositive = modifierValues.some(v => v > 0);
            const sumValues = modifierValues.reduce((a, b) => a + b, 0);
            const politicsMod = sanitizedModifiers.politics || 0;
            
            // Crime Logic: Sum < -15, No positives, Negative Politics
            if (!hasPositive && sumValues < -15 && politicsMod < 0) {
                finalRarity = TraitRarity.CRIME;
            } 
            // General Negative Logic: Purely negative, but not severe enough for Crime
            else if (!hasPositive && sumValues < 0 && finalRarity !== TraitRarity.CRIME) {
                finalRarity = TraitRarity.NEGATIVE;
            }
        }
        // -------------------------------------------------------------------

        return {
            id: t.id || `trait_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: safeString(t.name),
            description: safeString(t.description),
            rarity: finalRarity,
            modifiers: sanitizedModifiers,
            duration: t.duration
        };
    });
};
