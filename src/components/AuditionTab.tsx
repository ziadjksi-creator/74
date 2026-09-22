import { useState } from "react";
import { 
  Sliders, Search, RefreshCw, Layers, VolumeX, Mic, 
  Settings, SlidersHorizontal, BookOpen, AlertCircle, Copy, Check
} from "lucide-react";
import { AuditionSettingsResult } from "../types";

interface AuditionTabProps {
  backupApiKey?: string;
}

export default function AuditionTab({ backupApiKey }: AuditionTabProps) {
  const [referenceLink, setReferenceLink] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<AuditionSettingsResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleFetchSettings = async () => {
    if (!referenceLink.trim()) return;
    setIsLoading(true);
    try {
      const response = await fetch("/api/audition-settings", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-custom-gemini-key": backupApiKey || ""
        },
        body: JSON.stringify({ referenceLink: referenceLink.trim() }),
      });
      if (!response.ok) throw new Error("فشل في استخلاص إعدادات الهندسة الصوتية");
      const data: AuditionSettingsResult = await response.json();
      setSettings(data);
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء تحليل المقطع وهندسة صوته لأدوبي أوديشين.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySetupInstructions = () => {
    if (!settings) return;
    let text = `إعدادات أدوبي أوديشين (Adobe Audition) المستنسخة:\n\n`;
    text += `وصف جودة خامة المرجع: ${settings.channelVocalStyle}\n\n`;
    text += `1. إزالة الضوضاء (${settings.noiseReduction.effectName}):\n• ` + settings.noiseReduction.settings.join("\n• ") + `\n\n`;
    text += `2. معادل الصوت البارامتري (${settings.parametricEQ.effectName} - Preset: ${settings.parametricEQ.presetName}):\n`;
    settings.parametricEQ.bands.forEach((b) => {
      text += `• النطاق: ${b.band} | التردد: ${b.frequency} | الكسب: ${b.gain} | الـ Q: ${b.q}\n`;
    });
    text += `• تفسير توزيع الترددات: ${settings.parametricEQ.explanation}\n\n`;
    text += `3. المكبس متعدد النطاقات (${settings.multibandCompressor.effectName} - Preset: ${settings.multibandCompressor.preset}):\n• القيم: ${settings.multibandCompressor.values}\n\n`;
    text += `4. فلتر الصفير والتخلص من الحروف الحادة (${settings.deEsser.effectName}):\n• القيم: ${settings.deEsser.settings}\n\n`;
    text += `5. سقف تضخيم الصوت النهائي (${settings.masteringLimiter.effectName}):\n• القيم: ${settings.masteringLimiter.settings}\n\n`;
    text += `💡 نصيحة مهندس الصوت للاستوديو والمايك: ${settings.narratorTip}`;
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8" id="audition-tab">
      <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm">
        <h3 className="text-lg font-bold text-[#3E2723] mb-4 flex items-center gap-2">
          <Sliders className="w-6 h-6 text-[#8D6E63]" />
          نسخ واستنساخ جودة الصوت في Adobe Audition
        </h3>
        <p className="text-sm text-[#7D766D] mb-4">
          أدخل رابط يوتيوب لقصة أو معلق صوتي تعجبك خامة صوته العميقة والمحترفة. سيقوم مهندس الصوت الذكي باستخلاص خامة الصوت وإعطائك سلسلة الفلاتر والقيم الرقمية التفصيلية التي عليك تطبيقها في برنامج أدوبي أوديشين (Adobe Audition) لمحاكاته والوصول لنفس التميز!
        </p>

        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="مثال: https://youtube.com/watch?v=video_id" 
            value={referenceLink}
            onChange={(e) => setReferenceLink(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-lg border border-[#ECE9E0] bg-[#FAF9F6] text-sm focus:outline-none focus:ring-2 focus:ring-[#8D6E63]"
            onKeyDown={(e) => e.key === "Enter" && handleFetchSettings()}
          />
          <button 
            onClick={handleFetchSettings}
            disabled={isLoading || !referenceLink.trim()}
            className="px-6 py-2.5 bg-[#8D6E63] text-white font-bold rounded-lg text-sm hover:bg-[#7D5E53] transition disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                جاري استنساخ البصمة الصوتية...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                استنساخ إعدادات الأوديشين
              </>
            )}
          </button>
        </div>
      </div>

      {/* Setup instructions output */}
      {settings && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Fffects step by step sequence (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Step-by-Step Effects Rack */}
            <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm">
              <div className="flex justify-between items-center mb-6 border-b border-[#ECE9E0] pb-4">
                <h4 className="text-md font-bold text-[#3E2723] flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-[#8D6E63]" />
                  سلسلة فلاتر ومؤثرات أدوبي أوديشين المطلوبة (Effects Rack Sequence)
                </h4>
                <button 
                  onClick={handleCopySetupInstructions}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF9F6] border border-[#ECE9E0] text-xs font-bold rounded-lg hover:bg-[#FAF2EB]"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#2E7D32]" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "تم نسخ الإرشادات!" : "نسخ الدليل بالكامل"}
                </button>
              </div>

              <div className="space-y-6">
                
                {/* 1. Noise Reduction */}
                <div className="p-4 bg-[#FAF9F6] rounded-lg border border-[#ECE9E0] flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#EFE5DC] text-[#8D6E63] flex items-center justify-center font-bold text-xs flex-shrink-0">
                    1
                  </div>
                  <div>
                    <span className="font-bold text-xs text-[#8D6E63] block">فلتر عزل وضوضاء الغرفة:</span>
                    <span className="font-bold text-sm text-[#3E2723] block mb-2">{settings.noiseReduction.effectName}</span>
                    <ul className="list-disc list-inside space-y-1 text-xs text-[#5D4037]">
                      {settings.noiseReduction.settings.map((s, idx) => (
                        <li key={idx} className="font-semibold">{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* 2. Parametric EQ */}
                <div className="p-4 bg-[#FAF9F6] rounded-lg border border-[#ECE9E0] flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#EFE5DC] text-[#8D6E63] flex items-center justify-center font-bold text-xs flex-shrink-0">
                    2
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-xs text-[#8D6E63] block">معادل الصوت البارامتري (تضخيم الباص والوضوح):</span>
                    <span className="font-bold text-sm text-[#3E2723] block mb-1">{settings.parametricEQ.effectName}</span>
                    <span className="text-[10px] bg-[#FAF2EB] text-[#8D6E63] px-2 py-0.5 rounded border border-[#EFE5DC] font-bold inline-block mb-3">
                      Preset البداية: {settings.parametricEQ.presetName}
                    </span>

                    {/* Parametric values table */}
                    <div className="overflow-x-auto mb-3">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="border-b border-[#ECE9E0] text-[#8D6E63] font-bold">
                            <th className="py-1 px-2">النطاق (Band)</th>
                            <th className="py-1 px-2">التردد (Frequency)</th>
                            <th className="py-1 px-2">الكسب (Gain)</th>
                            <th className="py-1 px-2">العرض (Q)</th>
                          </tr>
                        </thead>
                        <tbody className="text-[#3E2723]">
                          {settings.parametricEQ.bands.map((b, idx) => (
                            <tr key={idx} className="border-b border-[#FAF9F6] font-semibold">
                              <td className="py-1.5 px-2">{b.band}</td>
                              <td className="py-1.5 px-2 font-mono">{b.frequency}</td>
                              <td className="py-1.5 px-2 font-mono text-[#2E7D32]">{b.gain}</td>
                              <td className="py-1.5 px-2 font-mono">{b.q}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[11px] text-[#7D766D] leading-relaxed italic">
                      * {settings.parametricEQ.explanation}
                    </p>
                  </div>
                </div>

                {/* 3. Multiband Compressor */}
                <div className="p-4 bg-[#FAF9F6] rounded-lg border border-[#ECE9E0] flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#EFE5DC] text-[#8D6E63] flex items-center justify-center font-bold text-xs flex-shrink-0">
                    3
                  </div>
                  <div>
                    <span className="font-bold text-xs text-[#8D6E63] block">ضغط وتكثيف طبقات الصوت المتفاوتة:</span>
                    <span className="font-bold text-sm text-[#3E2723] block mb-1.5">{settings.multibandCompressor.effectName}</span>
                    <p className="text-xs text-[#5D4037] font-semibold">
                      • البريسيت: <strong className="text-[#8D6E63]">{settings.multibandCompressor.preset}</strong>
                    </p>
                    <p className="text-xs text-[#5D4037] mt-1 font-semibold">
                      • الإعدادات: {settings.multibandCompressor.values}
                    </p>
                  </div>
                </div>

                {/* 4. DeEsser */}
                <div className="p-4 bg-[#FAF9F6] rounded-lg border border-[#ECE9E0] flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#EFE5DC] text-[#8D6E63] flex items-center justify-center font-bold text-xs flex-shrink-0">
                    4
                  </div>
                  <div>
                    <span className="font-bold text-xs text-[#8D6E63] block">فلتر التخلص من حروف الصفير الحادة (س، ش، ص):</span>
                    <span className="font-bold text-sm text-[#3E2723] block mb-1">{settings.deEsser.effectName}</span>
                    <p className="text-xs text-[#5D4037] font-semibold">{settings.deEsser.settings}</p>
                  </div>
                </div>

                {/* 5. Hard Limiter */}
                <div className="p-4 bg-[#FAF9F6] rounded-lg border border-[#ECE9E0] flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#EFE5DC] text-[#8D6E63] flex items-center justify-center font-bold text-xs flex-shrink-0">
                    5
                  </div>
                  <div>
                    <span className="font-bold text-xs text-[#8D6E63] block">الحد الأقصى للتضخيم الصوتي وتوحيد القوة:</span>
                    <span className="font-bold text-sm text-[#3E2723] block mb-1">{settings.masteringLimiter.effectName}</span>
                    <p className="text-xs text-[#5D4037] font-semibold">{settings.masteringLimiter.settings}</p>
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* Sidebar Reference analysis (1 col) */}
          <div className="space-y-6">
            
            {/* Raw target voice summary */}
            <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm">
              <h4 className="text-sm font-bold text-[#3E2723] mb-3 flex items-center gap-1.5">
                <VolumeX className="w-4 h-4 text-[#8D6E63]" /> تحليل البصمة الصوتية للمذيع المرجع
              </h4>
              <p className="text-xs text-[#5D4037] leading-relaxed whitespace-pre-line bg-[#FAF9F6] p-4 rounded-lg border border-[#ECE9E0] font-medium">
                {settings.channelVocalStyle}
              </p>
            </div>

            {/* Microphones distance and room tip */}
            <div className="bg-[#FFF3E0] rounded-xl p-6 border border-[#FFE0B2]">
              <h4 className="text-sm font-bold text-[#E65100] mb-3 flex items-center gap-1.5">
                <Mic className="w-4 h-4" /> نصائح استوديو التسجيل والمايك
              </h4>
              <p className="text-xs text-[#E65100] leading-relaxed whitespace-pre-line font-medium">
                {settings.narratorTip}
              </p>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
