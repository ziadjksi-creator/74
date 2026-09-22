import { useState, useRef, useEffect } from "react";
import { 
  FileText, CheckCircle2, Music, Users, Sparkles, Image as ImageIcon, 
  Copy, Check, AlertTriangle, Play, HelpCircle, Download, RefreshCw, Star
} from "lucide-react";
import { ProofreadResult } from "../types";

interface StoryPrepTabProps {
  competitorChannels: string[];
  setCompetitorChannels: (channels: string[]) => void;
  onStoryCorrected?: (text: string) => void;
  backupApiKey?: string;
  sharedStoryText: string;
  onStoryTextChange: (text: string) => void;
}

export default function StoryPrepTab({ 
  competitorChannels, 
  setCompetitorChannels,
  onStoryCorrected,
  backupApiKey,
  sharedStoryText,
  onStoryTextChange
}: StoryPrepTabProps) {
  const storyText = sharedStoryText;
  const setStoryText = onStoryTextChange;
  const [newChannel, setNewChannel] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const [result, setResult] = useState<ProofreadResult | null>(() => {
    try {
      const saved = localStorage.getItem("rawi_story_prep_result");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (result) {
      localStorage.setItem("rawi_story_prep_result", JSON.stringify(result));
    } else {
      localStorage.removeItem("rawi_story_prep_result");
    }
  }, [result]);

  const [copied, setCopied] = useState<{ [key: string]: boolean }>({});
  const [readerFontSize, setReaderFontSize] = useState(18);
  const [isComfortableSpacing, setIsComfortableSpacing] = useState(false);
  const [appliedContextSuggestions, setAppliedContextSuggestions] = useState<number[]>([]);
  
  // Thumbnail variables
  const [imagePrompt, setImagePrompt] = useState("");
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [thumbnailImage, setThumbnailImage] = useState("");
  const [storyTitle, setStoryTitle] = useState("");
  const [logoText, setLogoText] = useState("شعار القناة");
  const [logoFile, setLogoFile] = useState<string | null>(null);
  const [titleColor, setTitleColor] = useState("#ffffff");
  const [titleSize, setTitleSize] = useState(36);
  const [logoPosition, setLogoPosition] = useState<"top-left" | "top-right" | "bottom-left" | "bottom-right">("top-left");
  const [titleY, setTitleY] = useState(80); // percentage from top
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleAddChannel = () => {
    if (newChannel.trim() && !competitorChannels.includes(newChannel.trim())) {
      setCompetitorChannels([...competitorChannels, newChannel.trim()]);
      setNewChannel("");
    }
  };

  const handleRemoveChannel = (index: number) => {
    setCompetitorChannels(competitorChannels.filter((_, i) => i !== index));
  };

  const triggerCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopied((prev) => ({ ...prev, [key]: false }));
    }, 2000);
  };

  const handleDownloadExcel = () => {
    if (!result) return;
    
    let csvContent = "\uFEFF"; // UTF-8 BOM to prevent Arabic corruption in Excel
    
    // Header
    csvContent += "تقرير تحضير القصة الكامل وتفاصيل الإنتاج والـ SEO\n";
    csvContent += `العنوان المقترح,${result.youtubeOptimization.title.replace(/"/g, '""')}\n`;
    csvContent += `مدة الإلقاء المقدرة,${result.durationMinutes} دقيقة\n`;
    csvContent += `تقييم الحبكة,${result.rating} من 10\n\n`;
    
    // Section 1: المقدمة التشويقية والقصة المصححة
    csvContent += "=== قسم النصوص السردية ===\n";
    csvContent += `المقدمة التشويقية (Hook Intro),"${result.videoHook.replace(/"/g, '""')}"\n\n`;
    csvContent += `القصة الكاملة المصححة,"${result.correctedText.replace(/"/g, '""')}"\n\n`;
    
    // Section 2: الشخصيات والأعمار
    csvContent += "=== شخصيات القصة وأعمارهم ===\n";
    csvContent += "الاسم,العمر,الدور,الوصف والملامح الفنية\n";
    result.characters.forEach(char => {
      csvContent += `"${char.name.replace(/"/g, '""')}","${char.age.replace(/"/g, '""')}","${char.role.replace(/"/g, '""')}","${char.description.replace(/"/g, '""')}"\n`;
    });
    csvContent += "\n";
    
    // Section 3: الموسيقى والمؤثرات
    csvContent += "=== جدول المؤثرات الصوتية والبيئية والموسيقى التصويرية ===\n";
    csvContent += "المشهد / الجزء,التوقيت / المدة,نوع المود والنمط الموسيقي,الوصف الفني والتأثير الصوتي المرفق\n";
    result.backgroundMusic.forEach(bg => {
      csvContent += `"${bg.part.replace(/"/g, '""')}","${bg.duration.replace(/"/g, '""')}","${bg.style.replace(/"/g, '""')}","${bg.description.replace(/"/g, '""')}"\n`;
    });
    csvContent += "\n";
    
    // Section 4: بيانات اليوتيوب الـ SEO
    csvContent += "=== بيانات تهيئة اليوتيوب ومحركات البحث SEO ===\n";
    csvContent += `عنوان الفيديو المحسّن,"${result.youtubeOptimization.title.replace(/"/g, '""')}"\n`;
    csvContent += `الوصف المهيأ لمحركات البحث (SEO Description),"${result.youtubeOptimization.description.replace(/"/g, '""')}"\n`;
    csvContent += `الكلمات الدلالية الهاشتاغس,"${result.youtubeOptimization.tags.join(" - ").replace(/"/g, '""')}"\n`;
    csvContent += `أفضل موعد للنشر,"${result.youtubeOptimization.bestPostingTime.replace(/"/g, '""')}"\n\n`;
    
    // Section 5: الأخطاء اللغوية المصححة تلقائياً
    csvContent += "=== جدول التصحيحات الإملائية واللغوية التلقائية ===\n";
    csvContent += "الكلمة الأصلية الخطأ,الكلمة الصحيحة المعدلة,السبب والتوضيح النحوي\n";
    result.corrections.forEach(corr => {
      csvContent += `"${corr.original.replace(/"/g, '""')}","${corr.corrected.replace(/"/g, '""')}","${corr.reason.replace(/"/g, '""')}"\n`;
    });
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const fileName = `تقرير_إنتاج_القصة_${result.youtubeOptimization.title.substring(0, 20).replace(/\s+/g, "_")}.csv`;
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleApplySuggestion = (suggestionId: number, original: string, suggested: string) => {
    if (!result) return;
    
    const currentText = result.correctedText;
    if (currentText.includes(original)) {
      const updatedText = currentText.replaceAll(original, suggested);
      
      const updatedResult = {
        ...result,
        correctedText: updatedText
      };
      
      setResult(updatedResult);
      setAppliedContextSuggestions((prev) => [...prev, suggestionId]);
      
      if (onStoryCorrected) {
        onStoryCorrected(updatedText);
      }
    } else {
      alert("عذراً، لم يتم العثور على العبارة الأصلية في النص المصحح (ربما تم تعديلها بالفعل أو تطبيق تعديل آخر تداخل معها).");
    }
  };

  const handleUndoSuggestion = (suggestionId: number, original: string, suggested: string) => {
    if (!result) return;
    
    const currentText = result.correctedText;
    if (currentText.includes(suggested)) {
      const updatedText = currentText.replaceAll(suggested, original);
      
      const updatedResult = {
        ...result,
        correctedText: updatedText
      };
      
      setResult(updatedResult);
      setAppliedContextSuggestions((prev) => prev.filter(id => id !== suggestionId));
      
      if (onStoryCorrected) {
        onStoryCorrected(updatedText);
      }
    }
  };

  const handleAnalyzeStory = async () => {
    if (!storyText.trim()) return;
    setIsLoading(true);
    try {
      const response = await fetch("/api/proofread", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-custom-gemini-key": backupApiKey || ""
        },
        body: JSON.stringify({ storyText, competitorChannels }),
      });
      if (!response.ok) throw new Error("فشلت عملية التحليل والتصحيح");
      const data: ProofreadResult = await response.json();
      setResult(data);
      setStoryTitle(data.youtubeOptimization.title || "");
      if (onStoryCorrected) {
        onStoryCorrected(data.correctedText);
      }
      
      // Auto generate visual prompt
      generateVisualPrompt(data.correctedText);
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الاتصال بالخادم وتصحيح القصة.");
    } finally {
      setIsLoading(false);
    }
  };

  const generateVisualPrompt = async (text: string) => {
    setIsGeneratingPrompt(true);
    try {
      const response = await fetch("/api/generate-thumbnail-prompt", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-custom-gemini-key": backupApiKey || ""
        },
        body: JSON.stringify({ storyText: text, competitorChannels }),
      });
      if (response.ok) {
        const data = await response.json();
        setImagePrompt(data.prompt);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleGenerateThumbnail = async () => {
    if (!imagePrompt.trim()) return;
    setIsGeneratingImage(true);
    try {
      // We will use Pollinations AI for ultra-high quality, responsive and free image generation based on prompt
      const encodedPrompt = encodeURIComponent(imagePrompt + ", youtube thumbnail style, highly detailed, dramatic lighting, detailed character, 4k resolution");
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1280&height=720&nologo=true&seed=${Math.floor(Math.random() * 100000)}`;
      
      // Preload image to verify loading
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl;
      img.onload = () => {
        setThumbnailImage(imageUrl);
        setIsGeneratingImage(false);
      };
      img.onerror = () => {
        // Fallback to high quality placeholder if pollinations is slow
        setThumbnailImage(`https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&q=80&w=1280&h=720`);
        setIsGeneratingImage(false);
      };
    } catch (err) {
      console.error(err);
      setIsGeneratingImage(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setLogoFile(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Draw on canvas for downloading the thumbnail
  useEffect(() => {
    if (!thumbnailImage) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const baseImg = new Image();
    baseImg.crossOrigin = "anonymous";
    baseImg.src = thumbnailImage;
    baseImg.onload = () => {
      // Set canvas size to Youtube standard 1280x720
      canvas.width = 1280;
      canvas.height = 720;
      ctx.drawImage(baseImg, 0, 0, 1280, 720);

      // Draw dark overlay gradient at the bottom for readability of the title
      const gradient = ctx.createLinearGradient(0, 400, 0, 720);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(0.5, "rgba(0,0,0,0.5)");
      gradient.addColorStop(1, "rgba(0,0,0,0.85)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 400, 1280, 320);

      // Draw Story Title
      if (storyTitle) {
        ctx.fillStyle = titleColor;
        ctx.font = `bold ${titleSize * 1.5}px Cairo`; // Scale font size for 1280 width
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
        
        // Split title into lines if too long
        const yPos = (titleY / 100) * 720;
        ctx.fillText(storyTitle, 640, yPos);
        
        // Reset shadow
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      // Draw Logo watermark
      const drawLogo = (logoImg?: HTMLImageElement) => {
        let lx = 50;
        let ly = 50;
        const size = 100;

        if (logoPosition === "top-right") {
          lx = 1280 - size - 50;
        } else if (logoPosition === "bottom-left") {
          ly = 720 - size - 50;
        } else if (logoPosition === "bottom-right") {
          lx = 1280 - size - 50;
          ly = 720 - size - 50;
        }

        if (logoImg) {
          ctx.shadowColor = "rgba(0,0,0,0.5)";
          ctx.shadowBlur = 10;
          ctx.drawImage(logoImg, lx, ly, size, size);
        } else if (logoText) {
          // Draw elegant textual logo background
          ctx.fillStyle = "rgba(30, 27, 21, 0.75)";
          ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
          ctx.lineWidth = 2;
          
          // Draw rounded rect
          ctx.beginPath();
          ctx.roundRect(lx, ly, 180, 50, 8);
          ctx.fill();
          ctx.stroke();

          // Text
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 20px Cairo";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(logoText, lx + 90, ly + 25);
        }
      };

      if (logoFile) {
        const logoImg = new Image();
        logoImg.src = logoFile;
        logoImg.onload = () => {
          drawLogo(logoImg);
        };
      } else {
        drawLogo();
      }
    };
  }, [thumbnailImage, storyTitle, logoText, logoFile, titleColor, titleSize, logoPosition, titleY]);

  const handleDownloadThumbnail = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `thumbnail-${storyTitle || "story"}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="space-y-8" id="story-prep-tab">
      {/* Competitor Channels Setup Card */}
      <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm">
        <h3 className="text-lg font-bold text-[#3E2723] mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#8D6E63]" />
          القنوات المرجعية والمنافسة (مصادر الإلهام ومحرك التحليل)
        </h3>
        <p className="text-sm text-[#7D766D] mb-4">
          أدخل روابط قنوات يوتيوب المنافسة التي تريد أن تحاكي أسلوبها في سرد القصص، المونتاج، تفاصيل الصور المصغرة، واقتراحات أدوبي أوديشين ليتوافق إنتاجك معها.
        </p>
        
        <div className="flex gap-2 mb-4">
          <input 
            type="text" 
            placeholder="مثال: https://youtube.com/@channel_name" 
            value={newChannel}
            onChange={(e) => setNewChannel(e.target.value)}
            className="flex-1 px-4 py-2 rounded-lg border border-[#ECE9E0] bg-[#FAF9F6] text-sm focus:outline-none focus:ring-2 focus:ring-[#8D6E63]"
            onKeyDown={(e) => e.key === "Enter" && handleAddChannel()}
          />
          <button 
            onClick={handleAddChannel}
            className="px-6 py-2 bg-[#8D6E63] text-white font-bold rounded-lg text-sm hover:bg-[#7D5E53] transition"
          >
            إضافة
          </button>
        </div>

        {competitorChannels.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {competitorChannels.map((channel, idx) => (
              <span 
                key={idx} 
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FAF2EB] text-[#8D6E63] rounded-full text-xs font-semibold border border-[#EFE5DC]"
              >
                {channel}
                <button 
                  onClick={() => handleRemoveChannel(idx)} 
                  className="w-4 h-4 rounded-full bg-[#EFE5DC] text-[#8D6E63] hover:bg-[#8D6E63] hover:text-white flex items-center justify-center text-[10px]"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className="text-xs text-[#9E9E9E] italic">
            لا توجد قنوات مضافة حالياً. سيتم استخدام نمط يوتيوب العام الافتراضي للتحليل.
          </div>
        )}
      </div>

      {/* Main Story input Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm">
            <h3 className="text-lg font-bold text-[#3E2723] mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#8D6E63]" />
              نص القصة الكاملة
            </h3>
            <p className="text-xs text-[#7D766D] mb-4">
              ارفع قصتك بالكامل هنا. سيقوم الذكاء الاصطناعي بتصحيح الأخطاء الإملائية والمطبعية فقط دون تغيير الكلمات أو تحويل اللهجة العامية إلى فصحى لتبدو القصة طبيعية وحرفية أثناء التسجيل.
            </p>
            
            <textarea 
              rows={12}
              placeholder="اكتب أو الصق القصة الكاملة هنا..."
              value={storyText}
              onChange={(e) => setStoryText(e.target.value)}
              className="w-full p-4 rounded-lg border border-[#ECE9E0] bg-[#FCFBF9] text-sm focus:outline-none focus:ring-2 focus:ring-[#8D6E63] leading-relaxed resize-y"
            />
            
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-[#9E9E9E]">
                عدد الكلمات: {storyText ? storyText.trim().split(/\s+/).length : 0} كلمة
              </span>
              <button 
                onClick={handleAnalyzeStory}
                disabled={isLoading || !storyText.trim()}
                className="px-6 py-2.5 bg-[#5D4037] text-white font-bold rounded-lg text-sm hover:bg-[#4E342E] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    جاري التدقيق وصناعة التحضيرات...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    تدقيق القصة وتجهيز التحضيرات
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results section */}
          {result && (
            <div className="space-y-6">
              {/* Top Bar for Actions */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-[#F5F2EB] p-4 rounded-xl border border-[#ECE9E0]">
                <div className="text-right">
                  <h4 className="font-bold text-[#3E2723] text-sm">تجهيز القصة وتصدير الشغل كله</h4>
                  <p className="text-[11px] text-[#7D766D] font-semibold mt-0.5">تقدر تنزل ملف إكسيل فيه القصة الكاملة، المقدمة، الشخصيات، المؤثرات الصوتية، وحاجات الـ SEO كمان.</p>
                </div>
                <button
                  onClick={handleDownloadExcel}
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-lg transition shadow-sm flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  تحميل تقرير القصة والتحضيرات الكاملة (Excel / CSV)
                </button>
              </div>

              {/* 30-60 Seconds Premium Hook Section (المقدمة التشويقية الاحترافية) */}
              <div className="bg-gradient-to-r from-[#3E2723] to-[#5D4037] text-white rounded-xl p-6 border border-[#2D1B18] shadow-md relative overflow-hidden text-right">
                <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full -translate-x-12 -translate-y-12 pointer-events-none" />
                <div className="flex justify-between items-start mb-4">
                  <div className="text-right">
                    <span className="px-2 py-0.5 bg-[#E65100] text-white text-[10px] font-bold rounded-full mb-1.5 inline-block">مقدمة تشويقية سريعة (أول 30-60 ثانية من غير حرق!)</span>
                    <h4 className="text-md font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-[#FFB74D]" />
                      المقدمة المغناطيسية عشان تشد المشاهد وميخرجش (Hook Intro)
                    </h4>
                  </div>
                  <button 
                    onClick={() => triggerCopy(result.videoHook, "hook_intro")}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg border border-white/20"
                  >
                    {copied["hook_intro"] ? <Check className="w-3.5 h-3.5 text-[#81C784]" /> : <Copy className="w-3.5 h-3.5 text-[#FFB74D]" />}
                    {copied["hook_intro"] ? "تم النسخ!" : "نسخ المقدمة السريعة"}
                  </button>
                </div>
                <p className="text-xs text-[#E0D4C5] mb-4 leading-relaxed font-semibold bg-black/25 p-3 rounded-lg border border-white/5 whitespace-pre-wrap text-right">
                  {result.videoHook}
                </p>
                <div className="text-[10px] text-[#FFB74D] font-bold flex items-center gap-1.5 justify-start">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>* نصيحة للأداء الصوتي: قول المقدمة دي بسرعة شوية، بنبرة صوت فيها غموض وتساؤل وإثارة عشان تشد ودن السامع من أول ثانية!</span>
                </div>
              </div>

              {/* Interactive Context Optimizer (مصحح السياق التفاعلي والعبارات الفنية) */}
              {result.contextSuggestions && result.contextSuggestions.length > 0 && (
                <div className="bg-[#FAF2EB] rounded-xl p-6 border border-[#EFE5DC] shadow-sm text-right">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-md font-bold text-[#5D4037] flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-[#8D6E63]" />
                      مصحح السياق التفاعلي واقتراحات التحسين بالعامية (تحكم كامل ليك)
                    </h4>
                    <span className="px-2.5 py-1 bg-[#8D6E63] text-white text-xs font-bold rounded-full">
                      معانا {result.contextSuggestions.length} اقتراحات عشان تزود الإثارة والرعب
                    </span>
                  </div>
                  <p className="text-xs text-[#7D766D] mb-4">
                    الذكاء الاصطناعي طلعلك جمل في قصتك الأصلية ممكن تتقال بطريقة أرعب وأكثر غموضاً بالعامية المصرية. محبناش نعدلها من نفسنا عشان نحافظ على أسلوبك؛ شوف الاقتراح اللي يعجبك ودوس "تطبيق التعديل" وهيغيرها في النص فوراً!
                  </p>

                  <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                    {result.contextSuggestions.map((suggestion) => {
                      const isApplied = appliedContextSuggestions.includes(suggestion.id);
                      return (
                        <div key={suggestion.id} className="p-4 bg-white rounded-lg border border-[#ECE9E0] space-y-3">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <span className="px-2 py-0.5 bg-[#FAF2EB] text-[#8D6E63] text-[10px] font-bold rounded-full">
                              اقتراح رقم {suggestion.id}
                            </span>
                            <div className="flex gap-2 w-full sm:w-auto">
                              {isApplied ? (
                                <button
                                  onClick={() => handleUndoSuggestion(suggestion.id, suggestion.originalPhrase, suggestion.suggestedPhrase)}
                                  className="w-full sm:w-auto px-3 py-1 bg-[#D32F2F]/10 text-[#D32F2F] text-xs font-bold rounded hover:bg-[#D32F2F]/20 transition"
                                >
                                  تراجع عن التعديل ✕
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleApplySuggestion(suggestion.id, suggestion.originalPhrase, suggestion.suggestedPhrase)}
                                  className="w-full sm:w-auto px-3 py-1 bg-[#2E7D32] text-white text-xs font-bold rounded hover:bg-[#1B5E20] transition"
                                >
                                  تطبيق هذا التعديل ✓
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="p-2.5 bg-[#FFEBEE] rounded border border-[#FFCDD2] text-[#C62828] text-right">
                              <span className="font-bold block mb-1">العبارة الأصلية في النص:</span>
                              "{suggestion.originalPhrase}"
                            </div>
                            <div className="p-2.5 bg-[#E8F5E9] rounded border border-[#C8E6C9] text-[#2E7D32] text-right">
                              <span className="font-bold block mb-1">الصياغة المحسنة المقترحة:</span>
                              "{suggestion.suggestedPhrase}"
                            </div>
                          </div>

                          <div className="text-[11px] text-[#7D766D] font-semibold flex items-center gap-1.5 justify-start">
                            <AlertTriangle className="w-3.5 h-3.5 text-[#E65100]" />
                            <span><strong>سبب التعديل:</strong> {suggestion.reason}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Corrected Text compared view */}
              <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm text-right">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <div className="text-right">
                    <h4 className="text-md font-bold text-[#3E2723] flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-[#2E7D32]" />
                      القصة المصححة والجاهزة للتسجيل
                    </h4>
                    <p className="text-[11px] text-[#7D766D] font-semibold mt-0.5">يمكنك زيادة حجم الخط وتباعد الأسطر لتسهيل القراءة أثناء التسجيل الصوتي</p>
                  </div>
                  
                  {/* Sizing & Formatting Controls */}
                  <div className="flex flex-wrap gap-2 items-center bg-[#FAF9F6] p-1.5 rounded-lg border border-[#ECE9E0] w-full sm:w-auto">
                    <span className="text-[10px] font-bold text-[#8D6E63] px-2">مساعد القراءة:</span>
                    
                    <button 
                      onClick={() => setReaderFontSize(prev => Math.max(12, prev - 2))}
                      className="px-2.5 py-1 bg-white hover:bg-[#FAF2EB] border border-[#ECE9E0] rounded text-xs font-bold text-[#3E2723] transition"
                      title="تصغير الخط"
                    >
                      أ-
                    </button>
                    <span className="text-xs font-bold text-[#3E2723] px-1">{readerFontSize}px</span>
                    <button 
                      onClick={() => setReaderFontSize(prev => Math.min(32, prev + 2))}
                      className="px-2.5 py-1 bg-white hover:bg-[#FAF2EB] border border-[#ECE9E0] rounded text-xs font-bold text-[#3E2723] transition"
                      title="تكبير الخط"
                    >
                      أ+
                    </button>
                    
                    <div className="h-4 w-[1px] bg-[#ECE9E0] mx-1" />
                    
                    <button 
                      onClick={() => setIsComfortableSpacing(!isComfortableSpacing)}
                      className={`px-3 py-1 border rounded text-xs font-bold transition ${isComfortableSpacing ? "bg-[#8D6E63] text-white border-[#8D6E63]" : "bg-white text-[#5D4037] border-[#ECE9E0] hover:bg-[#FAF2EB]"}`}
                    >
                      {isComfortableSpacing ? "مسافة ضيقة" : "تباعد مريح"}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] bg-[#E8F5E9] text-[#2E7D32] font-bold px-2 py-0.5 rounded-full">
                    * محدثة بالخيارات السياقية وتصحيحات الإملاء تلقائياً
                  </span>
                  <button 
                    onClick={() => triggerCopy(result.correctedText, "corrected")}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF9F6] text-xs font-semibold rounded-lg hover:bg-[#FAF2EB] border border-[#ECE9E0]"
                  >
                    {copied["corrected"] ? <Check className="w-3.5 h-3.5 text-[#2E7D32]" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied["corrected"] ? "تم النسخ!" : "نسخ النص الكامل"}
                  </button>
                </div>

                <div 
                  className="p-5 rounded-lg bg-[#FAF9F6] border border-[#ECE9E0] overflow-y-auto whitespace-pre-wrap text-right"
                  style={{ 
                    height: "450px", 
                    fontSize: `${readerFontSize}px`, 
                    lineHeight: isComfortableSpacing ? "2.6" : "1.8",
                    color: "#3E2723"
                  }}
                >
                  {result.correctedText}
                </div>
              </div>

              {/* Characters Brief & Background Music */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Character list */}
                <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm">
                  <h4 className="text-md font-bold text-[#3E2723] mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#8D6E63]" />
                    شخصيات القصة وأعمارهم
                  </h4>
                  <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                    {result.characters.map((char, index) => (
                      <div key={index} className="p-3 bg-[#FAF9F6] rounded-lg border border-[#ECE9E0]">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-[#3E2723] text-sm">{char.name}</span>
                          <span className="px-2 py-0.5 bg-[#FAF2EB] text-[#8D6E63] text-[10px] font-bold rounded-full">
                            العمر: {char.age}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-[#8D6E63] mb-1">الدور: {char.role}</p>
                        <p className="text-xs text-[#7D766D]">{char.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Background music setup */}
                <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm">
                  <h4 className="text-md font-bold text-[#3E2723] mb-4 flex items-center gap-2">
                    <Music className="w-5 h-5 text-[#8D6E63]" />
                    مخطط الموسيقى والمؤثرات (Background Music)
                  </h4>
                  <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                    {result.backgroundMusic.map((bg, index) => (
                      <div key={index} className="p-3 bg-[#FAF9F6] rounded-lg border border-[#ECE9E0]">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-xs text-[#3E2723]">{bg.part}</span>
                          <span className="px-2 py-0.5 bg-[#E8F5E9] text-[#2E7D32] text-[10px] font-bold rounded-full">
                            {bg.duration}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-[#8D6E63] mb-1">النمط: {bg.style}</p>
                        <p className="text-xs text-[#7D766D]">{bg.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* YouTube SEO Optimization Metadata */}
              <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm">
                <h4 className="text-md font-bold text-[#3E2723] mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#E65100]" />
                  بيانات اليوتيوب المثالية والمقترحة (SEO Metadata)
                </h4>
                
                <div className="space-y-4">
                  {/* Title */}
                  <div className="p-3 bg-[#FAF9F6] rounded-lg border border-[#ECE9E0]">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-[#8D6E63]">عنوان الفيديو المقترح (عالي النقر)</span>
                      <button 
                        onClick={() => triggerCopy(result.youtubeOptimization.title, "title")}
                        className="p-1 text-[#8D6E63] hover:text-[#5D4037] hover:bg-[#FAF2EB] rounded"
                      >
                        {copied["title"] ? <Check className="w-4 h-4 text-[#2E7D32]" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-sm font-bold text-[#3E2723]">{result.youtubeOptimization.title}</p>
                  </div>

                  {/* Description */}
                  <div className="p-3 bg-[#FAF9F6] rounded-lg border border-[#ECE9E0]">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-[#8D6E63]">وصف الفيديو المهيأ لمحركات البحث</span>
                      <button 
                        onClick={() => triggerCopy(result.youtubeOptimization.description, "desc")}
                        className="p-1 text-[#8D6E63] hover:text-[#5D4037] hover:bg-[#FAF2EB] rounded"
                      >
                        {copied["desc"] ? <Check className="w-4 h-4 text-[#2E7D32]" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-[#5D4037] leading-relaxed whitespace-pre-line">{result.youtubeOptimization.description}</p>
                  </div>

                  {/* Tags */}
                  <div>
                    <span className="text-xs font-bold text-[#8D6E63] block mb-2">العلامات والكلمات المفتاحية (Tags)</span>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {result.youtubeOptimization.tags.map((tag, idx) => (
                        <span key={idx} className="px-2.5 py-1 bg-[#FAF2EB] text-[#8D6E63] text-xs font-medium rounded-md border border-[#EFE5DC]">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <button 
                      onClick={() => triggerCopy(result.youtubeOptimization.tags.join(", "), "tags")}
                      className="text-xs font-bold text-[#8D6E63] hover:underline flex items-center gap-1"
                    >
                      {copied["tags"] ? "تم نسخ الكلمات!" : "نسخ جميع العلامات مفصولة بفواصل"}
                    </button>
                  </div>

                  {/* Best posting time */}
                  <div className="p-3 bg-[#FFF3E0] rounded-lg border border-[#FFE0B2] text-xs text-[#E65100]">
                    <span className="font-bold block mb-1">الموعد المثالي لنشر القصة:</span>
                    {result.youtubeOptimization.bestPostingTime}
                  </div>
                </div>
              </div>

              {/* List of Spelling Mistakes Fixed */}
              <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm">
                <h4 className="text-md font-bold text-[#3E2723] mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#2E7D32]" />
                  الأخطاء اللغوية والإملائية التي تم تصحيحها تلقائياً
                </h4>
                {result.corrections && result.corrections.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="border-b border-[#ECE9E0] text-xs text-[#8D6E63] font-bold">
                          <th className="py-2 px-3">الكلمة الخطأ</th>
                          <th className="py-2 px-3">الكلمة الصحيحة</th>
                          <th className="py-2 px-3">السبب / التوضيح</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs text-[#5D4037]">
                        {result.corrections.map((corr, i) => (
                          <tr key={i} className="border-b border-[#FAF9F6] hover:bg-[#FAF9F6]">
                            <td className="py-2.5 px-3 line-through text-[#D32F2F] font-semibold">{corr.original}</td>
                            <td className="py-2.5 px-3 text-[#2E7D32] font-bold">{corr.corrected}</td>
                            <td className="py-2.5 px-3 text-[#7D766D]">{corr.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-xs text-[#2E7D32] italic bg-[#E8F5E9] p-3 rounded-lg border border-[#C8E6C9]">
                    لم يتم العثور على أخطاء إملائية تستدعي التعديل! النص أصلي ونظيف جداً ولغته ممتازة.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Info & Thumbnail Generator */}
        <div className="space-y-6">
          {/* Quick Metrics */}
          {result && (
            <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm">
              <h4 className="text-md font-bold text-[#3E2723] mb-4">بيانات وتقييم القصة</h4>
              
              <div className="space-y-6">
                {/* Rating out of 10 */}
                <div className="text-center">
                  <span className="text-xs text-[#7D766D] block mb-1">تقييم حبكة وتشويق القصة</span>
                  <div className="inline-flex items-center justify-center p-4 bg-[#FAF2EB] rounded-full border border-[#EFE5DC] mb-2">
                    <div className="text-2xl font-black text-[#8D6E63]">
                      {result.rating} <span className="text-xs text-[#9E9E9E]">/ 10</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    {[...Array(10)].map((_, i) => (
                      <Star 
                        key={i} 
                        className={`w-3.5 h-3.5 ${i < Math.round(result.rating) ? "fill-[#8D6E63] text-[#8D6E63]" : "text-[#ECE9E0]"}`} 
                      />
                    ))}
                  </div>
                </div>

                <hr className="border-[#ECE9E0]" />

                {/* Expected narrating duration */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-[#7D766D] mb-1">
                    <span>مدة القراءة والإلقاء المتوقعة:</span>
                    <span className="text-[#2E7D32] font-black">
                      {(() => {
                        const mins = Math.floor(result.durationMinutes);
                        const secs = Math.round((result.durationMinutes - mins) * 60);
                        return secs > 0 ? `${mins} دقيقة و ${secs} ثانية` : `${mins} دقيقة`;
                      })()}
                    </span>
                  </div>
                  <div className="w-full bg-[#FAF9F6] h-2.5 rounded-full overflow-hidden border border-[#ECE9E0]">
                    <div 
                      className="bg-[#2E7D32] h-full" 
                      style={{ width: `${Math.min(100, (result.durationMinutes / 60) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[#9E9E9E] mt-1.5 leading-relaxed font-semibold">
                    * محسوبة بدقة بالغة بالثواني بناءً على معدل إلقاء إذاعي وسرد مشوق هادئ (بمتوسط 130 كلمة بالدقيقة) يشمل الوقفات التعبيرية للتشويق وسكتات الـ Foley والموسيقى.
                  </p>
                </div>

                <hr className="border-[#ECE9E0]" />

                {/* Detailed Evaluation */}
                <div>
                  <span className="text-xs font-bold text-[#8D6E63] block mb-1">مراجعة الحبكة الفنية:</span>
                  <p className="text-xs text-[#5D4037] leading-relaxed whitespace-pre-line">{result.evaluation}</p>
                </div>
              </div>
            </div>
          )}

          {/* Thumbnail Generator Card */}
          <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm">
            <h4 className="text-md font-bold text-[#3E2723] mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-[#8D6E63]" />
              صانع الغلاف والصورة المصغرة (Thumbnail Maker)
            </h4>
            <p className="text-xs text-[#7D766D] mb-4 leading-relaxed">
              قم بتوليد صورة معبرة مبنية على مشهد القصة، ثم ضع اسم القصة وشعار قناتك فوق الصورة تلقائياً لتبدو كغلاف يوتيوب احترافي فوري!
            </p>

            <div className="space-y-4">
              {/* Image Prompt input */}
              <div>
                <label className="text-xs font-bold text-[#8D6E63] block mb-1">الوصف البصري للصورة (Prompt)</label>
                <textarea 
                  rows={4}
                  placeholder="الوصف البصري الإنجليزي المقترح لمولد الصور..."
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  className="w-full p-3 rounded-lg border border-[#ECE9E0] bg-[#FAF9F6] text-xs focus:outline-none focus:ring-2 focus:ring-[#8D6E63]"
                />
                {isGeneratingPrompt && (
                  <span className="text-[10px] text-[#8D6E63] animate-pulse">جاري استخلاص مشهد بصري عبقري من القصة...</span>
                )}
              </div>

              {/* Generate Image Button */}
              <button 
                onClick={handleGenerateThumbnail}
                disabled={isGeneratingImage || !imagePrompt.trim()}
                className="w-full py-2 bg-[#8D6E63] text-white font-bold rounded-lg text-xs hover:bg-[#7D5E53] transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isGeneratingImage ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    جاري رسم الصورة الخيالية...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    توليد الصورة الذكية مجاناً
                  </>
                )}
              </button>

              <hr className="border-[#ECE9E0]" />

              {/* Thumbnail Customization Overlay Controls */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-[#3E2723] block">خيارات الكتابة والشعار على الغلاف:</span>
                
                {/* Story Title Custom Input */}
                <div>
                  <label className="text-[11px] font-bold text-[#8D6E63] block mb-1">عنوان القصة على الغلاف</label>
                  <input 
                    type="text"
                    placeholder="اسم القصة بالخط العريض"
                    value={storyTitle}
                    onChange={(e) => setStoryTitle(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-[#ECE9E0] bg-[#FAF9F6] text-xs focus:outline-none"
                  />
                </div>

                {/* Logo Custom text Watermark */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-[#8D6E63] block mb-1">نص شعار القناة</label>
                    <input 
                      type="text"
                      placeholder="اسم قناتك"
                      value={logoText}
                      onChange={(e) => setLogoText(e.target.value)}
                      className="w-full px-3 py-1.5 rounded border border-[#ECE9E0] bg-[#FAF9F6] text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#8D6E63] block mb-1">أو ارفع لوجو (.png)</label>
                    <input 
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="w-full text-[10px] text-[#7D766D] file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-[#FAF2EB] file:text-[#8D6E63]"
                    />
                  </div>
                </div>

                {/* Style adjustments */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-[#8D6E63] block mb-1">لون خط العنوان</label>
                    <input 
                      type="color"
                      value={titleColor}
                      onChange={(e) => setTitleColor(e.target.value)}
                      className="w-full h-8 p-0 border-0 rounded cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#8D6E63] block mb-1">حجم الخط</label>
                    <input 
                      type="number"
                      value={titleSize}
                      onChange={(e) => setTitleSize(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded border border-[#ECE9E0] bg-[#FAF9F6] text-xs focus:outline-none"
                    />
                  </div>
                </div>

                {/* Title Y positioning & Logo Position */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-[#8D6E63] block mb-1">موضع الشعار</label>
                    <select 
                      value={logoPosition}
                      onChange={(e: any) => setLogoPosition(e.target.value)}
                      className="w-full px-2 py-1.5 rounded border border-[#ECE9E0] bg-[#FAF9F6] text-xs focus:outline-none"
                    >
                      <option value="top-left">أعلى اليسار</option>
                      <option value="top-right">أعلى اليمين</option>
                      <option value="bottom-left">أسفل اليسار</option>
                      <option value="bottom-right">أسفل اليمين</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#8D6E63] block mb-1">ارتفاع النص (Y)</label>
                    <input 
                      type="range"
                      min={10}
                      max={90}
                      value={titleY}
                      onChange={(e) => setTitleY(Number(e.target.value))}
                      className="w-full h-8 accent-[#8D6E63]"
                    />
                  </div>
                </div>
              </div>

              {/* Interactive Thumbnail Canvas preview */}
              {thumbnailImage && (
                <div className="mt-4 border border-[#ECE9E0] rounded-lg overflow-hidden shadow-sm bg-[#FAF9F6]">
                  <span className="text-[10px] font-bold text-[#8D6E63] px-3 py-1.5 bg-[#FAF2EB] block border-b border-[#ECE9E0]">
                    معاينة حية للغلاف النهائي (Youtube Thumbnail - 1280x720)
                  </span>
                  <div className="relative aspect-video w-full bg-black overflow-hidden flex items-center justify-center">
                    <canvas 
                      ref={canvasRef} 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  
                  <div className="p-3">
                    <button 
                      onClick={handleDownloadThumbnail}
                      className="w-full py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      تحميل صورة غلاف اليوتيوب (PNG)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
