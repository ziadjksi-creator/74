import { useState, useEffect } from "react";
import { 
  Sparkles, FileText, Youtube, Clapperboard, BookOpen, 
  Sliders, Mic, Star, Heart, ExternalLink, Moon, HelpCircle,
  Image as ImageIcon, Settings, Key
} from "lucide-react";

import StoryPrepTab from "./components/StoryPrepTab";
import ChannelAnalyzerTab from "./components/ChannelAnalyzerTab";
import TeaserTab from "./components/TeaserTab";
import StoryBuilderTab from "./components/StoryBuilderTab";
import AuditionTab from "./components/AuditionTab";
import VoiceCoachTab from "./components/VoiceCoachTab";
import ImageMakerTab from "./components/ImageMakerTab";
import SettingsTab from "./components/SettingsTab";
import StoryReferencesTab from "./components/StoryReferencesTab";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      return localStorage.getItem("rawi_active_tab") || "story-builder";
    } catch {
      return "story-builder";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("rawi_active_tab", activeTab);
    } catch {
      // ignore
    }
  }, [activeTab]);
  
  // Shared injected reference data for StoryBuilder
  const [injectedReference, setInjectedReference] = useState<{
    concept: string;
    genre?: string;
    pacingStyle?: string;
    notes?: string;
    referenceFocus?: string;
  } | null>(null);
  
  // Shared States (saved in localStorage for seamless persistence across sessions)
  const [competitorChannels, setCompetitorChannels] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("rawi_competitors");
      return saved ? JSON.parse(saved) : [
        "https://youtube.com/@m_abdelhady", // Example default storyteller
        "https://youtube.com/@shady_moro"
      ];
    } catch {
      return [];
    }
  });

  const [myChannelLink, setMyChannelLink] = useState<string>(() => {
    return localStorage.getItem("rawi_my_channel") || "https://youtube.com/@my_storytelling_channel";
  });

  // Shared story state so Tab 4 can send stories to Tab 1 & Tab 3 & Image Tab
  const [sharedStoryText, setSharedStoryText] = useState<string>(() => {
    return localStorage.getItem("rawi_shared_story") || "";
  });

  // Custom Backup API Key state for failover
  const [backupApiKey, setBackupApiKey] = useState<string>(() => {
    return localStorage.getItem("rawi_backup_api_key") || "";
  });

  // Persist states
  useEffect(() => {
    localStorage.setItem("rawi_competitors", JSON.stringify(competitorChannels));
  }, [competitorChannels]);

  useEffect(() => {
    localStorage.setItem("rawi_my_channel", myChannelLink);
  }, [myChannelLink]);

  useEffect(() => {
    localStorage.setItem("rawi_shared_story", sharedStoryText);
  }, [sharedStoryText]);

  useEffect(() => {
    localStorage.setItem("rawi_backup_api_key", backupApiKey);
  }, [backupApiKey]);

  // Handler to receive story from Creator tab (Tab 4) or update from Proofread
  const handleStoryUpdate = (text: string) => {
    setSharedStoryText(text);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FCFBF9] text-[#1E1B15] selection:bg-[#EFE5DC] selection:text-[#5D4037]">
      
      {/* Top Professional Elegant Header */}
      <header className="bg-white border-b border-[#ECE9E0] sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          
          {/* Logo & Slogan */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#8D6E63] rounded-xl flex items-center justify-center shadow-md">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-[#3E2723] flex items-center gap-2">
                راوي <span className="text-xs bg-[#FAF2EB] text-[#8D6E63] px-2 py-0.5 rounded border border-[#EFE5DC] font-black">نسخة المحترفين</span>
              </h1>
              <p className="text-[11px] text-[#7D766D] font-semibold">المساعد الذكي المتكامل لمقدمي ومؤلفي قصص اليوتيوب الصوتية</p>
            </div>
          </div>

          {/* Quick metrics banner / stats / My Channel Pinned indicator */}
          <div className="flex items-center gap-4 flex-wrap">
            {myChannelLink && (
              <div className="text-[11px] bg-[#E8F5E9] text-[#2E7D32] px-3 py-1.5 rounded-lg border border-[#C8E6C9] font-black flex items-center gap-1">
                <Youtube className="w-3.5 h-3.5 text-[#D32F2F]" />
                <span>قناتي المثبتة:</span>
                <span className="font-mono max-w-[150px] truncate">{myChannelLink}</span>
              </div>
            )}
            <div className="hidden md:flex items-center gap-1 text-xs text-[#8D6E63] font-bold bg-[#FAF2EB] px-3 py-1.5 rounded-lg border border-[#EFE5DC]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>مدعوم بنموذج Gemini 3.8-Flash</span>
            </div>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 w-full space-y-8">
        
        {/* Navigation Tabs bar */}
        <div className="bg-white p-2 rounded-xl border border-[#ECE9E0] shadow-sm flex flex-wrap gap-1.5 justify-start">
          {[
            { id: "story-builder", label: "مساعد التأليف ✍️", icon: Sparkles, featured: true },
            { id: "references", label: "المراجع والتكنيك 📚", icon: BookOpen },
            { id: "story-prep", label: "القصة والتدقيق", icon: FileText },
            { id: "image-maker", label: "صناعة غلاف يوتيوب 🎨", icon: ImageIcon },
            { id: "teaser", label: "فيديو تشويقي", icon: Clapperboard },
            { id: "channel-analyzer", label: "تحليل قناتي", icon: Youtube },
            { id: "audition", label: "هندسة الصوت", icon: Sliders },
            { id: "voice-coach", label: "مدرب الإلقاء", icon: Mic },
            { id: "settings", label: "المفاتيح والإعدادات ⚙️", icon: Settings }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-black transition relative ${
                  isActive 
                    ? "bg-[#3E2723] text-white shadow-md shadow-[#3E2723]/15" 
                    : "text-[#5D4037] hover:bg-[#FAF2EB] hover:text-[#3E2723]"
                } ${tab.featured && !isActive ? "bg-[#FAF2EB]/70 border border-[#EFE5DC]" : ""}`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-[#FFB74D]" : ""}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab contents window with custom transitions */}
        <div className="min-h-[500px]">
          {activeTab === "references" && (
            <StoryReferencesTab 
              onApplyReferenceToBuilder={(refData) => {
                setInjectedReference(refData);
                setActiveTab("story-builder");
              }}
              setActiveTab={setActiveTab}
              backupApiKey={backupApiKey}
            />
          )}

          {activeTab === "story-prep" && (
            <StoryPrepTab 
              competitorChannels={competitorChannels}
              setCompetitorChannels={setCompetitorChannels}
              onStoryCorrected={handleStoryUpdate}
              backupApiKey={backupApiKey}
              sharedStoryText={sharedStoryText}
              onStoryTextChange={handleStoryUpdate}
            />
          )}

          {activeTab === "image-maker" && (
            <ImageMakerTab 
              currentStoryText={sharedStoryText}
              backupApiKey={backupApiKey}
            />
          )}

          {activeTab === "story-builder" && (
            <StoryBuilderTab 
              competitorChannels={competitorChannels}
              onStoryGenerated={handleStoryUpdate}
              setActiveTab={setActiveTab}
              backupApiKey={backupApiKey}
              injectedReference={injectedReference}
              onClearInjectedReference={() => setInjectedReference(null)}
            />
          )}

          {activeTab === "teaser" && (
            <TeaserTab 
              currentStoryText={sharedStoryText}
              onStoryTextChange={handleStoryUpdate}
              backupApiKey={backupApiKey}
            />
          )}

          {activeTab === "channel-analyzer" && (
            <ChannelAnalyzerTab 
              myChannelLink={myChannelLink}
              setMyChannelLink={setMyChannelLink}
              backupApiKey={backupApiKey}
            />
          )}

          {activeTab === "audition" && (
            <AuditionTab 
              backupApiKey={backupApiKey}
            />
          )}

          {activeTab === "voice-coach" && (
            <VoiceCoachTab 
              myChannelLink={myChannelLink}
              backupApiKey={backupApiKey}
            />
          )}

          {activeTab === "settings" && (
            <SettingsTab 
              competitorChannels={competitorChannels}
              setCompetitorChannels={setCompetitorChannels}
              myChannelLink={myChannelLink}
              setMyChannelLink={setMyChannelLink}
              backupApiKey={backupApiKey}
              setBackupApiKey={setBackupApiKey}
            />
          )}
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#ECE9E0] py-6 mt-12 text-center text-xs text-[#7D766D] font-medium">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© 2026 راوي لإنتاج المحتوى الصوتي والقصصي. جميع الحقوق محفوظة.</p>
          <div className="flex items-center gap-1 text-[#8D6E63]">
            <span>صُنع بشغف لمبدعي المحتوى العربي</span>
            <Heart className="w-3 h-3 fill-[#8D6E63]" />
          </div>
        </div>
      </footer>

    </div>
  );
}
