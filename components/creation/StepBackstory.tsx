
import React from 'react';

interface Props {
  backstory: string;
  setBackstory: (s: string) => void;
  isGeneratingProfile: boolean;
  isGeneratingTraits: boolean;
  errorMsg: string | null;
  onGenerate: () => void;
  onSubmit: () => void;
  onBack: () => void;
}

export const StepBackstory: React.FC<Props> = ({ 
  backstory, 
  setBackstory, 
  isGeneratingProfile, 
  isGeneratingTraits, 
  errorMsg, 
  onGenerate, 
  onSubmit, 
  onBack 
}) => {
  return (
    <div className="flex-1 flex flex-col space-y-4 md:space-y-6 animate-slide-up">
      <div className="text-center">
         <p className="mb-2 text-gray-700 font-bold text-sm md:text-base">简述你的前18年人生经历</p>
         <p className="text-xs text-gray-500 mb-2">系统将根据你的经历生成3个【特质】</p>
      </div>
      
      <div className="relative flex-1">
        <textarea 
          className="w-full h-48 md:h-64 bg-[#f4f1de] border-2 border-gray-400 p-3 md:p-4 font-serif text-base md:text-lg focus:border-red-800 outline-none resize-none shadow-inner transition-colors rounded-sm"
          placeholder="例如：我从小体弱多病，但喜欢看书。父亲是因伤退伍的军人，对我要求很严..."
          value={backstory}
          onChange={(e) => setBackstory(e.target.value)}
          maxLength={200}
        />
        <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
            <button
                onClick={onGenerate}
                disabled={isGeneratingProfile}
                className="bg-gray-200/90 hover:bg-gray-300 text-gray-700 text-xs font-bold px-3 py-1.5 rounded shadow border border-gray-400 transition-colors backdrop-blur-sm"
            >
            {isGeneratingProfile ? "生成中..." : "✨ AI 生成经历"}
            </button>
            <div className="text-xs text-gray-500 bg-[#f4f1de]/80 px-1 rounded">{backstory.length}/200</div>
        </div>
      </div>

      {errorMsg && (
        <div className="text-center text-red-700 font-bold animate-pulse text-xs md:text-sm">
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="flex gap-3 md:gap-4 mt-auto">
         <button onClick={onBack} className="w-1/3 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 shadow-lg border-2 border-gray-800 transition-transform active:scale-95 text-sm md:text-base">
          返回
        </button>
        <button 
          onClick={onSubmit} 
          disabled={!backstory.trim() || isGeneratingTraits}
          className="w-2/3 bg-red-700 hover:bg-red-800 text-[#fdfbf7] text-lg md:text-xl font-bold py-3 shadow-lg disabled:opacity-50 border-2 border-red-900 flex justify-center items-center transition-transform active:scale-95"
        >
          {isGeneratingTraits ? (
            <span className="animate-pulse">正在审阅档案...</span>
          ) : "生成特质"}
        </button>
      </div>
    </div>
  );
};
