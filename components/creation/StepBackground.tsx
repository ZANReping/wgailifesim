
import React from 'react';
import { BackgroundType } from '../../types';

interface Props {
  name: string;
  setName: (name: string) => void;
  background: BackgroundType;
  setBackground: (bg: BackgroundType) => void;
  onSubmit: (e: React.FormEvent) => void;
  isVerifying: boolean;
  errorMsg: string | null;
}

// Local random name data
const SURNAMES = ['李', '王', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '林', '郭', '何', '高', '郑'];
const GIVEN_NAMES = ['卫红', '卫东', '国庆', '建国', '向阳', '红兵', '胜利', '解放', '援朝', '跃进', '东方', '红梅', '立功', '志强', '爱国', '秀英', '建设', '勇', '军', '平', '向东', '文革', '学军', '卫疆', '继红'];

const backgrounds = [
  {
    type: BackgroundType.RED_FIVE,
    desc: "出身革命军人、干部、工人、贫下中农。根正苗红，备受信任。",
    color: "border-red-600 bg-red-50 text-red-900",
    difficulty: "简单",
    diffColor: "bg-green-600"
  },
  {
    type: BackgroundType.ORDINARY,
    desc: "普通市民。试图在风暴中明哲保身，但往往身不由己。",
    color: "border-amber-700 bg-amber-50 text-amber-900",
    difficulty: "普通",
    diffColor: "bg-blue-600"
  },
  {
    type: BackgroundType.INTELLECTUAL,
    desc: "教师、学者、技术人员。在反智的浪潮中战战兢兢。",
    color: "border-indigo-800 bg-indigo-50 text-indigo-900",
    difficulty: "较难",
    diffColor: "bg-orange-600"
  },
  {
    type: BackgroundType.BLACK_FIVE,
    desc: "出身地主、富农、反革命、坏分子、右派。生而带有原罪。",
    color: "border-gray-800 bg-gray-900 text-gray-100",
    difficulty: "困难",
    diffColor: "bg-red-800"
  },
  {
    type: BackgroundType.HISTORICAL,
    desc: "历史真实人物。无论当时是支持者还是受害者，重走他/她的人生路。",
    color: "border-yellow-700 bg-yellow-50 text-yellow-900 ring-2 ring-yellow-400",
    difficulty: "特殊",
    diffColor: "bg-purple-700"
  },
  {
    type: BackgroundType.TIME_TRAVELER,
    desc: "来自其他时空的穿越者。可能是古人、现代人或虚拟角色。",
    color: "border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-400",
    difficulty: "娱乐",
    diffColor: "bg-teal-500"
  }
];

export const StepBackground: React.FC<Props> = ({ name, setName, background, setBackground, onSubmit, isVerifying, errorMsg }) => {
  
  const handleRandomName = (e: React.MouseEvent) => {
    e.preventDefault();
    const s = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
    const g = GIVEN_NAMES[Math.floor(Math.random() * GIVEN_NAMES.length)];
    setName(s + g);
  };

  const isSpecialBackground = background === BackgroundType.HISTORICAL || background === BackgroundType.TIME_TRAVELER;

  return (
    <form onSubmit={onSubmit} className="space-y-4 md:space-y-6 flex-1 flex flex-col animate-slide-up">
      <div>
        <label className="block text-base md:text-lg font-bold text-gray-800 mb-1 md:mb-2">
          {isSpecialBackground ? "人物姓名" : "革命姓名"}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            required
            maxLength={10}
            placeholder={isSpecialBackground ? "角色/历史姓名" : "输入名字（如：卫东）"}
            className="flex-1 bg-transparent border-b-2 border-gray-400 focus:border-red-600 outline-none py-2 text-xl md:text-2xl text-center font-serif transition-colors placeholder:text-gray-400 text-gray-900"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {!isSpecialBackground && (
            <button
               type="button"
               onClick={handleRandomName}
               className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold px-3 py-2 rounded shadow-sm text-sm border border-gray-400 whitespace-nowrap transition-colors"
            >
              🎲 随机
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 overflow-y-auto max-h-[40vh] md:max-h-none pr-1">
        {backgrounds.map((bg) => (
          <div
            key={bg.type}
            onClick={() => setBackground(bg.type)}
            className={`cursor-pointer p-3 md:p-4 border-2 transition-all duration-300 relative rounded-sm ${
              background === bg.type 
                ? `${bg.color} scale-[1.02] shadow-md` 
                : "border-gray-300 hover:border-gray-500 opacity-70 grayscale"
            }`}
          >
            <div className={`absolute top-0 right-0 px-2 py-0.5 text-[10px] text-white font-bold ${bg.diffColor}`}>
              {bg.difficulty}
            </div>
            {background === bg.type && (
              <div className="absolute top-6 right-2 text-red-600 text-xl animate-bounce-subtle">★</div>
            )}
            <h3 className="font-bold text-base md:text-lg mb-1 mt-1">{bg.type}</h3>
            <p className="text-xs opacity-90 leading-relaxed">{bg.desc}</p>
          </div>
        ))}
      </div>

      {errorMsg && (
          <div className="text-center text-red-700 font-bold animate-pulse text-xs md:text-sm">
            ⚠️ {errorMsg}
          </div>
      )}

      <div className="flex-1 min-h-[10px]"></div>
      <button
        type="submit"
        disabled={!name.trim() || isVerifying}
        className="w-full bg-red-800 hover:bg-red-900 text-[#fdfbf7] text-lg md:text-xl font-bold py-3 md:py-3 shadow-lg border-2 border-red-950 transition-transform active:scale-95 disabled:opacity-50"
      >
        {isVerifying 
          ? "正在核对档案..." 
          : background === BackgroundType.HISTORICAL 
            ? "验证历史档案" 
            : background === BackgroundType.TIME_TRAVELER
            ? "设定穿越信息"
            : "下一步：建立档案"
        }
      </button>
    </form>
  );
};
