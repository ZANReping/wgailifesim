
import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, ProviderConfig, GameSettings, HistoryStyle } from '../types';
import { testConnection } from '../services/geminiService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
  initialSettings: AppSettings;
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error';
type Tab = 'api' | 'game' | 'data';

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialSettings }) => {
  const [activeTab, setActiveTab] = useState<Tab>('api');
  
  // API State
  const [apiType, setApiType] = useState<'gemini' | 'openai'>(initialSettings.apiType);
  const [geminiConfig, setGeminiConfig] = useState<ProviderConfig>(initialSettings.gemini);
  const [openaiConfig, setOpenaiConfig] = useState<ProviderConfig>(initialSettings.openai);
  
  // Game Settings State
  const [gameSettings, setGameSettings] = useState<GameSettings>(initialSettings.gameSettings || { monthsPerTurn: 1, baseLuck: 1.0, historyStyle: HistoryStyle.REALISM });

  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from props when opened
  useEffect(() => {
    if (isOpen) {
      setApiType(initialSettings.apiType);
      setGeminiConfig(initialSettings.gemini);
      setOpenaiConfig(initialSettings.openai);
      setGameSettings(initialSettings.gameSettings || { monthsPerTurn: 1, baseLuck: 1.0, historyStyle: HistoryStyle.REALISM });
      setTestStatus('idle');
      setMessage(null);
      setActiveTab('api');
    }
  }, [isOpen, initialSettings]);

  // Helper to get/set active config fields based on apiType
  const activeConfig = apiType === 'gemini' ? geminiConfig : openaiConfig;
  
  const updateActiveConfig = (updates: Partial<ProviderConfig>) => {
    setTestStatus('idle');
    if (apiType === 'gemini') {
      setGeminiConfig(prev => ({ ...prev, ...updates }));
    } else {
      setOpenaiConfig(prev => ({ ...prev, ...updates }));
    }
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setMessage(null);
    const success = await testConnection(activeConfig.apiKey, activeConfig.baseUrl, activeConfig.modelName, apiType);
    setTestStatus(success ? 'success' : 'error');
  };

  const handleSave = () => {
    let finalGemini = { ...geminiConfig };
    let finalOpenAI = { ...openaiConfig };
    let finalGameSettings = { ...gameSettings };

    // CHEAT MODE CHECK: Check the dedicated cheat code input
    const code = finalGameSettings.cheatCodeInput ? finalGameSettings.cheatCodeInput.trim().toUpperCase() : '';
    if (code === 'ZAN') {
        finalGameSettings.cheatMode = true;
    } else {
        finalGameSettings.cheatMode = false;
    }

    onSave({
      apiType,
      gemini: finalGemini,
      openai: finalOpenAI,
      gameSettings: finalGameSettings
    });
    onClose();
  };

  const handleExport = () => {
    const settings = {
      apiType,
      gemini: geminiConfig,
      openai: openaiConfig,
      gameSettings
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "gemini_rpg_settings.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    setMessage({ text: "配置已导出", type: "success" });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const target = e.target;
      const file = target.files?.[0];
      
      if (file) {
        const fileReader = new FileReader();
        fileReader.onload = (event) => {
          try {
            const result = event.target?.result;
            if (typeof result === 'string') {
               const parsed = JSON.parse(result);
               if (parsed.apiType && (parsed.gemini || parsed.openai)) {
                   // Strictly update state using arrow functions or direct values to avoid unwanted arguments
                   setApiType(parsed.apiType);
                   
                   if (parsed.gemini) {
                       const newGemini = parsed.gemini;
                       setGeminiConfig(newGemini);
                   }
                   if (parsed.openai) {
                       const newOpenAI = parsed.openai;
                       setOpenaiConfig(newOpenAI);
                   }
                   if (parsed.gameSettings) {
                       const newGameSettings = parsed.gameSettings;
                       // Ensure default if missing
                       if (!newGameSettings.historyStyle) newGameSettings.historyStyle = HistoryStyle.REALISM;
                       setGameSettings(newGameSettings);
                   }
                   
                   setMessage({ text: "配置导入成功！请点击“保存生效”。", type: "success" });
               } else {
                   setMessage({ text: "无效的配置文件格式。", type: "error" });
               }
            }
          } catch (error) {
            console.error(error);
            setMessage({ text: "读取配置文件失败。", type: "error" });
          }
        };
        fileReader.readAsText(file, "UTF-8");
      }
      
      if (target) {
          target.value = '';
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center animate-fade-in backdrop-blur-sm p-4">
      {/* Container: Flex Column with restricted height */}
      <div className="bg-[#fdfbf7] rounded border-4 border-double border-gray-800 shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col relative animate-scale-in">
        
        {/* Header (Fixed) */}
        <div className="p-6 pb-2 border-b border-gray-300 flex-shrink-0">
          <h3 className="text-2xl font-black text-gray-900 mb-4 font-serif tracking-widest">
            设置
          </h3>
          <div className="flex gap-2 overflow-x-auto">
             <button 
               onClick={() => { setActiveTab('api'); setMessage(null); }}
               className={`px-3 py-2 text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'api' ? 'border-b-2 border-red-800 text-red-900' : 'text-gray-500 hover:text-gray-700'}`}
             >
               API 连接
             </button>
             <button 
               onClick={() => { setActiveTab('game'); setMessage(null); }}
               className={`px-3 py-2 text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'game' ? 'border-b-2 border-red-800 text-red-900' : 'text-gray-500 hover:text-gray-700'}`}
             >
               游戏参数
             </button>
             <button 
               onClick={() => { setActiveTab('data'); setMessage(null); }}
               className={`px-3 py-2 text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'data' ? 'border-b-2 border-red-800 text-red-900' : 'text-gray-500 hover:text-gray-700'}`}
             >
               数据管理
             </button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {/* Message Banner */}
          {message && (
              <div className={`mb-4 p-2 rounded text-sm font-bold text-center ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {message.text}
              </div>
          )}
          
          {activeTab === 'api' && (
            <div className="space-y-4 font-serif pb-2">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">API 类型</label>
                <select
                   value={apiType}
                   onChange={(e) => { setApiType(e.target.value as 'gemini' | 'openai'); setTestStatus('idle'); }}
                   className="w-full bg-[#f4f1de] border-b-2 border-gray-400 focus:border-red-800 outline-none py-1 px-2 transition-colors font-serif appearance-none rounded-none"
                >
                  <option value="gemini">Google Gemini (Default)</option>
                  <option value="openai">OpenAI Compatible (ChatGPT/DeepSeek)</option>
                </select>
              </div>

              <div className="p-3 bg-gray-100 border border-gray-300 rounded text-xs text-gray-600 mb-2">
                 当前配置: <span className="font-bold text-gray-800">{apiType === 'gemini' ? 'Google Gemini' : 'OpenAI 协议'}</span>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">API Key</label>
                <input 
                  type="password" 
                  value={activeConfig.apiKey}
                  onChange={(e) => updateActiveConfig({ apiKey: e.target.value })}
                  placeholder={apiType === 'gemini' ? "Gemini API Key" : "sk-..."}
                  className="w-full bg-[#f4f1de] border-b-2 border-gray-400 focus:border-red-800 outline-none py-1 px-2 transition-colors rounded-none"
                />
                {apiType === 'gemini' && <p className="text-[10px] text-gray-500 mt-1">留空则使用默认 Key</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Base URL (可选)</label>
                <input 
                  type="text" 
                  value={activeConfig.baseUrl}
                  onChange={(e) => updateActiveConfig({ baseUrl: e.target.value })}
                  placeholder={apiType === 'gemini' ? "https://generativelanguage.googleapis.com" : "https://api.openai.com/v1"}
                  className="w-full bg-[#f4f1de] border-b-2 border-gray-400 focus:border-red-800 outline-none py-1 px-2 transition-colors rounded-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">模型名称 (可选)</label>
                <input 
                  type="text" 
                  value={activeConfig.modelName}
                  onChange={(e) => updateActiveConfig({ modelName: e.target.value })}
                  placeholder={apiType === 'gemini' ? "gemini-3-flash-preview" : "gpt-3.5-turbo"}
                  className="w-full bg-[#f4f1de] border-b-2 border-gray-400 focus:border-red-800 outline-none py-1 px-2 transition-colors rounded-none"
                />
              </div>

              <div className="pt-4">
                 <button
                   onClick={handleTestConnection}
                   disabled={testStatus === 'testing'}
                   className={`w-full py-3 text-sm font-bold border rounded-sm shadow-sm ${
                     testStatus === 'idle' ? 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200' :
                     testStatus === 'testing' ? 'bg-yellow-50 border-yellow-300 text-yellow-800' :
                     testStatus === 'success' ? 'bg-green-50 border-green-300 text-green-800' :
                     'bg-red-50 border-red-300 text-red-800'
                   } transition-all flex items-center justify-center gap-2`}
                 >
                   {testStatus === 'idle' && '🔌 测试连通性'}
                   {testStatus === 'testing' && <span className="animate-pulse">⏳ 测试中...</span>}
                   {testStatus === 'success' && '✅ 连接成功'}
                   {testStatus === 'error' && '❌ 连接失败'}
                 </button>
              </div>
            </div>
          )}

          {activeTab === 'game' && (
            <div className="space-y-6 font-serif">
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-2 flex justify-between">
                   <span>每回合流逝时间</span>
                   <span className="text-red-800">{gameSettings.monthsPerTurn} 个月</span>
                 </label>
                 <input 
                   type="range" 
                   min="1" 
                   max="6" 
                   step="1"
                   value={gameSettings.monthsPerTurn}
                   onChange={(e) => setGameSettings(prev => ({ ...prev, monthsPerTurn: parseInt(e.target.value) }))}
                   className="w-full accent-red-800"
                 />
                 <p className="text-xs text-gray-500 mt-1">控制游戏节奏。数值越大，时间过得越快。</p>
               </div>

               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-2 flex justify-between">
                   <span>基础运势 (难度系数)</span>
                   <span className="text-red-800">{gameSettings.baseLuck.toFixed(1)}x</span>
                 </label>
                 <input 
                   type="range" 
                   min="0.5" 
                   max="2.0" 
                   step="0.1"
                   value={gameSettings.baseLuck}
                   onChange={(e) => setGameSettings(prev => ({ ...prev, baseLuck: parseFloat(e.target.value) }))}
                   className="w-full accent-red-800"
                 />
                 <p className="text-xs text-gray-500 mt-1">
                   影响所有检定的基础难度。<br/>
                   <span className="text-green-700">大于 1.0</span>: 降低难度 (简单)<br/>
                   <span className="text-red-700">小于 1.0</span>: 增加难度 (困难)
                 </p>
               </div>

               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-3">AI 历史风格</label>
                 <div className="flex flex-col gap-2">
                    {[
                        { val: HistoryStyle.REALISM, label: '现实主义', desc: '特质数值保守、真实 (-2 ~ +3)' },
                        { val: HistoryStyle.ROMANTICISM, label: '浪漫主义', desc: '特质数值偏高且正面 (+3 ~ +6)' },
                        { val: HistoryStyle.DRAMATIZATION, label: '戏剧化', desc: '特质数值极高，伴随强烈副作用 (+5 ~ +8)' }
                    ].map(option => (
                        <label key={option.val} className={`flex items-center gap-3 p-3 border rounded cursor-pointer transition-all ${gameSettings.historyStyle === option.val ? 'bg-red-50 border-red-800' : 'bg-white border-gray-300 hover:bg-gray-50'}`}>
                            <input 
                                type="radio" 
                                name="historyStyle"
                                value={option.val}
                                checked={gameSettings.historyStyle === option.val}
                                onChange={() => setGameSettings(prev => ({ ...prev, historyStyle: option.val }))}
                                className="accent-red-800"
                            />
                            <div>
                                <div className="font-bold text-sm text-gray-900">{option.label}</div>
                                <div className="text-xs text-gray-500">{option.desc}</div>
                            </div>
                        </label>
                    ))}
                 </div>
               </div>

               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-2">神秘代码 (作弊模式)</label>
                 <input 
                   type="text" 
                   value={gameSettings.cheatCodeInput || ''}
                   onChange={(e) => setGameSettings(prev => ({ ...prev, cheatCodeInput: e.target.value }))}
                   placeholder="输入代码开启隐藏功能..."
                   className="w-full bg-[#f4f1de] border-b-2 border-gray-400 focus:border-red-800 outline-none py-1 px-2 transition-colors rounded-none font-mono"
                 />
                 <p className="text-xs text-gray-400 mt-1">仅用于测试或特殊体验。</p>
               </div>
            </div>
          )}

          {activeTab === 'data' && (
              <div className="space-y-6 font-serif flex flex-col items-center justify-center py-4">
                 <button 
                   onClick={handleExport}
                   className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold border border-gray-400 shadow-sm transition-colors"
                 >
                   📤 导出配置到本地文件
                 </button>
                 
                 <div className="w-full relative">
                   <input 
                     type="file" 
                     accept=".json"
                     ref={fileInputRef}
                     onChange={handleImport}
                     className="hidden"
                   />
                   <button 
                     onClick={() => fileInputRef.current?.click()}
                     className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold border border-gray-400 shadow-sm transition-colors"
                   >
                     📥 从本地文件导入配置
                   </button>
                 </div>
                 
                 <p className="text-xs text-gray-500 text-center">
                   您可以将 API Key 和游戏设置保存为 JSON 文件，<br/>以便在不同设备间迁移或备份。
                 </p>
              </div>
          )}
        </div>

        {/* Footer (Fixed) */}
        <div className="p-4 border-t border-gray-200 flex justify-end gap-4 bg-[#fdfbf7] rounded-b flex-shrink-0 z-10">
           <button 
             onClick={onClose}
             className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm font-bold transition-colors"
           >
             取消
           </button>
           <button 
             onClick={handleSave}
             className="px-6 py-2 bg-red-800 hover:bg-red-900 text-[#fdfbf7] text-sm font-bold shadow-md transition-colors"
           >
             保存生效
           </button>
        </div>
      </div>
    </div>
  );
};
