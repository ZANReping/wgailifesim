
import React, { useState } from 'react';

interface Props {
  initialName: string;
  onGenerate: (name: string, tag: string, age: number, location: string) => void;
  onBack: () => void;
  isGenerating: boolean;
  errorMsg: string | null;
}

export const StepTimeTraveler: React.FC<Props> = ({ 
  initialName, 
  onGenerate, 
  onBack, 
  isGenerating, 
  errorMsg 
}) => {
  const [name, setName] = useState(initialName);
  const [tag, setTag] = useState('');
  const [age, setAge] = useState<number>(18);
  const [location, setLocation] = useState('北京');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !tag.trim() || !location.trim()) return;
    onGenerate(name, tag, age, location);
  };

  return (
    <div className="flex-1 flex flex-col space-y-4 md:space-y-6 animate-slide-up">
      <div className="text-center border-b border-dashed border-gray-400 pb-2">
         <h3 className="text-xl md:text-2xl font-black text-emerald-800 mb-1">穿越者登记处</h3>
         <p className="text-xs text-gray-500">请填写你的身份信息，系统将生成适配 1966 年的能力面板。</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 flex-1">
        
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">角色姓名</label>
          <input
            type="text"
            required
            placeholder="如：孙悟空、马化腾"
            className="w-full bg-[#f4f1de] border border-gray-400 p-2 focus:border-emerald-600 outline-none font-serif font-bold text-lg"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">识别标签 (Tag)</label>
          <input
            type="text"
            required
            placeholder="用于区分同名人物，如：西游记、腾讯创始人、原神"
            className="w-full bg-[#f4f1de] border border-gray-400 p-2 focus:border-emerald-600 outline-none text-sm"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
          <p className="text-[10px] text-gray-500 mt-1">辅助AI从无限宇宙中锁定唯一目标。</p>
        </div>

        <div className="flex gap-4">
            <div className="flex-1">
                <label className="block text-sm font-bold text-gray-700 mb-1">穿越后年龄</label>
                <input
                    type="number"
                    min={10}
                    max={90}
                    required
                    className="w-full bg-[#f4f1de] border border-gray-400 p-2 focus:border-emerald-600 outline-none font-bold"
                    value={age}
                    onChange={(e) => setAge(parseInt(e.target.value))}
                />
            </div>
            <div className="flex-1">
                <label className="block text-sm font-bold text-gray-700 mb-1">降落地点</label>
                <input
                    type="text"
                    required
                    placeholder="如：北京天安门"
                    className="w-full bg-[#f4f1de] border border-gray-400 p-2 focus:border-emerald-600 outline-none"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                />
            </div>
        </div>

        {errorMsg && (
            <div className="bg-red-50 border border-red-300 p-3 rounded text-sm text-red-800 animate-pulse">
                ⚠️ {errorMsg}
            </div>
        )}

        <div className="pt-4 mt-auto">
            <button
                type="submit"
                disabled={isGenerating || !name.trim() || !tag.trim()}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white text-lg font-bold py-3 shadow-lg border-2 border-emerald-900 transition-transform active:scale-95 disabled:opacity-50"
            >
                {isGenerating ? "正在穿越时空..." : "启动穿越"}
            </button>
            <button 
                type="button"
                onClick={onBack}
                className="w-full mt-3 text-gray-500 hover:text-gray-800 text-sm underline"
            >
                返回重选出身
            </button>
        </div>
      </form>
    </div>
  );
};
