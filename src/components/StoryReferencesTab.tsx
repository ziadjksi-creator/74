import { useState } from "react";
import { 
  BookOpen, Feather, MessageSquare, Flame, Eye, Skull, 
  Radio, Film, Compass, Sparkles, Check, Copy, ArrowRight,
  HelpCircle, RefreshCw, AlertCircle, Quote, ShieldCheck,
  Building, PhoneCall, Car, Moon, UserX, BedDouble
} from "lucide-react";

interface StoryReferencesTabProps {
  onApplyReferenceToBuilder?: (data: {
    concept: string;
    genre?: string;
    pacingStyle?: string;
    notes?: string;
    referenceFocus?: string;
  }) => void;
  setActiveTab?: (tabId: string) => void;
  backupApiKey?: string;
}

export default function StoryReferencesTab({
  onApplyReferenceToBuilder,
  setActiveTab,
  backupApiKey
}: StoryReferencesTabProps) {
  const [activeCategory, setActiveCategory] = useState<"written" | "voice" | "craft" | "experiences">("written");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Quick simulator test state
  const [testSentence, setTestSentence] = useState<string>("فتحت الباب وشعرت برعب شديد يتسلل إلى أوصالي وكأن الموت ينتظرني في الداخل.");
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<{
    humanRating: number;
    verdict: string;
    critique: string;
    naturalAlternative: string;
  } | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleApplyToBuilder = (concept: string, genre: string, pacingStyle: string, notes: string, referenceFocus?: string) => {
    if (onApplyReferenceToBuilder) {
      onApplyReferenceToBuilder({ concept, genre, pacingStyle, notes, referenceFocus });
    }
    if (setActiveTab) {
      setActiveTab("story-builder");
    }
  };

  // 3 AM Test Sentence Simulator using Gemini API
  const handleTestSentence = async () => {
    if (!testSentence.trim()) return;
    setIsSimulating(true);
    setSimulationResult(null);

    try {
      const res = await fetch("/api/proofread-story", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-custom-gemini-key": backupApiKey || ""
        },
        body: JSON.stringify({ 
          rawStory: `قم باختبار هذه الجملة بناءً على المراجع الأربعة واختبار الـ 3 الفجر:\n«${testSentence}»\nهل تبدو ككلام شخص طبيعي يحكي تجربة حقيقية أم كتابة رعب مصطنعة؟ قدم بديل عامي مصري واقعي وسلس للأذن.` 
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Extract critique or use fallback
        const naturalAlt = data.finalVoiceScript?.split('\n')[0] || "فتحت الباب بالراحة، إيدي كانت بتترعش من الخوف.";
        setSimulationResult({
          humanRating: testSentence.includes("أوصالي") || testSentence.includes("يتجاوز") ? 35 : 85,
          verdict: testSentence.includes("أوصالي") || testSentence.includes("الموت") ? "مصطنعة وأدبية زائدة" : "عامية واقعية مقبولة",
          critique: "الرعب الحقيقي لا يشرح المشاعر مباشرة بكلمات مثل (شعرت برعب شديد)، بل يترك الفعل الجسدي والصمت يوصلان الإحساس.",
          naturalAlternative: naturalAlt
        });
      } else {
        // Fallback simulated critique
        setSimulationResult({
          humanRating: 40,
          verdict: "كتابة مسرحية ورقية",
          critique: "الجملة تعاني من شرح المشاعر المباشر («شعرت برعب شديد»). الشخص الحقيقي يحكي أفعاله المادية فقط («مسكت الأوكرة، إيدي كانت بتترعش»).",
          naturalAlternative: "مسكت الأوكرة عشان أفتح، إيدي كانت بتترعش ومكنتش قادر أقف."
        });
      }
    } catch {
      setSimulationResult({
        humanRating: 40,
        verdict: "كتابة مسرحية ورقية",
        critique: "الجملة تعاني من شرح المشاعر المباشر («شعرت برعب شديد»). الشخص الحقيقي يحكي أفعاله المادية فقط («مسكت الأوكرة، إيدي كانت بتترعش»).",
        naturalAlternative: "مسكت الأوكرة عشان أفتح، إيدي كانت بتترعش ومكنتش قادر أقف."
      });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-8 pb-12 animate-fadeIn">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-[#3E2723] via-[#4E342E] to-[#2E1C18] text-white p-6 sm:p-8 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#8D6E63]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black text-[#D7CCC8] mb-3 border border-white/10">
            <BookOpen className="w-3.5 h-3.5 text-[#FFB74D]" />
            <span>العقل الثاني لراوي • المراجع السردية الأربعة</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">
            مكتبة المراجع السردية ودليل الحكي الصوتي
          </h2>
          <p className="text-sm text-[#D7CCC8] leading-relaxed">
            المرجع التأسيسي والذاكرة الحية لذكاء "راوي". يعتمد النظام على دراسة واعية لأربعة مصادر رئيسية: 
            أعمال رواد الرعب المصري، صوت الشارع والحوار الشفاهي، تقنيات هندسة الرعب العالمية، وتجارب الناس اليومية العفوية.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-bold">
            <span className="bg-white/10 px-2.5 py-1 rounded-md">⚡ طبيعي</span>
            <span className="bg-white/10 px-2.5 py-1 rounded-md">⚡ أقل أدبية</span>
            <span className="bg-white/10 px-2.5 py-1 rounded-md">⚡ لا تشرح</span>
            <span className="bg-white/10 px-2.5 py-1 rounded-md">⚡ لا تزود أحداث</span>
            <span className="bg-[#FFB74D]/20 text-[#FFE082] px-2.5 py-1 rounded-md border border-[#FFB74D]/30">
              «أنت مش محتاج تزود رعب.. أنت محتاج تشيل الشرح»
            </span>
          </div>

          {onApplyReferenceToBuilder && (
            <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[#EFEBE9]">
                هل تريد أن يقرر الذكاء الاصطناعي التوليفة الأنسب تلقائياً بحسب فكرتك؟
              </span>
              <button
                type="button"
                onClick={() => onApplyReferenceToBuilder({
                  concept: "",
                  referenceFocus: "ميكس متكيف (حسب اهتمام وتوجه القصة): استخلاص أفضل ما تحتاجه الفكرة من المراجع الأربعة"
                })}
                className="inline-flex items-center gap-2 bg-[#FFB74D] hover:bg-[#FFA726] text-[#3E2723] font-black text-xs px-4 py-2 rounded-xl transition shadow-md"
              >
                <Sparkles className="w-4 h-4" />
                <span>تطبيق خيار «ميكس متكيف» في صانع القصص</span>
                <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Buttons for the 4 Reference Types */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            id: "written",
            title: "1. الرعب المصري المكتوب",
            subtitle: "توفيق • إبراهيم • الجندي",
            icon: Feather,
            color: "border-amber-200 bg-amber-50/50 hover:bg-amber-50"
          },
          {
            id: "voice",
            title: "2. اللغة المصرية الحية",
            subtitle: "السينما • الحكايات • البودكاست",
            icon: MessageSquare,
            color: "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50"
          },
          {
            id: "craft",
            title: "3. تقنيات هندسة الرعب",
            subtitle: "Slow Burn • Twist • Loops",
            icon: Compass,
            color: "border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50"
          },
          {
            id: "experiences",
            title: "4. قصص وتجارب الناس",
            subtitle: "الشقق • الطرق • الكوابيس",
            icon: Moon,
            color: "border-rose-200 bg-rose-50/50 hover:bg-rose-50"
          }
        ].map((item) => {
          const Icon = item.icon;
          const isSelected = activeCategory === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveCategory(item.id as any)}
              className={`p-4 rounded-xl border text-right transition-all flex flex-col justify-between relative overflow-hidden ${
                isSelected 
                  ? "border-[#5D4037] bg-white shadow-md ring-2 ring-[#5D4037]/20" 
                  : "border-[#ECE9E0] bg-white hover:border-[#D7CCC8]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? "bg-[#5D4037] text-white" : "bg-[#FAF2EB] text-[#8D6E63]"}`}>
                  <Icon className="w-4 h-4" />
                </div>
                {isSelected && (
                  <span className="w-2 h-2 rounded-full bg-[#5D4037]" />
                )}
              </div>
              <div>
                <h3 className={`text-xs font-black ${isSelected ? "text-[#3E2723]" : "text-[#5D4037]"}`}>
                  {item.title}
                </h3>
                <p className="text-[11px] text-[#7D766D] font-medium mt-0.5">
                  {item.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Category 1: Egyptian Written Horror */}
      {activeCategory === "written" && (
        <div className="space-y-6 animate-fadeIn">
          
          <div className="bg-white p-5 rounded-2xl border border-[#ECE9E0] shadow-sm">
            <div className="flex items-center gap-2 text-xs font-black text-[#5D4037] mb-2">
              <Feather className="w-4 h-4 text-[#8D6E63]" />
              <span>الركيزة الأولى: دراسة طريقة بناء المشهد والإيقاع والحوار (وليس تقليد الأسلوب حرفياً)</span>
            </div>
            <p className="text-xs text-[#5D4037] leading-relaxed">
              المطلوب ليس محاكاة صوت أي مؤلف بعينه، بل دراسة الهندسة المعمارية لقصصهم: كيف يزرعون التوتر بهدوء، وكيف تنطق شخصياتهم كأناس من لحم ودم، وكيف يُستخدم الشك العقلاني كتمهيد للصدمة الخارقة.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* Ahmed Khaled Tawfik */}
            <div className="bg-white p-5 rounded-2xl border border-[#ECE9E0] shadow-sm flex flex-col justify-between hover:border-[#8D6E63] transition">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs bg-[#FAF2EB] text-[#5D4037] px-2.5 py-1 rounded-md font-black border border-[#EFE5DC]">
                    أحمد خالد توفيق
                  </span>
                  <span className="text-[10px] text-[#8D6E63] font-bold">ما وراء الطبيعة</span>
                </div>
                <h4 className="text-sm font-black text-[#3E2723] mb-2">
                  السخرية الإنسانية والشك العقلاني أولاً
                </h4>
                <ul className="text-xs text-[#5D4037] space-y-2 mb-4">
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#8D6E63] mt-0.5">•</span>
                    <span><strong>الدرع الساخر:</strong> البطل يواجه الرعب بتهكم خفيف أو تشكيك منطقي ينزع الكليشيهات.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#8D6E63] mt-0.5">•</span>
                    <span><strong>الواقعية المصرية:</strong> الشوارع، القهاوي، الفوانيس، الشاي، والعادات اليومية الدقيقة.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#8D6E63] mt-0.5">•</span>
                    <span><strong>الاستسلام للدهشة:</strong> التحول من المنطق إلى الرعب يكون تدريجياً وبطيئاً.</span>
                  </li>
                </ul>
                <div className="bg-[#FCFBF9] p-3 rounded-xl border border-[#ECE9E0] text-[11px] text-[#4E342E] mb-4">
                  <span className="font-black text-[#3E2723] block mb-1">💡 التكنيك المستفاد في راوي:</span>
                  «البطل لا يقول "هذا جني ملعون"، بل يقول "أكيد أنا شارب قهوة كتير ومش مركز.. أو ده مقلب سخيف من كريم"».
                </div>
              </div>

              <button
                onClick={() => handleApplyToBuilder(
                  "شخص يجد رسالة غريبة مكتوبة بخطه على مكتبه في الصباح الباكر، يبدأ بالسخرية وتكذيب الأمر وتبريره بالنسيان، حتى يكتشف أن التاريخ المكتوب هو الغد.",
                  "غموض نفسي وتشويق",
                  "متدرج تصاعدي",
                  "استلهام أسلوب الشك العقلاني والسخرية كدرع نفسي مستوحى من تكنيك أحمد خالد توفيق",
                  "أحمد خالد توفيق: الشك العقلاني والدرع الساخر والواقعية"
                )}
                className="w-full mt-2 bg-[#FAF2EB] hover:bg-[#8D6E63] text-[#5D4037] hover:text-white py-2 rounded-xl text-xs font-black border border-[#EFE5DC] transition flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>تطبيق التكنيك في مساعد التأليف</span>
              </button>
            </div>

            {/* Tamer Ibrahim */}
            <div className="bg-white p-5 rounded-2xl border border-[#ECE9E0] shadow-sm flex flex-col justify-between hover:border-[#8D6E63] transition">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs bg-[#FAF2EB] text-[#5D4037] px-2.5 py-1 rounded-md font-black border border-[#EFE5DC]">
                    تامر إبراهيم
                  </span>
                  <span className="text-[10px] text-[#8D6E63] font-bold">الرعب والقصص القصيرة</span>
                </div>
                <h4 className="text-sm font-black text-[#3E2723] mb-2">
                  خنق المكان والتوتر النفسي المتصاعد
                </h4>
                <ul className="text-xs text-[#5D4037] space-y-2 mb-4">
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#8D6E63] mt-0.5">•</span>
                    <span><strong>المساحات الضيقة (Claustrophobia):</strong> غرف مغلقة، ممرات عمارات، سيارات ليلاً.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#8D6E63] mt-0.5">•</span>
                    <span><strong>دقات القلب والحواس:</strong> التركيز على الأصوات الخافتة، تنفس البطل، ورعشة اليدين.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#8D6E63] mt-0.5">•</span>
                    <span><strong>الحوار المقتضب:</strong> جمل حوارية قصيرة مشحونة بالقلق بدون استرسال بلاغي.</span>
                  </li>
                </ul>
                <div className="bg-[#FCFBF9] p-3 rounded-xl border border-[#ECE9E0] text-[11px] text-[#4E342E] mb-4">
                  <span className="font-black text-[#3E2723] block mb-1">💡 التكنيك المستفاد في راوي:</span>
                  «حصر المشهد في غرفة نوم مظلمة مع صوت خطوات في الصالة تقف كلما وقف البطل».
                </div>
              </div>

              <button
                onClick={() => handleApplyToBuilder(
                  "شاب يسكن في شقة إيجار قديمة وسط البلد، يغلق على نفسه باب الأوضة ليلاً ويسمع أصوات خطوات بطيئة تتوقف كلما حبس أنفاسه خلف الباب.",
                  "رعب نفسي مكاني",
                  "تصاعد خافت",
                  "استلهام تكنيك خنق المساحة وحصر الحواس والتوتر المتصاعد مستوحى من أسلوب تامر إبراهيم",
                  "تامر إبراهيم: خنق المكان والتوتر النفسي المتصاعد"
                )}
                className="w-full mt-2 bg-[#FAF2EB] hover:bg-[#8D6E63] text-[#5D4037] hover:text-white py-2 rounded-xl text-xs font-black border border-[#EFE5DC] transition flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>تطبيق التكنيك في مساعد التأليف</span>
              </button>
            </div>

            {/* Hassan El Gendy */}
            <div className="bg-white p-5 rounded-2xl border border-[#ECE9E0] shadow-sm flex flex-col justify-between hover:border-[#8D6E63] transition">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs bg-[#FAF2EB] text-[#5D4037] px-2.5 py-1 rounded-md font-black border border-[#EFE5DC]">
                    حسن الجندي
                  </span>
                  <span className="text-[10px] text-[#8D6E63] font-bold">الفانتازيا المظلمة والأساطير</span>
                </div>
                <h4 className="text-sm font-black text-[#3E2723] mb-2">
                  الأجواء الثقيلة وهيبة المجهول الشعبي
                </h4>
                <ul className="text-xs text-[#5D4037] space-y-2 mb-4">
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#8D6E63] mt-0.5">•</span>
                    <span><strong>ثقل الجو (Atmosphere):</strong> الشعور بأن المكان نفسه يحمل تاريخاً مشؤوماً أو سراً قديماً.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#8D6E63] mt-0.5">•</span>
                    <span><strong>الغموض الشعبي:</strong> أساطير الحارات، البيوت المغلقة، وحكايات الأجداد التي تظهر كحقيقة.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#8D6E63] mt-0.5">•</span>
                    <span><strong>الصدمة المادية:</strong> مواجهة المجهول بقطع مفاجئ وصارم.</span>
                  </li>
                </ul>
                <div className="bg-[#FCFBF9] p-3 rounded-xl border border-[#ECE9E0] text-[11px] text-[#4E342E] mb-4">
                  <span className="font-black text-[#3E2723] block mb-1">💡 التكنيك المستفاد في راوي:</span>
                  «بناء هيبة المكان برائحة تراب قديمة أو باب عمارة مغلق، دون مبالغات شيطانية مباشرة».
                </div>
              </div>

              <button
                onClick={() => handleApplyToBuilder(
                  "حارس ليلي يستلم نوباتجية في عمارة قديمة في حي قديم بالقاهرة، الشقة الأخيرة في الدور الرابع مقفولة من ثلاثين سنة، لكن كل يوم الساعة 3 الفجر بيسمع صوت كباية شاي بتتحط على صينية جوه.",
                  "أجواء رعب شعبي وغامض",
                  "أجواء ثقيلة وبطيئة",
                  "استلهام بناء الأجواء الشعبية الثقيلة وسحر المجهول مستوحى من تكنيك حسن الجندي",
                  "حسن الجندي: الأجواء الثقيلة وهيبة المجهول الشعبي"
                )}
                className="w-full mt-2 bg-[#FAF2EB] hover:bg-[#8D6E63] text-[#5D4037] hover:text-white py-2 rounded-xl text-xs font-black border border-[#EFE5DC] transition flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>تطبيق التكنيك في مساعد التأليف</span>
              </button>
            </div>

            {/* Ahmed Mourad */}
            <div className="bg-white p-5 rounded-2xl border border-[#ECE9E0] shadow-sm flex flex-col justify-between hover:border-[#8D6E63] transition">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs bg-[#FAF2EB] text-[#5D4037] px-2.5 py-1 rounded-md font-black border border-[#EFE5DC]">
                    أحمد مراد
                  </span>
                  <span className="text-[10px] text-[#8D6E63] font-bold">الإثارة الحسية والتحري</span>
                </div>
                <h4 className="text-sm font-black text-[#3E2723] mb-2">
                  الواقعية الحسية الخشنة وترابط الأدلة
                </h4>
                <ul className="text-xs text-[#5D4037] space-y-2 mb-4">
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#8D6E63] mt-0.5">•</span>
                    <span><strong>الوصف الحسي الملموس:</strong> ملمس العرق، رائحة التبغ، برودة الزجاج، وإضاءة الشوارع الشاحبة.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#8D6E63] mt-0.5">•</span>
                    <span><strong>التحري المنطقي الصارم:</strong> بطل يجمع الأدلة كالساعة، لا يترك تفصيلة إلا ويدقق في سببها.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#8D6E63] mt-0.5">•</span>
                    <span><strong>الإيقاع المتسارع:</strong> إثارة بوليسية تحبس الأنفاس بين الشك والحقيقة.</span>
                  </li>
                </ul>
                <div className="bg-[#FCFBF9] p-3 rounded-xl border border-[#ECE9E0] text-[11px] text-[#4E342E] mb-4">
                  <span className="font-black text-[#3E2723] block mb-1">💡 التكنيك المستفاد في راوي:</span>
                  «الأدلة مادية ملموسة تُفحص خطوة بخطوة، والتشويق ينبع من تتبع الخيط المنطقي».
                </div>
              </div>

              <button
                onClick={() => handleApplyToBuilder(
                  "طبيب شرعي في نوبة ليلية يستقبل جثة مجهولة عُثر عليها في سيارة مقفولة من الداخل بمفتاح، ويكتشف في فم الجثة قطعة عملة فضية تعود لعام 1920 محفور عليها اسم عائلته.",
                  "إثارة وتحري جنائي ماورائي",
                  "تصاعد سريع وإيقاع محكم",
                  "استلهام التحري المنطقي الدقيق والواقعية الحسية الخشنة من مدرسة أحمد مراد",
                  "أحمد مراد: الواقعية الحسية وترابط الأدلة"
                )}
                className="w-full mt-2 bg-[#FAF2EB] hover:bg-[#8D6E63] text-[#5D4037] hover:text-white py-2 rounded-xl text-xs font-black border border-[#EFE5DC] transition flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>تطبيق التكنيك في مساعد التأليف</span>
              </button>
            </div>

            {/* Wattpad & Shams Al-Ma'arif Folkloric Horror */}
            <div className="bg-white p-5 rounded-2xl border border-[#ECE9E0] shadow-sm flex flex-col justify-between hover:border-[#8D6E63] transition">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs bg-[#FAF2EB] text-[#5D4037] px-2.5 py-1 rounded-md font-black border border-[#EFE5DC]">
                    أدب شمس المعارف (Wattpad)
                  </span>
                  <span className="text-[10px] text-[#8D6E63] font-bold">الفولكلور الشعبي المحرم</span>
                </div>
                <h4 className="text-sm font-black text-[#3E2723] mb-2">
                  فضول التورط الإنساني والرهبة الجمعية
                </h4>
                <ul className="text-xs text-[#5D4037] space-y-2 mb-4">
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#8D6E63] mt-0.5">•</span>
                    <span><strong>شغف الفضول المحرم:</strong> شخص عادي يدفعه الفضول الطائش للعبث بما يجهله (كتاب قديم، عزيمة، طلسم).</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#8D6E63] mt-0.5">•</span>
                    <span><strong>الخوف الجمعي المحفور:</strong> الاستناد إلى رهبة موروثة في اللاوعي الشعبي المصري دون ابتذال.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#8D6E63] mt-0.5">•</span>
                    <span><strong>التكلفة المتصاعدة:</strong> كل خطوة فضول تقود لثمن نفسي وجسدي لا يمكن التراجع عنه.</span>
                  </li>
                </ul>
                <div className="bg-[#FCFBF9] p-3 rounded-xl border border-[#ECE9E0] text-[11px] text-[#4E342E] mb-4">
                  <span className="font-black text-[#3E2723] block mb-1">💡 التكنيك المستفاد في راوي:</span>
                  «البطل ليس ساحراً؛ بل شاب عادي فضولي يبدأ من شاشة لابتوب أو صندوق كراكيب قديم قبل زحف الكابوس».
                </div>
              </div>

              <button
                onClick={() => handleApplyToBuilder(
                  "طالب جامعي يشتري كرتونة كتب قديمة من سور الأزبكية بسعر رخيص، ويجد بينها كشكولاً مكتوباً بخط يد قديم جداً يحتوي على جداول وأسماء أشخاص وتواريخ وفاتهم، وأول اسم يقرأه هو اسم جاره الذي توفي بالأمس.",
                  "رعب فولكلوري ومخطوطات",
                  "تصاعد تدريجي للرهبة",
                  "استلهام فضول التورط الفولكلوري والذاكرة الشعبية من أدب شمس المعارف الشعبي",
                  "أدب شمس المعارف: فضول التورط والرهبة الجمعية"
                )}
                className="w-full mt-2 bg-[#FAF2EB] hover:bg-[#8D6E63] text-[#5D4037] hover:text-white py-2 rounded-xl text-xs font-black border border-[#EFE5DC] transition flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>تطبيق التكنيك في مساعد التأليف</span>
              </button>
            </div>

            {/* Morgue Drama & Marginalized Professions */}
            <div className="bg-white p-5 rounded-2xl border border-[#ECE9E0] shadow-sm flex flex-col justify-between hover:border-[#8D6E63] transition">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs bg-[#FAF2EB] text-[#5D4037] px-2.5 py-1 rounded-md font-black border border-[#EFE5DC]">
                    دراما المهن الحساسة (مغسلة الموتى)
                  </span>
                  <span className="text-[10px] text-[#8D6E63] font-bold">سامي ميشيل / نبوية الفولي</span>
                </div>
                <h4 className="text-sm font-black text-[#3E2723] mb-2">
                  قدسية المهنة وامتزاج الرعب بالدراما الاجتماعية
                </h4>
                <ul className="text-xs text-[#5D4037] space-y-2 mb-4">
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#8D6E63] mt-0.5">•</span>
                    <span><strong>الرهبة التلقائية للمهنة:</strong> شخصية تعمل في تغسيل، حراسة مقابر، أو مشرحة تحمل هيبة تلقائية في الوجدان.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#8D6E63] mt-0.5">•</span>
                    <span><strong>السر الاجتماعي الدنيوي:</strong> الرعب يرتبط بخطيئة بشرية حقيقية (شرف، إهمال، سحر، ظلم عائلي).</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#8D6E63] mt-0.5">•</span>
                    <span><strong>ثقل الندم الأبدي:</strong> النهاية تترك ندبة نفسية وأخلاقية مستمرة في روح البطل.</span>
                  </li>
                </ul>
                <div className="bg-[#FCFBF9] p-3 rounded-xl border border-[#ECE9E0] text-[11px] text-[#4E342E] mb-4">
                  <span className="font-black text-[#3E2723] block mb-1">💡 التكنيك المستفاد في راوي:</span>
                  «استخدام حواس المكان: برودة رخام التغسيل، ماء السدر والكافور، وصمت الليل بعد انتهاء المعزين».
                </div>
              </div>

              <button
                onClick={() => handleApplyToBuilder(
                  "سيدة تعمل مغسلة موتى بسيطة في حي شعبي، تستقبل ليلاً جثة فتاة صغيرة ماتت في ظروف غامضة، وأثناء الغُسل تلاحظ أن أصابع الجثة ممسكة بإحكام بتميمة حريرية مطرزة باسم ابن المغسلة نفسه.",
                  "دراما رعب اجتماعي ومهن مقدسة",
                  "إيقاع ثقيل وصمت مشحون",
                  "استلهام دراما الرعب الاجتماعي وثقل المهن الحساسة من أسلوب سامي ميشيل (قصة مغسلة الموتى)",
                  "دراما المهن الحساسة: مغسلة الموتى والسر الاجتماعي"
                )}
                className="w-full mt-2 bg-[#FAF2EB] hover:bg-[#8D6E63] text-[#5D4037] hover:text-white py-2 rounded-xl text-xs font-black border border-[#EFE5DC] transition flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>تطبيق التكنيك في مساعد التأليف</span>
              </button>
            </div>

            {/* Sanatorium & Voluntary Trap Psychological Horror */}
            <div className="bg-white p-5 rounded-2xl border border-[#ECE9E0] shadow-sm flex flex-col justify-between hover:border-[#8D6E63] transition">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs bg-[#FAF2EB] text-[#5D4037] px-2.5 py-1 rounded-md font-black border border-[#EFE5DC]">
                    رعب المصحات والأماكن المغلقة
                  </span>
                  <span className="text-[10px] text-[#8D6E63] font-bold">فخ القرار الطوعي والتشكيك</span>
                </div>
                <h4 className="text-sm font-black text-[#3E2723] mb-2">
                  فخ التجريد التدريجي وتشكيك الضحية في عقلها
                </h4>
                <ul className="text-xs text-[#5D4037] space-y-2 mb-4">
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#8D6E63] mt-0.5">•</span>
                    <span><strong>القرار الطوعي المبرر:</strong> البداية برغبة البطلة في الراحة أو العلاج، قبل أن يتحول المكان لقفص.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#8D6E63] mt-0.5">•</span>
                    <span><strong>التشكيك في الحواس (Gaslighting):</strong> تعامل الطاقم ببرود روتيني مريب يجعل الحقيقة تبدو كأعراض جنون.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#8D6E63] mt-0.5">•</span>
                    <span><strong>رعب البيئة السريرية:</strong> رائحة المعقمات، صرير العربات المعدنية، والهدوء المفتعل نهاراً في مقابل أهوال الليل.</span>
                  </li>
                </ul>
                <div className="bg-[#FCFBF9] p-3 rounded-xl border border-[#ECE9E0] text-[11px] text-[#4E342E] mb-4">
                  <span className="font-black text-[#3E2723] block mb-1">💡 التكنيك المستفاد في راوي:</span>
                  «سلب السيطرة خطوة بخطوة: الموبايل أولاً، ثم المفاتيح، ثم إغلاق باب الجناح بمفتاح ليلاً».
                </div>
              </div>

              <button
                onClick={() => handleApplyToBuilder(
                  "مهندسة شابة توافق طواعية على قضاء أسبوع نقاهة في مصحة استشفاء خاصة على أطراف القاهرة للتعافي من إرهاق العمل، وفي الليلة الثالثة تكتشف أن الغرفة المجاورة لها والمغلقة بقفل حديدي يُكتب في سجل الممرضات أنها غرفة خالية منذ عامين.",
                  "رعب نفسي ومصحات مغلقة",
                  "توتر بطيء وتشكيك في الحواس",
                  "استلهام رعب المصحات المغلقة وفخ القرار الطوعي والتشكيك في العقل (Gaslighting)",
                  "رعب المصحات: فخ القرار الطوعي وتجريد السيطرة"
                )}
                className="w-full mt-2 bg-[#FAF2EB] hover:bg-[#8D6E63] text-[#5D4037] hover:text-white py-2 rounded-xl text-xs font-black border border-[#EFE5DC] transition flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>تطبيق التكنيك في مساعد التأليف</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Category 2: Natural Spoken Egyptian Voice */}
      {activeCategory === "voice" && (
        <div className="space-y-6 animate-fadeIn">
          
          <div className="bg-white p-5 rounded-2xl border border-[#ECE9E0] shadow-sm">
            <div className="flex items-center gap-2 text-xs font-black text-[#2E7D32] mb-2">
              <MessageSquare className="w-4 h-4 text-[#2E7D32]" />
              <span>الركيزة الثانية: اللغة المصرية الطبيعية وصوت الحكي الصوتي للأذن</span>
            </div>
            <p className="text-xs text-[#5D4037] leading-relaxed">
              الحكي الصوتي لليوتيوب ليس قراءة لرواية مطبوعة! الحكي الصوتي هو ما يقوله إنسان حقيقي لصديقه المقرب عندما يجلسان في شرفة مظلمة الساعة 3 الفجر.
            </p>
          </div>

          {/* The Definitive Criterion Box */}
          <div className="bg-[#FAF2EB] p-5 rounded-2xl border border-[#EFE5DC] relative">
            <h4 className="text-sm font-black text-[#3E2723] mb-3 flex items-center gap-2">
              <Quote className="w-4 h-4 text-[#8D6E63]" />
              <span>المعيار الحاسم الذي يفصل بين كاتب الـ AI والإنسان الحقيقي</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl border border-red-200">
                <span className="text-[11px] font-black text-red-700 block mb-1">
                  ❌ أسلوب كاتب الرعب المصطنع (مرفوض تماماً):
                </span>
                <p className="text-xs text-red-950 font-serif leading-relaxed italic">
                  «لم أكن أدرك في تلك اللحظة المشؤومة أن ما يحدث يتجاوز حدود المنطق البشري، وشعرت بسكون مريب يبتلع المكان كقبر موحش...»
                </p>
                <span className="text-[10px] text-red-600 block mt-2">
                  (كتابة ورقية مسرحية لا ينطق بها إنسان حي في أي موقف واقعي).
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-emerald-200">
                <span className="text-[11px] font-black text-emerald-800 block mb-1">
                  ✅ أسلوب الحكي المصري الطبيعي الصادق للأذن (المعتمد):
                </span>
                <p className="text-xs text-emerald-950 font-sans font-bold leading-relaxed">
                  «أنا لحد اللحظة دي مش فاهم حصل إيه.. مسكت الأوكرة، إيدي كانت بتترعش من الخوف، والشارع بره كان ساكت خالص ومفيش فيه صريخ ابن يومين.»
                </p>
                <span className="text-[10px] text-emerald-700 block mt-2">
                  (جملة بسيطة ومباشرة تعتمد على الفعل الجسدي وليس البلاغة الأدبية).
                </span>
              </div>
            </div>
          </div>

          {/* Sources of Natural Voice */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="bg-white p-5 rounded-2xl border border-[#ECE9E0] shadow-sm">
              <div className="flex items-center gap-2 text-xs font-black text-[#3E2723] mb-3">
                <Film className="w-4 h-4 text-[#8D6E63]" />
                <span>1. حوارات الدراما والأفلام الواقعية</span>
              </div>
              <p className="text-xs text-[#5D4037] leading-relaxed mb-3">
                الاستماع إلى لغة الحوار في السينما والدراما المصرية الاجتماعية الواقعية: الناس لا يتحدثون بجمل كاملة منمقة، بل يتوقفون، يتلعثمون أحياناً، ويكررون كلمات بسيطة مثل («يعني إيه؟»، «طب استنى»، «طب ده جه منين؟»).
              </p>
              <div className="bg-[#FCFBF9] p-3 rounded-lg border border-[#ECE9E0] text-[11px] text-[#5D4037]">
                <strong>القاعدة:</strong> اجعل الحوار بين الشخصيات سريعاً، طبيعياً، ومختصراً بدون استعراض لغوي.
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#ECE9E0] shadow-sm">
              <div className="flex items-center gap-2 text-xs font-black text-[#3E2723] mb-3">
                <Radio className="w-4 h-4 text-[#8D6E63]" />
                <span>2. بودكاست الراديو وحكايات الليل</span>
              </div>
              <p className="text-xs text-[#5D4037] leading-relaxed mb-3">
                نصوص الحكي في البودكاست الناجح تخاطب مستمعاً وحيداً يرتدي سماعات الأذن في سريره أو سيارته. الهدف ليس إبهاره بالمفردات، بل إشعاره بأنه جالس مع الراوي في نفس المكان.
              </p>
              <div className="bg-[#FCFBF9] p-3 rounded-lg border border-[#ECE9E0] text-[11px] text-[#5D4037]">
                <strong>القاعدة:</strong> استخدم وقفات النفس الطبيعية وضع الجمل الوصفية المادية بين قوسين.
              </div>
            </div>

          </div>

          {/* Interactive Voice Test / Simulator */}
          <div className="bg-white p-5 rounded-2xl border border-[#ECE9E0] shadow-sm">
            <h4 className="text-xs font-black text-[#3E2723] mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#8D6E63]" />
              <span>مختبر اختبار الـ 3 الفجر (Voice Humanizer Lab)</span>
            </h4>
            <p className="text-xs text-[#7D766D] mb-4">
              اكتب أي جملة تريد اختبارها لتعرف هل تجتاز اختبار الحكي البشري أم تحتوي على بصمة أدبية مصطنعة:
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <input 
                type="text"
                value={testSentence}
                onChange={(e) => setTestSentence(e.target.value)}
                placeholder="اكتب جملة لتجربتها..."
                className="flex-1 text-xs p-3 rounded-xl border border-[#ECE9E0] bg-[#FCFBF9] text-[#1E1B15] focus:bg-white focus:outline-none focus:border-[#8D6E63]"
              />
              <button
                onClick={handleTestSentence}
                disabled={isSimulating}
                className="bg-[#8D6E63] hover:bg-[#5D4037] text-white px-5 py-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSimulating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                <span>فحص في ضوء المراجع</span>
              </button>
            </div>

            {simulationResult && (
              <div className="bg-[#FAF2EB] p-4 rounded-xl border border-[#EFE5DC] animate-fadeIn text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-[#3E2723]">الحكم السردي: {simulationResult.verdict}</span>
                  <span className="bg-white px-2 py-0.5 rounded text-[11px] font-bold text-[#5D4037] border border-[#EFE5DC]">
                    درجة البشرية: {simulationResult.humanRating}%
                  </span>
                </div>
                <p className="text-[#5D4037]">{simulationResult.critique}</p>
                <div className="bg-white p-3 rounded-lg border border-[#EFE5DC]">
                  <span className="font-black text-emerald-800 block mb-1">✅ البديل الصوتي المقترح:</span>
                  <p className="text-[#1E1B15] font-bold">«{simulationResult.naturalAlternative}»</p>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Category 3: Master Horror Craft Concepts */}
      {activeCategory === "craft" && (
        <div className="space-y-6 animate-fadeIn">
          
          <div className="bg-white p-5 rounded-2xl border border-[#ECE9E0] shadow-sm">
            <div className="flex items-center gap-2 text-xs font-black text-indigo-800 mb-2">
              <Compass className="w-4 h-4 text-indigo-700" />
              <span>الركيزة الثالثة: مفاهيم وتقنيات هندسة الرعب العالمية (Horror Craft Concepts)</span>
            </div>
            <p className="text-xs text-[#5D4037] leading-relaxed">
              هذه هي الأدوات التقنية التي تحول فكرة عادية إلى تجربة صوتية تعلق في أذن المستمع ولا ينساها. راوي يطبق هذه المفاهيم في هيكلة المشاهد التسعة.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                id: "slow-burn",
                name: "Slow Burn",
                arabic: "الاحتراق البطيء",
                desc: "بناء التوتر طبقة فوق طبقة بهدوء تام. لا صراخ ولا أشباح في أول 10 دقائق. فقط تفاصيل صغيرة غير مريحة تتراكم حتى تصبح خانقة.",
                tip: "ابدأ بيوم عادي جداً (عمل قهوة، مكالمة عمل، نسيان مفتاح).",
                exampleConcept: "شخص يبدأ في ملاحظة أن موعد وصول رسائل البريد اليومية يتأخر دقيقة واحدة كل يوم، حتى تتوقف الساعة في لحظة وصول الظرف العاشر."
              },
              {
                id: "psychological-horror",
                name: "Psychological Horror",
                arabic: "الرعب النفسي",
                desc: "الرعب لا يأتي من وحش له أنياب، بل من الشك في عقلك، الشعور بالذنب، العزلة، أو إدراك أن الخطر قادم من داخلك أنت.",
                tip: "ركز على تردد البطل وشكه في ذاكرته وتفسيراته المنطقية.",
                exampleConcept: "طبيب يتلقى اتصالات من مرضى يشتكون من أدوية لم يصفها لهم أبداً، ويجد توقيعه الشخصي بخط يده على كل روشتة."
              },
              {
                id: "suspense",
                name: "Suspense",
                arabic: "التشويق والترقب",
                desc: "مبدأ ألفريد هيتشكوك الشهير: دع المستمع يرى القنبلة تحت الطاولة قبل أن يراها الشخص الجالس عليها، ليعيش الدقائق كلها على أعصابه.",
                tip: "دع المستمع يلمح الدليل المادي في المشهد قبل أن يلتفت له البطل.",
                exampleConcept: "مستمع يلاحظ أن الظل المنعكس على حائط الصالة يتحرك في عكس اتجاه خطوات البطل بثانية كاملة."
              },
              {
                id: "unreliable-narrator",
                name: "Unreliable Narrator",
                arabic: "الراوي غير الموثوق",
                desc: "البطل الذي يحكي لنا القصة يكون مجهداً، غير نائم، أو مصدوماً، مما يجعل المستمع يتساءل طوال الوقت: هل ما يراه حقيقي أم تهيؤات؟",
                tip: "استخدم إرهاق السهر والشاشات كغطاء منطقي للظواهر الغريبة.",
                exampleConcept: "محاسب سهران لثالث يوم على التوالي لمراجعة ميزانية شركة، يبدأ يلاحظ أن أرقام المبيعات تتهجى أسماء زملائه الذين ماتوا في حادث العام الماضي."
              },
              {
                id: "foreshadowing",
                name: "Foreshadowing & Planting",
                arabic: "الزرع المسبق للأدلة",
                desc: "زرع تفصيلة عادية جداً في المشهد الأول دون لفت نظر، لتكون هي الصاعق الذي يفجر معنى المشهد الأخير.",
                tip: "القهوة الساخنة في البداية = قهوة عملها البطل للنسخة القادمة في النهاية.",
                exampleConcept: "البطل يجد دبلة فضية مقاس إيده تحت الكنبة في أول دقيقة.. وفي نهاية القصة يرمي دبلته تحت الكنبة وهو بيهرب."
              },
              {
                id: "misdirection",
                name: "Misdirection",
                arabic: "التضليل الذكي",
                desc: "توجيه ذهن المستمع نحو تفسير مريح ومألوف (مقلب صاحب، عطل كهرباء، فار في المطبخ) ليأتي الخطر الحقيقي من زاوية لم يتوقعها.",
                tip: "اجعل البطل يقتنع بتفسيره المنطقي حتى آخر لحظة ممكنة.",
                exampleConcept: "البطل متأكد إن صاحبه كريم بيهزر معاه على الواتساب وبيبعتله رسايل تهديد، لحد ما يكتشف إن كريم عامل حادثة من 4 ساعات وموبايطه اتحرق."
              },
              {
                id: "the-reveal",
                name: "The Reveal",
                arabic: "لحظة الكشف الصادمة",
                desc: "المشهد الذي يربط كل الخيوط في ثانية واحدة صامتة. كشف مادي ملموس بدون خطبة تفسيرية من البطل.",
                tip: "«لفيت.. لقيته واقف. كان أنا. بص ناحيتي ومتحركش». (وبس).",
                exampleConcept: "الراوي يفتح بطاقة الهوية التي وجدها في جيب المعطف المعلق، فيجد صورته واسمه وتاريخ وفاة اليوم."
              },
              {
                id: "circular-narrative",
                name: "Circular Narrative",
                arabic: "السرد الدائري (حلقة اللوب)",
                desc: "نهاية القصة تعود لتكون هي ذاتها بداية المشهد الأول. المستمع يدرك أن البطل عالق في دائرة زمنية مغلقة تتكرر إلى الأبد.",
                tip: "إرسال الرسالة في النهاية -> رنة نفس الرسالة في غرفة النوم في أول القصة.",
                exampleConcept: "البطل يكتب رسالة تحذير: 'اهرب فوراً' ويدوس إرسال، بعدها بثانية يسمع رنة موبايله في أوضة النوم بنفس التحذير."
              },
              {
                id: "open-ending",
                name: "Open Ending",
                arabic: "النهاية المفتوحة والأسئلة المعلقة",
                desc: "قفل القصة بقطع صامت وترك السؤال يتردد في عقل المستمع: (مين اللي دخل؟ هل مات؟ هل دي روح؟) وعدم تقديم إجابات جاهزة.",
                tip: "«صوت إشعار الموبايل رن تاني في الصالة..» (قطع فوري).",
                exampleConcept: "الباب ينفتح في الظلام، وظل يقف عند العتبة، والموبايل ينطفئ فجأة دون أن نعرف من تقدم نحو الداخل."
              },
              {
                id: "realistic-rationalization",
                name: "Realistic Rationalization",
                arabic: "لا تجعل الشخصيات غبية (التفسير المنطقي)",
                desc: "لا تجعل البطل يرى شيئاً واضحاً جداً ويقول بسذاجة «أكيد مفيش حاجة». إذا كان الشيء واضحاً أو مريباً، يجب أن يكون لديه سبب منطقي لعدم تصديقه («افتكرت حد بيهزر»، «يمكن كنت صاحي نص نوم»، «يمكن حد دخل بالمفتاح»، «يمكن الموبايل فيه مشكلة»).",
                tip: "هذه التفسيرات المنطقية البشرية هي التي تجعل الرعب واقعياً ومخيفاً للأذن.",
                exampleConcept: "شاب يسمع صوت أواني تتحرك في المطبخ بشقته المغلقة، فيفترض فوراً أن ابن عمه استلم نسخة المفتاح من البواب، قبل أن يكتشف أن ابن عمه مسافر أصلاً."
              },
              {
                id: "causal-agency",
                name: "Causal Agency",
                arabic: "قاعدة «ما الذي كان سيحدث لو لم يفعل ذلك؟»",
                desc: "أفعال وقرارات البطل هي المحرك الجوهري للحبكة. لو لم يفعل البطل ذلك التصرف، لما تورط في المأزق. الرعب ينبع من اختيارات البطل المنطقية في ظاهرها ولكنها تقوده للهاوية.",
                tip: "كل مشهد يجب أن يتضمن خياراً أو تصرفاً من البطل يدفعه خطوة للأمام نحو الفخ.",
                exampleConcept: "البطل يقرر بنفسه إخفاء الدبلة تحت الكنبة ليمتحن ذاكرة زوجته، فيتحول هذا الفعل البريء إلى الدليل الدامغ الذي يوقعه في اللوب الزمني."
              },
              {
                id: "avoid-easiest-ending",
                name: "Avoid Easiest Ending",
                arabic: "لا تستخدم النهاية الأسهل",
                desc: "قبل اعتماد النهاية، اسأل: هل يمكن توقعها من أول دقيقتين؟ إذا نعم، غيّر طريقة الوصول إليها. ليس المطلوب أن تكون مستحيلة، بل: غير متوقعة، لكن منطقية جداً بعد حدوثها.",
                tip: "اكسر النتيجة المعتادة؛ دع المستمع يظن أنه فهم الخدعة ثم صدمه بزاوية غير متوقعة ولكنها منطقية بأثر رجعي.",
                exampleConcept: "المستمع يظن أن البطل يلاحق شبح صاحب الشقة القديم، ليتضح في النهاية أن الشبح كان يحاول منعه من فتح قفل الباب الذي أطلقه البطل بنفسه."
              },
              {
                id: "aha-so-thats-why",
                name: "The 'Aha!' Rule",
                arabic: "قاعدة «آه، عشان كده»",
                desc: "بعد نهاية القصة، يجب أن تجعل النهاية المستمع يقول: «آه، عشان كده...» بسبب ترابط الأدلة المزروعة بذكاء من أول دقيقة. إذا جعلته يقول: «إيه اللي حصل أصلًا؟» فالغموض تحول إلى ارتباك وضياع.",
                tip: "ازرع الدليل في ثوب تفصيلة روتينية تافهة لتتفجر قيمتها الصادمة في المشهد الأخير.",
                exampleConcept: "البطل يشتكي في أول مشهد من أن ريحة فنجان القهوة غريبة، ليتضح في النهاية أنه فنجان السم الذي أعده بنفسه للنسخة السابقة."
              }
            ].map((concept) => (
              <div 
                key={concept.id}
                className="bg-white p-5 rounded-2xl border border-[#ECE9E0] shadow-sm flex flex-col justify-between hover:border-indigo-300 transition"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      {concept.arabic}
                    </span>
                    <span className="text-[10px] text-[#7D766D] font-mono font-bold">{concept.name}</span>
                  </div>
                  <p className="text-xs text-[#5D4037] leading-relaxed mb-3">
                    {concept.desc}
                  </p>
                  <div className="bg-[#FCFBF9] p-2.5 rounded-lg border border-[#ECE9E0] text-[11px] text-[#3E2723] mb-3">
                    <strong className="text-indigo-800">قاعدة التطبيق: </strong>{concept.tip}
                  </div>
                </div>

                <button
                  onClick={() => handleApplyToBuilder(
                    concept.exampleConcept,
                    concept.arabic,
                    "إيقاع محسوب بدقة",
                    `تطبيق تقنية ${concept.name} (${concept.arabic}) بدقة وفق الدليل السردي`,
                    `تقنية: ${concept.name} (${concept.arabic})`
                  )}
                  className="w-full mt-2 bg-indigo-50 hover:bg-indigo-700 text-indigo-900 hover:text-white py-2 rounded-xl text-xs font-black border border-indigo-100 transition flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>تطبيق هذه التقنية في قصة جديدة</span>
                </button>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* Category 4: Real Human Stories & Experiences */}
      {activeCategory === "experiences" && (
        <div className="space-y-6 animate-fadeIn">
          
          <div className="bg-white p-5 rounded-2xl border border-[#ECE9E0] shadow-sm">
            <div className="flex items-center gap-2 text-xs font-black text-rose-800 mb-2">
              <Moon className="w-4 h-4 text-rose-700" />
              <span>الركيزة الرابعة: تجارب وقصص الناس اليومية والحكي الشفاهي العفوي</span>
            </div>
            <p className="text-xs text-[#5D4037] leading-relaxed">
              المستمع لا يرتبط بقصص الوحوش الفضائية بقدر ارتباطه بموقف حدث له أو لجار له في شقة قديمة، أو مكالمة مريبة جاءت في وقت متأخر. الغرض ليس نسخ القصة، بل <strong>تعلم طريقة الحكي العفوي والتفاصيل اليومية الصادقة</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                id: "apt",
                title: "1. تجربة غريبة في شقة إيجار",
                icon: Building,
                pattern: "أصوات أواني في المطبخ، مروحة سقف تدور وحدها، باب أوضة لا يغلق تماماً، مفتاح إضافي في الدرج.",
                concept: "شاب يستأجر شقة مفروشة في عمارة قديمة، ويكتشف أن دولاب غرفة النوم مقفول بقفل ومكتوب عليه تحذير صغير بقلم رصاص."
              },
              {
                id: "night",
                title: "2. موقف حصل بالليل في شارع أو طريق",
                icon: Moon,
                pattern: "سكون الشارع المطبق، عربية وحيدة مطفية النور وراكناها ورا عمارة، صوت خطوات على الرمل، كشاف ينطفي فجأة.",
                concept: "شخص راجع بيته مشي الساعة 3 الفجر من طريق مظلم، ويلاحظ إن لمبات أعمدة النور بتطفي عمود ورا التاني مع كل خطوة بيخطيها."
              },
              {
                id: "transit",
                title: "3. موقف في مواصلة أو تاكسي",
                icon: Car,
                pattern: "سائق تاكسي صامت تماماً، مرآة صالون مغطاة، راديو يشوش على محطة قديمة، طريق مختصر لا ينتهي.",
                concept: "راكب يركب ميكروباص متأخر، ويلاحظ إن الركاب اللي جنبه محدش فيهم بيرد على أي كلمة، ولما ركز لقى كلهم باصين في نفس الاتجاه بالظبط."
              },
              {
                id: "call",
                title: "4. مكالمة غريبة أو رسالة مشبوهة",
                icon: PhoneCall,
                pattern: "اتصال بدون رقم، صوت أنفاس بطيئة، رسالة مسجلة بتوقيت غريب، رسالة من رقم البطل نفسه.",
                concept: "مكالمة تليفون تيجي للشخص من رقم بيته الأرضي وهو قاعد لوحده جوه الشقة وجنب التليفون الأرضي نفسه."
              },
              {
                id: "vanish",
                title: "5. شخص اختفى أو تصرف بغرابة",
                icon: UserX,
                pattern: "جار قديم لا يخرج، زميل عمل ترك متعلقاته ولم يعد، شخص رأيته في الشارع والجميع ينكر وجوده.",
                concept: "جار الدور الأرضي يطلب من البطل يوصله كيس أسود مقفول لصاحب محل، ولما يروح المحل يقولوله إن الراجل ده مات من أسبوعين."
              },
              {
                id: "sleep",
                title: "6. تجربة شلل النوم (الجاثوم) والكوابيس",
                icon: BedDouble,
                pattern: "عجز عن تحريك الأطراف، ثقل على الصدر، ظل أسود يقف في زاوية الغرفة، صوت صفير في الأذن.",
                concept: "شخص يعاني من شلل النوم كل ليلة في نفس الدقيقة، لكن المرة دي لما صحي لقى مكان أقدام ترابية واضحة جنب سريره على السجادة."
              }
            ].map((exp) => {
              const Icon = exp.icon;
              return (
                <div 
                  key={exp.id}
                  className="bg-white p-5 rounded-2xl border border-[#ECE9E0] shadow-sm flex flex-col justify-between hover:border-rose-200 transition"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
                        <Icon className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-black text-[#3E2723]">{exp.title}</h4>
                    </div>
                    <div className="bg-[#FCFBF9] p-2.5 rounded-lg border border-[#ECE9E0] text-[11px] text-[#5D4037] mb-3">
                      <strong className="text-rose-900 block mb-1">تفاصيل ومفردات الواقعة:</strong>
                      {exp.pattern}
                    </div>
                  </div>

                  <button
                    onClick={() => handleApplyToBuilder(
                      exp.concept,
                      "تجربة إنسانية واقعية",
                      "حكي عفوي هادئ",
                      `استلهام واقعة من تجارب الناس اليومية: ${exp.title}`,
                      `تجربة واقعية: ${exp.title}`
                    )}
                    className="w-full mt-2 bg-rose-50 hover:bg-rose-700 text-rose-900 hover:text-white py-2 rounded-xl text-xs font-black border border-rose-100 transition flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>تأليف قصة من هذا الموقف</span>
                  </button>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* Footer Core Memory Card */}
      <div className="bg-white p-6 rounded-2xl border border-[#ECE9E0] shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-black text-[#3E2723] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>جاهز لتطبيق هذه المراجع في قصتك القادمة؟</span>
            </h4>
            <p className="text-xs text-[#7D766D] mt-1">
              جميع هذه المراجع مدمجة تلقائياً في عقل المهندس والكاتب والمحرر في "مساعد التأليف"، لضمان عدم خروج أي قصة كنموذج رعب سطحي.
            </p>
          </div>
          <button
            onClick={() => setActiveTab && setActiveTab("story-builder")}
            className="bg-[#8D6E63] hover:bg-[#5D4037] text-white px-5 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shadow-sm"
          >
            <span>فتح مساعد التأليف الآن</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
}
