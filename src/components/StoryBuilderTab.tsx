import { useState, useEffect, useRef } from "react";
import { 
  Sparkles, RefreshCw, CheckCircle2, 
  Clock, Flame, Copy, Check, Headphones,
  Scissors, Feather, AlertTriangle,
  MessageSquare, ArrowRight, Volume2, ShieldCheck,
  Brain, Play, Pause, RotateCcw, Type,
  Mic, Maximize2, Minimize2, Eye,
  FileText, Sliders, Settings2, Layers, BookOpen, BookMarked,
  Search, ShieldAlert, CheckSquare, FileCheck, ChevronDown, ChevronUp, SlidersHorizontal
} from "lucide-react";
import { GeneratedStoryResult } from "../types";

interface StoryBuilderTabProps {
  competitorChannels: string[];
  onStoryGenerated: (text: string) => void;
  setActiveTab: (tab: string) => void;
  backupApiKey?: string;
  injectedReference?: {
    concept: string;
    genre?: string;
    pacingStyle?: string;
    notes?: string;
    referenceFocus?: string;
  } | null;
  onClearInjectedReference?: () => void;
}

export default function StoryBuilderTab({ 
  competitorChannels, 
  onStoryGenerated,
  setActiveTab,
  backupApiKey,
  injectedReference,
  onClearInjectedReference
}: StoryBuilderTabProps) {
  const [concept, setConcept] = useState(() => {
    return localStorage.getItem("rawi_storybuilder_concept") || "";
  });
  const [duration, setDuration] = useState(() => {
    return localStorage.getItem("rawi_storybuilder_duration") || "30 دقيقة";
  });
  const [wordCount, setWordCount] = useState(() => {
    return localStorage.getItem("rawi_storybuilder_wordcount") || "2000 كلمة";
  });
  const [genre, setGenre] = useState(() => {
    return localStorage.getItem("rawi_storybuilder_genre") || "auto";
  });
  const [pacingStyle, setPacingStyle] = useState(() => {
    return localStorage.getItem("rawi_storybuilder_pacing_style") || "سرد صوتي متدرج (بدون مط أو كلمات صلبة)";
  });
  const [referenceFocus, setReferenceFocus] = useState<string>(() => {
    return localStorage.getItem("rawi_storybuilder_reffocus") || "ميكس متكيف (حسب اهتمام وتوجه القصة): استخلاص أفضل ما تحتاجه الفكرة من المراجع الأربعة";
  });

  useEffect(() => {
    localStorage.setItem("rawi_storybuilder_reffocus", referenceFocus);
  }, [referenceFocus]);

  useEffect(() => {
    if (injectedReference) {
      if (injectedReference.concept) setConcept(injectedReference.concept);
      if (injectedReference.genre) setGenre(injectedReference.genre);
      if (injectedReference.pacingStyle) setPacingStyle(injectedReference.pacingStyle);
      if (injectedReference.referenceFocus) setReferenceFocus(injectedReference.referenceFocus);
      onClearInjectedReference?.();
    }
  }, [injectedReference, onClearInjectedReference]);

  const [showAgentsBlueprint, setShowAgentsBlueprint] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeStage, setActiveStage] = useState(1);
  const [activeLogIndex, setActiveLogIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copiedFormatted, setCopiedFormatted] = useState(false);
  const [copiedHook, setCopiedHook] = useState(false);

  // View state for drafts comparison: "audited" (Agent 4) | "humanized" (Agent 3) | "raw" (Agent 2)
  const [activeDraftTab, setActiveDraftTab] = useState<"audited" | "humanized" | "raw">("audited");
  const [activeResultSubTab, setActiveResultSubTab] = useState<"story" | "agent4_audit" | "agent3_report" | "titles" | "reverse_architecture">("story");
  const [isAuditingLive, setIsAuditingLive] = useState<boolean>(false);

  // 🎙️ Audio Teleprompter & Narration Studio States
  const [scriptViewMode, setScriptViewMode] = useState<"teleprompter" | "standard">("teleprompter");
  const [teleprompterTheme, setTeleprompterTheme] = useState<"dark" | "light" | "warm">("dark");
  const [teleprompterFontSize, setTeleprompterFontSize] = useState<number>(20);
  const [teleprompterLineHeight, setTeleprompterLineHeight] = useState<string>("leading-[2.2]");
  const [highlightDialogues, setHighlightDialogues] = useState<boolean>(true);
  const [activeSceneFilter, setActiveSceneFilter] = useState<number | null>(null);

  // Second Brain Memory Modal State
  const [showSecondBrain, setShowSecondBrain] = useState<boolean>(false);
  const [secondBrainContent, setSecondBrainContent] = useState<string>("");
  const [isSavingBrain, setIsSavingBrain] = useState<boolean>(false);
  const [brainSaveSuccess, setBrainSaveSuccess] = useState<boolean>(false);
  const [isRegeneratingTitles, setIsRegeneratingTitles] = useState<boolean>(false);
  const [copiedTitleIndex, setCopiedTitleIndex] = useState<number | null>(null);

  // Auto-scroll engine
  const [isAutoScrolling, setIsAutoScrolling] = useState<boolean>(false);
  const [scrollSpeed, setScrollSpeed] = useState<number>(2); // 1 to 5
  const teleprompterRef = useRef<HTMLDivElement | null>(null);

  // Fetch Second Brain rules on mount / modal open
  const fetchSecondBrain = async () => {
    try {
      const res = await fetch("/api/second-brain");
      if (res.ok) {
        const data = await res.json();
        setSecondBrainContent(data.content || "");
      }
    } catch (e) {
      console.error("Failed to load Second Brain:", e);
    }
  };

  const handleSaveSecondBrain = async () => {
    setIsSavingBrain(true);
    setBrainSaveSuccess(false);
    try {
      const res = await fetch("/api/second-brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: secondBrainContent })
      });
      if (res.ok) {
        setBrainSaveSuccess(true);
        setTimeout(() => setBrainSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error("Failed to save Second Brain:", e);
    } finally {
      setIsSavingBrain(false);
    }
  };

  // Studio Recording Stopwatch
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordSeconds, setRecordSeconds] = useState<number>(0);

  const [storyResult, setStoryResult] = useState<GeneratedStoryResult | null>(() => {
    try {
      const saved = localStorage.getItem("rawi_storybuilder_result");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    localStorage.setItem("rawi_storybuilder_concept", concept);
  }, [concept]);

  useEffect(() => {
    localStorage.setItem("rawi_storybuilder_duration", duration);
  }, [duration]);

  useEffect(() => {
    localStorage.setItem("rawi_storybuilder_wordcount", wordCount);
  }, [wordCount]);

  useEffect(() => {
    localStorage.setItem("rawi_storybuilder_genre", genre);
  }, [genre]);

  useEffect(() => {
    localStorage.setItem("rawi_storybuilder_pacing_style", pacingStyle);
  }, [pacingStyle]);

  useEffect(() => {
    if (storyResult) {
      localStorage.setItem("rawi_storybuilder_result", JSON.stringify(storyResult));
    } else {
      localStorage.removeItem("rawi_storybuilder_result");
    }
  }, [storyResult]);

  // Live dialogue feed between Agent 1, Agent 2, Agent 3, and Agent 4
  const agentCollaborationLogs = [
    {
      agent: 1,
      name: "الوكيل 1 (المخطط الدرامي وهندسة اللغز)",
      text: "تحليل الفكرة وزرع الأدلة الثلاثة المسبقة: تحديد اللغز المركزي وحظر حرق الـ Twist مبكراً، وتوزيع الشك المتباعد.",
      stage: 1
    },
    {
      agent: 2,
      name: "الوكيل 2 (الحكواتي المصري وكاتب المشاهد)",
      text: "كتابة مسودة المشاهد بالعامية المصرية الطبيعية: حوارات حقيقية تُقال للأذن، تجنب التشبيهات الورقية المصطنعة والمبالغات.",
      stage: 2
    },
    {
      agent: 3,
      name: "الوكيل 3 (المحرر البشري النهائي ومزيل بصمات الـ AI)",
      text: "تنقيح جراحي شامل: استئصال أي شرح مباشر للرعب، تليين الكلمات الفصحى المتحجرة، وصياغة عناوين اليوتيوب بعلم النفس الفيروسي.",
      stage: 3
    },
    {
      agent: 4,
      name: "الوكيل 4 (المستمع الناقد المتشكك ومحقق المنطق)",
      text: "فحص استمرارية السكن (عايش لوحده ولا مع حد)، تبرير الأفعال وقفل الأبواب، وإبادة العبارات المبهمة (مثل 'إيد مكتومة بتطبق').",
      stage: 4
    }
  ];

  // Real elapsed stopwatch while the AI passes run on the server
  useEffect(() => {
    let interval: any = null;
    if (isLoading) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1;
          if (next < 8) {
            setActiveStage(1);
            setActiveLogIndex(0);
          } else if (next < 20) {
            setActiveStage(2);
            setActiveLogIndex(1);
          } else if (next < 32) {
            setActiveStage(3);
            setActiveLogIndex(2);
          } else {
            setActiveStage(4);
            setActiveLogIndex(3);
          }
          return next;
        });
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);

  // Studio Recording Stopwatch
  useEffect(() => {
    let interval: any = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Teleprompter Auto-Scroll Effect
  useEffect(() => {
    let scrollInterval: any = null;
    if (isAutoScrolling && teleprompterRef.current) {
      scrollInterval = setInterval(() => {
        if (teleprompterRef.current) {
          teleprompterRef.current.scrollTop += scrollSpeed;
          // Stop if reached the very bottom
          if (
            teleprompterRef.current.scrollTop + teleprompterRef.current.clientHeight >=
            teleprompterRef.current.scrollHeight - 5
          ) {
            setIsAutoScrolling(false);
          }
        }
      }, 35);
    } else {
      if (scrollInterval) clearInterval(scrollInterval);
    }
    return () => {
      if (scrollInterval) clearInterval(scrollInterval);
    };
  }, [isAutoScrolling, scrollSpeed]);

  // Helper to parse story into structured scenes and breath-based paragraphs
  const parseStoryIntoScenes = (rawText: string) => {
    if (!rawText) return [];
    
    // Split on scene markers or divider lines
    const rawBlocks = rawText.split(/(?=###\s*المشهد|\n---\n)/g);
    
    return rawBlocks
      .map((block, idx) => {
        const clean = block.replace(/^---\s*/, '').trim();
        if (!clean) return null;
        
        const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
        let title = `المشهد ${idx + 1}`;
        let contentLines = lines;
        
        if (lines.length > 0 && lines[0].startsWith('###')) {
          title = lines[0].replace(/^###\s*/, '').trim();
          contentLines = lines.slice(1);
        }
        
        const sceneWordCount = contentLines.join(" ").split(/\s+/).filter(Boolean).length;
        const sceneAudioMinutes = Math.max(1, Math.round(sceneWordCount / 130));

        return {
          sceneNumber: idx + 1,
          title,
          paragraphs: contentLines,
          wordCount: sceneWordCount,
          estMinutes: sceneAudioMinutes
        };
      })
      .filter(Boolean) as {
        sceneNumber: number;
        title: string;
        paragraphs: string[];
        wordCount: number;
        estMinutes: number;
      }[];
  };

  const getCurrentStoryText = () => {
    if (!storyResult) return "";
    if (activeDraftTab === "audited") {
      return storyResult.fullStoryText;
    } else if (activeDraftTab === "humanized") {
      return storyResult.humanizedDraftPreview || storyResult.fullStoryText;
    } else {
      return storyResult.rawDraftPreview || storyResult.humanizedDraftPreview || storyResult.fullStoryText;
    }
  };

  const handleCopyFormattedStory = () => {
    if (!storyResult) return;
    const textToCopy = getCurrentStoryText();
    
    const scenes = parseStoryIntoScenes(textToCopy);
    const formattedForTeleprompter = scenes.map(s => {
      return `═══════════════════════════════════\n🎬 ${s.title} (~${s.estMinutes} دقيقة إلقاء)\n═══════════════════════════════════\n\n` +
        s.paragraphs.map(p => {
          if (p.startsWith('"') || p.startsWith('«') || p.includes('":')) {
            return `🎙️ [حوار]\n${p}`;
          }
          return p;
        }).join("\n\n");
    }).join("\n\n\n");

    navigator.clipboard.writeText(formattedForTeleprompter);
    setCopiedFormatted(true);
    setTimeout(() => setCopiedFormatted(false), 2000);
  };

  const handleRunSkepticalAuditLive = async () => {
    if (!storyResult) return;
    setIsAuditingLive(true);
    try {
      const textToAudit = getCurrentStoryText();
      const res = await fetch("/api/skeptical-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyText: textToAudit,
          storyTitle: storyResult.title
        })
      });
      if (res.ok) {
        const data = await res.json();
        setStoryResult((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            fullStoryText: data.auditedFullStory || prev.fullStoryText,
            skepticalAuditorReport: data.skepticalAuditorReport || prev.skepticalAuditorReport
          };
        });
        setActiveDraftTab("audited");
        setActiveResultSubTab("agent4_audit");
      }
    } catch (err) {
      console.error("Live skeptical audit failed:", err);
    } finally {
      setIsAuditingLive(false);
    }
  };

  const handleBuildStory = async () => {
    if (!concept.trim()) return;
    setIsLoading(true);
    setElapsedSeconds(0);
    setActiveStage(1);
    setActiveLogIndex(0);
    setActiveDraftTab("audited");

    try {
      const response = await fetch("/api/pro-story-builder", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-custom-gemini-key": backupApiKey || ""
        },
        body: JSON.stringify({ 
          concept, 
          duration, 
          wordCount, 
          genre, 
          competitorChannels, 
          pacingStyle,
          referenceFocus
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "فشل في تأليف وتدقيق القصة");
      }

      const data: GeneratedStoryResult = await response.json();
      setStoryResult(data);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "حدث خطأ أثناء تأليف وتدقيق القصة.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendToProofreader = () => {
    if (!storyResult) return;
    onStoryGenerated(storyResult.fullStoryText);
    setActiveTab("story-prep");
  };

  const handleCopyStory = () => {
    if (!storyResult) return;
    const textToCopy = getCurrentStoryText();
        
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyHook = () => {
    if (!storyResult?.hook) return;
    navigator.clipboard.writeText(storyResult.hook);
    setCopiedHook(true);
    setTimeout(() => setCopiedHook(false), 2000);
  };

  const formatElapsed = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-8" id="story-builder-tab">
      
      {/* Header & 3-Agent Architecture Banner */}
      <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-[#ECE9E0] pb-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#3E2723] text-white flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#FFB74D]" />
                نظام الوكلاء الأربعة الصوتي البشري (مع المستمع الناقد)
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]">
                استئصال شرح الرعب ❌
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2]">
                اكتشاف مادي صامت
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EDE7F6] text-[#512DA8] border border-[#D1C4E9]">
                منع حرق الـ Twist بدري
              </span>
            </div>
            <h3 className="text-xl font-black text-[#3E2723]">
              مساعد التأليف الروائي والتدقيق الصوتي البشري المتقدم
            </h3>
            <p className="text-xs text-[#7D766D] mt-1 leading-relaxed">
              مسار معالجة رباعي جراحي: الوكيل 1 يحلل الفرضية ويزرع الأدلة المادية، الوكيل 2 يكتب المشاهد بحكي مصري واقعي، الوكيل 3 يشطب أي شرح مباشر للمشاعر، والوكيل 4 يدقق المنطق السكني والزمني ليكون النص بشرياً حقيقياً للأذن.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {storyResult && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("هل تريد تفريغ القصة السابقة والبدء من جديد بحقول نظيفة؟")) {
                    setStoryResult(null);
                    localStorage.removeItem("rawi_storybuilder_result");
                  }
                }}
                className="flex items-center gap-1.5 bg-[#FFEBEE] hover:bg-[#FFCDD2] text-[#C62828] px-3.5 py-2 rounded-xl border border-[#EF9A9A] text-xs font-black transition shadow-xs"
                title="مسح نتيجة القصة السابقة لإفساح المجال لكتابة قصة جديدة"
              >
                <RefreshCw className="w-4 h-4 text-[#C62828]" />
                <span>🔄 قصة جديدة / تفريغ</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab("references")}
              className="flex items-center gap-1.5 bg-[#F3E5F5] hover:bg-[#E1BEE7] text-[#4A148C] px-3.5 py-2 rounded-xl border border-[#CE93D8] text-xs font-black transition shadow-xs"
              title="استعراض مراجع الرعب المكتوب، اللغة الطبيعية، والتقنيات وتطبيقها"
            >
              <BookOpen className="w-4 h-4 text-[#7B1FA2]" />
              <span>📚 المراجع السردية الأربعة</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowSecondBrain(true);
                fetchSecondBrain();
              }}
              className="flex items-center gap-1.5 bg-[#FAF2EB] hover:bg-[#F3E5D8] text-[#5D4037] px-3.5 py-2 rounded-xl border border-[#EFE5DC] text-xs font-black transition shadow-xs"
              title="عرض وتعديل ذاكرة القواعد والتعلم التراكمي للوكلاء"
            >
              <Brain className="w-4 h-4 text-[#8D6E63]" />
              <span>🧠 ذاكرة العقل الثاني (Second Brain)</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 bg-[#FAF9F6] p-2 rounded-xl border border-[#ECE9E0] text-xs">
              <Headphones className="w-4 h-4 text-[#8D6E63]" />
              <span className="text-[#5D4037] font-bold">جاهز للإلقاء</span>
            </div>
          </div>
        </div>

        {/* Visual Notice: Field-Based System Banner */}
        <div className="p-3.5 bg-gradient-to-r from-[#FFF8E1] via-[#FAF2EB] to-[#FFF8E1] rounded-xl border border-[#FFE082] text-xs font-black text-[#5D4037] flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs mb-6">
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <span>نظام الحقول المنسدلة (افتح واختار): اختر مدة القصة، نوع الحبكة، الإيقاع، والمرجعية بنقرة واحدة من القوائم أدناه.</span>
          </div>
          <span className="text-[10px] font-bold text-[#8D6E63] bg-white px-2.5 py-1 rounded-md border border-[#EFE5DC] shrink-0 self-start sm:self-auto">
            ⚡ 4 قوائم منسدلة جاهزة
          </span>
        </div>

        {/* Collapsible 4-Agent Pipeline Bar */}
        <div className="bg-[#FAF9F6] border border-[#ECE9E0] rounded-xl p-3.5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span className="text-xs font-black text-[#3E2723]">مسار المعالجة الرباعي المعتمد للأذن:</span>
            <span className="text-xs text-[#7D766D] font-medium hidden sm:inline">
              1. هندسة اللغز ⬅️ 2. الحكواتي المصري ⬅️ 3. المحرر الصارم ⬅️ 4. المستمع الناقد
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowAgentsBlueprint(!showAgentsBlueprint)}
            className="text-xs font-bold text-[#8D6E63] hover:text-[#3E2723] flex items-center gap-1.5 self-end sm:self-auto bg-white px-3 py-1.5 rounded-lg border border-[#ECE9E0] transition hover:bg-[#FAF2EB]"
          >
            <span>{showAgentsBlueprint ? "إخفاء بطاقات الوكلاء" : "عرض تفاصيل الوكلاء الأربعة"}</span>
            {showAgentsBlueprint ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* The 4 Agents Visual Blueprint (Collapsible) */}
        {showAgentsBlueprint && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6 animate-fadeIn">
            {/* Agent 1 Card */}
            <div className="p-3.5 bg-[#FAF2EB] rounded-xl border border-[#EFE5DC] flex flex-col justify-between hover:border-[#D7CCC8] transition">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-[#8D6E63] text-white flex items-center justify-center font-black text-xs">1</span>
                    <h4 className="text-xs font-black text-[#3E2723]">المخطط وهندسة النهاية</h4>
                  </div>
                  <span className="text-[10px] text-[#8D6E63] font-bold">النهاية أولاً 🎯</span>
                </div>
                <p className="text-[11px] text-[#7D766D] leading-relaxed">
                  يهندس النهاية الصادمة أولاً في الكواليس، ويزرع أدلة ذات معنى مزدوج تُحدث صدمة عند إعادة الاستماع، ويكسر البنية المتوقعة.
                </p>
              </div>
              <div className="mt-2.5 pt-2 border-t border-[#EFE5DC] text-[10px] text-[#8D6E63] font-bold flex items-center gap-1">
                <span>⬅️ يُسلم المخطط للحكواتي</span>
              </div>
            </div>

            {/* Agent 2 Card */}
            <div className="p-3.5 bg-[#FFF8E1] rounded-xl border border-[#FFE082] flex flex-col justify-between hover:border-[#FFD54F] transition">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-[#F57F17] text-white flex items-center justify-center font-black text-xs">2</span>
                    <h4 className="text-xs font-black text-[#E65100]">الحكواتي المصري</h4>
                  </div>
                  <span className="text-[10px] text-[#E65100] font-bold">الإيقاع الشفاهي 🎙️</span>
                </div>
                <p className="text-[11px] text-[#7D766D] leading-relaxed">
                  يحكي بنَفَس ورواق الحكواتي المصري للأذن، يزرع الأدلة المزدوجة بدهاء، سرد روائي متصل (80% حكي و20% حوار) دون كليشيهات.
                </p>
              </div>
              <div className="mt-2.5 pt-2 border-t border-[#FFE082] text-[10px] text-[#E65100] font-bold flex items-center gap-1">
                <span>⬅️ يُسلم المسودة للمحرر البشري</span>
              </div>
            </div>

            {/* Agent 3 Card */}
            <div className="p-3.5 bg-[#F1F8E9] rounded-xl border border-[#C8E6C9] flex flex-col justify-between hover:border-[#A5D6A7] transition">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-[#2E7D32] text-white flex items-center justify-center font-black text-xs">3</span>
                    <h4 className="text-xs font-black text-[#2E7D32]">المحرر البشري الصارم</h4>
                  </div>
                  <span className="text-[10px] text-[#2E7D32] font-bold">إبادة الحشو</span>
                </div>
                <p className="text-[11px] text-[#2E7D32] leading-relaxed">
                  يستأصل شرح الرعب وكليشيهات الـ AI، يلين الكلمات الفصحى المتحجرة، ويصيغ عناوين يوتيوب فيروسية.
                </p>
              </div>
              <div className="mt-2.5 pt-2 border-t border-[#C8E6C9] text-[10px] text-[#2E7D32] font-black flex items-center gap-1">
                <span>⬅️ يُسلم المسودة للمستمع الناقد</span>
              </div>
            </div>

            {/* Agent 4 Card (The Skeptical Auditor - The Final Authority) */}
            <div className="p-3.5 bg-[#E8EAF6] rounded-xl border border-[#9FA8DA] shadow-xs flex flex-col justify-between relative overflow-hidden hover:border-[#7986CB] transition">
              <div className="absolute top-0 left-0 bg-[#283593] text-white text-[9px] font-black px-2.5 py-0.5 rounded-br-lg">
                المعتمد النهائي ★
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-[#283593] text-white flex items-center justify-center font-black text-xs">4</span>
                    <h4 className="text-xs font-black text-[#1A237E]">المستمع الناقد المتشكك</h4>
                  </div>
                </div>
                <p className="text-[11px] text-[#283593] leading-relaxed">
                  يحسم استمرارية السكن، ويفحص صدمة إعادة الاستماع (The Re-Listen Shock) لضمان عدم وجود أي تناقض، وتبرير الأفعال.
                </p>
              </div>
              <div className="mt-2.5 pt-2 border-t border-[#9FA8DA] text-[10px] text-[#1A237E] font-black flex items-center gap-1">
                <span>★ يمنح الختم النهائي للقصة الموثوقة</span>
              </div>
            </div>
          </div>
        )}

        {/* Story Builder Field-Based Controls System ("نظام فيلدات وافتح واختار") */}
        <div className="space-y-6 mb-6">
          
          {/* Main Story Concept Field */}
          <div className="bg-white rounded-xl p-4 sm:p-5 border border-[#ECE9E0] shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
              <label className="text-xs font-black text-[#3E2723] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#8D6E63]" />
                <span>فكرة القصة أو المسودة (اكتب ما تريده وسيتولى الوكلاء الصياغة والتدقيق)</span>
              </label>
              
              {/* Quick inspiration ideas */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-[#8D6E63] font-bold">أفكار سريعة:</span>
                {[
                  {
                    label: "شقة وسط البلد والمصعد",
                    text: "شقة في عمارة قديمة بوسط البلد يكتشف حارسها أن المصعد ينزل لدور مجهول تحت الأرض لا يوجد في خريطة العقار، وكل ليلة يسمع صوت شخص ينادي عليه باسم والده المتوفى..."
                  },
                  {
                    label: "سر المشرحة",
                    text: "نبطشية ليلية في مشرحة مستشفى حكومي، تصل جثة مجهولة بدون أي أوراق ثبوتية، وفي جيب سترتها مفتاح شقة البطل نفسه الذي يسكن فيه..."
                  },
                  {
                    label: "مصحة الاستشفاء",
                    text: "شاب يدخل مصحة هادئة في أطراف القاهرة برغبته للتعافي من التوتر، ليكتشف بالتدريج أنه تنازل عن كل أدوات التحكم وأن خروجه غير مسموح..."
                  }
                ].map((idea, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setConcept(idea.text)}
                    className="text-[10px] font-bold bg-[#FAF2EB] hover:bg-[#F3E5D8] text-[#5D4037] px-2.5 py-1 rounded-md border border-[#EFE5DC] transition"
                  >
                    💡 {idea.label}
                  </button>
                ))}
              </div>
            </div>

            <textarea 
              rows={5}
              placeholder="اكتب فكرتك هنا بالتفصيل أو برؤوس أقلام... مثال: شقة في عمارة قديمة بوسط البلد يكتشف حارسها أن المصعد ينزل لدور مجهول تحت الأرض لا يوجد في خريطة العقار، وكل ليلة يسمع صوت شخص ينادي عليه باسم والده..."
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className="w-full p-4 rounded-xl border border-[#ECE9E0] bg-[#FCFBF9] text-sm focus:outline-none focus:ring-2 focus:ring-[#8D6E63] leading-relaxed resize-none font-medium placeholder:text-[#A8A29E]"
            />

            <div className="flex items-center justify-between text-[11px] text-[#8D6E63] mt-2">
              <span>{concept.trim() ? `${concept.trim().split(/\s+/).length} كلمة مكتوبة في الفكرة` : "لم يتم إدخال نص الفكرة بعد"}</span>
              {concept && (
                <button
                  type="button"
                  onClick={() => setConcept("")}
                  className="text-[#D32F2F] hover:underline font-bold"
                >
                  مسح الحقل
                </button>
              )}
            </div>
          </div>

          {/* 4 Open & Select Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* FIELD 1: Word Count & Audio Duration */}
            <div className="bg-white p-4 rounded-xl border border-[#ECE9E0] shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-[#3E2723] flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#8D6E63]" />
                  <span>حجم القصة ومدة الإلقاء التقديرية</span>
                </label>
                <span className="text-[10px] font-extrabold text-[#5D4037] bg-[#FAF2EB] px-2.5 py-0.5 rounded-full border border-[#EFE5DC]">
                  {wordCount} ({duration})
                </span>
              </div>

              {/* Select Dropdown */}
              <div className="relative">
                <select
                  value={
                    ["1000 كلمة", "2000 كلمة", "3000 كلمة", "5000 كلمة"].includes(wordCount)
                      ? wordCount
                      : "custom"
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "1000 كلمة") {
                      setWordCount("1000 كلمة");
                      setDuration("10 دقائق");
                    } else if (val === "2000 كلمة") {
                      setWordCount("2000 كلمة");
                      setDuration("20 دقيقة");
                    } else if (val === "3000 كلمة") {
                      setWordCount("3000 كلمة");
                      setDuration("30 دقيقة");
                    } else if (val === "5000 كلمة") {
                      setWordCount("5000 كلمة");
                      setDuration("60 دقيقة");
                    } else {
                      // custom
                      setWordCount("2500 كلمة");
                      setDuration("25 دقيقة");
                    }
                  }}
                  className="w-full p-2.5 rounded-lg border border-[#ECE9E0] bg-[#FAF9F6] text-xs font-black text-[#3E2723] focus:outline-none focus:ring-2 focus:ring-[#8D6E63] cursor-pointer"
                >
                  <option value="2000 كلمة">2000 كلمة (~16-20 دقيقة إلقاء) [الأنسب والأكثر انتشاراً ⭐]</option>
                  <option value="1000 كلمة">1000 كلمة (~8-10 دقائق إلقاء) [قصة قصيرة سريعة]</option>
                  <option value="3000 كلمة">3000 كلمة (~25 دقيقة إلقاء) [حلقة دسمة وتفاصيل عميقة]</option>
                  <option value="5000 كلمة">5000 كلمة (~40-50 دقيقة إلقاء) [سهرة طويلة ملحمية]</option>
                  <option value="custom">✏️ إدخال عدد كلمات ومدة مخصصة يدوي...</option>
                </select>
              </div>

              {/* Custom Word Count Inputs if Custom Selected */}
              {!["1000 كلمة", "2000 كلمة", "3000 كلمة", "5000 كلمة"].includes(wordCount) && (
                <div className="grid grid-cols-2 gap-2 pt-1 animate-fadeIn">
                  <input 
                    type="text"
                    placeholder="مثال: 4000 كلمة"
                    value={wordCount}
                    onChange={(e) => setWordCount(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#ECE9E0] bg-white text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#8D6E63]"
                  />
                  <input 
                    type="text"
                    placeholder="مثال: 35 دقيقة"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#ECE9E0] bg-white text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#8D6E63]"
                  />
                </div>
              )}

              <p className="text-[11px] text-[#7D766D] leading-relaxed">
                يضمن الوكلاء تمديد القصة بالتفاصيل الحياتية والتردد البشري الواقعي لتحقيق المدة دون حشو.
              </p>
            </div>

            {/* FIELD 2: Genre & Psychological Classification */}
            <div className="bg-white p-4 rounded-xl border border-[#ECE9E0] shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-[#3E2723] flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-[#8D6E63]" />
                  <span>نوع الحبكة والتصنيف النفسي</span>
                </label>
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                  genre === "auto" ? "bg-[#E8F5E9] text-[#2E7D32] border-[#C8E6C9]" : "bg-[#FFF3E0] text-[#E65100] border-[#FFE0B2]"
                }`}>
                  {genre === "auto" ? "تلقائي ذكي ✨" : "محدد يدوياً"}
                </span>
              </div>

              {/* Select Dropdown */}
              <div className="relative">
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#ECE9E0] bg-[#FAF9F6] text-xs font-black text-[#3E2723] focus:outline-none focus:ring-2 focus:ring-[#8D6E63] cursor-pointer"
                >
                  <option value="auto">✨ تلقائي: ابتكار وتحديد الحبكة والتصنيف النفسي من السياق (موصى به)</option>
                  <option value="تشويق نفسي وبارانويا الشك">🧠 تشويق نفسي وبارانويا الشك (Psychological Suspense)</option>
                  <option value="رعب واقعي وفلكلور مصري">🕯️ رعب واقعي وفلكلور مصري شعبي (Folklore & Mystery)</option>
                  <option value="لغز وجريمة وتحقيق واقعي">🔍 لغز وجريمة وتحقيق بوليسي واقعي (Crime & Realistic Investigation)</option>
                  <option value="رعب وجودي وهلع كابوسي">🌑 رعب وجودي وهلع كابوسي (Cosmic & Nightmare Dread)</option>
                </select>
              </div>

              <p className="text-[11px] text-[#7D766D] leading-relaxed">
                {genre === "auto" 
                  ? "يحدد الوكيل الأول نوع الصراع ودوافع البطل النفسية وتأسيس التويست تلقائياً من نص فكرتك."
                  : `الحبكة المستهدفة: ${genre}`}
              </p>
            </div>

            {/* FIELD 3: Pacing Style */}
            <div className="bg-white p-4 rounded-xl border border-[#ECE9E0] shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-[#3E2723] flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4 text-[#8D6E63]" />
                  <span>أسلوب الإيقاع الصوتي والسرعة</span>
                </label>
                <span className="text-[10px] font-extrabold text-[#5D4037] bg-[#FAF2EB] px-2.5 py-0.5 rounded-full border border-[#EFE5DC]">
                  {pacingStyle.includes("سريع") ? "حركي سريع ⚡" : "متدرج هادئ 🎧"}
                </span>
              </div>

              {/* Select Dropdown */}
              <div className="relative">
                <select
                  value={pacingStyle}
                  onChange={(e) => setPacingStyle(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#ECE9E0] bg-[#FAF9F6] text-xs font-black text-[#3E2723] focus:outline-none focus:ring-2 focus:ring-[#8D6E63] cursor-pointer"
                >
                  <option value="سرد صوتي متدرج (بدون مط أو كلمات صلبة)">
                    🎧 سرد صوتي متدرج ووقفات تشويقية (بدون مط أو كلمات صلبة) - المفضل للمستمع
                  </option>
                  <option value="حركي سريع ومركّز (بدون مط أو إسهال وصفي)">
                    ⚡ حركي متسارع وإثارة متواصلة (بدون مط أو إسهال وصفي)
                  </option>
                </select>
              </div>

              <p className="text-[11px] text-[#7D766D] leading-relaxed">
                توجيه دقيق للوكيل 2 والوكيل 3 لضبط وقفات الأنفاس والانتقال السلس بين المشاهد.
              </p>
            </div>

            {/* FIELD 4: Reference Focus & Literary Technique */}
            <div className="bg-white p-4 rounded-xl border border-[#ECE9E0] shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-[#3E2723] flex items-center gap-1.5">
                  <BookMarked className="w-4 h-4 text-[#8D6E63]" />
                  <span>المرجعية الأدبية والتكنيك السردي</span>
                </label>
                <button
                  type="button"
                  onClick={() => setActiveTab("references")}
                  className="text-[10px] font-bold text-[#8D6E63] hover:text-[#3E2723] hover:underline"
                >
                  استعراض المراجع 📚
                </button>
              </div>

              {/* Select Dropdown */}
              <div className="relative">
                <select
                  value={referenceFocus}
                  onChange={(e) => setReferenceFocus(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#ECE9E0] bg-[#FAF9F6] text-xs font-black text-[#3E2723] focus:outline-none focus:ring-2 focus:ring-[#8D6E63] cursor-pointer"
                >
                  <option value="ميكس متكيف (حسب اهتمام وتوجه القصة): استخلاص أفضل ما تحتاجه الفكرة من المراجع الأربعة">
                    ✨ ميكس متكيف: توليفة ذكية تستخلص أنسب ما تحتاجه الفكرة (موصى به)
                  </option>
                  <option value="تكامل المراجع السردية (رعب مصري + لغة طبيعية + هندسة الرعب + تجارب واقعية + مغسلة الموتى + رعب المصحات)">
                    📚 تكامل المراجع السردية الشاملة لكافة الأركان
                  </option>
                  <option value="أحمد خالد توفيق: الشك العقلاني والدرع الساخر والواقعية">
                    ☕ مدرسة د. أحمد خالد توفيق (الشك العقلاني والدرع الساخر والواقعية)
                  </option>
                  <option value="تامر إبراهيم: خنق المكان والتوتر النفسي المتصاعد">
                    🚪 مدرسة تامر إبراهيم (خنق المكان والتوتر النفسي المتصاعد)
                  </option>
                  <option value="حسن الجندي: الأجواء الثقيلة وهيبة المجهول الشعبي">
                    🕯️ مدرسة حسن الجندي (الأجواء الثقيلة وهيبة المجهول الشعبي)
                  </option>
                  <option value="أحمد مراد: الواقعية الحسية وترابط الأدلة">
                    🔍 مدرسة أحمد مراد (التحري المنطقي والواقعية الحسية الخشنة)
                  </option>
                  <option value="أدب شمس المعارف: فضول التورط والرهبة الجمعية">
                    📖 أدب شمس المعارف والقصص الشعبية (فضول التورط والرهبة الجمعية)
                  </option>
                  <option value="دراما المهن الحساسة: مغسلة الموتى والسر الاجتماعي">
                    🪦 دراما مغسلة الموتى والمهن المهمشة (قدسية المهنة وسر الجثة الإنساني)
                  </option>
                  <option value="رعب المصحات والأماكن المغلقة: فخ القرار الطوعي وتجريد السيطرة والتشكيك في الحواس">
                    🏥 رعب المصحات وسلسلة الراوي (فخ القرار الطوعي وتجريد السيطرة والتشكيك في الحواس)
                  </option>
                </select>
              </div>

              <p className="text-[11px] text-[#7D766D] leading-relaxed">
                {referenceFocus.includes("ميكس") 
                  ? "توليفة مرنة تدمج عقلانية توفيق مع خنق تامر وهيبة الجندي بحسب طبيعة القصة."
                  : referenceFocus}
              </p>
            </div>

          </div>
        </div>

        {/* References info banner & Master Principles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <div className="p-3 bg-[#FAF2EB] rounded-xl border border-[#EFE5DC] text-xs text-[#8D6E63] flex items-center justify-between">
            <span>
              💡 محاكاة قنواتك المرجعية: يلتزم الوكلاء بأسلوب <strong>{competitorChannels.length}</strong> قنوات مسجلة.
            </span>
            <button 
              onClick={() => setActiveTab("story-prep")} 
              className="text-xs font-bold underline hover:text-[#5D4037]"
            >
              تعديل القنوات
            </button>
          </div>

          <div className="p-3 bg-white rounded-xl border border-[#ECE9E0] text-xs text-[#5D4037] flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>قواعد العقل الثاني الإلزامية:</span>
            </div>
            <div className="text-[10px] text-[#7D766D] font-medium flex gap-2">
              <span>✓ لا غباء مصطنع</span>
              <span>✓ تويست مادي صامت</span>
              <span>✓ شطب شرح الرعب</span>
            </div>
          </div>
        </div>

        {/* Trigger Button */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-xs text-[#7D766D] flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-[#2E7D32]" />
            <span>نظام الوكلاء الرباعي: المخطط (1) ⬅️ الحكواتي (2) ⬅️ المحرر البشري (3) ⬅️ المستمع الناقد المتشكك (4)</span>
          </div>

          <button 
            onClick={handleBuildStory}
            disabled={isLoading || !concept.trim()}
            className="w-full sm:w-auto px-7 py-3.5 bg-[#3E2723] text-white font-black rounded-xl text-sm hover:bg-[#2A1810] transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-[#FFB74D]" />
                <span>معالجة رباعية المراحل (تخطيط ⬅️ كتابة ⬅️ تنقيح ⬅️ تدقيق منطقي)...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-[#FFB74D]" />
                <span>تأليف وتدقيق القصة بالوكلاء الأربعة (معتمد للأذن)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* LIVE 4-AGENT COLLABORATION TERMINAL (DURING GENERATION) */}
      {isLoading && (
        <div className="bg-[#140F0D] text-white rounded-xl p-6 border border-[#2D211B] shadow-xl space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2D211B] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#3E2723] flex items-center justify-center border border-[#FFB74D]/30">
                <Headphones className="w-5 h-5 text-[#FFB74D] animate-pulse" />
              </div>
              <div>
                <h4 className="text-base font-black text-[#F5EBE6] flex items-center gap-2">
                  غرفة التأليف والتدقيق المنطقي المباشر (4-Agent Master Pipeline)
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#4CAF50] animate-ping" />
                </h4>
                <p className="text-xs text-[#BCAAA4]">
                  معالجة جراحية رباعية: المخطط يزرع الأدلة ⬅️ الحكواتي يكتب المشاهد ⬅️ المحرر البشري يشطب الحشو ⬅️ المستمع الناقد يدقق استمرارية السكن والأفعال
                </p>
              </div>
            </div>

            {/* Real Elapsed Stopwatch */}
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <div className="bg-[#221814] px-4 py-2 rounded-xl border border-[#3E2723] text-center">
                <span className="text-[10px] text-[#A1887F] block font-bold">وقت المعالجة الفعلي</span>
                <span className="text-lg font-black text-[#FFCCBC] font-mono tracking-wider">
                  {formatElapsed(elapsedSeconds)}
                </span>
              </div>
            </div>
          </div>

          {/* 4 Active Stages Progress Bar */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-bold text-[#D7CCC8]">
              <div className={`text-center p-1.5 rounded-lg ${activeStage === 1 ? "bg-[#3E2723] text-[#FFB74D]" : activeStage > 1 ? "text-[#81C784]" : "opacity-40"}`}>
                1. هندسة اللغز وزرع الأدلة
              </div>
              <div className={`text-center p-1.5 rounded-lg ${activeStage === 2 ? "bg-[#3E2723] text-[#FFB74D]" : activeStage > 2 ? "text-[#81C784]" : "opacity-40"}`}>
                2. الحكواتي وسرد المشاهد
              </div>
              <div className={`text-center p-1.5 rounded-lg ${activeStage === 3 ? "bg-[#3E2723] text-[#FFB74D]" : activeStage > 3 ? "text-[#81C784]" : "opacity-40"}`}>
                3. المحرر البشري وتليين الألفاظ
              </div>
              <div className={`text-center p-1.5 rounded-lg ${activeStage === 4 ? "bg-[#1A237E] text-[#9FA8DA]" : "opacity-40"}`}>
                4. المستمع الناقد ومحقق المنطق
              </div>
            </div>
            
            <div className="w-full h-2.5 bg-[#221814] rounded-full overflow-hidden flex gap-1 p-0.5 border border-[#3E2723]">
              <div className={`h-full flex-1 rounded-full transition-all duration-500 ${activeStage > 1 ? "bg-[#4CAF50]" : "bg-[#FF9800] animate-pulse"}`} />
              <div className={`h-full flex-1 rounded-full transition-all duration-500 ${activeStage > 2 ? "bg-[#4CAF50]" : activeStage === 2 ? "bg-[#FF9800] animate-pulse" : "bg-[#2D211B]"}`} />
              <div className={`h-full flex-1 rounded-full transition-all duration-500 ${activeStage > 3 ? "bg-[#4CAF50]" : activeStage === 3 ? "bg-[#FF9800] animate-pulse" : "bg-[#2D211B]"}`} />
              <div className={`h-full flex-1 rounded-full transition-all duration-500 ${activeStage === 4 ? "bg-[#3949AB] animate-pulse" : "bg-[#2D211B]"}`} />
            </div>
          </div>

          {/* Live Agent Terminal Feed */}
          <div className="bg-[#0A0706] rounded-xl p-4 border border-[#221814] space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between text-[11px] text-[#A1887F] border-b border-[#221814] pb-2">
              <span className="flex items-center gap-1.5 font-sans font-bold">
                <MessageSquare className="w-3.5 h-3.5 text-[#FFB74D]" />
                سجل المداولة والتنسيق المباشر بين الوكلاء الأربعة:
              </span>
              <span className="text-[#81C784]">المرحلة الجارية: {activeStage} من 4</span>
            </div>

            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {agentCollaborationLogs.slice(0, activeLogIndex + 1).map((log, idx) => (
                <div 
                  key={idx} 
                  className={`p-2.5 rounded-lg border leading-relaxed text-[11px] ${
                    log.agent === 1 
                      ? "bg-[#1E1511] border-[#3E2723] text-[#FFE0B2]" 
                      : log.agent === 2
                      ? "bg-[#2A1C0E] border-[#F57F17]/40 text-[#FFE082]"
                      : log.agent === 3
                      ? "bg-[#122415] border-[#2E7D32]/40 text-[#C8E6C9]"
                      : "bg-[#101428] border-[#3949AB]/40 text-[#C5CAE9]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 font-sans font-bold">
                    <span className={log.agent === 1 ? "text-[#FFB74D]" : log.agent === 2 ? "text-[#FFB300]" : log.agent === 3 ? "text-[#81C784]" : "text-[#7986CB]"}>
                      {log.name}
                    </span>
                    <span className="text-[10px] text-[#8D6E63]">مرحلة {log.stage}</span>
                  </div>
                  <p className="font-sans font-medium text-xs leading-relaxed">{log.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FINAL STORY & EDITORIAL MASTER RESULTS */}
      {storyResult && !isLoading && (
        <div className="space-y-8 animate-fade-in">
          
          {/* Decisive Master Banner */}
          <div className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#1A237E] text-white flex items-center justify-center shrink-0 shadow-sm">
                <ShieldCheck className="w-6 h-6 text-[#C5CAE9]" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-black text-[#1A237E]">
                    النسخة المعتمدة نهائياً (مختومة من المستمع الناقد المتشكك - الوكيل 4)
                  </h4>
                  {storyResult.skepticalAuditorReport?.overallConsistencyScore && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#1A237E] text-[#E8EAF6]">
                      اتساق منطقي وسكني: {storyResult.skepticalAuditorReport.overallConsistencyScore}%
                    </span>
                  )}
                  {storyResult.agentReport?.excitementScore && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#2E7D32] text-white">
                      مؤشر التشويق: {storyResult.agentReport.excitementScore}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#283593] leading-relaxed font-medium">
                  {storyResult.skepticalAuditorReport?.auditorVerdictSummary || 
                    "تم تدقيق استمرارية السكن (حسم عايش لوحده ولا مع حد)، تبرير قفل الباب بالمفتاح، إبادة العبارات المبهمة، وضبط اللسان المصري الطبيعي."}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-bold text-[#3949AB]">
                  <span className="bg-white/80 px-2 py-0.5 rounded border border-[#C7D2FE] flex items-center gap-1">
                    🏡 السكن: {storyResult.skepticalAuditorReport?.livingSituationCheck?.verdict || "متسق 100%"}
                  </span>
                  <span className="bg-white/80 px-2 py-0.5 rounded border border-[#C7D2FE] flex items-center gap-1">
                    🗝️ سببية الأفعال: {storyResult.skepticalAuditorReport?.actionJustificationCheck?.verdict || "مبررة"}
                  </span>
                  <span className="bg-white/80 px-2 py-0.5 rounded border border-[#C7D2FE] flex items-center gap-1">
                    🗣️ لسان مصري أصيل: {storyResult.skepticalAuditorReport?.egyptianAmmiyaCheck?.verdict || "خالٍ من الفصحى المتحجرة"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button 
                onClick={handleRunSkepticalAuditLive}
                disabled={isAuditingLive}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-xs font-bold rounded-xl hover:bg-[#FAF9F6] border border-[#C7D2FE] text-[#1A237E] shadow-xs disabled:opacity-50 transition"
                title="إعادة فحص النص المعروض حالياً بالمستمع المتشكك والتحقق من المنطق"
              >
                {isAuditingLive ? <RefreshCw className="w-4 h-4 animate-spin text-[#1A237E]" /> : <Search className="w-4 h-4 text-[#1A237E]" />}
                <span>{isAuditingLive ? "جاري الفحص..." : "فحص وتدقيق بالمستمع الناقد"}</span>
              </button>

              <button 
                onClick={handleCopyStory}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-xs font-bold rounded-xl hover:bg-[#FAF9F6] border border-[#ECE9E0] text-[#3E2723] shadow-xs"
              >
                {copied ? <Check className="w-4 h-4 text-[#2E7D32]" /> : <Copy className="w-4 h-4" />}
                {copied ? "تم نسخ القصة" : "نسخ القصة"}
              </button>

              <button 
                onClick={handleSendToProofreader}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1A237E] text-white text-xs font-black rounded-xl hover:bg-[#0D1244] transition shadow-xs"
              >
                أرسل للتحضير وتجهيز الغلاف ⚡
              </button>
            </div>
          </div>

          {/* Result Sub-Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-[#ECE9E0] pb-2">
            <button
              onClick={() => setActiveResultSubTab("story")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition ${
                activeResultSubTab === "story"
                  ? "bg-[#1A237E] text-white shadow-xs"
                  : "bg-white text-[#7D766D] hover:text-[#1A237E] border border-[#ECE9E0]"
              }`}
            >
              <Headphones className="w-4 h-4" />
              <span>استوديو القصة والتيليبرومتر 🎙️</span>
            </button>

            <button
              onClick={() => setActiveResultSubTab("agent4_audit")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition ${
                activeResultSubTab === "agent4_audit"
                  ? "bg-[#1A237E] text-white shadow-xs"
                  : "bg-white text-[#7D766D] hover:text-[#1A237E] border border-[#ECE9E0]"
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-[#3949AB]" />
              <span>مختبر المستمع الناقد ومحقق المنطق (الوكيل 4) 🕵️‍♂️</span>
              {storyResult.skepticalAuditorReport?.correctionsApplied && (
                <span className="bg-[#E8EAF6] text-[#1A237E] px-1.5 py-0.2 rounded-full text-[10px]">
                  {storyResult.skepticalAuditorReport.correctionsApplied.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveResultSubTab("agent3_report")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition ${
                activeResultSubTab === "agent3_report"
                  ? "bg-[#2E7D32] text-white shadow-xs"
                  : "bg-white text-[#7D766D] hover:text-[#2E7D32] border border-[#ECE9E0]"
              }`}
            >
              <Scissors className="w-4 h-4 text-[#2E7D32]" />
              <span>مختبر المحرر البشري وتليين الألفاظ (الوكيل 3) ✂️</span>
            </button>

            <button
              onClick={() => setActiveResultSubTab("titles")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition ${
                activeResultSubTab === "titles"
                  ? "bg-[#E65100] text-white shadow-xs"
                  : "bg-white text-[#7D766D] hover:text-[#E65100] border border-[#ECE9E0]"
              }`}
            >
              <Flame className="w-4 h-4 text-[#FF5722]" />
              <span>عناوين يوتيوب وعلم النفس الفيروسي 🎯</span>
            </button>

            <button
              onClick={() => setActiveResultSubTab("reverse_architecture")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition ${
                activeResultSubTab === "reverse_architecture"
                  ? "bg-[#6A1B9A] text-white shadow-xs"
                  : "bg-white text-[#7D766D] hover:text-[#6A1B9A] border border-[#ECE9E0]"
              }`}
            >
              <Sparkles className="w-4 h-4 text-[#AB47BC]" />
              <span>الهندسة العكسية وصدمة إعادة الاستماع 🎯</span>
              {storyResult.reverseEngineeredEnding && (
                <span className="bg-[#F3E5F5] text-[#6A1B9A] px-1.5 py-0.2 rounded-full text-[10px] font-black">
                  النهاية أولاً ★
                </span>
              )}
            </button>
          </div>

          {/* SUB-VIEW 1: THE STORY & SCRIPT */}
          {activeResultSubTab === "story" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Main Script Text Body (2 cols) */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm">
                  
                  {/* Draft Version Switcher */}
                  {(() => {
                    const currentDisplayedText = getCurrentStoryText();
                    const currentWords = currentDisplayedText.trim().split(/\s+/).filter(Boolean).length;
                    const currentAudioMins = Math.max(1, Math.round(currentWords / 130));

                    return (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-[#ECE9E0] pb-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-[#1A237E] bg-[#E8EAF6] px-2.5 py-1 rounded-md border border-[#C5CAE9] inline-block">
                              {activeDraftTab === "audited" 
                                ? "المعتمدة بعد تدقيق المستمع الناقد (الوكيل 4)" 
                                : activeDraftTab === "humanized"
                                ? "مسودة المحرر البشري (الوكيل 3)"
                                : "المسودة الأولية (الوكيل 2)"}
                            </span>
                            <span className="text-[11px] font-extrabold text-[#1565C0] bg-[#E3F2FD] px-2.5 py-1 rounded-md border border-[#BBDEFB] flex items-center gap-1">
                              📊 {currentWords.toLocaleString("ar-EG")} كلمة
                              {storyResult.wordCountTarget && (
                                <span className="text-[10px] text-[#0D47A1] font-bold">
                                  (المستهدف: {storyResult.wordCountTarget.toLocaleString("ar-EG")})
                                </span>
                              )}
                            </span>
                            {storyResult.wordCountTarget && currentWords >= Math.floor(storyResult.wordCountTarget * 0.85) && (
                              <span className="text-[10px] font-black text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.5 rounded border border-[#C8E6C9] flex items-center gap-1">
                                ✓ مكتمل الطول
                              </span>
                            )}
                            <span className="text-[11px] font-extrabold text-[#6A1B9A] bg-[#F3E5F5] px-2.5 py-1 rounded-md border border-[#E1BEE7] flex items-center gap-1">
                              ⏱️ ~{currentAudioMins} دقيقة إلقاء
                            </span>
                            {storyResult.scenesCount && (
                              <span className="text-[10px] font-bold text-[#4E342E] bg-[#EFEBE9] px-2 py-1 rounded-md border border-[#D7CCC8]">
                                🎬 {storyResult.scenesCount} مشاهد
                              </span>
                            )}
                          </div>
                          <h4 className="text-xl font-black text-[#3E2723] mt-1.5">{storyResult.title}</h4>
                        </div>

                        {/* 3-Way Version Selector Buttons */}
                        <div className="flex flex-wrap items-center gap-1.5 bg-[#FAF9F6] p-1 rounded-xl border border-[#ECE9E0]">
                          <button
                            type="button"
                            onClick={() => setActiveDraftTab("audited")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 ${
                              activeDraftTab === "audited" 
                                ? "bg-[#1A237E] text-white shadow-xs" 
                                : "text-[#7D766D] hover:text-[#1A237E]"
                            }`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>المعتمدة (الوكيل 4)</span>
                          </button>

                          {storyResult.humanizedDraftPreview && (
                            <button
                              type="button"
                              onClick={() => setActiveDraftTab("humanized")}
                              className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 ${
                                activeDraftTab === "humanized" 
                                  ? "bg-[#2E7D32] text-white shadow-xs" 
                                  : "text-[#7D766D] hover:text-[#2E7D32]"
                              }`}
                            >
                              <Scissors className="w-3.5 h-3.5" />
                              <span>المحرر (الوكيل 3)</span>
                            </button>
                          )}

                          {storyResult.rawDraftPreview && (
                            <button
                              type="button"
                              onClick={() => setActiveDraftTab("raw")}
                              className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 ${
                                activeDraftTab === "raw" 
                                  ? "bg-[#8D6E63] text-white shadow-xs" 
                                  : "text-[#7D766D] hover:text-[#3E2723]"
                              }`}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>المسودة 1 (الوكيل 2)</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* 4 YouTube Titles Selection Box */}
                  {(() => {
                    const titlesList = storyResult.youtubeTitles || storyResult.titleOptions || [
                      storyResult.title,
                      `سر الرسالة الغامضة: ${storyResult.title}`,
                      `اللي حصل في البيت ده محدش يقدر يفسره`,
                      `ليلة المشهد الأخير: القصة التي غيرت كل شيء`
                    ];
                    const angleBadges = [
                      { label: "🔍 فضول غامض (Curiosity Gap)", color: "bg-[#E3F2FD] text-[#0D47A1] border-[#90CAF9]" },
                      { label: "⚡ صدمة ومفارقة (High Stakes)", color: "bg-[#FFEBEE] text-[#C62828] border-[#FFCDD2]" },
                      { label: "🎙️ تجربة شخصية واقعية", color: "bg-[#E8F5E9] text-[#2E7D32] border-[#A5D6A7]" },
                      { label: "🎬 سينمائي وسيكولوجي", color: "bg-[#F3E5F5] text-[#6A1B9A] border-[#CE93D8]" }
                    ];

                    const handleRegenerateTitles = async () => {
                      setIsRegeneratingTitles(true);
                      try {
                        const res = await fetch("/api/generate-youtube-titles", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            storyText: storyResult.fullStoryText,
                            currentTitle: storyResult.title,
                            backupApiKey
                          })
                        });
                        if (res.ok) {
                          const data = await res.json();
                          if (data.titles && Array.isArray(data.titles) && data.titles.length > 0) {
                            setStoryResult({
                              ...storyResult,
                              youtubeTitles: data.titles,
                              title: data.titles[0]
                            });
                          }
                        }
                      } catch (err) {
                        console.error("Failed to regenerate titles:", err);
                      } finally {
                        setIsRegeneratingTitles(false);
                      }
                    };

                    const handleSelectAndGoToCover = (chosenTitle: string) => {
                      const text = storyResult.fullStoryText;
                      // Persist to localStorage for ImageMakerTab
                      localStorage.setItem("rawi_imgmaker_title_text", chosenTitle);
                      localStorage.setItem("rawi_imgmaker_story_input", text);
                      localStorage.setItem("rawi_shared_story", text);
                      localStorage.setItem("rawi_shared_title", chosenTitle);
                      
                      setStoryResult({ ...storyResult, title: chosenTitle });
                      onStoryGenerated(text);
                      setActiveTab("image-maker");
                    };

                    return (
                      <div className="p-4 bg-[#FFFDF7] rounded-xl border-2 border-[#FFE082] mb-6 space-y-3 shadow-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#FFE082]/60 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-[#D32F2F] text-white flex items-center justify-center font-black text-xs shadow-xs">
                              YT
                            </span>
                            <div>
                              <h5 className="text-xs font-black text-[#3E2723]">
                                4 عناوين يوتيوب مقترحة للقصة (اختر العنوان الأنسب للـ CTR):
                              </h5>
                              <p className="text-[10px] text-[#7D766D] font-medium">
                                تم توليدها بزوايا نفسية مختلفة لتجربة العنوان الأمثل قبل صناعة الغلاف
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleRegenerateTitles}
                              disabled={isRegeneratingTitles}
                              className="text-[11px] font-bold text-[#8D6E63] hover:text-[#3E2723] bg-white px-2.5 py-1 rounded-lg border border-[#FFE082] hover:bg-[#FFF8E1] transition flex items-center gap-1 disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3 h-3 ${isRegeneratingTitles ? "animate-spin" : ""}`} />
                              <span>{isRegeneratingTitles ? "جارِ التوليد..." : "توليد 4 عناوين أخرى 🔄"}</span>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {titlesList.slice(0, 4).map((t, idx) => {
                            const isSelected = storyResult.title === t;
                            const badge = angleBadges[idx % angleBadges.length];
                            const isCopied = copiedTitleIndex === idx;

                            return (
                              <div
                                key={idx}
                                onClick={() => setStoryResult({ ...storyResult, title: t })}
                                className={`p-3 rounded-xl border text-right cursor-pointer transition flex flex-col justify-between gap-2 ${
                                  isSelected 
                                    ? "bg-[#FAF2EB] border-[#8D6E63] ring-2 ring-[#8D6E63]/25 shadow-xs" 
                                    : "bg-white border-[#ECE9E0] hover:border-[#8D6E63] hover:bg-[#FAF9F6]"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge.color}`}>
                                    {badge.label}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(t);
                                        setCopiedTitleIndex(idx);
                                        setTimeout(() => setCopiedTitleIndex(null), 2000);
                                      }}
                                      className="text-[10px] text-[#8D6E63] hover:text-[#3E2723] hover:underline flex items-center gap-0.5"
                                      title="نسخ هذا العنوان"
                                    >
                                      {isCopied ? <Check className="w-3 h-3 text-[#2E7D32]" /> : <Copy className="w-3 h-3" />}
                                      <span>{isCopied ? "تم النسخ" : "نسخ"}</span>
                                    </button>
                                  </div>
                                </div>

                                <p className="text-xs font-black text-[#3E2723] leading-snug">
                                  {isSelected && <span className="text-[#2E7D32] ml-1">✓</span>}
                                  {t}
                                </p>

                                {isSelected && (
                                  <div className="pt-2 border-t border-[#8D6E63]/20 flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-bold text-[#2E7D32]">
                                      العنوان النشط المعتمد للقصة
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelectAndGoToCover(t);
                                      }}
                                      className="text-[11px] font-black text-white bg-[#8D6E63] hover:bg-[#6D4C41] px-2.5 py-1 rounded-md transition shadow-xs flex items-center gap-1"
                                    >
                                      <span>🎨 صناعة الغلاف بهذا العنوان</span>
                                      <ArrowRight className="w-3 h-3 rotate-180" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* The Magnetic Hook */}
                  <div className="p-4 bg-[#FFEBEE] rounded-xl border border-[#FFCDD2] mb-6 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-[#C62828] flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-[#D32F2F]" />
                        الخطاف الافتتاحي المشدود (Hook أول 15-30 ثانية لجذب المستمع):
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyHook}
                        className="text-[11px] font-bold text-[#C62828] hover:underline flex items-center gap-1"
                      >
                        {copiedHook ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedHook ? "تم نسخ الخطاف" : "نسخ الخطاف"}
                      </button>
                    </div>
                    <p className="text-sm italic font-bold text-[#3E2723] leading-relaxed bg-white/70 p-3 rounded-lg border border-[#FFCDD2]/60">
                      "{storyResult.hook}"
                    </p>
                  </div>

                  {/* View Mode Switcher & Granular Font Sizing */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-[#FAF9F6] p-2.5 rounded-xl border border-[#ECE9E0]">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setScriptViewMode("teleprompter")}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition ${
                          scriptViewMode === "teleprompter"
                            ? "bg-[#3E2723] text-white shadow-sm"
                            : "text-[#7D766D] hover:text-[#3E2723]"
                        }`}
                      >
                        <Mic className="w-3.5 h-3.5 text-[#FFB74D]" />
                        🎙️ وضع الإلقاء المتدفق (Teleprompter)
                      </button>
                      <button
                        type="button"
                        onClick={() => setScriptViewMode("standard")}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition ${
                          scriptViewMode === "standard"
                            ? "bg-[#3E2723] text-white shadow-sm"
                            : "text-[#7D766D] hover:text-[#3E2723]"
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        📄 عرض النص الموحد
                      </button>
                    </div>

                    {/* Font Size Granular Controls */}
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-[#ECE9E0]">
                      <span className="text-[11px] font-bold text-[#8D6E63] flex items-center gap-1">
                        <Type className="w-3.5 h-3.5" />
                        حجم الخط:
                      </span>
                      <button
                        type="button"
                        onClick={() => setTeleprompterFontSize(Math.max(12, teleprompterFontSize - 1))}
                        className="w-6 h-6 rounded bg-[#FAF9F6] hover:bg-[#FAF2EB] text-[#3E2723] font-black text-xs flex items-center justify-center border border-[#ECE9E0]"
                        title="تصغير الخط"
                      >
                        -
                      </button>
                      <input 
                        type="range"
                        min="13"
                        max="36"
                        value={teleprompterFontSize}
                        onChange={(e) => setTeleprompterFontSize(Number(e.target.value))}
                        className="w-20 accent-[#8D6E63] cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => setTeleprompterFontSize(Math.min(40, teleprompterFontSize + 1))}
                        className="w-6 h-6 rounded bg-[#FAF9F6] hover:bg-[#FAF2EB] text-[#3E2723] font-black text-xs flex items-center justify-center border border-[#ECE9E0]"
                        title="تكبير الخط"
                      >
                        +
                      </button>
                      <span className="text-xs font-mono font-black text-[#5D4037] min-w-[32px] text-center">
                        {teleprompterFontSize}px
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyFormattedStory}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-[#FAF2EB] text-[#3E2723] rounded-lg border border-[#ECE9E0] text-[11px] font-bold shadow-xs transition"
                        title="نسخ النص بأسطر تنفسية قصيرة وفواصل حوار جاهزة لبرامج التسجيل"
                      >
                        {copiedFormatted ? <Check className="w-3.5 h-3.5 text-[#2E7D32]" /> : <Copy className="w-3.5 h-3.5 text-[#8D6E63]" />}
                        {copiedFormatted ? "تم نسخ نص الإلقاء" : "نسخ منسق للإلقاء"}
                      </button>
                    </div>
                  </div>

                  {/* TELEPROMPTER / AUDIO NARRATION STUDIO VIEW */}
                  {scriptViewMode === "teleprompter" && (() => {
                    const currentDisplayedText = getCurrentStoryText();
                    const scenes = parseStoryIntoScenes(currentDisplayedText);
                    const filteredScenes = activeSceneFilter !== null 
                      ? scenes.filter(s => s.sceneNumber === activeSceneFilter)
                      : scenes;

                    const themeClasses = {
                      dark: "bg-[#120E0C] text-[#F5EDE8] border-[#2E2019]",
                      light: "bg-[#FFFFFF] text-[#2D1E18] border-[#E0D8D0]",
                      warm: "bg-[#FDFBF7] text-[#3E2723] border-[#EAE3D6]"
                    }[teleprompterTheme];

                    return (
                      <div className="space-y-4">
                        {/* Audio Studio Control Bar */}
                        <div className="bg-[#2A1C15] text-white p-3.5 rounded-xl border border-[#3E2723] space-y-3 shadow-md">
                          
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            {/* Auto-Scroll Controller */}
                            <div className="flex items-center gap-2 bg-[#1A110D] px-3 py-1.5 rounded-lg border border-[#3E2723]">
                              <button
                                type="button"
                                onClick={() => setIsAutoScrolling(!isAutoScrolling)}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-black transition ${
                                  isAutoScrolling 
                                    ? "bg-[#D32F2F] text-white animate-pulse" 
                                    : "bg-[#2E7D32] hover:bg-[#1B5E20] text-white"
                                }`}
                              >
                                {isAutoScrolling ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                {isAutoScrolling ? "إيقاف التمرير" : "بدء التمرير التلقائي"}
                              </button>

                              {/* Speed selector */}
                              <div className="flex items-center gap-1 text-[11px]">
                                <span className="text-[#A1887F] font-bold">السرعة:</span>
                                {[
                                  { val: 1, label: "بطيء (1x)" },
                                  { val: 2, label: "معتدل (2x)" },
                                  { val: 3, label: "سريع (3x)" }
                                ].map(s => (
                                  <button
                                    key={s.val}
                                    type="button"
                                    onClick={() => setScrollSpeed(s.val)}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${scrollSpeed === s.val ? "bg-[#FFB74D] text-[#3E2723]" : "text-[#D7CCC8] hover:bg-[#3E2723]"}`}
                                  >
                                    {s.label}
                                  </button>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  if (teleprompterRef.current) teleprompterRef.current.scrollTop = 0;
                                }}
                                className="p-1 text-[#A1887F] hover:text-white rounded hover:bg-[#3E2723]"
                                title="إعادة إلى أعلى النص"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Studio Recording Stopwatch */}
                            <div className="flex items-center gap-2 bg-[#1A110D] px-3 py-1.5 rounded-lg border border-[#3E2723]">
                              <span className="text-xs font-black text-[#FFB74D] flex items-center gap-1">
                                <span className={`w-2 h-2 rounded-full ${isRecording ? "bg-red-500 animate-ping" : "bg-red-400"}`} />
                                مؤقت التسجيل:
                              </span>
                              <span className="font-mono text-sm font-black text-white">
                                {formatElapsed(recordSeconds)}
                              </span>
                              <button
                                type="button"
                                onClick={() => setIsRecording(!isRecording)}
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  isRecording ? "bg-[#C62828] text-white" : "bg-[#3E2723] text-[#FFE0B2] hover:bg-[#4E342E]"
                                }`}
                              >
                                {isRecording ? "إيقاف المؤقت" : "بدء التسجيل 🎙️"}
                              </button>
                              {recordSeconds > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsRecording(false);
                                    setRecordSeconds(0);
                                  }}
                                  className="text-[10px] text-[#A1887F] hover:text-white underline"
                                >
                                  تصفير
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Visual Formatting Options */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#3E2723]/60 text-xs">
                            
                            {/* Font size */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[#A1887F] font-bold text-[11px] flex items-center gap-1">
                                <Type className="w-3 h-3" />
                                حجم الخط:
                              </span>
                              {[
                                { size: 18, label: "عادي 18" },
                                { size: 22, label: "مريح 22" },
                                { size: 26, label: "كبير 26" },
                                { size: 30, label: "شاشة 30" }
                              ].map(fs => (
                                <button
                                  key={fs.size}
                                  type="button"
                                  onClick={() => setTeleprompterFontSize(fs.size)}
                                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${teleprompterFontSize === fs.size ? "bg-[#FFB74D] text-[#3E2723]" : "text-[#D7CCC8] hover:bg-[#3E2723]"}`}
                                >
                                  {fs.label}
                                </button>
                              ))}
                            </div>

                            {/* Line Height / Breathing Gap */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[#A1887F] font-bold text-[11px]">تباعد الأسطر:</span>
                              {[
                                { val: "leading-[2.0]", label: "مريح" },
                                { val: "leading-[2.4]", label: "واسع للنَّفَس" },
                                { val: "leading-[2.8]", label: "إلقائي فسيح" }
                              ].map(lh => (
                                <button
                                  key={lh.val}
                                  type="button"
                                  onClick={() => setTeleprompterLineHeight(lh.val)}
                                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${teleprompterLineHeight === lh.val ? "bg-[#FFB74D] text-[#3E2723]" : "text-[#D7CCC8] hover:bg-[#3E2723]"}`}
                                >
                                  {lh.label}
                                </button>
                              ))}
                            </div>

                            {/* Cues Toggles */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setHighlightDialogues(!highlightDialogues)}
                                className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition ${highlightDialogues ? "bg-[#2E7D32] text-white" : "bg-[#1A110D] text-[#A1887F] border border-[#3E2723]"}`}
                              >
                                💬 تمييز نبرة الحوارات
                              </button>

                              {/* Theme */}
                              <div className="flex items-center gap-1 bg-[#1A110D] p-0.5 rounded-lg border border-[#3E2723]">
                                <button
                                  type="button"
                                  onClick={() => setTeleprompterTheme("dark")}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${teleprompterTheme === "dark" ? "bg-[#3E2723] text-[#FFE0B2]" : "text-[#A1887F]"}`}
                                >
                                  🌑 مظلم
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTeleprompterTheme("warm")}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${teleprompterTheme === "warm" ? "bg-[#8D6E63] text-white" : "text-[#A1887F]"}`}
                                >
                                  📜 دافئ
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTeleprompterTheme("light")}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${teleprompterTheme === "light" ? "bg-white text-[#3E2723]" : "text-[#A1887F]"}`}
                                >
                                  ☀️ فاتح
                                </button>
                              </div>
                            </div>

                          </div>
                        </div>

                        {/* Scene Quick Jump Tabs */}
                        {scenes.length > 1 && (
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
                            <span className="text-[11px] font-bold text-[#8D6E63] shrink-0">انتقال سريع:</span>
                            <button
                              type="button"
                              onClick={() => setActiveSceneFilter(null)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition ${
                                activeSceneFilter === null 
                                  ? "bg-[#3E2723] text-white" 
                                  : "bg-[#FAF9F6] text-[#5D4037] border border-[#ECE9E0] hover:bg-[#FAF2EB]"
                              }`}
                            >
                              كل القصة ({scenes.length} مشاهد)
                            </button>
                            {scenes.map(sc => (
                              <button
                                key={sc.sceneNumber}
                                type="button"
                                onClick={() => setActiveSceneFilter(sc.sceneNumber)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 transition ${
                                  activeSceneFilter === sc.sceneNumber 
                                    ? "bg-[#2E7D32] text-white" 
                                    : "bg-[#FAF9F6] text-[#5D4037] border border-[#ECE9E0] hover:bg-[#FAF2EB]"
                                }`}
                              >
                                <span>{sc.title}</span>
                                <span className="text-[10px] opacity-75">(~{sc.estMinutes}د)</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Teleprompter Scrollable Body - Continuous Flow with Clean Scene Separators */}
                        <div 
                          ref={teleprompterRef}
                          className={`rounded-xl p-6 sm:p-8 border overflow-y-auto max-h-[640px] shadow-inner transition-colors duration-300 font-sans ${themeClasses} ${teleprompterLineHeight}`}
                          style={{ fontSize: `${teleprompterFontSize}px` }}
                        >
                          <div className="max-w-3xl mx-auto space-y-8">
                            {filteredScenes.map((sceneItem, scIdx) => (
                              <section key={sceneItem.sceneNumber} className="space-y-4">
                                
                                {/* Elegant Subtle Scene Delimiter */}
                                {scIdx > 0 && (
                                  <div className="flex items-center gap-3 my-6 opacity-60">
                                    <span className="flex-1 h-px bg-current opacity-25" />
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full border border-current/20 opacity-70">
                                      ✦ {sceneItem.title} ✦
                                    </span>
                                    <span className="flex-1 h-px bg-current opacity-25" />
                                  </div>
                                )}

                                {scIdx === 0 && (
                                  <div className="flex items-center justify-between pb-2 border-b border-current/15 mb-4 text-xs font-bold opacity-75">
                                    <span className="flex items-center gap-1.5 font-black text-sm">
                                      🎬 {sceneItem.title}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span>⏱️ ~{sceneItem.estMinutes} دقيقة</span>
                                      <span>•</span>
                                      <span>📊 {sceneItem.wordCount} كلمة</span>
                                    </div>
                                  </div>
                                )}

                                {/* Scene Paragraphs - Natural storytelling flow */}
                                <div className="space-y-4">
                                  {sceneItem.paragraphs.map((p, pIdx) => {
                                    const isDialogue = p.startsWith('"') || p.startsWith('«') || p.startsWith('- "') || p.includes('":') || p.endsWith('"');

                                    if (isDialogue && highlightDialogues) {
                                      return (
                                        <div 
                                          key={pIdx}
                                          className="p-3.5 rounded-lg border shadow-xs my-2 transition-all"
                                          style={{
                                            backgroundColor: teleprompterTheme === "dark" ? "#14251B" : "#F1F8E9",
                                            borderColor: teleprompterTheme === "dark" ? "#2E7D32" : "#C8E6C9",
                                            color: teleprompterTheme === "dark" ? "#E8F5E9" : "#1B5E20"
                                          }}
                                        >
                                          <p className="font-bold tracking-wide">
                                            {p}
                                          </p>
                                        </div>
                                      );
                                    }

                                    return (
                                      <p 
                                        key={pIdx}
                                        className="font-medium tracking-wide transition-opacity hover:opacity-100 leading-relaxed"
                                        style={{ opacity: teleprompterTheme === "dark" ? 0.95 : 1 }}
                                      >
                                        {p}
                                      </p>
                                    );
                                  })}
                                </div>
                              </section>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* STANDARD RAW TEXT BOX */}
                  {scriptViewMode === "standard" && (
                    <div className="p-5 rounded-lg bg-[#FCFBF9] border border-[#ECE9E0] text-sm leading-relaxed text-[#3E2723] whitespace-pre-wrap font-medium h-[540px] overflow-y-auto font-mono">
                      {getCurrentStoryText()}
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar: Plot/Psychology & Audio Direction & Pacing (1 col) */}
              <div className="space-y-6">
                {/* Detected Plot & Psychological Analysis */}
                {storyResult.detectedPlotAndPsychology && (
                  <div className="bg-[#FAF9F6] rounded-xl p-5 border border-[#FFE082] shadow-sm space-y-3 bg-gradient-to-br from-[#FFFDF9] to-[#FFF8E1]">
                    <div className="flex items-center justify-between border-b border-[#FFE082]/70 pb-2.5">
                      <h4 className="text-xs font-black text-[#E65100] flex items-center gap-1.5">
                        <Brain className="w-4 h-4 text-[#FB8C00]" />
                        الحبكة والتحليل النفسي من سياق فكرتك:
                      </h4>
                      <span className="text-[10px] font-black bg-[#FFF3E0] text-[#E65100] px-2 py-0.5 rounded-full border border-[#FFE082]">
                        استنتاج ذكي
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div>
                        <span className="font-bold text-[#8D6E63] block text-[10px]">نوع الحبكة الدرامية:</span>
                        <p className="font-black text-[#3E2723] text-xs mt-0.5">
                          {storyResult.detectedPlotAndPsychology.plotType}
                        </p>
                      </div>

                      <div>
                        <span className="font-bold text-[#8D6E63] block text-[10px]">التصنيف والعمق النفسي للأبطال:</span>
                        <p className="font-medium text-[#4E342E] text-xs leading-relaxed mt-0.5">
                          {storyResult.detectedPlotAndPsychology.psychologicalArchetype}
                        </p>
                      </div>

                      <div>
                        <span className="font-bold text-[#8D6E63] block text-[10px]">جوهر الصراع النفسي والدرامي:</span>
                        <p className="font-medium text-[#4E342E] text-xs leading-relaxed mt-0.5">
                          {storyResult.detectedPlotAndPsychology.coreConflict}
                        </p>
                      </div>

                      {storyResult.detectedPlotAndPsychology.twistSetup && (
                        <div>
                          <span className="font-bold text-[#8D6E63] block text-[10px]">تأسيس نقطة التحول الصادمة (Twist):</span>
                          <p className="font-medium text-[#C62828] text-xs leading-relaxed mt-0.5 bg-[#FFEBEE]/80 p-2 rounded-lg border border-[#FFCDD2]">
                            {storyResult.detectedPlotAndPsychology.twistSetup}
                          </p>
                        </div>
                      )}

                      {storyResult.detectedPlotAndPsychology.rationaleFromContext && (
                        <div className="pt-1.5 text-[11px] text-[#795548] leading-relaxed border-t border-[#FFE082]/50 italic">
                          💡 <span className="font-bold">سبب الاختيار من السياق:</span> {storyResult.detectedPlotAndPsychology.rationaleFromContext}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Pacing Guide */}
                <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm">
                  <h4 className="text-sm font-bold text-[#3E2723] mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#8D6E63]" />
                    دليل الإيقاع والوقفات للراوي
                  </h4>
                  <p className="text-xs text-[#5D4037] leading-relaxed whitespace-pre-line bg-[#FAF9F6] p-4 rounded-lg border border-[#ECE9E0]">
                    {storyResult.pacingGuide}
                  </p>
                </div>

                {/* Suggested Sound Atmosphere */}
                <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm">
                  <h4 className="text-sm font-bold text-[#3E2723] mb-3 flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-[#2E7D32]" />
                    المؤثرات الصوتية والبيئة المحيطة المقترحة
                  </h4>
                  <p className="text-xs text-[#5D4037] leading-relaxed whitespace-pre-line bg-[#FAF9F6] p-4 rounded-lg border border-[#ECE9E0]">
                    {storyResult.suggestedAtmosphere}
                  </p>
                </div>

                {/* Quick Next Step Box */}
                <div className="bg-[#FAF2EB] rounded-xl p-5 border border-[#EFE5DC] text-center space-y-3">
                  <h5 className="text-xs font-black text-[#3E2723]">الانتقال للتحضير وتوليد الغلاف</h5>
                  <p className="text-[11px] text-[#7D766D]">
                    انقل النص فوراً لتبويب التحضير لفحص التشكيل، ضبط الألفاظ وتوليد برومبت الغلاف المصغر بأعلى نسبة نقر (CTR).
                  </p>
                  <button
                    onClick={handleSendToProofreader}
                    className="w-full py-2.5 bg-[#3E2723] hover:bg-[#2A1810] text-white text-xs font-black rounded-lg transition shadow-sm"
                  >
                    انتقال إلى تجهيز القصة والغلاف ⚡
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* SUB-VIEW 2: AGENT 4 SKEPTICAL AUDITOR & LOGICAL CONTINUITY LAB */}
          {activeResultSubTab === "agent4_audit" && (
            <div className="bg-white rounded-2xl p-6 border border-[#C7D2FE] shadow-sm space-y-6">
              {/* Header */}
              <div className="border-b border-[#ECE9E0] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1A237E] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <ShieldCheck className="w-6 h-6 text-[#C5CAE9]" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-[#1A237E] flex items-center gap-2">
                      مختبر المستمع الناقد ومحقق المنطق (الوكيل 4 - حارس المصداقية)
                    </h4>
                    <p className="text-xs text-[#5C6BC0] mt-0.5">
                      فحص صارم بعين المستمع المتربص: كشف التناقض السكني، تبرير قفل الأبواب، إبادة التشبيهات المبهمة، وضمان سلامة العامية المصرية.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-black text-[#1A237E] bg-[#E8EAF6] px-3.5 py-1.5 rounded-full border border-[#C5CAE9]">
                    معدل الاتساق المنطقي: {storyResult.skepticalAuditorReport?.overallConsistencyScore || 95}%
                  </span>
                  <button
                    type="button"
                    onClick={handleRunSkepticalAuditLive}
                    disabled={isAuditingLive}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A237E] hover:bg-[#0D1244] text-white text-xs font-black rounded-xl transition shadow-xs disabled:opacity-50"
                  >
                    {isAuditingLive ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    <span>{isAuditingLive ? "جاري التدقيق..." : "إعادة تدقيق النص الآن"}</span>
                  </button>
                </div>
              </div>

              {/* 4 Pillars Audit Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Pillar 1: Living Situation */}
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#0F172A] flex items-center gap-1.5">
                      🏡 استمرارية السكن
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD]">
                      {storyResult.skepticalAuditorReport?.livingSituationCheck?.verdict || "محسوم ومتسق"}
                    </span>
                  </div>
                  <p className="text-xs text-[#334155] leading-relaxed">
                    {storyResult.skepticalAuditorReport?.livingSituationCheck?.details || 
                      "تم حسم حالة السكن بوضوح من المشهد الأول لمنع تشتيت المستمع بين العيش منفرداً أو مع آخرين."}
                  </p>
                </div>

                {/* Pillar 2: Action Justification */}
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#0F172A] flex items-center gap-1.5">
                      🗝️ سببية الأفعال والأبواب
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]">
                      {storyResult.skepticalAuditorReport?.actionJustificationCheck?.verdict || "مبرر بالكامل"}
                    </span>
                  </div>
                  <p className="text-xs text-[#334155] leading-relaxed">
                    {storyResult.skepticalAuditorReport?.actionJustificationCheck?.doorLockingJustification || 
                      "لكل قرار جسدي (مثل قفل الباب بالمفتاح أو فحص المكان) سبب واقعي مفهوم يمنع تناقض التصرفات."}
                  </p>
                </div>

                {/* Pillar 3: Vague Phrasing */}
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#0F172A] flex items-center gap-1.5">
                      👁️ التشبيهات الحسية
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]">
                      تفكيك وتجسيد
                    </span>
                  </div>
                  <p className="text-xs text-[#334155] leading-relaxed">
                    {storyResult.skepticalAuditorReport?.unimaginablePhrasingCheck?.replacementsExplanation || 
                      "استبدال العبارات المبهمة بصور حسية مادية يسهل على المستمع في الظلام تخيلها ورسمها في عقله."}
                  </p>
                </div>

                {/* Pillar 4: Egyptian Ammiya */}
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#0F172A] flex items-center gap-1.5">
                      🗣️ سلامة العامية المصرية
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F3E8FF] text-[#7E22CE] border border-[#E9D5FF]">
                      {storyResult.skepticalAuditorReport?.egyptianAmmiyaCheck?.verdict || "أصيلة 100%"}
                    </span>
                  </div>
                  <p className="text-xs text-[#334155] leading-relaxed">
                    صياغة نابعة من لسان راوٍ مصري حقيقي يحكي واقعه لأصحابه دون فصحى مسرحية أو ركاكة آلية.
                  </p>
                </div>
              </div>

              {/* Auditor Verdict Summary */}
              {storyResult.skepticalAuditorReport?.auditorVerdictSummary && (
                <div className="p-4 rounded-xl bg-[#EEF2FF] border border-[#C7D2FE] flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-[#3730A3] shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed text-[#1E1B4B]">
                    <span className="font-black block mb-1">التقرير الختامي للمستمع الناقد المتشكك:</span>
                    <p>{storyResult.skepticalAuditorReport.auditorVerdictSummary}</p>
                  </div>
                </div>
              )}

              {/* Detailed Corrections Applied Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-black text-[#1A237E] flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-[#3949AB]" />
                    سجل الملاحظات والتصحيحات التي تم تطبيقها فوراً على النص:
                  </h5>
                  <span className="text-[11px] text-[#5C6BC0]">
                    {storyResult.skepticalAuditorReport?.correctionsApplied?.length || 0} تصحيحات نقدية
                  </span>
                </div>

                {storyResult.skepticalAuditorReport?.correctionsApplied && storyResult.skepticalAuditorReport.correctionsApplied.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {storyResult.skepticalAuditorReport.correctionsApplied.map((corr, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E2E8F0] space-y-2 hover:border-[#C7D2FE] transition">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-[#3949AB] bg-[#EEF2FF] px-2.5 py-0.5 rounded-md border border-[#C7D2FE]">
                            📍 {corr.sceneOrContext}
                          </span>
                          <span className="text-[#B91C1C] flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> نقطة الالتباس المفككة
                          </span>
                        </div>

                        {/* Critique */}
                        <p className="text-xs text-[#7F1D1D] bg-[#FEF2F2] p-2.5 rounded-lg border border-[#FEE2E2] leading-relaxed font-medium">
                          <strong>🕵️‍♂️ نقد المستمع المتشكك:</strong> {corr.critiqueExplanation}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                          <div className="bg-white p-2.5 rounded-lg border border-[#E2E8F0]">
                            <span className="text-[10px] font-black text-[#94A3B8] block mb-1">❌ الصياغة المربكة السابقة:</span>
                            <p className="text-xs text-[#64748B] line-through leading-relaxed">{corr.originalProblematicText}</p>
                          </div>
                          <div className="bg-[#F0FDF4] p-2.5 rounded-lg border border-[#BBF7D0]">
                            <span className="text-[10px] font-black text-[#16A34A] block mb-1">✅ الصياغة المعتمدة الجديدة (عامية حية):</span>
                            <p className="text-xs text-[#15803D] font-bold leading-relaxed">{corr.correctedReplacementText}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-[#64748B] bg-[#F8FAFC] rounded-xl border border-dashed border-[#CBD5E1]">
                    لم يتم رصد تناقضات منطقية أو عيوب سكنية؛ النص متسق تماماً ومؤهل للإلقاء.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUB-VIEW 3: AGENT 3 EDITORIAL AUDIT (ANTI-FLUFF & SOFTENED WORDS) */}
          {activeResultSubTab === "agent3_report" && storyResult.agentReport && (
            <div className="bg-white rounded-2xl p-6 border border-[#C8E6C9] shadow-sm space-y-6">
              <div className="border-b border-[#ECE9E0] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#2E7D32] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Scissors className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-[#2E7D32] flex items-center gap-2">
                      مختبر المحرر البشري وإبادة الحشو (تقرير الوكيل 3 الصارم)
                    </h4>
                    <p className="text-xs text-[#7D766D] mt-0.5">
                      سجل تفصيلي لما تم استئصاله من الوصف الميت والمشاعر المشروحة، والكلمات الفصحى المتحجرة التي تم تليينها لعامية مصرية سلسة.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#2E7D32] bg-[#E8F5E9] px-3.5 py-1.5 rounded-full border border-[#C8E6C9]">
                    {storyResult.agentReport.softenedSolidWords?.length || 0} كلمات تم تليينها
                  </span>
                  {storyResult.agentReport.excitementScore && (
                    <span className="text-xs font-black text-white bg-[#2E7D32] px-3 py-1.5 rounded-full">
                      مؤشر التشويق: {storyResult.agentReport.excitementScore}%
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Fluff Purge Examples */}
                <div className="p-4 bg-[#FFF8E1] rounded-xl border border-[#FFE082] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black text-[#F57F17]">
                    <AlertTriangle className="w-4 h-4" />
                    أمثلة لما تم حذفه واستئصاله من المط والوصف الميت:
                  </div>
                  <ul className="space-y-2">
                    {storyResult.agentReport.deletedFluffExamples?.map((item, idx) => (
                      <li key={idx} className="text-xs text-[#5D4037] flex items-start gap-2 leading-relaxed">
                        <span className="text-[#D32F2F] font-black shrink-0">✕</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-[#8D6E63] italic border-t border-[#FFE082] pt-2">
                    {storyResult.agentReport.editorAgentNotes}
                  </p>
                </div>

                {/* Softened Solid Words Table */}
                <div className="p-4 bg-[#E8F5E9] rounded-xl border border-[#A5D6A7] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black text-[#2E7D32]">
                    <Feather className="w-4 h-4" />
                    الكلمات الصلبة التي استُبدلت بألفاظ مصرية حية وسلسة:
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {storyResult.agentReport.softenedSolidWords?.map((wordItem, idx) => (
                      <div key={idx} className="bg-white p-2.5 rounded-lg border border-[#C8E6C9] text-xs">
                        <div className="flex items-center justify-between font-bold mb-1">
                          <span className="text-[#C62828] line-through">{wordItem.original}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-[#2E7D32]" />
                          <span className="text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.5 rounded">{wordItem.replacedWith}</span>
                        </div>
                        <p className="text-[10px] text-[#558B2F] leading-normal">{wordItem.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Hook Tightening note */}
              {storyResult.agentReport.hookTightening && (
                <div className="p-3.5 bg-[#FAF2EB] rounded-xl border border-[#EFE5DC] text-xs text-[#5D4037] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#8D6E63] shrink-0" />
                  <span><strong>صقل وتشديد الخطاف الافتتاحي:</strong> {storyResult.agentReport.hookTightening}</span>
                </div>
              )}
            </div>
          )}

          {/* SUB-VIEW 4: VIRAL YOUTUBE TITLES & PSYCHOLOGY LAB */}
          {activeResultSubTab === "titles" && (
            <div className="bg-white rounded-2xl p-6 border border-[#FFCC80] shadow-sm space-y-6">
              <div className="border-b border-[#ECE9E0] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#E65100] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Flame className="w-6 h-6 text-[#FFE082]" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-[#E65100] flex items-center gap-2">
                      مختبر عناوين يوتيوب وعلم النفس الفيروسي (أعلى نسبة نقر CTR)
                    </h4>
                    <p className="text-xs text-[#7D766D] mt-0.5">
                      4 زوايا سيكولوجية مصممة خصيصاً لمستمعي الرعب على يوتيوب، تعتمد على فجوة الفضول وإثارة الترقب.
                    </p>
                  </div>
                </div>
              </div>

              {(() => {
                const titlesList = storyResult.youtubeTitles || storyResult.titleOptions || [
                  storyResult.title,
                  `سر الرسالة الغامضة: ${storyResult.title}`,
                  `اللي حصل في البيت ده محدش يقدر يفسره`,
                  `ليلة المشهد الأخير: القصة التي غيرت كل شيء`
                ];
                const angleBadges = [
                  { 
                    label: "🔍 فضول غامض (Curiosity Gap)", 
                    color: "bg-[#E3F2FD] text-[#0D47A1] border-[#90CAF9]",
                    desc: "يترك سؤالاً حارقاً في عقل المشاهد لا يمكن الإجابة عليه إلا بسماع القصة." 
                  },
                  { 
                    label: "⚡ صدمة ومفارقة (High Stakes)", 
                    color: "bg-[#FFEBEE] text-[#C62828] border-[#FFCDD2]",
                    desc: "يركز على خطورة الحدث والتهديد الوجودي المباشر الذي واجه البطل." 
                  },
                  { 
                    label: "🎙️ تجربة شخصية واقعية", 
                    color: "bg-[#E8F5E9] text-[#2E7D32] border-[#A5D6A7]",
                    desc: "يخلق مصداقية حميمية كأن صديقاً مقرباً يروي كارثة حقيقية عاشها بنفسه." 
                  },
                  { 
                    label: "🎬 سينمائي وسيكولوجي", 
                    color: "bg-[#F3E5F5] text-[#6A1B9A] border-[#CE93D8]",
                    desc: "يخاطب عشاق الرعب النفسي الغامض والتحولات الدرامية غير المتوقعة." 
                  }
                ];

                const handleSelectTitle = (t: string) => {
                  setStoryResult({ ...storyResult, title: t });
                  localStorage.setItem("rawi_shared_title", t);
                  localStorage.setItem("rawi_imgmaker_title_text", t);
                };

                const handleSelectAndProceed = (t: string) => {
                  handleSelectTitle(t);
                  handleSendToProofreader();
                };

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {titlesList.map((t, idx) => {
                      const badge = angleBadges[idx % angleBadges.length];
                      const isSelected = storyResult.title === t;

                      return (
                        <div 
                          key={idx} 
                          className={`p-5 rounded-2xl border transition space-y-3.5 flex flex-col justify-between ${
                            isSelected 
                              ? "bg-[#FFF8E1] border-[#FFA000] shadow-sm ring-2 ring-[#FFA000]/30" 
                              : "bg-[#FAF9F6] border-[#ECE9E0] hover:border-[#FFA000]/50"
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-md border ${badge.color}`}>
                                {badge.label}
                              </span>
                              {isSelected && (
                                <span className="text-[10px] font-black text-[#E65100] bg-white px-2 py-0.5 rounded-full border border-[#FFA000] flex items-center gap-1">
                                  ✓ العنوان المعتمد حالياً
                                </span>
                              )}
                            </div>
                            <h5 className="text-sm font-black text-[#3E2723] leading-relaxed">
                              {t}
                            </h5>
                            <p className="text-[11px] text-[#7D766D] leading-relaxed">
                              {badge.desc}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-[#ECE9E0]">
                            <button
                              type="button"
                              onClick={() => handleSelectTitle(t)}
                              className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                                isSelected 
                                  ? "bg-[#FFA000] text-white font-black" 
                                  : "bg-white text-[#5D4037] border border-[#ECE9E0] hover:bg-[#FAF9F6]"
                              }`}
                            >
                              {isSelected ? "معتمد كعنوان للقصة ✓" : "اعتماد كعنوان رئيسي"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectAndProceed(t)}
                              className="px-3 py-2 bg-[#E65100] hover:bg-[#BF360C] text-white text-xs font-black rounded-xl transition shadow-xs flex items-center gap-1"
                              title="اعتماد العنوان والانتقال فوراً لتجهيز الغلاف"
                            >
                              <span>للغلاف</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* SUB-VIEW 5: REVERSE ARCHITECTURE & RE-LISTEN SHOCK */}
          {activeResultSubTab === "reverse_architecture" && (
            <div className="space-y-6">
              <div className="bg-[#FAF5FF] border border-[#E9D5FF] rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E9D5FF] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#6A1B9A] text-white flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-[#4A148C]">
                        هندسة النهاية أولاً وصدمة إعادة الاستماع (The Re-Listen Shock Engine)
                      </h4>
                      <p className="text-xs text-[#7B1FA2] mt-0.5">
                        «اكتب النهاية الأول وبعدين ابني القصة بحيث القارئ ميتوقعهاش بس لو رجع قراها تاني يلاقي كل حاجة كانت بتقول عليها من الأول»
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-[#6A1B9A] bg-[#F3E5F5] px-3.5 py-1.5 rounded-full border border-[#D1C4E9] self-start sm:self-auto">
                    إيقاع مصري شفاهي + كسر البنية
                  </span>
                </div>

                {/* 3 Strategic Pillars of the Reverse Story */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  
                  {/* Card 1: The Hidden Pre-Engineered Ending */}
                  <div className="p-4 rounded-xl bg-white border border-[#E9D5FF] space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-[#4A148C] flex items-center gap-1.5">
                        🎯 النهاية المحسومة مسبقاً
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F3E5F5] text-[#6A1B9A] border border-[#D1C4E9]">
                        كواليس التأليف
                      </span>
                    </div>
                    <p className="text-xs text-[#334155] leading-relaxed font-medium bg-[#FAF5FF] p-3 rounded-lg border border-[#F3E5F5]">
                      {storyResult.reverseEngineeredEnding || "تم حسم النهاية الصادمة كحادثة مادية غير متوقعة قبل صياغة المشهد الأول، لتوجه خيوط القصة بالكامل في الكواليس دون كشفها."}
                    </p>
                  </div>

                  {/* Card 2: Structural Subversion */}
                  <div className="p-4 rounded-xl bg-white border border-[#E9D5FF] space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-[#4A148C] flex items-center gap-1.5">
                        💥 كسر البنية المتوقعة
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD]">
                        ضد الكليشيه
                      </span>
                    </div>
                    <p className="text-xs text-[#334155] leading-relaxed font-medium bg-[#F0F9FF] p-3 rounded-lg border border-[#E0F2FE]">
                      {storyResult.structuralSubversionNotes || "هدم التوقع الكلاسيكي للرعب وتفادي السيناريوهات المحفوظة، مع بناء الأحداث على أخطاء وضعف بشري حقيقي يربك المستمع."}
                    </p>
                  </div>

                  {/* Card 3: Skeptical Auditor's Re-Listen Verdict */}
                  <div className="p-4 rounded-xl bg-white border border-[#E9D5FF] space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-[#4A148C] flex items-center gap-1.5">
                        🔍 تقييم إعادة الاستماع
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]">
                        المستمع الناقد
                      </span>
                    </div>
                    <p className="text-xs text-[#334155] leading-relaxed font-medium bg-[#F0FDF4] p-3 rounded-lg border border-[#DCFCE7]">
                      {storyResult.skepticalAuditorReport?.reListenTestVerdict || "تم فحص الأدلة وتماسكها بحيث لا يظهر أي تناقض منطقي عند إعادة الاستماع، بل تتجلى الحقيقة بوضوح مدهش."}
                    </p>
                  </div>

                </div>

                {/* Dual Clues Section (الأدلة ذات المعنى المزدوج) */}
                {storyResult.reListenDualClues && storyResult.reListenDualClues.length > 0 && (
                  <div className="bg-white rounded-xl p-4 border border-[#E9D5FF] space-y-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-[#F3E5F5] pb-2">
                      <span className="text-xs font-black text-[#4A148C] flex items-center gap-2">
                        🧩 شبكة الأدلة ذات المعنى المزدوج (Dual-Meaning Clues):
                      </span>
                      <span className="text-[10px] font-bold text-[#7B1FA2]">
                        {storyResult.reListenDualClues.length} أدلة مزروعة بذكاء
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {storyResult.reListenDualClues.map((clue, cIdx) => (
                        <div key={cIdx} className="p-3 bg-[#FAF5FF] rounded-lg border border-[#E9D5FF] flex items-start gap-2.5">
                          <span className="w-5 h-5 rounded-md bg-[#6A1B9A] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                            {cIdx + 1}
                          </span>
                          <div className="text-xs leading-relaxed text-[#3E2723]">
                            <p className="font-semibold">{clue}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-[#7B1FA2] italic pt-1">
                      💡 في الاستماع الأول: تمر هذه التفاصيل كأحداث روتينية طبيعية... لكن عند معرفة النهاية وإعادة الاستماع، يكتشف المستمع بذهول أنها كانت تشير للحقيقة من أول لحظة!
                    </p>
                  </div>
                )}

              </div>
            </div>
          )}

        </div>
      )}

      {/* SECOND BRAIN (العقل الثاني) MODAL */}
      {showSecondBrain && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-[#ECE9E0] overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-[#FAF2EB] border-b border-[#EFE5DC] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#8D6E63] text-white flex items-center justify-center font-black">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-[#3E2723]">
                    ذاكرة العقل الثاني للمشروع (Second Brain Memory)
                  </h4>
                  <p className="text-[11px] text-[#7D766D]">
                    القواعد الحاكمة المحفوظة التي يتعلم منها الوكلاء وتوجه كل توليد للقصص
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSecondBrain(false)}
                className="w-8 h-8 rounded-lg bg-white/80 hover:bg-white text-[#7D766D] hover:text-[#3E2723] flex items-center justify-center font-black text-sm border border-[#EFE5DC]"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="p-3 bg-[#FFF8E1] rounded-xl border border-[#FFE082] text-xs text-[#E65100] space-y-1">
                <p className="font-bold">💡 كيف يعمل العقل الثاني؟</p>
                <p className="text-[11px] text-[#795548] leading-relaxed">
                  يتم حقن هذه القواعد بشكل دائم في عقل الوكلاء الثلاثة (المخطط، الحكواتي، والمدقق). أي تعديل تكتبه هنا أو كلمة محظورة تضيفها سيتم حفظها وتطبيقها تلقائياً على كل القصص القادمة!
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-[#5D4037] block mb-1.5">
                  ملف القواعد الحاكمة الدائم (AGENTS.md / GEMINI.md):
                </label>
                <textarea
                  rows={14}
                  value={secondBrainContent}
                  onChange={(e) => setSecondBrainContent(e.target.value)}
                  className="w-full p-3.5 bg-[#FAF9F6] rounded-xl border border-[#ECE9E0] text-xs font-mono leading-relaxed text-[#3E2723] focus:outline-none focus:ring-2 focus:ring-[#8D6E63] resize-none"
                  placeholder="جاري تحميل ذاكرة العقل الثاني..."
                />
              </div>

              {brainSaveSuccess && (
                <div className="p-3 bg-[#E8F5E9] text-[#2E7D32] rounded-lg border border-[#C8E6C9] text-xs font-black flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تم حفظ وتحديث ذاكرة العقل الثاني بنجاح! جميع الوكلاء يلتزمون بهذه القواعد الآن.</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#FAF9F6] border-t border-[#ECE9E0] flex items-center justify-between gap-3">
              <span className="text-[11px] text-[#7D766D]">
                تطبيق فوري على التوليدات القادمة
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSecondBrain(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#7D766D] hover:bg-[#FAF2EB]"
                >
                  إغلاق
                </button>
                <button
                  type="button"
                  onClick={handleSaveSecondBrain}
                  disabled={isSavingBrain}
                  className="px-5 py-2 bg-[#8D6E63] hover:bg-[#6D4C41] text-white text-xs font-black rounded-xl transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingBrain ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{isSavingBrain ? "جاري الحفظ..." : "حفظ القواعد في العقل الثاني"}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
