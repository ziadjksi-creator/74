export interface Character {
  name: string;
  age: string;
  role: string;
  description: string;
}

export interface BackgroundMusic {
  part: string;
  description: string;
  style: string;
  duration: string;
}

export interface SpellingCorrection {
  original: string;
  corrected: string;
  reason: string;
}

export interface YoutubeOptimization {
  title: string;
  description: string;
  tags: string[];
  bestPostingTime: string;
}

export interface ContextSuggestion {
  id: number;
  originalPhrase: string;
  suggestedPhrase: string;
  reason: string;
}

export interface ProofreadResult {
  correctedText: string;
  videoHook: string;
  durationMinutes: number;
  rating: number;
  evaluation: string;
  characters: Character[];
  backgroundMusic: BackgroundMusic[];
  corrections: SpellingCorrection[];
  youtubeOptimization: YoutubeOptimization;
  contextSuggestions?: ContextSuggestion[];
}

export interface ChannelAnalysis {
  channelName: string;
  strengths: string[];
  weaknesses: string[];
  audienceLikes: string[];
  keepOrDeleteRecommendations: string;
  predictions: string;
  tips: string[];
}

export interface TeaserScriptItem {
  time: string;
  visual: string;
  voiceover: string;
  audio: string;
}

export interface TeaserResult {
  teaserTitle: string;
  hook: string;
  script: TeaserScriptItem[];
  cliffhanger: string;
}

export interface SoftenedWord {
  original: string;
  replacedWith: string;
  reason: string;
}

export interface CritiqueCorrection {
  original?: string;
  critique?: string;
  fixed?: string;
  category?: 'logic' | 'continuity' | 'phrasing' | 'action' | string;
  sceneOrContext?: string;
  originalProblematicText?: string;
  critiqueExplanation?: string;
  correctedReplacementText?: string;
}

export interface SkepticalAuditorReport {
  logicScore?: number;
  overallConsistencyScore?: number;
  continuityVerdict?: string;
  livingSituationCheck?: any;
  actionJustificationCheck?: any;
  unimaginablePhrasingCheck?: any;
  sceneTransitionsCheck?: any;
  egyptianAmmiyaCheck?: any;
  continuityIssues?: string[];
  confusingPhrases?: string[];
  unjustifiedActions?: string[];
  reListenTestVerdict?: string;
  correctionsApplied: CritiqueCorrection[];
  finalVerdict?: string;
  auditorVerdictSummary?: string;
}

export interface AgentReviewReport {
  writerAgentNotes: string;
  editorAgentNotes: string;
  deletedFluffExamples: string[];
  softenedSolidWords: SoftenedWord[];
  hookTightening: string;
  excitementScore: number;
}

export interface DetectedPlotAndPsychology {
  plotType: string;
  psychologicalArchetype: string;
  coreConflict: string;
  twistSetup?: string;
  rationaleFromContext?: string;
}

export interface GeneratedStoryResult {
  title: string;
  youtubeTitles?: string[];
  titleOptions?: string[];
  hook: string;
  fullStoryText: string;
  pacingGuide: string;
  suggestedAtmosphere: string;
  rawDraftPreview?: string;
  humanizedDraftPreview?: string;
  skepticalAuditorReport?: SkepticalAuditorReport;
  agentReport?: AgentReviewReport;
  detectedPlotAndPsychology?: DetectedPlotAndPsychology;
  wordCountTarget?: number;
  wordCountActual?: number;
  scenesCount?: number;
  reverseEngineeredEnding?: string | null;
  reListenDualClues?: string[];
  structuralSubversionNotes?: string | null;
}

export interface AuditionSettingsResult {
  channelVocalStyle: string;
  noiseReduction: {
    effectName: string;
    settings: string[];
  };
  parametricEQ: {
    effectName: string;
    presetName: string;
    bands: {
      band: string;
      frequency: string;
      gain: string;
      q: string;
    }[];
    explanation: string;
  };
  multibandCompressor: {
    effectName: string;
    preset: string;
    values: string;
  };
  deEsser: {
    effectName: string;
    settings: string;
  };
  masteringLimiter: {
    effectName: string;
    settings: string;
  };
  narratorTip: string;
}

export interface VoiceAnalysisResult {
  deliveryScore: number;
  audioQualityScore: number;
  vocalAnalysis: string;
  prosAndCons: {
    pros: string[];
    cons: string[];
  };
  coachingTips: string[];
  customAuditionPreset: {
    title: string;
    steps: string[];
  };
}
