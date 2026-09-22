import { useState } from "react";
import { 
  Youtube, Search, ShieldAlert, Sparkles, TrendingUp, Compass, 
  Trash2, Award, Lightbulb, Check, RefreshCw, AlertTriangle
} from "lucide-react";
import { ChannelAnalysis } from "../types";

interface ChannelAnalyzerTabProps {
  myChannelLink: string;
  setMyChannelLink: (link: string) => void;
  backupApiKey?: string;
}

export default function ChannelAnalyzerTab({ 
  myChannelLink, 
  setMyChannelLink,
  backupApiKey
}: ChannelAnalyzerTabProps) {
  const [channelInput, setChannelInput] = useState(myChannelLink);
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ChannelAnalysis | null>(null);

  const handleAnalyzeChannel = async () => {
    if (!channelInput.trim()) return;
    setIsLoading(true);
    setMyChannelLink(channelInput.trim());
    try {
      const response = await fetch("/api/analyze-channel", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-custom-gemini-key": backupApiKey || ""
        },
        body: JSON.stringify({ channelLink: channelInput.trim() }),
      });
      if (!response.ok) throw new Error("فشل في تحليل القناة");
      const data = await response.json();
      setAnalysis(data);
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء إجراء تحليل القناة. يرجى التحقق من الاتصال.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8" id="channel-analyzer-tab">
      {/* Search Header card */}
      <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm">
        <h3 className="text-lg font-bold text-[#3E2723] mb-4 flex items-center gap-2">
          <Youtube className="w-6 h-6 text-[#D32F2F]" />
          مستشار تحليل أداء وتوقعات قناتك على اليوتيوب
        </h3>
        <p className="text-sm text-[#7D766D] mb-4">
          أدخل رابط قناتك الحالية ليقوم الذكاء الاصطناعي بدراسة أدائك، وتحديد نقاط الضعف اللغوية والفنية في أسلوب سردك وقصصك القديمة، مع تقديم توصيات حاسمة بالقصص التي تجلب مشاهدات عالية وتلك التي تضر بالاحتباس الجماهيري ويُفضل تعديلها أو حذفها.
        </p>
        
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="أدخل رابط قناتك على يوتيوب..." 
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-lg border border-[#ECE9E0] bg-[#FAF9F6] text-sm focus:outline-none focus:ring-2 focus:ring-[#8D6E63]"
            onKeyDown={(e) => e.key === "Enter" && handleAnalyzeChannel()}
          />
          <button 
            onClick={handleAnalyzeChannel}
            disabled={isLoading || !channelInput.trim()}
            className="px-6 py-2.5 bg-[#8D6E63] text-white font-bold rounded-lg text-sm hover:bg-[#7D5E53] transition disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                جاري استقراء القناة...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                تحليل قناتي وتوقع الأداء
              </>
            )}
          </button>
        </div>
      </div>

      {/* Analysis Reports */}
      {analysis && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main detailed reports (Left / 2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Audience interest & Keep/Delete stories */}
            <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm">
              <h4 className="text-md font-bold text-[#3E2723] mb-4 flex items-center gap-2">
                <Compass className="w-5 h-5 text-[#8D6E63]" />
                ماذا يفضل جمهورك؟ وتوصيات الإبقاء أو الحذف
              </h4>
              
              <div className="space-y-4">
                {/* Audience preferences */}
                <div className="p-4 bg-[#FAF9F6] rounded-lg border border-[#ECE9E0]">
                  <span className="text-xs font-bold text-[#8D6E63] block mb-2">اهتمامات وتفضيلات الجمهور المحققة للمشاهدات:</span>
                  <div className="flex flex-wrap gap-2">
                    {analysis.audienceLikes.map((like, i) => (
                      <span key={i} className="px-3 py-1 bg-[#E8F5E9] text-[#2E7D32] text-xs font-bold rounded-full border border-[#C8E6C9]">
                        ✓ {like}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Keep / delete policy */}
                <div className="p-4 bg-[#FFF3E0] rounded-lg border border-[#FFE0B2]">
                  <div className="flex items-start gap-2 text-[#E65100]">
                    <Trash2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-bold text-sm block mb-1">توصيات مراجعة المحتوى والقصص القديمة (مخاطر الخوارزميات):</span>
                      <p className="text-xs text-[#E65100] leading-relaxed whitespace-pre-line font-medium">
                        {analysis.keepOrDeleteRecommendations}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance predictions and forecasts */}
            <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm">
              <h4 className="text-md font-bold text-[#3E2723] mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#2E7D32]" />
                التوقعات المستقبلية وفرص نمو القناة
              </h4>
              <div className="p-4 rounded-lg bg-[#E8F5E9] border border-[#C8E6C9] text-sm text-[#1B5E20] leading-relaxed whitespace-pre-line font-medium">
                {analysis.predictions}
              </div>
            </div>

            {/* Practical tips checklist */}
            <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm">
              <h4 className="text-md font-bold text-[#3E2723] mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-[#FFB300]" />
                قائمة مهام عاجلة لتصحيح أخطاء قناتك
              </h4>
              <div className="space-y-3">
                {analysis.tips.map((tip, idx) => (
                  <div key={idx} className="flex gap-2 text-xs text-[#5D4037] bg-[#FAF9F6] p-3 rounded-lg border border-[#ECE9E0]">
                    <Check className="w-4 h-4 text-[#2E7D32] flex-shrink-0" />
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Highlights (Right / 1 col) */}
          <div className="space-y-6">
            
            {/* Channel Identification */}
            <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm text-center">
              <div className="w-16 h-16 bg-[#FAF2EB] rounded-full flex items-center justify-center mx-auto mb-3 border border-[#EFE5DC]">
                <Youtube className="w-8 h-8 text-[#D32F2F]" />
              </div>
              <h4 className="text-md font-bold text-[#3E2723] mb-1">{analysis.channelName || "قناتك على اليوتيوب"}</h4>
              <span className="text-xs text-[#9E9E9E] font-mono break-all">{myChannelLink}</span>
            </div>

            {/* Strengths & Weaknesses */}
            <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm space-y-6">
              
              {/* Strengths */}
              <div>
                <span className="text-xs font-bold text-[#2E7D32] block mb-2 flex items-center gap-1.5">
                  <Award className="w-4 h-4" /> نقاط القوة الحالية
                </span>
                <div className="space-y-2">
                  {analysis.strengths.map((str, i) => (
                    <div key={i} className="p-2.5 bg-[#E8F5E9] text-[#2E7D32] text-xs font-semibold rounded-lg border border-[#C8E6C9]">
                      • {str}
                    </div>
                  ))}
                </div>
              </div>

              <hr className="border-[#ECE9E0]" />

              {/* Weaknesses */}
              <div>
                <span className="text-xs font-bold text-[#D32F2F] block mb-2 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" /> نقاط الضعف الفنية واللغوية
                </span>
                <div className="space-y-2">
                  {analysis.weaknesses.map((weak, i) => (
                    <div key={i} className="p-2.5 bg-[#FFEBEE] text-[#C62828] text-xs font-semibold rounded-lg border border-[#FFCDD2]">
                      • {weak}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

        </div>
      )}
    </div>
  );
}
