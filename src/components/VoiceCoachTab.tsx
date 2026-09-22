import { useState, useRef, useEffect } from "react";
import { 
  Mic, Square, Play, RefreshCw, Sparkles, Award, 
  Volume2, ShieldAlert, CheckCircle, Headphones, ArrowUpRight, 
  Settings, UserCheck, AlertCircle, Trash2, FileAudio
} from "lucide-react";
import { VoiceAnalysisResult } from "../types";

interface VoiceCoachTabProps {
  myChannelLink: string;
  backupApiKey?: string;
}

export default function VoiceCoachTab({ 
  myChannelLink,
  backupApiKey
}: VoiceCoachTabProps) {
  const [voiceDescription, setVoiceDescription] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioMime, setAudioMime] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<VoiceAnalysisResult | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Clean up recording timers
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setAudioMime("audio/webm");

        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          // Extract base64 payload
          const base64String = base64data.split(",")[1];
          setAudioBase64(base64String);
        };

        // Stop all tracks on the stream to release the mic
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Mic access failed", err);
      alert("تعذر الوصول إلى الميكروفون. يرجى تفعيل إذن الميكروفون في متصفحك أولاً.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleDeleteRecording = () => {
    setAudioUrl(null);
    setAudioBase64(null);
    setAudioMime(null);
    setRecordingDuration(0);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioMime(file.type || "audio/mp3");
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const base64data = event.target.result as string;
          setAudioBase64(base64data.split(",")[1]);
          setAudioUrl(URL.createObjectURL(file));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyzeVoice = async () => {
    setIsLoading(true);
    try {
      const payload = {
        audioData: audioBase64,
        mimeType: audioMime,
        channelLink: myChannelLink,
        voiceDescription: voiceDescription
      };

      const response = await fetch("/api/analyze-voice", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-custom-gemini-key": backupApiKey || ""
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("فشل في تحليل المقطع الصوتي للراوي");
      const data: VoiceAnalysisResult = await response.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الاتصال بمُدرب الصوت لتقييم أدائك.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="space-y-8" id="voice-coach-tab">
      
      {/* Recording card */}
      <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm">
        <h3 className="text-lg font-bold text-[#3E2723] mb-4 flex items-center gap-2">
          <Mic className="w-6 h-6 text-[#8D6E63]" />
          مُدرب الإلقاء الصوتي وهندسة صوتك الشخصي (Vocal Coach)
        </h3>
        <p className="text-sm text-[#7D766D] mb-6">
          قم بتسجيل مقطع قصير بصوتك وأنت تقرأ جزءاً من قصتك (أو ارفع ملفاً صوتياً جاهزاً). سيقوم الذكاء الاصطناعي بتحليل سرعة إلقائك، ونبرة تشويقك، ونقاء ميكروفونك وغرفتك، ومن ثم إعطائك نصائح ذهبية لتطوير مهارات الإلقاء، بالإضافة إلى بريسيت فلاتر أوديشين مصمم ومخصص لتكبير جودة صوتك الشخصي بالذات!
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Recorder Controls */}
          <div className="flex flex-col justify-center items-center p-6 bg-[#FAF9F6] border border-[#ECE9E0] rounded-xl space-y-4">
            
            {/* Visualizer & Time representation */}
            <div className="text-center">
              <span className="text-xs text-[#8D6E63] font-bold block mb-1">مسجل الصوت المباشر للتدريب</span>
              <div className="text-2xl font-mono font-bold text-[#3E2723]">
                {formatTime(recordingDuration)}
              </div>
              
              {isRecording && (
                <div className="flex items-center gap-1 justify-center mt-2">
                  <span className="w-1.5 h-3 bg-[#D32F2F] animate-bounce delay-75 rounded-full" />
                  <span className="w-1.5 h-4 bg-[#D32F2F] animate-bounce delay-100 rounded-full" />
                  <span className="w-1.5 h-5 bg-[#D32F2F] animate-bounce delay-150 rounded-full" />
                  <span className="w-1.5 h-3 bg-[#D32F2F] animate-bounce delay-200 rounded-full" />
                  <span className="w-1.5 h-1.5 bg-[#D32F2F] animate-bounce rounded-full" />
                </div>
              )}
            </div>

            {/* Mic buttons toggle */}
            <div className="flex gap-4 items-center">
              {!isRecording ? (
                <button 
                  onClick={startRecording}
                  disabled={isLoading}
                  className="w-14 h-14 bg-[#D32F2F] hover:bg-[#C62828] text-white rounded-full flex items-center justify-center transition shadow-lg hover:scale-105 active:scale-95 flex-shrink-0"
                  title="ابدأ تسجيل صوتك"
                >
                  <Mic className="w-6 h-6 animate-pulse" />
                </button>
              ) : (
                <button 
                  onClick={stopRecording}
                  className="w-14 h-14 bg-[#3E2723] hover:bg-[#1E1B15] text-white rounded-full flex items-center justify-center transition shadow-lg hover:scale-105 active:scale-95 flex-shrink-0"
                  title="إيقاف وحفظ"
                >
                  <Square className="w-5 h-5" />
                </button>
              )}

              {/* Upload file fallback option */}
              <div className="relative">
                <input 
                  type="file" 
                  accept="audio/*" 
                  onChange={handleFileUpload}
                  className="hidden" 
                  id="vocal-file"
                />
                <label 
                  htmlFor="vocal-file"
                  className="px-4 py-2 bg-white border border-[#ECE9E0] text-xs font-bold rounded-lg cursor-pointer hover:bg-[#FAF2EB] transition flex items-center gap-1.5"
                >
                  <FileAudio className="w-4 h-4 text-[#8D6E63]" />
                  رفع ملف صوتي (.mp3, .wav)
                </label>
              </div>
            </div>

            {/* Audio URL Preview & Actions */}
            {audioUrl && (
              <div className="w-full space-y-3 pt-4 border-t border-[#ECE9E0]">
                <audio src={audioUrl} controls className="w-full h-10 accent-[#8D6E63]" />
                <div className="flex justify-between items-center">
                  <button 
                    onClick={handleDeleteRecording}
                    className="text-xs text-[#D32F2F] hover:underline flex items-center gap-1 font-bold"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> حذف التسجيل الحالي
                  </button>
                  <span className="text-[10px] text-[#9E9E9E]">التسجيل جاهز للتحليل الفني</span>
                </div>
              </div>
            )}
          </div>

          {/* Self description block */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[#8D6E63] block mb-1.5">أو صف إلقاءك الصوتي وعيوب ميكروفونك يدوياً (اختياري)</label>
              <textarea 
                rows={5}
                placeholder="مثال: أسجل بمايك ديناميكي رخيص، أواجه مشكلة في تكرار أنفاسي بصوت مسموع، وأشعر أن نبرتي سريعة ورتيبة أثناء قراءة قصص الغموض..."
                value={voiceDescription}
                onChange={(e) => setVoiceDescription(e.target.value)}
                className="w-full p-4 rounded-lg border border-[#ECE9E0] bg-[#FCFBF9] text-xs focus:outline-none focus:ring-2 focus:ring-[#8D6E63] leading-relaxed resize-none"
              />
            </div>

            <div className="p-3 bg-[#FAF2EB] rounded-lg border border-[#EFE5DC] text-[11px] text-[#8D6E63]">
              📍 سيقيس المدرب أداءك بالاعتماد على قناتك المستهدفة: <strong>{myChannelLink || "الافتراضية"}</strong> ليتماشى الصوت تماماً مع طموحات جمهورك.
            </div>

            <button 
              onClick={handleAnalyzeVoice}
              disabled={isLoading || (!audioBase64 && !voiceDescription.trim())}
              className="w-full py-2.5 bg-[#8D6E63] text-white font-bold rounded-lg text-sm hover:bg-[#7D5E53] transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  جاري تقييم وتشريح صوتك...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  تحليل خامة صوتي وتوليد الفلاتر المخصصة
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* Analysis & Presets results */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Coaching Analysis (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Vocal Analysis & Advice */}
            <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm">
              <h4 className="text-md font-bold text-[#3E2723] mb-4 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#8D6E63]" />
                مراجعة خامة صوتك وطريقة سردك (Vocal Delivery Audit)
              </h4>
              <div className="p-4 bg-[#FAF9F6] rounded-lg border border-[#ECE9E0] text-sm text-[#5D4037] leading-relaxed mb-6 font-medium">
                {result.vocalAnalysis}
              </div>

              {/* Coaching Tips checklist */}
              <div>
                <span className="text-xs font-bold text-[#8D6E63] block mb-3">نصائح وتدريبات عملية لتطوير الإلقاء وإحكام النفس:</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {result.coachingTips.map((tip, idx) => (
                    <div key={idx} className="flex gap-2 text-xs text-[#5D4037] bg-[#FAF9F6] p-3 rounded-lg border border-[#ECE9E0] font-medium">
                      <ArrowUpRight className="w-4 h-4 text-[#8D6E63] flex-shrink-0" />
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Personalized Adobe Audition Settings for their unique voice qualities */}
            <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm">
              <h4 className="text-md font-bold text-[#3E2723] mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#2E7D32]" />
                بريسيت أوديشين الموصى به لخصائص صوتك الشخصي (Custom Voice Preset)
              </h4>
              <p className="text-xs text-[#7D766D] mb-4">
                قمنا بتصميم هذا البريسيت وخطوات المعالجة الصوتية خصيصاً لتصحيح عيوب نبرتك أو مايكروفونك ولإعطاء صوتك دفئاً إذاعياً عميقاً ومحترفاً:
              </p>
              
              <div className="p-4 bg-[#E8F5E9] border border-[#C8E6C9] rounded-lg">
                <span className="text-xs font-bold text-[#2E7D32] block mb-2">اسم البريسيت: <strong className="text-sm">{result.customAuditionPreset.title}</strong></span>
                <div className="space-y-2">
                  {result.customAuditionPreset.steps.map((step, idx) => (
                    <div key={idx} className="text-xs text-[#1B5E20] font-semibold bg-white/60 p-2.5 rounded border border-[#C8E6C9]">
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar scores and Pros/Cons (1 col) */}
          <div className="space-y-6">
            
            {/* Scores indicator card */}
            <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm text-center">
              <h4 className="text-sm font-bold text-[#3E2723] mb-4">تقييم النبرة والظروف الفنية</h4>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Score 1 */}
                <div className="p-3 bg-[#FAF9F6] rounded-lg border border-[#ECE9E0]">
                  <span className="text-[10px] text-[#7D766D] font-bold block mb-1">تقييم الإلقاء</span>
                  <div className="text-xl font-black text-[#8D6E63]">{result.deliveryScore} <span className="text-[10px] text-[#9E9E9E]">/ 10</span></div>
                </div>

                {/* Score 2 */}
                <div className="p-3 bg-[#FAF9F6] rounded-lg border border-[#ECE9E0]">
                  <span className="text-[10px] text-[#7D766D] font-bold block mb-1">جودة المايك/الغرفة</span>
                  <div className="text-xl font-black text-[#8D6E63]">{result.audioQualityScore} <span className="text-[10px] text-[#9E9E9E]">/ 10</span></div>
                </div>
              </div>
            </div>

            {/* Pros & Cons card */}
            <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm space-y-6">
              
              {/* Pros */}
              <div>
                <span className="text-xs font-bold text-[#2E7D32] block mb-2 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> محاسن نبرتك وصوتك
                </span>
                <div className="space-y-1.5">
                  {result.prosAndCons.pros.map((p, i) => (
                    <div key={i} className="p-2 bg-[#E8F5E9] text-[#2E7D32] text-xs font-semibold rounded border border-[#C8E6C9]">
                      ✓ {p}
                    </div>
                  ))}
                </div>
              </div>

              <hr className="border-[#ECE9E0]" />

              {/* Cons */}
              <div>
                <span className="text-xs font-bold text-[#D32F2F] block mb-2 flex items-center gap-1">
                  <ShieldAlert className="w-4 h-4" /> عيوب فنية تحتاج تحسين
                </span>
                <div className="space-y-1.5">
                  {result.prosAndCons.cons.map((c, i) => (
                    <div key={i} className="p-2 bg-[#FFEBEE] text-[#C62828] text-xs font-semibold rounded border border-[#FFCDD2]">
                      ⚠ {c}
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
