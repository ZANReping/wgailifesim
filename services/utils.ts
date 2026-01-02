
// Utility Helper Functions

export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const cleanJsonString = (str: string) => {
  return str.replace(/```json\n?|```/g, '').trim();
};

export const safeString = (val: any, defaultVal = ""): string => {
  if (val === null || val === undefined) return defaultVal;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
     return val.text || val.content || val.value || val.name || JSON.stringify(val);
  }
  return String(val);
};

export const callWithRetry = async <T>(fn: () => Promise<T>, retries = 3, initialDelay = 2000): Promise<T> => {
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
