import { useState } from "react";
import { 
  Settings, Key, Youtube, Plus, Trash2, Pin, CheckCircle2, 
  HelpCircle, Eye, EyeOff, Sparkles, TrendingUp, Compass, Award, ShieldAlert,
  RefreshCw, ShieldCheck, XCircle, Loader2
} from "lucide-react";

interface SettingsTabProps {
  competitorChannels: string[];
  setCompetitorChannels: (channels: string[]) => void;
  myChannelLink: string;
  setMyChannelLink: (link: string) => void;
  backupApiKey: string;
  setBackupApiKey: (key: string) => void;
}

export default function SettingsTab({
  competitorChannels,
  setCompetitorChannels,
  myChannelLink,
  setMyChannelLink,
  backupApiKey,
  setBackupApiKey
}: SettingsTabProps) {
  const [newCompetitor, setNewCompetitor] = useState("");
  const [channelInput, setChannelInput] = useState(myChannelLink);
  const [newKeyInput, setNewKeyInput] = useState("");
  const [keysList, setKeysList] = useState<string[]>(() => {
    if (!backupApiKey) return [];
    return backupApiKey.split(",").map(k => k.trim()).filter(Boolean);
  });
  const [showKeyIndexes, setShowKeyIndexes] = useState<Record<number, boolean>>({});
  const [isSavedMyChannel, setIsSavedMyChannel] = useState(false);
  const [isSavedKey, setIsSavedKey] = useState(false);

  // States for API key validation
  const [isTestingNewKey, setIsTestingNewKey] = useState(false);
  const [newKeyTestResult, setNewKeyTestResult] = useState<{ success: boolean; message: string; tested: boolean } | null>(null);
  const [testingIndexes, setTestingIndexes] = useState<Record<number, boolean>>({});
  const [validationStatuses, setValidationStatuses] = useState<Record<number, { success: boolean; message: string; tested: boolean }>>({});

  const handleTestNewKey = async () => {
    const trimmed = newKeyInput.trim();
    if (!trimmed) {
      alert("الرجاء إدخال مفتاح API أولاً لتجربته!");
      return;
    }

    setIsTestingNewKey(true);
    setNewKeyTestResult({ success: false, message: "جاري الاتصال بالخادم وفحص صلاحية المفتاح...", tested: false });

    try {
      const response = await fetch("/api/test-api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: trimmed })
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        setNewKeyTestResult({
          success: true,
          message: data.message || "المفتاح شغال بنسبة 100% ومستعد للاستخدام!",
          tested: true
        });
      } else {
        setNewKeyTestResult({
          success: false,
          message: data.error || "المفتاح غير صالح أو معطل.",
          tested: true
        });
      }
    } catch (err) {
      setNewKeyTestResult({
        success: false,
        message: "فشل فحص المفتاح بسبب مشكلة في الاتصال بالخادم.",
        tested: true
      });
    } finally {
      setIsTestingNewKey(false);
    }
  };

  const handleTestKey = async (index: number, customList?: string[]) => {
    const list = customList || keysList;
    const keyToTest = list[index];
    if (!keyToTest) return;

    setTestingIndexes(prev => ({ ...prev, [index]: true }));
    setValidationStatuses(prev => ({
      ...prev,
      [index]: { success: false, message: "جاري فحص حالة المفتاح والاتصال بالخادم...", tested: false }
    }));

    try {
      const response = await fetch("/api/test-api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: keyToTest })
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        setValidationStatuses(prev => ({
          ...prev,
          [index]: { success: true, message: data.message || "المفتاح شغال ومترابط ومستعد للاستخدام!", tested: true }
        }));
      } else {
        setValidationStatuses(prev => ({
          ...prev,
          [index]: { success: false, message: data.error || "مفتاح الـ API هذا غير صالح أو معطل.", tested: true }
        }));
      }
    } catch (err: any) {
      setValidationStatuses(prev => ({
        ...prev,
        [index]: { success: false, message: "فشل الاتصال بالخادم لفحص المفتاح.", tested: true }
      }));
    } finally {
      setTestingIndexes(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleAddCompetitor = () => {
    if (!newCompetitor.trim()) return;
    if (competitorChannels.includes(newCompetitor.trim())) {
      alert("رابط القناة مضاف بالفعل!");
      return;
    }
    setCompetitorChannels([...competitorChannels, newCompetitor.trim()]);
    setNewCompetitor("");
  };

  const handleRemoveCompetitor = (link: string) => {
    setCompetitorChannels(competitorChannels.filter((c) => c !== link));
  };

  const handleSaveMyChannel = () => {
    setMyChannelLink(channelInput.trim());
    setIsSavedMyChannel(true);
    setTimeout(() => setIsSavedMyChannel(false), 2500);
  };

  const handleAddKey = () => {
    const trimmed = newKeyInput.trim();
    if (!trimmed) return;
    if (keysList.includes(trimmed)) {
      alert("مفتاح API هذا مضاف بالفعل في القائمة!");
      return;
    }
    const updated = [...keysList, trimmed];
    const newIndex = updated.length - 1;

    // Carry over tested result if already checked
    if (newKeyTestResult && newKeyTestResult.tested) {
      setValidationStatuses(prev => ({
        ...prev,
        [newIndex]: {
          success: newKeyTestResult.success,
          message: newKeyTestResult.message,
          tested: true
        }
      }));
    }

    setKeysList(updated);
    setBackupApiKey(updated.join(","));
    setNewKeyInput("");
    setNewKeyTestResult(null); // Reset input validation feedback banner
    setIsSavedKey(true);
    setTimeout(() => setIsSavedKey(false), 2500);

    // If not checked, trigger automatic test for it right away
    if (!newKeyTestResult || !newKeyTestResult.tested) {
      setTimeout(() => {
        handleTestKey(newIndex, updated);
      }, 150);
    }
  };

  const handleRemoveKey = (index: number) => {
    const updated = keysList.filter((_, i) => i !== index);
    setKeysList(updated);
    setBackupApiKey(updated.join(","));
    setIsSavedKey(true);
    setTimeout(() => setIsSavedKey(false), 2500);
  };

  const toggleShowKeyIndex = (index: number) => {
    setShowKeyIndexes(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const maskKey = (key: string) => {
    if (key.length <= 12) return "••••••••••••";
    return `${key.slice(0, 7)}••••••••${key.slice(-5)}`;
  };

  return (
    <div className="space-y-8" id="settings-tab">
      
      {/* 1. Backup API Key Section */}
      <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm space-y-4">
        <div className="flex justify-between items-start flex-wrap gap-2">
          <div>
            <h3 className="text-md font-black text-[#3E2723] flex items-center gap-2">
              <Key className="w-5 h-5 text-[#8D6E63]" />
              إدارة مفاتيح API الفعّالة والتناوب التلقائي (API Key Rotation)
            </h3>
            <p className="text-xs text-[#7D766D] leading-relaxed mt-1">
              أدخل مفتاحاً أو قائمة مفاتيح Gemini API الخاصة بك هنا. سيقوم النظام باعتماد هذه المفاتيح في طلباتك بالترتيب التنازلي للتناوب والتكرار؛ وفي حال انتهاء حصة مفتاح، ينتقل فوراً للمفتاح التالي تلقائياً، وإذا انتهت جميعها يرجع للعمل بالمفتاح الأصلي للسيرفر كخط دفاع أخير!
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#E8F5E9] text-[#2E7D32]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF50] animate-pulse"></span>
            نظام التناوب الذكي نشط
          </span>
        </div>

        {/* New key input input */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 min-w-[200px]">
              <input 
                type="text" 
                placeholder="أضف مفتاح API جديد يبدأ بـ AIzaSy..." 
                value={newKeyInput}
                onChange={(e) => {
                  setNewKeyInput(e.target.value);
                  setNewKeyTestResult(null);
                }}
                className="w-full pl-4 pr-4 py-2.5 rounded-lg border border-[#ECE9E0] bg-[#FAF9F6] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#8D6E63]"
                onKeyDown={(e) => e.key === "Enter" && handleAddKey()}
              />
            </div>
            
            <button
              onClick={handleTestNewKey}
              disabled={isTestingNewKey || !newKeyInput.trim()}
              className="px-4 py-2.5 bg-[#FAF2EB] border border-[#EFE5DC] text-[#5D4037] hover:bg-[#EFE5DC] disabled:opacity-50 text-xs font-bold rounded-lg transition flex items-center gap-1.5 flex-shrink-0"
              title="فحص صلاحية هذا المفتاح والاتصال بالخادم قبل إضافته"
            >
              {isTestingNewKey ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              فحص المفتاح
            </button>

            <button
              onClick={handleAddKey}
              className="px-5 py-2.5 bg-[#8D6E63] text-white text-xs font-bold rounded-lg hover:bg-[#7D5E53] transition flex items-center gap-1.5 flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              إضافة مفتاح
            </button>
          </div>

          {/* Test results for the typed key */}
          {newKeyTestResult && (
            <div className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 transition-all animate-pulse ${
              newKeyTestResult.success 
                ? "bg-[#E8F5E9] border-[#C8E6C9] text-[#2E7D32]" 
                : "bg-[#FFEBEE] border-[#FFCDD2] text-[#C62828]"
            }`}>
              {newKeyTestResult.success ? (
                <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#2E7D32]" />
              ) : (
                <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#C62828]" />
              )}
              <div>
                <p className="font-bold">{newKeyTestResult.success ? "✓ المفتاح يعمل والاتصال سليم!" : "✗ فشل فحص صلاحية المفتاح"}</p>
                <p className="mt-1 opacity-90 leading-relaxed text-[11px]">{newKeyTestResult.message}</p>
              </div>
            </div>
          )}
        </div>

        {/* List of currently active keys */}
        {keysList.length > 0 ? (
          <div className="space-y-3 mt-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <span className="text-[11px] font-bold text-[#8D6E63] block">🔑 المفاتيح المحفوظة وترتيب الأولوية للتناوب:</span>
              <button
                type="button"
                onClick={async () => {
                  for (let i = 0; i < keysList.length; i++) {
                    await handleTestKey(i);
                  }
                }}
                className="text-[10px] font-black text-[#8D6E63] hover:text-[#5D4037] hover:bg-[#FAF2EB] transition flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#EFE5DC] bg-[#FAF9F6]"
                title="فحص واختبار جميع المفاتيح المحفوظة في القائمة للتأكد من اتصالها"
              >
                <RefreshCw className="w-3 h-3" />
                فحص صلاحية كل المفاتيح دفعة واحدة
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2.5 max-h-[350px] overflow-y-auto">
              {keysList.map((key, idx) => (
                <div key={idx} className="flex flex-col p-3 bg-[#FAF9F6] border border-[#ECE9E0] rounded-xl text-xs space-y-2">
                  <div className="flex justify-between items-center flex-wrap sm:flex-nowrap gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="w-5 h-5 rounded-full bg-[#EFEBE9] text-[#5D4037] font-black flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="font-mono text-[#4E342E] font-semibold text-xs tracking-wider">
                        {showKeyIndexes[idx] ? key : maskKey(key)}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#EFEBE9] text-[#5D4037]">
                        {idx === 0 ? "الأولى بالاعتماد" : `الاحتياطي رقم ${idx}`}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1 flex-shrink-0 mr-auto">
                      {/* Key status indicator if tested */}
                      {validationStatuses[idx] && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          validationStatuses[idx].success 
                            ? "bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]" 
                            : "bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]"
                        }`} title={validationStatuses[idx].message}>
                          {validationStatuses[idx].success ? <ShieldCheck className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {validationStatuses[idx].success ? "شغال ومتصل" : "معطل / غير صالح"}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleTestKey(idx)}
                        disabled={testingIndexes[idx]}
                        className="p-1.5 text-[#5D4037] hover:text-[#3E2723] rounded hover:bg-[#EFEBE9] disabled:opacity-50"
                        title="اختبار الاتصال وصلاحية هذا المفتاح الآن"
                      >
                        {testingIndexes[idx] ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleShowKeyIndex(idx)}
                        className="p-1.5 text-[#7D766D] hover:text-[#3E2723] rounded hover:bg-[#EFEBE9]"
                        title="عرض/إخفاء المفتاح"
                      >
                        {showKeyIndexes[idx] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => handleRemoveKey(idx)}
                        className="p-1.5 text-[#D32F2F] hover:text-[#C62828] rounded hover:bg-[#FFEBEE]"
                        title="حذف المفتاح"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Detailed error/success message under the key if tested */}
                  {validationStatuses[idx] && (
                    <div className={`p-2 rounded text-[11px] leading-relaxed border ${
                      validationStatuses[idx].success 
                        ? "bg-[#E8F5E9]/50 border-[#C8E6C9]/40 text-[#2E7D32]" 
                        : "bg-[#FFEBEE]/50 border-[#FFCDD2]/40 text-[#C62828]"
                    }`}>
                      {validationStatuses[idx].message}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {isSavedKey && (
              <p className="text-[11px] font-bold text-[#2E7D32] flex items-center gap-1 justify-end animate-pulse">
                <CheckCircle2 className="w-3.5 h-3.5" />
                تم حفظ التغييرات وتحديث قائمة المفاتيح بنجاح!
              </p>
            )}
          </div>
        ) : (
          <div className="p-4 bg-[#FFFDE7] rounded-xl border border-[#FFF9C4] text-xs text-[#F57F17] flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-bold">لا يوجد مفاتيح مضافة حالياً</p>
              <p className="mt-0.5 text-[#7D766D] leading-relaxed">
                يعمل التطبيق حالياً بالكامل على حساب الخادم الافتراضي المشترك. ننصحك بإضافة مفتاح API احتياطي أو أكثر لضمان عدم توقف عملياتك في فترات ذروة الاستهلاك.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* 2. Pin my own channel */}
        <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm space-y-4">
          <h3 className="text-md font-bold text-[#3E2723] flex items-center gap-2">
            <Pin className="w-5 h-5 text-[#8D6E63]" />
            تثبيت قناتي لليوتيوب ومتابعة الأخبار
          </h3>
          <p className="text-xs text-[#7D766D] leading-relaxed">
            ثبّت رابط قناتك الرئيسي لتجعل الذكاء الاصطناعي على دراية كاملة بأبعاد هويتك السردية وتقديم نصائح وتحديثات مستمرة تهم جمهورك بالذات.
          </p>

          <div className="space-y-3">
            <input 
              type="text" 
              placeholder="أدخل رابط قناتك وتثبيته..." 
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-[#ECE9E0] bg-[#FAF9F6] text-xs focus:outline-none focus:ring-2 focus:ring-[#8D6E63]"
            />
            <button
              onClick={handleSaveMyChannel}
              className="w-full py-2 bg-[#8D6E63] hover:bg-[#7D5E53] text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1"
            >
              {isSavedMyChannel ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#A5D6A7]" />
                  تم تثبيت وحفظ رابط قناتك بنجاح!
                </>
              ) : (
                "تثبيت وحفظ قناتي كمرجع"
              )}
            </button>
          </div>

          {/* Dynamic Feed based on Pinned Channel */}
          {myChannelLink && (
            <div className="pt-4 border-t border-[#ECE9E0] space-y-3">
              <span className="text-xs font-black text-[#8D6E63] block">📡 آخر تحديثات وتوصيات قناتك المثبتة:</span>
              <div className="p-3.5 bg-[#FAF2EB] rounded-lg border border-[#EFE5DC] text-[11px] text-[#5D4037] space-y-2">
                <p className="font-bold text-[#3E2723] flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-[#2E7D32]" />
                  نصيحة أسبوعية مخصصة لقناتك:
                </p>
                <p className="leading-relaxed font-semibold">
                  بناءً على رابط قناتك المثبت ({myChannelLink})، نقترح التركيز على تحسين جودة النصف الثاني من القصص عبر زيادة وتكثيف الفواصل الصوتية للـ Foley (صرير باب، صوت رياح) للحفاظ على الجمهور وتجنب انخفاض معدل الاحتفاظ بـ (Audience Retention) بعد الدقيقة الثامنة.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 3. Manage Saved Competitors / Reference Channels */}
        <div className="bg-white rounded-xl p-6 border border-[#ECE9E0] shadow-sm space-y-4">
          <h3 className="text-md font-bold text-[#3E2723] flex items-center gap-2">
            <Youtube className="w-5 h-5 text-[#D32F2F]" />
            إدارة قنوات المراجع والمنافسين ({competitorChannels.length})
          </h3>
          <p className="text-xs text-[#7D766D] leading-relaxed">
            أضف أو احذف قنوات يوتيوب المرجعية التي تود محاكاة أسلوب سردها وجودتها الفنية والصوتية.
          </p>

          {/* Add input */}
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="مثال: https://youtube.com/@channel..." 
              value={newCompetitor}
              onChange={(e) => setNewCompetitor(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-[#ECE9E0] bg-[#FAF9F6] text-xs focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && handleAddCompetitor()}
            />
            <button
              onClick={handleAddCompetitor}
              className="px-4 py-2 bg-[#8D6E63] hover:bg-[#7D5E53] text-white text-xs font-bold rounded-lg transition flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> إضافة
            </button>
          </div>

          {/* List of saved reference channels */}
          <div className="space-y-2 max-h-[220px] overflow-y-auto">
            {competitorChannels.map((link) => (
              <div key={link} className="flex justify-between items-center p-2.5 bg-[#FAF9F6] border border-[#ECE9E0] rounded-lg text-xs">
                <span className="font-mono text-[#5D4037] truncate flex-1 block max-w-[80%]">{link}</span>
                <button
                  onClick={() => handleRemoveCompetitor(link)}
                  className="text-[#D32F2F] hover:text-[#C62828] p-1 rounded hover:bg-[#FFEBEE] transition"
                  title="حذف القناة من المراجع"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {competitorChannels.length === 0 && (
              <p className="text-center text-xs text-[#9E9E9E] py-4">لا توجد قنوات مرجعية مضافة حالياً.</p>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
