import { useState, useEffect } from "react";
import { 
  Clapperboard, Sparkles, Copy, Check, Play, RefreshCw, 
  Tv, Film, Eye, Flame, FileText
} from "lucide-react";
import { TeaserResult } from "../types";

interface TeaserTabProps {
  currentStoryText?: string;
  onStoryTextChange?: (text: string) => void;
  backupApiKey?: string;
}

export default function TeaserTab({ 
  currentStoryText = "",
  onStoryTextChange,
  backupApiKey
}: TeaserTabProps) {
  const [inputText, setInputText] = useState(() => {
    return localStorage.getItem("rawi_teaser_input") || currentStoryText || "";
  });
  const [isLoading, setIsLoading] = useState(false);
  
  const [result, setResult] = useState<TeaserResult | null>(() => {
    try {
      const saved = localStorage.getItem("rawi_teaser_result");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (currentStoryText && !localStorage.getItem("rawi_teaser_input")) {
      setInputText(currentStoryText);
    }
  }, [currentStoryText]);

  useEffect(() => {
    localStorage.setItem("rawi_teaser_input", inputText);
    if (onStoryTextChange && inputText) {
      onStoryTextChange(inputText);
    }
  }, [inputText, onStoryTextChange]);

  useEffect(() => {
    if (result) {
      localStorage.setItem("rawi_teaser_result", JSON.stringify(result));
    } else {
      localStorage.removeItem("rawi_teaser_result");
    }
  }, [result]);

  const [copied, setCopied] = useState(false);

  const handleGenerateTeaser = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    try {
      const response = await fetch("/api/generate-teaser", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-custom-gemini-key": backupApiKey || ""
        },
        body: JSON.stringify({ storyText: inputText }),
      });
      if (!response.ok) throw new Error("فشل في توليد سيناريو التشويق");
      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء صياغة الإعلان التشويقي للقصة.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyTeaser = () => {
    if (!result) return;
    let fullScript = `عنوان المقطع التشويقي: ${result.teaserTitle}\n`;
    fullScript += `الخطاف المثير: ${result.hook}\n\n`;
    result.script.forEach((item) => {
      fullScript += `[${item.time}]\n• اللقطة: ${item.visual}\n• الراوي: ${item.voiceover}\n• الصوت والمؤثرات: ${item.audio}\n\n`;
    });
    fullScript += `القفلة التشويقية (Cliffhanger): ${result.cliffhanger}`;
    
    navigator.clipboard.writeText(fullScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8" id="teaser-tab">
      {/* Search Input Card */}
      <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm">
        <h3 className="text-lg font-bold text-[#3E2723] mb-4 flex items-center gap-2">
          <Clapperboard className="w-6 h-6 text-[#8D6E63]" />
          مولد سيناريو الفيديو التشويقي (YouTube Shorts / Stories)
        </h3>
        <p className="text-sm text-[#7D766D] mb-4">
          اصنع مقطعاً ترويجياً مثيراً جداً (30-60 ثانية) لجذب الجمهور قبل أو بعد نشر القصة الكاملة. يمكن لهذا السكريبت المساعد أن يضمن لك تفاعلاً رهيباً على الستوريز وتيك توك وشورتس يوتيوب.
        </p>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-[#8D6E63]">نص القصة الأصلي أو فكرتها التلخيصية</label>
              {currentStoryText && (
                <button 
                  onClick={() => setInputText(currentStoryText)}
                  className="text-xs text-[#8D6E63] font-bold hover:underline flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5" /> استخدام القصة النشطة من التبويب الأول
                </button>
              )}
            </div>
            <textarea 
              rows={8}
              placeholder="اكتب فكرة سريعة أو الصق مقطعاً مشوقاً من القصة لتوليد إعلان تشويقي مدهش..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full p-4 rounded-lg border border-[#ECE9E0] bg-[#FCFBF9] text-sm focus:outline-none focus:ring-2 focus:ring-[#8D6E63] leading-relaxed resize-y"
            />
          </div>

          <div className="flex justify-end">
            <button 
              onClick={handleGenerateTeaser}
              disabled={isLoading || !inputText.trim()}
              className="px-6 py-2.5 bg-[#8D6E63] text-white font-bold rounded-lg text-sm hover:bg-[#7D5E53] transition disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  جاري كتابة السيناريو التشويقي...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  توليد السكريبت التشويقي الغامض
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Script Teaser Display */}
      {result && (
        <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-[#ECE9E0] pb-4">
            <div>
              <span className="text-xs font-bold text-[#8D6E63] bg-[#FAF2EB] px-2.5 py-1 rounded-md border border-[#EFE5DC] inline-block mb-1">
                سكريبت مقطع تشويقي (Shorts/Teaser)
              </span>
              <h4 className="text-md font-bold text-[#3E2723]">{result.teaserTitle}</h4>
            </div>
            <button 
              onClick={handleCopyTeaser}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#FAF9F6] border border-[#ECE9E0] text-xs font-bold rounded-lg hover:bg-[#FAF2EB]"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#2E7D32]" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "تم نسخ السكريبت!" : "نسخ السكريبت بالكامل"}
            </button>
          </div>

          {/* Golden Hook */}
          <div className="p-4 bg-[#FFEBEE] rounded-lg border border-[#FFCDD2]">
            <span className="text-xs font-bold text-[#C62828] block mb-1.5 flex items-center gap-1">
              <Flame className="w-4 h-4 text-[#D32F2F] fill-[#D32F2F]" /> الخطاف الافتتاحي المثير (أول 3 ثواني):
            </span>
            <p className="text-sm font-bold text-[#3E2723]">{result.hook}</p>
          </div>

          {/* Chronological Script Timeline */}
          <div>
            <span className="text-xs font-bold text-[#8D6E63] block mb-3">تفاصيل لقطات وسيناريو الإعلان ثانية بثانية:</span>
            <div className="space-y-4">
              {result.script.map((item, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 rounded-lg bg-[#FAF9F6] border border-[#ECE9E0] text-xs">
                  {/* Timer */}
                  <div className="md:col-span-2 font-mono font-bold text-[#8D6E63] flex items-center justify-center md:justify-start">
                    <span className="px-2 py-1 bg-[#FAF2EB] rounded-md border border-[#EFE5DC]">
                      {item.time}
                    </span>
                  </div>

                  {/* Visual Scene */}
                  <div className="md:col-span-4 space-y-1">
                    <span className="font-bold text-[#8D6E63] block">🎬 الكاميرا والمشهد البصري:</span>
                    <p className="text-[#3E2723] leading-relaxed font-semibold">{item.visual}</p>
                  </div>

                  {/* Voiceover line */}
                  <div className="md:col-span-4 space-y-1">
                    <span className="font-bold text-[#8D6E63] block">🎙️ الإلقاء والتعليق الصوتي:</span>
                    <p className="text-[#3E2723] italic leading-relaxed font-semibold">"{item.voiceover}"</p>
                  </div>

                  {/* SFX / Ambient */}
                  <div className="md:col-span-2 space-y-1">
                    <span className="font-bold text-[#8D6E63] block">🎵 مؤثرات وسبر:</span>
                    <p className="text-[#7D766D] leading-relaxed">{item.audio}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dramatic Cliffhanger End */}
          <div className="p-4 bg-[#E8F5E9] rounded-lg border border-[#C8E6C9]">
            <span className="text-xs font-bold text-[#2E7D32] block mb-1.5 flex items-center gap-1">
              <Eye className="w-4 h-4 text-[#2E7D32]" /> قفلة الغموض البصرية والـ Cliffhanger:
            </span>
            <p className="text-sm font-bold text-[#1B5E20]">{result.cliffhanger}</p>
          </div>

        </div>
      )}
    </div>
  );
}
