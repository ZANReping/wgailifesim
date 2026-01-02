
import { GoogleGenAI, Schema } from "@google/genai";
import { callWithRetry } from "./utils";

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

// --- OpenAI Compatible Implementation ---
const generateContentOpenAI = async (
  prompt: string, 
  systemInstruction: string | undefined, 
  responseSchema: Schema | undefined
): Promise<string> => {
  let url = config.baseUrl || "https://api.openai.com/v1";
  url = url.replace(/\/$/, "");
  if (!url.endsWith("/chat/completions")) {
    url += "/chat/completions";
  }

  const model = getModel();
  
  let finalSystemInstruction = systemInstruction || "";
  if (responseSchema) {
    finalSystemInstruction += `\n\nIMPORTANT: You must output strictly valid JSON. The JSON must adhere to the following schema:\n${JSON.stringify(responseSchema, null, 2)}`;
  }

  const messages = [
    { role: "system", content: finalSystemInstruction },
    { role: "user", content: prompt }
  ];

  const requestBody: any = {
    model: model,
    messages: messages,
    temperature: 0.7
  };

  // Only enforce JSON object mode if schema is provided
  if (responseSchema) {
    requestBody.response_format = { type: "json_object" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorCode = res.status;
      try {
          const errJson = JSON.parse(errorText);
          if (errJson.error?.code) errorCode = errJson.error.code;
      } catch (e) {}

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
export const unifiedGenerate = async (params: {
  prompt: string;
  systemInstruction?: string;
  responseSchema?: Schema;
  historyStyle?: any; // For debugging or logging if needed
}): Promise<string> => {
  return callWithRetry(async () => {
    if (config.apiType === 'openai') {
      return await generateContentOpenAI(params.prompt, params.systemInstruction, params.responseSchema);
    } else {
      // Gemini Mode
      const client = getGeminiClient();
      const model = getModel();
      
      const generationConfig: any = {
        systemInstruction: params.systemInstruction
      };

      // Only set responseMimeType to json if a schema is provided
      if (params.responseSchema) {
        generationConfig.responseMimeType = "application/json";
        generationConfig.responseSchema = params.responseSchema;
      }

      const response = await client.models.generateContent({
        model,
        contents: params.prompt,
        config: generationConfig
      });
      const text = response.text;
      if (!text) throw new Error("Empty response from Gemini");
      return text;
    }
  });
};

export const testConnection = async (apiKey: string, baseUrl: string, modelName: string, apiType: 'gemini' | 'openai'): Promise<boolean> => {
    const prevConfig = { ...config };
    updateGeminiConfig(apiKey, baseUrl, modelName, apiType);

    try {
        const testPrompt = "Reply with JSON: {\"status\": \"ok\"}";
        await unifiedGenerate({ prompt: testPrompt });
        updateGeminiConfig(prevConfig.apiKey, prevConfig.baseUrl, prevConfig.modelName, prevConfig.apiType);
        return true;
    } catch (e) {
        console.error("Connection test failed", e);
        updateGeminiConfig(prevConfig.apiKey, prevConfig.baseUrl, prevConfig.modelName, prevConfig.apiType);
        return false;
    }
};
