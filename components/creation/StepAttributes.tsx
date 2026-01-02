
import React from 'react';
import { Attributes } from '../../types';

interface Props {
  attributes: Attributes;
  onAttributeChange: (key: keyof Attributes, delta: number) => void;
  onRandomize: () => void;
  remainingPoints: number;
  onNext: () => void;
  onBack: () => void;
  baseValue: number;
  maxValue: number;
}

export const StepAttributes: React.FC<Props> = ({ 
  attributes, 
  onAttributeChange, 
  onRandomize, 
  remainingPoints, 
  onNext, 
  onBack,
  baseValue,
  maxValue
}) => {
  return (
    <div className="flex-1 flex flex-col space-y-4 md:space-y-6 animate-slide-up">
      <div className="text-center relative">
        <p className="mb-2 text-gray-700 text-sm md:text-base">请分配你的基础属性点</p>
        <div className="text-3xl md:text-4xl font-black text-red-800 mb-1">{remainingPoints}</div>
        <div className="text-xs md:text-sm text-gray-500">剩余点数</div>
        
        <button
          onClick={onRandomize}
          className="absolute top-0 right-0 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs px-2 py-1 rounded shadow border border-gray-400 transition-colors"
        >
          🎲 随机分配
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 overflow-y-auto max-h-[50vh] md:max-h-none pr-1">
        {[
          { k: 'physique', label: '体格', desc: '影响健康、抗击打能力' },
          { k: 'intelligence', label: '智力', desc: '影响学习、思考' },
          { k: 'spirit', label: '精神', desc: '影响意志力、抗压' },
          { k: 'agility', label: '身手', desc: '影响军事能力、机械操作、躲避' },
          { k: 'charisma', label: '魅力', desc: '影响煽动群众' },
          { k: 'politics', label: '政治', desc: '影响政治敏感度' },
        ].map(({ k, label, desc }) => (
          <div key={k} className="bg-[#f4f1de] p-2 md:p-3 border border-gray-400 rounded relative shadow-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-base md:text-lg text-gray-800">{label}</span>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => onAttributeChange(k as keyof Attributes, -1)}
                  className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gray-300 text-gray-800 font-bold hover:bg-gray-400 disabled:opacity-30 transition-colors flex items-center justify-center"
                  disabled={attributes[k as keyof Attributes] <= baseValue}
                >-</button>
                <span className="w-5 md:w-6 text-center font-bold text-lg md:text-xl">{attributes[k as keyof Attributes]}</span>
                <button 
                   onClick={() => onAttributeChange(k as keyof Attributes, 1)}
                   className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-red-700 text-white font-bold hover:bg-red-800 disabled:opacity-30 transition-colors flex items-center justify-center"
                   disabled={attributes[k as keyof Attributes] >= maxValue || remainingPoints <= 0}
                >+</button>
              </div>
            </div>
            <p className="text-[10px] md:text-xs text-gray-500">{desc}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-[10px]"></div>
      <div className="flex gap-3 md:gap-4">
         <button onClick={onBack} className="w-1/3 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 shadow-lg border-2 border-gray-800 transition-transform active:scale-95 text-sm md:text-base">
          返回
        </button>
        <button onClick={onNext} disabled={remainingPoints !== 0} className="w-2/3 bg-red-700 hover:bg-red-800 text-[#fdfbf7] text-lg md:text-xl font-bold py-3 shadow-lg disabled:opacity-50 border-2 border-red-900 transition-transform active:scale-95">
          下一步
        </button>
      </div>
    </div>
  );
};
