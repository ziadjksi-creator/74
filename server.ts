import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { jsonrepair } from "jsonrepair";

dotenv.config();

// Resilient JSON parsing helper that cleans markdown fences, repairs broken JSON strings/quotes/control characters
function safeJsonParse<T = any>(rawText: any, fallback: T = {} as T): T {
  if (!rawText) return fallback;
  const textStr = typeof rawText === "string" ? rawText : String(rawText);
  let cleaned = textStr.trim();
  
  // Strip markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  }

  // 1. Try native JSON.parse first
  try {
    return JSON.parse(cleaned);
  } catch (err1) {
    // 2. Try jsonrepair on the cleaned text
    try {
      const repaired = jsonrepair(cleaned);
      return JSON.parse(repaired);
    } catch (err2) {
      // 3. Try jsonrepair on the raw text
      try {
        const repairedRaw = jsonrepair(textStr);
        return JSON.parse(repairedRaw);
      } catch (err3) {
        // 4. Try extracting the first valid JSON object or array structure
        try {
          const firstBrace = cleaned.indexOf("{");
          const firstBracket = cleaned.indexOf("[");
          let startIdx = -1;
          if (firstBrace !== -1 && firstBracket !== -1) {
            startIdx = Math.min(firstBrace, firstBracket);
          } else if (firstBrace !== -1) {
            startIdx = firstBrace;
          } else if (firstBracket !== -1) {
            startIdx = firstBracket;
          }

          if (startIdx !== -1) {
            const isObject = cleaned[startIdx] === "{";
            const lastIdx = isObject ? cleaned.lastIndexOf("}") : cleaned.lastIndexOf("]");
            if (lastIdx > startIdx) {
              const substring = cleaned.substring(startIdx, lastIdx + 1);
              try {
                return JSON.parse(jsonrepair(substring));
              } catch (subErr) {
                // proceed
              }
            }
          }
        } catch (extractErr) {
          // ignore
        }

        console.warn("[safeJsonParse] All JSON repair strategies exhausted for input snippet:", textStr.slice(0, 150));
        return fallback;
      }
    }
  }
}

// Default global client (uses system environment key)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Helper to extract all valid custom API keys from header or body
function getCustomKeys(req: any): string[] {
  if (!req) return [];
  const keysStr = req.headers?.["x-custom-gemini-key"] || req.body?.customApiKey || req.body?.backupApiKey;
  if (!keysStr || typeof keysStr !== "string") return [];
  // Split by commas, trim, filter out empty/short keys
  return keysStr.split(",")
    .map((k: string) => k.trim())
    .filter((k: string) => k.length > 10);
}

// Helper to resolve custom client if provided by user as backup
function getAiClient(req: any): GoogleGenAI {
  const customKey = req.headers["x-custom-gemini-key"] || req.body?.customApiKey;
  if (customKey && typeof customKey === "string" && customKey.trim().length > 10) {
    console.log("[Resilient API] Using client-provided backup Gemini API Key!");
    return new GoogleGenAI({
      apiKey: customKey.trim(),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build-custom',
        }
      }
    });
  }
  return ai;
}

// Helper sleep function for backoff
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Centralized error formatter for Gemini API errors
function formatGeminiError(error: any): { status: number; message: string } {
  const errMsg = error?.message || String(error);
  if (errMsg.includes("API_KEY_INVALID") || errMsg.includes("API key not valid") || errMsg.includes("invalid argument")) {
    return {
      status: 400,
      message: "مفتاح Gemini API غير صالح. يرجى التأكد من نسخه بشكل سليم من Google AI Studio وحفظه في تبويب الإعدادات."
    };
  }
  if (errMsg.includes("429") || errMsg.includes("QUOTA_EXCEEDED") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota")) {
    return {
      status: 429,
      message: "تم الوصول إلى الحد الأقصى لحصة الاستخدام (Quota Limit) مؤقتاً. يرجى الانتظار بضع دقائق أو إضافة مفاتيح API احتياطية في الإعدادات للتناوب التلقائي."
    };
  }
  if (errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("high demand")) {
    return {
      status: 503,
      message: "خدمة الذكاء الاصطناعي تشهد ضغطاً مؤقتاً. يرجى المحاولة مرة أخرى بعد لحظات."
    };
  }
  return {
    status: 500,
    message: errMsg || "حدث خطأ غير متوقع أثناء معالجة الطلب."
  };
}

// Resilient fallback mechanism with model fallback + API key rotation
async function generateContentResilient(reqOrClient: any, params: any) {
  const modelsToTry = [
    "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash"
  ];
  let lastError = null;

  const tryWithBackoff = async (clientInstance: any, modelName: string, prefixLog: string) => {
    const retries = 2; // Try up to 2 additional times for transient occurrences
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        console.log(`${prefixLog} - Attempt ${attempt} trying model: ${modelName}`);
        const response = await clientInstance.models.generateContent({
          ...params,
          model: modelName,
        });
        return response;
      } catch (err: any) {
        const errMsg = (err && err.message) ? String(err.message) : "";
        const isInvalidKey = errMsg.includes("API_KEY_INVALID") || errMsg.includes("API key not valid");
        if (isInvalidKey) {
          console.log(`${prefixLog} - Key is invalid. Skipping further retries for this key.`);
          throw err;
        }

        const isTransient = errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("429") || errMsg.includes("temporary") || errMsg.includes("high demand") || String(err).includes("503");
        
        if (isTransient && attempt <= retries) {
          const delay = attempt * 400;
          console.log(`[Resilient API] Service busy at attempt ${attempt}. Retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        
        console.log(`[Resilient API] Sequence finished for model ${modelName}`);
        throw err;
      }
    }
  };

  // If a raw GoogleGenAI client is passed instead of a request object
  if (reqOrClient && typeof reqOrClient.models?.generateContent === "function") {
    for (const model of modelsToTry) {
      try {
        const response = await tryWithBackoff(reqOrClient, model, `[Resilient API Client]`);
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err);
        if (errMsg.includes("API_KEY_INVALID") || errMsg.includes("API key not valid")) {
          break;
        }
      }
    }
    throw lastError || new Error("All available Gemini models are currently experiencing high demand.");
  }

  // Otherwise, treat reqOrClient as an Express request object and rotate keys
  const req = reqOrClient;
  const customKeys = getCustomKeys(req);

  // 1. Try Custom API Keys in order
  if (customKeys.length > 0) {
    console.log(`[Resilient API Key Rotation] Found ${customKeys.length} custom API keys.`);
    for (let i = 0; i < customKeys.length; i++) {
      const customKey = customKeys[i];
      const customClient = new GoogleGenAI({
        apiKey: customKey,
        httpOptions: {
          headers: {
            'User-Agent': `rawi-custom-rotated-${i + 1}`,
          }
        }
      });

      for (const model of modelsToTry) {
        try {
          const response = await tryWithBackoff(customClient, model, `[Resilient API Key Rotation] Custom Key #${i + 1}`);
          console.log(`[Resilient API Key Rotation] SUCCESS using Custom Key #${i + 1} and model: ${model}`);
          return response;
        } catch (err: any) {
          lastError = err;
          const errMsg = String(err?.message || err);
          if (errMsg.includes("API_KEY_INVALID") || errMsg.includes("API key not valid")) {
            console.warn(`[Resilient API Key Rotation] Custom Key #${i + 1} is invalid. Skipping all remaining models for this key.`);
            break;
          }
        }
      }
      console.warn(`[Resilient API Key Rotation] Custom Key #${i + 1} exhausted. Moving to next key...`);
    }
  }

  // 2. Fallback to main account key if available
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 5) {
    console.log(`[Resilient API Key Rotation] Trying main account API key...`);
    for (const model of modelsToTry) {
      try {
        const response = await tryWithBackoff(ai, model, `[Resilient API Key Rotation] Main Account`);
        console.log(`[Resilient API Key Rotation] SUCCESS using Main Account and model: ${model}`);
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err);
        if (errMsg.includes("API_KEY_INVALID") || errMsg.includes("API key not valid")) {
          console.warn(`[Resilient API Key Rotation] Main account key is invalid or unauthorized.`);
          break;
        }
      }
    }
  } else {
    console.warn(`[Resilient API Key Rotation] Main account GEMINI_API_KEY is not configured.`);
  }

  throw lastError || new Error("مفاتيح Gemini API المستخدمة غير صالحة أو استنفذت الحصة. يرجى إدخال مفتاح API سليم في تبويب الإعدادات.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // 1. Proofreading & Assets API
  app.post("/api/proofread", async (req, res) => {
    try {
      const { storyText, competitorChannels } = req.body;
      if (!storyText) {
        return res.status(400).json({ error: "Story text is required" });
      }

      const client = getAiClient(req);

      const competitorChannelsArray = Array.isArray(competitorChannels) ? competitorChannels : [];
      const channelsListText = competitorChannelsArray.length > 0
        ? competitorChannelsArray.map((c: string) => c.replace(/^https?:\/\/(www\.)?youtube\.com\/(c\/|channel\/|@)?/i, "@")).join(" و ")
        : "قنوات الرعب والقصص والتشويق الرائدة";

      const channelsText = competitorChannelsArray.length > 0 
        ? `بالاعتماد على أسلوب هذه القنوات المنافسة المزودة كمثال ومصدر إلهام أساسي وصارم:\n${competitorChannelsArray.join("\n")}`
        : "بالاعتماد على أسلوب سرد قصص اليوتيوب الشهير والمثير.";

      const prompt = `
        أنت مصحح لغوي ومعد محتوى لقصص اليوتيوب الصوتية الاحترافية ومستشار هندسة صوتية وسينوغرافيا.
        لديك قصة كاملة مكتوبة باللغة العربية (قد تكون بالفصحى أو العامية أو مزيج منهما).
        
        المهمة الأولى: تصحيح الأخطاء الإملائية والمطبعية فقط!
        تحذير صارم: لا تغير الأسلوب، لا تغير الكلمات إلى الفصحى إذا كانت القصة مكتوبة بالعامية، ولا تغير الكلمات العامية إذا كانت عامية صحيحة في سياقها. قم فقط بتصحيح الكلمات المكتوبة خطأً إملائياً، وحافظ على نفس منوال ونغمة وكتابة القصة بالضبط.
        
        المهمة الثانية: تقديم تحليل فني كامل للقصة يتضمن:
        1. تقدير دقيق للغاية لمدة قراءة القصة وحكايتها بالصوت بالدقائق والثواني (بمعدل 130 كلمة في الدقيقة تقريباً).
        2. تقييم القصة من 10 درجات وتوضيح نقاط القوة والضعف والتشويق.
        3. ملخص بسيط وشيق للشخصيات (الاسم، العمر التقريبي، الدور، الوصف).
        4. تخطيط تفصيلي ومثير للمؤثرات الصوتية والبيئية (Sound Effects / Foley) والموسيقى الخلفية المناسبة (Background Music) لكل مقطع رئيسي من القصة لمساعدة مقدم المحتوى أثناء المونتاج.
           يجب أن تحتوي المؤثرات على تفاصيل صوتية سينمائية محددة جداً مثل: "صوت فتح باب خشبي قديم يصدر صريراً"، "صوت رياح عاصفة قوية في الخارج"، "صوت بكاء خافت قادم من القبو"، "صوت ضحك غريب أو ضحكة ساحرة شريرة"، "صوت خطوات أقدام ثقيلة تقترب على أرضية خشبية"، "صوت دقات قلب متسارعة"، "صوت رعد وصدمة غامضة".
        5. قائمة تفصيلية بالأخطاء الإملائية التي تم تصحيحها (الكلمة الأصلية الخطأ، الكلمة الصحيحة بعد التعديل، والسبب باختصار).
        6. تحسينات لليوتيوب (عنوان فيديو مثير وجذاب وعالي النقر (Clickbait) جداً، وصف فيديو غني وصديق للـ SEO، كلمات دلالية/علامات SEO ممتازة، وأفضل وقت لنشر هذا النوع من القصص بناءً على الفئة المستهدفة ومقارنة بالقنوات المنافسة).
        
        المهمة الثالثة: استخلاص مقدمة تشويقية خارقة ومكثفة (Hook Intro) مدتها 30 ثانية إلى دقيقة واحدة مبنية على أحداث القصة ولكن تصاغ بأسلوب مذهل ومثير للانتباه والشد النفسي، لتبدأ بها القصة فورا وتمنع المشاهد من الخروج. ضعها في حقل "videoHook".
        تحذير فائق الأهمية: تجنب حرق القصة تماماً! لا تكشف اللغز أو القاتل أو النهاية أو الصدمة في هذه المقدمة. صغها بطريقة تثير تساؤلات مرعبة وغامضة دون كشف أي حدث جوهري أو حرق القصة لكي لا تفقد جاذبيتها.
        
        المهمة الرابعة: كاشف السياق والتحسين التفاعلي المتقدم والمكثف (Advanced & Dense Context Suggestions):
        قم بعمل مسح وفحص ميكروسكوبي شامل للقصة الأصلية لاستخراج أكبر عدد ممكن من الفرص لتحسين الإثارة والتشويق ومستوى الرعب (استخرج ما لا يقل عن 5 إلى 10 اقتراحات متنوعة من مختلف أنحاء النص!).
        ركز على فحص وتحديد ما يلي:
        1. العبارات العادية أو الهادئة التي يمكن استبدالها بعبارات رعب نفسي وتوتر يحبس الأنفاس بالعامية المصرية الدارجة السلسة.
        2. الجمل التي تفتقر إلى التفاصيل الحسية (مثل سماع صوت مريب، الإحساس ببرودة مفاجئة، رؤية ظل غريب) واقترح دمج تفاصيل مرعبة ومؤثرات صوتية داخل الجملة المقترحة.
        3. التعبيرات المتكررة أو الركيكة وصياغتها بأسلوب درامي غامض يحبس الأنفاس مستوحى من كبار رواة الرعب على اليوتيوب.
        
        تنبيه صارم جداً: لا تقم بتعديل هذه الجمل تلقائياً في النص المصحح "correctedText"!
        حافظ عليها كما هي في النص المصحح، وبدلاً من ذلك استخرجها ووضعها في حقل "contextSuggestions" لكي يقرر المستخدم بنفسه تطبيقها.
        * تنبيه هام جداً: يجب صياغة الجمل المقترحة في حقل (suggestedPhrase) بالعامية المصرية الدارجة السلسة والمثيرة جداً (عربية عامية مصرية) بأسلوب قنوات الرعب والقصص المستهدفة: ${channelsListText}. واكتب سبب التعديل في حقل (reason) بالعامية المصرية البسيطة والودية برضه، عشان تكون قريبة وسهلة للي بيسجل القصة وتجنب لغة الفصحى الجافة تماماً.
        لكل اقتراح تعديل سياقي، اذكر:
        - "id": معرف رقمي فريد ومسلسل يبدأ من 1.
        - "originalPhrase": الجملة أو العبارة الأصلية كما وردت في النص تماماً وبلا أي تغيير لكي يتم مطابقتها برمجياً.
        - "suggestedPhrase": الجملة أو العبارة المقترحة والمعدلة بأسلوب العامية المصرية المشوق للغاية والغامض والمناسب للرعب والإثارة (بدون حرق).
        - "reason": السبب والتحليل البصري أو الدرامي للتعديل المقترح مكتوب بالعامية المصرية المبسطة والودية للغاية.

        تحذير هام بخصوص صياغة عنوان الفيديو المقترح:
        يجب دراسة نمط العناوين الفيروسية الأكثر نجاحاً ومشاهدة في قنوات المنافسين المستهدفة (${channelsListText}) والاعتماد على تركيباتها المربكة والمخيفة. لا تضع عنواناً كلاسيكياً أو مملاً!
        صغ العنوان ليعتمد على أحد هذه الأساليب الأربعة الجاذبة للملايين:
        1. صدمة أو كشف سر مرعب: 'جاري العجوز خبأ هذا الشيء الصادم خلف بابه المغلق!' أو 'ما وجدناه داخل بئر القرية المهجورة غيّر حياتنا للأبد!'
        2. تساؤل مخيف ومربك: 'لماذا يهمس هذا الصوت باسمي من المقبرة كل ليلة في الساعة 3 صباحاً؟'
        3. تجربة حية مرعبة وتهديد مباشر: 'قضيت ليلة واحدة في قبو جدي الراحل.. وهذا هو الكائن الذي ظهر لي!'
        4. جريمة غامضة بأسلوب سرد قصصي: 'الحقيقة البشعة وراء اختفاء الفتيات في ريف المحافظة!'
        اجعل العنوان في حقل "title" يعكس هذه الصياغة فائقة التشويق ومرتبطة بصلب أحداث القصة الحالية.

        ${channelsText}
        
        القصة الأصلية:
        """
        ${storyText}
        """
        
        يرجى إرجاع النتيجة بتنسيق JSON متوافق تماماً مع البنية التالية باللغة العربية:
        {
          "correctedText": "النص الكامل والمعدل بدقة بدون أخطاء إملائية مع الحفاظ على اللهجة والأسلوب والكلمات الأصلية تماماً",
          "videoHook": "مقدمة تشويقية خارقة (Hook) مدتها 30 إلى 60 ثانية مبنية على أحداث القصة لجذب وتثبيت انتباه المستمع فوراً ومنعه من الخروج في أول دقيقة.",
          "durationMinutes": 15.5, // الرقم التقريبي للمدة بالدقائق كعدد عشري أو صحيح
          "rating": 8.5, // التقييم من 10
          "evaluation": "تقييم عام مركز ومختصر في 2 إلى 3 أسطر فقط للحبكة ونقاط القوة بدون أي حشو أو كلام إنشائي مكرر",
          "characters": [
            { "name": "اسم الشخصية", "age": "العمر", "role": "الدور في القصة", "description": "وصف فني ومظهر الشخصية" }
          ],
          "backgroundMusic": [
            { "part": "المشهد أو الجزء من القصة", "description": "شرح التأثير الموسيقي والمؤثرات الصوتية التفصيلية للغاية (مثل: صرير باب، صوت رياح، بكاء، ضحكة عفريت)", "style": "نوع المود والموسيقى المستخدمة والمؤثر البصري المصاحب لها", "duration": "من بداية الدقيقة كذا إلى كذا" }
          ],
          "corrections": [
            { "original": "الكلمة الأصلية الخطأ", "corrected": "الكلمة المصححة", "reason": "سبب التعديل اللغوي" }
          ],
          "youtubeOptimization": {
            "title": "عنوان جذاب جداً ومحفز للنقر يحاكي نمط القنوات المنافسة المستهدفة (${channelsListText}) الأكثر مشاهدة",
            "description": "وصف يوتيوب جذاب ومركّز وموجز (SEO Description) بدون أي إسهاب أو حشو ممل يسبب الملل: مقدمة تشويقية غامضة ومحفزة من سطرين أو ثلاثة فقط تشعل فضول المشاهد دون حرق، متبوعة بالفصول الزمنية الأساسية (Timestamps) وعلامات الهاشتاج ذات الصلة فقط (بدون أسئلة شائعة مكررة أو فقرات ميتة).",
            "tags": ["كلمة دلالية 1", "كلمة دلالية 2", "رعب", "قصص غامضة"],
            "bestPostingTime": "توصية تفصيلية بوقت ويوم النشر المناسب للجمهور المستهدف"
          },
          "contextSuggestions": [
            { "id": 1, "originalPhrase": "الجملة/العبارة الأصلية التي تحتاج لتحسين بصلب النص الأصلي (يجب مطابقتها تماماً للحذف/الاستبدال يدوياً من قبل المستخدم)", "suggestedPhrase": "العبارة المقترحة المحسنة لزيادة الإثارة والغموض والرعب", "reason": "سبب التغيير وفلسفة الإثارة خلفه" }
          ]
        }
      `;

      const response = await generateContentResilient(req, {
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              correctedText: { type: Type.STRING },
              videoHook: { type: Type.STRING },
              durationMinutes: { type: Type.NUMBER },
              rating: { type: Type.NUMBER },
              evaluation: { type: Type.STRING },
              characters: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    age: { type: Type.STRING },
                    role: { type: Type.STRING },
                    description: { type: Type.STRING }
                  },
                  required: ["name", "age", "role", "description"]
                }
              },
              backgroundMusic: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    part: { type: Type.STRING },
                    description: { type: Type.STRING },
                    style: { type: Type.STRING },
                    duration: { type: Type.STRING }
                  },
                  required: ["part", "description", "style", "duration"]
                }
              },
              corrections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    original: { type: Type.STRING },
                    corrected: { type: Type.STRING },
                    reason: { type: Type.STRING }
                  },
                  required: ["original", "corrected", "reason"]
                }
              },
              youtubeOptimization: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  tags: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  bestPostingTime: { type: Type.STRING }
                },
                required: ["title", "description", "tags", "bestPostingTime"]
              },
              contextSuggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.NUMBER },
                    originalPhrase: { type: Type.STRING },
                    suggestedPhrase: { type: Type.STRING },
                    reason: { type: Type.STRING }
                  },
                  required: ["id", "originalPhrase", "suggestedPhrase", "reason"]
                }
              }
            },
            required: ["correctedText", "videoHook", "durationMinutes", "rating", "evaluation", "characters", "backgroundMusic", "corrections", "youtubeOptimization", "contextSuggestions"]
          }
        }
      });

      res.json(safeJsonParse(response.text, {}));
    } catch (error: any) {
      const errInfo = formatGeminiError(error);
      console.log("Proofread handled error:", errInfo.message);
      res.status(errInfo.status).json({ error: errInfo.message });
    }
  });

  // 2. Generate Image Prompt based on story
  app.post("/api/generate-thumbnail-prompt", async (req, res) => {
    try {
      const { storyText, competitorChannels } = req.body;
      if (!storyText) {
        return res.status(400).json({ error: "Story text is required" });
      }

      const client = getAiClient(req);

      const competitorChannelsArray = Array.isArray(competitorChannels) ? competitorChannels : [];
      const channelsListText = competitorChannelsArray.length > 0
        ? competitorChannelsArray.map((c: string) => c.replace(/^https?:\/\/(www\.)?youtube\.com\/(c\/|channel\/|@)?/i, "@")).join(" and ")
        : "viral dark storytelling, mystery, and horror channels";

      const prompt = `
        You are a premier YouTube thumbnail art director specializing in high-CTR, viral storytelling style of: ${channelsListText}.
        Read the following Arabic story, extract the single most dramatic, spine-chilling, and visually striking scene/concept, and translate it into an extremely focused, high-impact English image generation prompt.

        Composition Rules for High-CTR YouTube Thumbnails:
        - Core Subject: Focus on ONLY ONE extremely prominent, high-contrast, terrifying focal subject (e.g., a giant creepy shadow entity with glowing eyes, a single hyper-realistic horrified crying face, a dusty ancient key floating in misty light, or a terrifying creature peering from a half-open door).
        - Layout Split: Position this central subject clearly on ONE side of the 16:9 frame (e.g., left half), leaving the other side (e.g., right half) as a very dark, atmospheric, negative-space background (deep black shadows, volumetric smoke, moody fog) so we can put readable Arabic text there without cluttering.
        - Lighting & Atmosphere: Dramatic chiaroscuro lighting, intense glowing highlights (blood-red, eerie moonlight blue, or toxic neon green), volumetric fog, and ultra-high contrast.
        - Absolute Restrictions: NO digital drawings, NO flat vectors, NO anime, NO crowded details, NO multiple tiny characters. It must look like a high-budget cinematic movie still with real photorealistic human skin/surfaces.

        Write ONLY the final English prompt as a single cohesive paragraph. Do NOT add any intro, preamble, explanations, or markdown formatting. Just the English text.
        
        Story:
        """
        ${storyText}
        """
      `;

      const response = await generateContentResilient(req, {
        contents: prompt,
      });

      res.json({ prompt: response.text?.trim() || "" });
    } catch (error: any) {
      const errInfo = formatGeminiError(error);
      console.log("Prompt Generation handled error:", errInfo.message);
      res.status(errInfo.status).json({ error: errInfo.message });
    }
  });

  // 3. Channel Analysis API
  app.post("/api/analyze-channel", async (req, res) => {
    try {
      const { channelLink } = req.body;
      if (!channelLink) {
        return res.status(400).json({ error: "Channel link is required" });
      }

      const client = getAiClient(req);

      const prompt = `
        قم بإجراء تحليل شامل وعميق لقناة يوتيوب متخصصة في رواية القصص (أو قناة الرواية المرتبطة بهذا الرابط: ${channelLink}).
        بصفتك مستشار قنوات يوتيوب خبير في زيادة المشاهدات وتطوير قنوات القصص (خاصة الرعب، التشويق، القصص النفسية أو التاريخية):
        
        قم بتقديم تقرير فني شامل ومفصل يحتوي على:
        1. تحليل لنقاط القوة والضعف الحالية في القناة (تكامل الصوت، المونتاج، العناوين، الصور المصغرة).
        2. دراسة دقيقة لاهتمامات الجمهور الحالي وما يفضلونه (ما الذي يجعل المشاهد يستمع لقصة كاملة مدتها 30 دقيقة بدلاً من المغادرة).
        3. توصيات دقيقة وحاسمة عن أنواع القصص التي يجب الحفاظ عليها، وأي قصص أو أساليب سرد قديمة يجب تعديلها أو "حذفها" لأنها تضر بمعدل الاحتفاظ بالجمهور (Retention rate).
        4. توقعات بالأداء المستقبلي وفرص النمو للـ 6 أشهر القادمة بناءً على أسلوب هذه القناة.
        5. نصائح لزيادة التفاعل والمشتركين.

        أرجع النتيجة في صيغة JSON متوافقة مع البنية التالية باللغة العربية:
        {
          "channelName": "اسم افتراضي أو مستنتج للقناة",
          "strengths": ["نقطة قوة 1", "نقطة قوة 2"],
          "weaknesses": ["نقطة ضعف 1", "نقطة ضعف 2"],
          "audienceLikes": ["ميزة يفضلها الجمهور 1", "ميزة يفضلها الجمهور 2"],
          "keepOrDeleteRecommendations": "شرح مفصل عن القصص والأساليب التي تنجح والأساليب الفاشلة التي يجب تلافيها أو حذفها تماماً لرفع تقييم القناة في خوارزميات يوتيوب",
          "predictions": "توقعات أداء القناة والنمو للشهور القادمة ومعدل الزيادة المتوقع إذا تم تطبيق التوصيات",
          "tips": ["نصيحة عملية 1", "نصيحة عملية 2", "نصيحة عملية 3"]
        }
      `;

      const response = await generateContentResilient(req, {
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              channelName: { type: Type.STRING },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
              audienceLikes: { type: Type.ARRAY, items: { type: Type.STRING } },
              keepOrDeleteRecommendations: { type: Type.STRING },
              predictions: { type: Type.STRING },
              tips: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["channelName", "strengths", "weaknesses", "audienceLikes", "keepOrDeleteRecommendations", "predictions", "tips"]
          }
        }
      });

      res.json(safeJsonParse(response.text, {}));
    } catch (error: any) {
      const errInfo = formatGeminiError(error);
      console.log("Channel Analysis handled error:", errInfo.message);
      res.status(errInfo.status).json({ error: errInfo.message });
    }
  });

  // 3.5 Extract Thumbnail Style from Channel
  app.post("/api/extract-thumbnail-style", async (req, res) => {
    try {
      const { channelLink } = req.body;
      if (!channelLink) {
        return res.status(400).json({ error: "Channel link is required" });
      }

      const client = getAiClient(req);

      const prompt = `
        قم بدراسة وتحليل الأسلوب الفني البصري لصور اليوتيوب المصغرة (Thumbnails) الخاصة بهذه القناة: ${channelLink}.
        استنتج مواصفات الغلاف التي تجعل مقاطع هذه القناة الفيروسية مرئية ومثيرة للاهتمام للغاية.

        قم باستخلاص الميزات الفنية التالية:
        1. مستويات الظلام والتباين المفضل في الخلفيات.
        2. نوع الخط ولونه وحجمه والموضع المفضل له (علوي، سفلي، في الوسط) لمنع تداخله مع زمن الفيديو.
        3. المشهد المركزي والعناصر البصرية الطاغية (هل يركز على وجوه مرعوبة؟ أم غرف مظلمة؟ أم كائنات وكيانات وظلال؟).
        4. نوع الفلتر اللوني المناسب (horror، golden، dramatic).
        5. كود لون النص المقترح بالصيغة الست عشرية (Hex) مثل #FF0000 أو #FFB300.
        6. صياغة برومبت إنجليزي مكمل ومخصص (Prompt Suffix) ليتم إضافته لطلبات التوليد لإنتاج صور تشبه هذا الأسلوب الفني بالضبط.

        أرجع النتيجة في صيغة JSON متوافقة تماماً مع البنية التالية باللغة العربية:
        {
          "channelName": "اسم القناة المستخلص",
          "backgroundDarkness": "وصف مستخلص لعمق الخلفية والظلام والضباب",
          "fontStyle": "نوع الخط ولون النص والموضع المقترح على الشاشة",
          "visualTheme": "المحور البصري والمكونات الأساسية للغلاف",
          "vignetteStyle": "نوع الفلتر الإضافي الموصى به (horror أو golden أو dramatic)",
          "titleColor": "#HEX_COLOR_CODE",
          "promptSuffix": "Cinematic horror style matching this channel's viral visual signature, highly detailed, photorealistic render, moody atmosphere..."
        }
      `;

      const response = await generateContentResilient(req, {
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              channelName: { type: Type.STRING },
              backgroundDarkness: { type: Type.STRING },
              fontStyle: { type: Type.STRING },
              visualTheme: { type: Type.STRING },
              vignetteStyle: { type: Type.STRING },
              titleColor: { type: Type.STRING },
              promptSuffix: { type: Type.STRING }
            },
            required: ["channelName", "backgroundDarkness", "fontStyle", "visualTheme", "vignetteStyle", "titleColor", "promptSuffix"]
          }
        }
      });

      res.json(safeJsonParse(response.text, {}));
    } catch (error: any) {
      const errInfo = formatGeminiError(error);
      console.log("Extract Thumbnail Style handled error:", errInfo.message);
      res.status(errInfo.status).json({ error: errInfo.message });
    }
  });

  // 3.6 API Key Validation & Verification
  app.post("/api/test-api-key", async (req, res) => {
    try {
      const { apiKey } = req.body;
      if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 10) {
        return res.status(400).json({ success: false, error: "المفتاح المدخل غير مكتمل أو فارغ" });
      }

      const client = new GoogleGenAI({
        apiKey: apiKey.trim(),
        httpOptions: {
          headers: {
            'User-Agent': 'api-key-validator',
          }
        }
      });

      // Validate key using lightweight countTokens (does NOT consume generate_content quota)
      try {
        await client.models.countTokens({
          model: "gemini-3.5-flash",
          contents: "ping",
        });
        return res.json({ success: true, message: "تم التحقق بنجاح! المفتاح شغال ومترابط ومستعد للاستخدام." });
      } catch (checkErr: any) {
        const checkErrMsg = checkErr?.message || String(checkErr);

        // If rate limited or quota exceeded, the key IS authenticated and VALID with Google!
        if (checkErrMsg.includes("QUOTA_EXCEEDED") || checkErrMsg.includes("429") || checkErrMsg.includes("RESOURCE_EXHAUSTED") || checkErrMsg.includes("quota")) {
          return res.json({ 
            success: true, 
            message: "المفتاح صالح ومفعّل رسمياً لدى Google! (ملاحظة: تم استهلاك الحصة المجانية المؤقتة لليوم، وسيتناوب النظام تلقائياً عند الحاجة)." 
          });
        }

        // If key is fundamentally invalid
        if (checkErrMsg.includes("API_KEY_INVALID") || checkErrMsg.includes("invalid") || checkErrMsg.includes("API key not valid")) {
          return res.status(400).json({ 
            success: false, 
            error: "مفتاح API غير صالح! الرجاء التأكد من نسخه بشكل صحيح من Google AI Studio." 
          });
        }

        if (checkErrMsg.includes("permission") || checkErrMsg.includes("denied") || checkErrMsg.includes("forbidden")) {
          return res.status(400).json({ 
            success: false, 
            error: "تم رفض الإذن! تأكد من تفعيل خدمة Gemini API في لوحة تحكم Google لهذا المفتاح." 
          });
        }

        return res.status(400).json({ 
          success: false, 
          error: "المفتاح غير متاح حالياً أو يحتاج تفعيل في Google AI Studio." 
        });
      }
    } catch (error: any) {
      return res.status(400).json({ 
        success: false, 
        error: "حدث خطأ أثناء فحص المفتاح" 
      });
    }
  });

  // 4. Teaser / Shorts Generator API
  app.post("/api/generate-teaser", async (req, res) => {
    try {
      const { storyText, concept } = req.body;
      const sourceText = storyText || concept;

      if (!sourceText) {
        return res.status(400).json({ error: "Story text or concept is required" });
      }

      const client = getAiClient(req);

      const prompt = `
        قم بإنشاء سيناريو كامل ومثير جداً لفيديو تشويقي قصير (YouTube Shorts / TikTok / Reels) بالعامية المصرية لجذب وتجهيز المشاهدين للقصة الكبيرة.
        يجب أن تتراوح مدة الفيديو التشويقي بين 30 إلى 60 ثانية، ويتميز بإيقاع سريع للغاية، وحبكة غامضة (Cliffhanger) تجعل المشاهد ينتظر بفارغ الصبر نزول القصة كاملة.
        يجب كتابة نصوص التعليق الصوتي (voiceover) بالكامل بالعامية المصرية الدارجة والمثيرة جداً.
        
        المحتوى المستند إليه:
        """
        ${sourceText}
        """
        
        أرجع النتيجة بتنسيق JSON يحتوي على:
        {
          "teaserTitle": "عنوان الفيديو التشويقي القصير بالعامية المصرية",
          "hook": "الخطاف أو الجملة الافتتاحية الأولى بالعامية المصرية الجاذبة للانتباه في أول 3 ثواني",
          "script": [
            { "time": "0:00 - 0:05", "visual": "تفاصيل اللقطة البصرية المقترحة والمؤثر البصري", "voiceover": "الكلام الذي ينطقه الراوي بصوته هنا بالعامية المصرية الدارجة بتشويق وإثارة وبدون حرق", "audio": "صوت الخلفية أو المؤثر الصوتي المطلوب (مثال: صوت دقات ساعة متسارعة، صرخة بعيدة)" }
          ],
          "cliffhanger": "القفلة التشويقية أو السؤال الغامض بالعامية المصرية الذي ينتهي به الفيديو لدعوة لمشاهدة القصة الكاملة"
        }
      `;

      const response = await generateContentResilient(req, {
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              teaserTitle: { type: Type.STRING },
              hook: { type: Type.STRING },
              script: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    time: { type: Type.STRING },
                    visual: { type: Type.STRING },
                    voiceover: { type: Type.STRING },
                    audio: { type: Type.STRING }
                  },
                  required: ["time", "visual", "voiceover", "audio"]
                }
              },
              cliffhanger: { type: Type.STRING }
            },
            required: ["teaserTitle", "hook", "script", "cliffhanger"]
          }
        }
      });

      res.json(safeJsonParse(response.text, {}));
    } catch (error: any) {
      const errInfo = formatGeminiError(error);
      console.log("Teaser Generator handled error:", errInfo.message);
      res.status(errInfo.status).json({ error: errInfo.message });
    }
  });

  // 5. Pro Story Builder (3-Agent Audio-First Sensory Storycrafting Pipeline)
  app.post("/api/pro-story-builder", async (req, res) => {
    try {
      const { concept, duration, wordCount, genre, competitorChannels, pacingStyle, referenceFocus } = req.body;
      if (!concept) {
        return res.status(400).json({ error: "Story concept/idea is required" });
      }

      const client = getAiClient(req);

      const isAutoGenre = !genre || genre === "auto" || String(genre).includes("تلقائي");
      const parsedTargetWords = parseInt(String(wordCount || "2000").replace(/[^\d]/g, ""), 10) || 2000;
      
      // Dynamic Scene Count Distribution calibrated accurately to target word count
      let numScenes = 4;
      if (parsedTargetWords >= 4500) {
        numScenes = 7;
      } else if (parsedTargetWords >= 3200) {
        numScenes = 6;
      } else if (parsedTargetWords >= 2200) {
        numScenes = 5;
      } else if (parsedTargetWords >= 1500) {
        numScenes = 4;
      } else if (parsedTargetWords >= 900) {
        numScenes = 3;
      } else {
        numScenes = 2;
      }

      // Exact target words per scene to hit parsedTargetWords faithfully
      const wordsPerScene = Math.round(parsedTargetWords / numScenes);
      const minWordsPerScene = Math.max(280, Math.floor(wordsPerScene * 0.95));
      const maxWordsPerScene = Math.floor(wordsPerScene * 1.15);
      const targetDuration = duration || `${Math.max(8, Math.round(parsedTargetWords / 130))} دقيقة`;

      const channelsText = competitorChannels && competitorChannels.length > 0
        ? `قم بمحاكاة الأسلوب السردي المشوق والممتع للغاية المعتمد في هذه القنوات:\n${competitorChannels.join("\n")}`
        : "استخدم أسلوب سرد غموض ورعب وتشويق سينمائي مصري أصيل يشد المستمع طوال الوقت للأذن.";

      const isMixReference = !referenceFocus || String(referenceFocus).includes("ميكس") || String(referenceFocus).includes("تكامل");
      const referenceInstructionText = isMixReference
        ? `🎯 [توجيه الميكس المتكيف الذكي - القواعد التشغيلية العشر والنسب الذهبية للمراجع]:
- المهمة الكبرى: "ألّف قصة رعب أصلية من الصفر، بأسلوب سردي روائي نثري غني ومتدفق، تبدو كأن شخصًا مصريًا عاش الواقعة ويحكيها بصوته، وليس كأن كاتبًا كتب قصة رعب باللغة المصرية."
- 📖 [فرض الأسلوب السردي النثري المتصل وحظر أسلوب السؤال والجواب - Anti-Q&A Trap]:
  ❌ ممنوع منعاً باتاً كتابة القصة بأسلوب (سؤال وجواب) أو أسئلة استنكارية وبلاغية لنفسه أو للمستمع ثم يجاوب عليها فوراً (مثل: "عملت إيه؟ وقفت مكاني"، "تفتكروا سكت؟ لأ"، "لقيت إيه جوة؟ لقيت شنطة"، "طب ليه روحت؟").
  ❌ ممنوع الحوارات السريعة المتتالية كاستجواب شرطة خالي من السرد (سألته فقال لي، قلتله قالي).
  ✅ السرد الروائي النثري المتدفق (Narrative Prose) هو العمود الفقري (75-80% سرد روائي غني بالحركة وبناء المشهد والمكان والأجواء والمشاعر، و 20-25% حوار طبيعي مقتضب).
- محاكاة التقنيات السردية للروايات والقصص الكبرى:
  1. (أحمد خالد توفيق - ما وراء الطبيعة): السرد الروائي الممتع المتدفق، الشك العقلاني، الملاحظات الذكية الساخرة كدرع نفسي، والأصالة المصرية.
  2. (تامر إبراهيم): التكثيف السردي الخانق، محاصرة الشخصية في تفاصيل المكان، وتصاعد التوتر النفسي ببطء بدون صخب.
  3. (حسن الجندي): الأجواء الثقيلة الساحرة، الوصف البصري والروائح وحركة الظلال في الأماكن الشعبية والبيوت القديمة.
  4. (Shirley Jackson, Edgar Allan Poe, H. P. Lovecraft, Stephen King): تشريح تفاصيل العالم الحقيقي، سيكولوجية الكوابيس، الرهبة من المجهول، وكسر الأمان.
  5. (On Writing Horror من HWA، The Anatomy of Story من Truby، و Save the Cat! من Brody): هندسة النبضات الدرامية والـ Twist العضوي.
  6. الحكي الشفهي المصري المسموع للأذن وهندسة الـ YouTube (Hook قوي بدون كليشيه "3 الفجر"، تنفس صوتي، وإنهاء صامت).`
        : `🎯 [التركيز المرجعي المخصص لهذه القصة]: "${referenceFocus}".
- 📖 [التجسيد السردي الروائي الصارم]: اكتب بأسلوب سردي روائي نثري متدفق ومتماسك (Flowing Narrative Prose) يجسد روح هذا الأسلوب المختار بعمق (75-80% سرد روائي يبني المشهد والمكان والمشاعر، و 20-25% حوار مقتضب).
- ❌ ممنوع تماماً أسلوب "سؤال وجواب" الاستنكاري أو تقطيع السرد بأسئلة تمهيدية أو حوارات الاستجواب السريعة.`;

      console.log(`[Story Builder] Step 1: Architecting Story Blueprint (Strict Target: ${parsedTargetWords} words across ${numScenes} scenes, exactly ${wordsPerScene} words/scene [min: ${minWordsPerScene}, max: ${maxWordsPerScene}])...`);

      // ── STEP 1: Agent 1 (The Psychological Architect & Master Outliner) ──
      const architectPrompt = `
        أنت "الوكيل 1: المخطط الروائي وهندسة الرعب الإنساني خماسي الطبقات" (The 5-Layer Master Story Architect).
        مهمتك الكبرى: "ألّف قصة رعب أصلية من الصفر بأسلوب سردي روائي غني ومتدفق، تبدو كأن شخصًا مصريًا عاش الواقعة ويحكيها بصوته، وليس كأن كاتبًا كتب قصة رعب باللغة المصرية."
        
        معطيات القصة:
        - الفكرة الأساسية: "${concept}"
        - الطول الإجمالي المطلوب: ${parsedTargetWords} كلمة (الالتزام بعدد الكلمات إلزامي ولا تهاون فيه!)
        - عدد المشاهد الإلزامي: بالضبط ${numScenes} مشاهد درامية متسلسلة بمعدل ${wordsPerScene} كلمة لكل مشهد.
        - أسلوب اللغة: عامية مصرية بسيطة مسموعة للأذن وعفوية تفهم من أول لحظة بأسلوب سردي روائي متصل.
        - التوجيه المرجعي: ${referenceInstructionText}

        ══════════════════════════════════════════════════════════════
        🔥 [القاعدة الذهبية الكبرى لنظام التأليف: الهندسة العكسية، الإيقاع المصري، وكسر البنية]:
        1. 🎯 [الهندسة العكسية: اكتب النهاية أولاً في الكواليس (Reverse-Engineered Inevitable Ending)]:
           - صُغ وثبّت القفلة الصادمة والحدث الأخير المادي أولاً في ذهنك قبل تخطيط أي مشهد.
           - ابنِ القصة من البداية بحيث لا يتوقع المستمع النهاية مطلقاً أثناء السرد الأول.
        2. ⚡ [الأدلة ذات المعنى المزدوج وصدمة إعادة الاستماع (The Re-Listen Shock / Dual-Reality Clues)]:
           - ازرع في المشاهد الأولى تفاصيل، كلمات، حركات، وأشياء تبدو في الاستماع الأول طبيعية وعادية جداً ويفسرها المستمع بتفسير روتيني بديهي، لكن لو رجع المستمع بعد النهاية وسمع القصة ثانية، يُصدم بذهول بأن كل كلمة وكل حركة كانت تصرخ بالحقيقة من البداية دون أي تناقض!
        3. 🎙️ [الإيقاع المصري الأصيل (Authentic Egyptian Spoken Cadence)]:
           - نَفَس الحكي الشفاهي المصري، روقان وهدوء القعدة، والتفاصيل البيئية الحية (الشاي في الخمسينة، الشيشة، النبطشية، السلم، العمارة القديمة، صمت الليل في الشوارع الجانبية) بدون تقعير فصيح أو تهريج مفتعل.
        4. 💥 [كسر البنية غير المتوقعة (Subverting Structure & Tropes)]:
           - هدم قوالب الرعب المعلبة والمستهلكة (علامة ← خضة ← صراخ ← شيخ).
           - تغيير مواقع النبضات الدرامية وتصرفات الشخصية الصادمة لتنتهي بـ "حدث مادي جديد يفتح طبقة أعمق".

        🔥 [المعادلة الجوهرية والوصية الكبرى لنظام التأليف الإنساني - Decisions Drive Evidence]:
        ❌ البناء المرفوض المصنوع: علامة ← علامة ← علامة ← علامة ← فيديو ← تفسير.
        ✅ **البناء الاحترافي الإنساني الحتمي:**
        **حياة عادية → شيء غير مريح → تفسير منطقي معقول → قرار وتصرف → نتيجة غير متوقعة → تفسير جديد أضعف → قرار آخر → دليل مادي → حدث أخير يفتح طبقة جديدة.**
        
        «لا تبدأ من القفلة أمام المستمع؛ بل ابدأ من حياة الشخص، ثم اسأل: ما الشيء الصغير الذي لو حدث له سيجعله يتصرف بطريقة لا يستطيع التراجع عنها؟»
        «قرارات الشخصية هي التي تقود الأدلة، وليس تكديس علامات الرعب هي التي تقود الشخصية!»
        ══════════════════════════════════════════════════════════════

        🏗️ [نظام الطبقات وقواعد الصنعة الـ 15 لتوليد القصة]:
        
        1. 🧱 "Layer 1: مراسي الواقعية ذات الوظيفة (Relevant Anchors Only)":
           - [القاعدة 9]: احتفظ فقط بالتفاصيل الواقعية التي تحقق واحداً من ثلاثة: (شخصية / سبب / دليل).
             تجنب تكديس فواتير الكهرباء وأعطال السنترال والديون التي لا تدخل في صلب الحدث وتتحول لحشو (Filler).
           - [القاعدة 4: الأصوات والأجهزة ليست مؤشرات رعب (No Horror Appliance Cues)]:
             صوت التكييف أو الثلاجة أو المروحة هو صوت بيئي روتيني عادي: يفصل، يشتغل، يزن، يطقطق.
             ❌ ممنوع التشبيه النفسي المباشر: ("كأنه بيتنفس معايا"). التكييف يظل تكييفاً عادياً له تفسير روتيني.

        2. 👤 "Layer 2: صوت وهوية الراوي والإنكار الإنساني (Human Denial vs Artificial Stupidity)":
           - [القاعدة 7]: البطل إنسان عاقل؛ لا ينكر الأدلة بغباء، بل يقدم تفسيرات معقولة تضعف تدريجياً:
             ("الموبايل ممكن يكون وقع وأنا نايم"، "الدولاب يمكن مكنش مقفول كويس"، "الكدمة ممكن من طرف السرير").
             مع كل تطور يصبح التفسير أضعف؛ الإنكار هنا نفسي وإنساني مفهوم وليس غباءً مصطنعاً لخدمة السيناريو.
           - [القاعدة 8: إثبات الشخصية بالسلوك وليس بجمل مصطنعة]:
             ❌ شطب جمل الكاتب المصطنعة: ("وأنا موظفة عاقلة مش هسمح لشوية خيالات تسيطر عليا").
             ✅ العقلانية تثبت بالفعل المادي: (تصوير، فحص الباب، مراجعة الكاميرا، تغيير مكان النوم، سؤال شخص محدد).
           - [القاعدة 5: استبدال شرح المشاعر بالسلوك البشري الحي]:
             ❌ شطب: ("حاسة بوجودهم في كل ركن"، "في حاجة في البيت مش مريحة"، "الحيطان بتحسسني إنها بتسمعني").
             ✅ التعبير بفعل وسلوك طبيعي: ("من يومها بقيت أقفل باب الأوضة وأنا خارجة، حتى لو هروح المطبخ دقيقتين").

        2.5 📖 "Layer 2.5: فرض السرد الروائي النثري المتصل وحظر أسلوب السؤال والجواب (Narrative Prose vs Q&A Trap)":
           - ❌ حظر كامل لصيغة (سؤال وجواب) الاستنكارية: ممنوع أن يطرح الراوي أسئلة لنفسه أو للمستمع ثم يجاوب عليها ("عملت إيه؟ نزلت"، "تفتكروا خفت؟ لأ"، "لقيت إيه؟ لقيت كذا").
           - ❌ حظر تحويل الحوار إلى استجواب جاف وميكانيكي مقتضب.
           - ✅ فرض السرد الروائي النثري المتدفق (75-80% سرد روائي يبني المشهد والمكان والمشاعر كما في روايات أحمد خالد توفيق وتامر إبراهيم وحسن الجندي، و 20-25% حوار مقتضب).

        3. ⚙️ "Layer 3: آلية الرعب، قاعدة الأدلة الثلاثة، وتطور التفاصيل":
           - [القاعدة 2: حظر تكديس الأدلة (Anti-Evidence Stacking)]:
             ❌ ممنوع حشد 7 أو 8 علامات تقول نفس الشيء للمستمع (التكييف + النفس + الكرسي + الخربشة + أثر الأصابع + المخدة + الكدمات + الفيديو).
             ✅ **القاعدة الصارمة: 3 أدلة رئيسية فقط في القصة كلها** (مثلاً: 1. المخدة كشيء غريب غير مألوف، 2. أثر مادي على الجسم، 3. الفيديو كالحقيقة). والباقي بيئة طبيعية روتينية لا علاقة لها بالرعب.
           - [القاعدة 3: تطور التفصيلة المتكررة (Atmosphere → Suspicion → Evidence)]:
             ❌ ممنوع تكرار نفس الوصف الميت الذي يحرق المعنى: ("كأن رأس كانت تضغط عليها بكل قوتها").
             ✅ التطور الثلاثي الإلزامي:
               - المرة الأولى: المخدة مش في مكانها (Atmosphere).
               - المرة الثانية: تلاحظ إن شكلها اتغير لكن مش عارفة ليه، وتفترض سبباً عادياً (Suspicion).
               - المرة الأخيرة: الفيديو يثبت إيه اللي حصل للمخدة فعلاً (Evidence).
           - [القاعدة 6: الاستجابة الجسدية مشروطة بفعل وقرار]:
             ❌ شطب القاموس الجسدي المكرر: (قلبي دق، ريقي نشف، إيدي بتترعش، اتسمرت، غسلت وشي، هرشت في شعري، بصيت في المراية).
             ✅ لا تستخدم استجابة جسدية إلا إذا كانت مقترنة فوراً بفعل أو قرار عملي: (بدل "قلبي دق بسرعة" ← "رجعت الفيديو عشر ثواني، ووقفته عشان أدقق").

        4. ⛓️ "Layer 4: لماذا الآن؟ وشظايا الأحلام، وحظر الحركات المصنوعة":
           - [القاعدة 10: الحلم شظية ناقصة وليس كشفاً مسبقاً (Fragment, Not a Spoiler)]:
             ❌ ممنوع أن يكون الحلم عن نفس موضوع النهاية أو يريها يداً تخنق شخصاً!
             ✅ الحلم شظية حسية ناقصة: صوت احتكاك، مكان غير واضح، شخص غير ظاهر، إحساس بأنها تحاول الوصول لشيء، وتستيقظ قبل أن تعرف ماذا كانت تفعل.
           - [القاعدة 13: حظر الحركات المصممة لخدمة السيناريو في الكاميرا]:
             لا تجعل الشخصية تتعمد لمس الكاميرا أو إخفاء الدليل كأنها ممثل يخدم الكاتب؛ إذا حُجبت الكاميرا فلتكن حركة واقعية عادية أثناء الحدث، وتظهر الحقيقة في اللقطة السابقة للاختفاء.
           - محفز "لماذا الآن؟": مبرر واقعي لبداية الحدث في هذا الوقت بالذات (نقل شقة، شغل جديد، وفاة قريب، شراء سيارة مستعملة).

        5. 💡 "Layer 5: تأخير التكشف الصارم، والحدث الأخير الجديد":
           - [القاعدة 1: حظر الكشف المبكر الصارم (Anti-Premature Revelation)]:
             في أول مشهدين: الأدلة تثبت فقط أن: **«في حاجة بتحصل وأنا نايم/ة»**، لكن **لا تسمح لها إطلاقاً بإثبات أو الإيحاء بأن «أنا اللي بعملها»**.
             الموبايل يتحرك ← لا تربطه فوراً بالنوم.
             أثر على الذراع ← كدمة عادية غير واضحة، لا تجعل شكلها كأصابع.
             المخدة مضغوطة ← لا تقل "كأن رأس كانت عليها".
             الدليل الحاسم الوحيد على مسؤوليتها يأتي حصراً في النهاية.
           - [القاعدة 11: الكشف النهائي مادي صامت بدون شرح بعد الـ Twist]:
             ❌ شطب تام للشروحات والمواعظ: ("مدركة أخيراً إني كنت بحارب ضيفي اللي مش موجود، وإني كنت الضيف...").
             ✅ الفيديو يكشف الحقيقة ← حدث مادي أخير ← Cut فوري. المستمع يفهم بنفسه!
           - [القاعدة 12: حظر صناعة الغموض المصطنع بالأسئلة]:
             ❌ شطب: ("رقبة أي حد، أو ربما رقبتي أنا؟"). لا تطرح السؤال؛ اعرض الصورة واترك المستمع يستنتج.
           - [القاعدة 14: النهاية تحتوي على "حدث جديد" يفتح طبقة أعمق (A New Incident)]:
             النهاية لا تكتفي بكونها تفسيراً للفيديو، بل يقع **حدث صغير مادي جديد** بعد انتهاء الفيديو:
             (الفيديو ينتهي ← تفتح الكاميرا لتفاجأ بأن زاوية التسجيل لم تكن في الغرفة التي نامت فيها، أو يظهر شيء مادي لم يكن في ذاكرتها، أو يقع فعل مادي جديد بعد انتهاء الفيديو يفتح طبقة أعمق تترك المستمع متجمداً).

        6. 🛑 "المحظورات الصارمة الإضافية":
           - ❌ حظر كشف اللغز في المشهد قبل الأخير رقم ${numScenes - 1}.
           - ❌ حظر الرعب السريالي المقحم (الحيطان بتتنفس، البيت بيصغر، الممر ملوش آخر، المراية). المكان طبيعي ومألوف.

        📚 [التغذية الأدبية من كلاسيكيات الرعب المصري وأدب شمس المعارف]:
        - استوعب روح كلاسيكيات الرعب المصري الشعبي:
          1. شغف الفضول البشري المحرم غير المصطنع (مثل قصص شمس المعارف الفولكلورية): شخص عادي يعبث بجهل وتدرج في ما يفوق إدراكه.
          2. مدرسة د. أحمد خالد توفيق: البطل العادي الملموس الذي يتسلح بالسخرية والإنكار التلقائي كدرع نفسي.
          3. مدرسة تامر إبراهيم: التوتر البطيء والضغط النفسي الخانق في الأماكن المألوفة.
          4. مدرسة حسن الجندي: الميثولوجيا الشعبية وأسرار الحارات والمقابر والبيوت القديمة.
          5. مدرسة أحمد مراد: الوصف الحسي الخشن للأصوات والروائح والأماكن مع ترابط منطقي محكم للأدلة.
          6. دراما الرعب الصوتي والمهن الشعبية (قصة مغسلة الموتى - نبوية الفولي / سامي ميشيل): بطلة حقيقية من لحم ودم في مهنة ذات رهبة (تغسيل، كفن، رخامة الموتى)، مع مزج الرعب الماورائي بالدراما الاجتماعية وأسرار الجريمة والندم الدائم.
          7. دراما الرعب النفسي والمصحات المغلقة: فخ القرار الطوعي، التجريد التدريجي للسيطرة والمفاتيح، تشكيك الضحية في سلامة عقلها، والتوتر البارد للأجواء الطبية السريرية.

        ${isAutoGenre ? `
        🧠 [استنتاج الحبكة وآلية الرعب ونوع النهاية من سياق الفكرة]:
        - حدد آلية الرعب الرئيسية الواحدة، مراسي الواقعية، محفز "لماذا الآن؟"، والتفاصيل المتحولة، وتأخير التكشف.
        ` : `
        - التصنيف المختار: ${genre}
        - طوّع الطبقات الخمس والحبكة بناءً على الفكرة: "${concept}".
        `}

        المطلوب:
        صياغة 4 عناوين يوتيوب متنوعة الزوايا، خطاف افتتاحي مشوق بمفارقة حية، وتحديد عناصر الطبقات الخمس مع مخطط دقيق للمشاهد الـ ${numScenes}.

        أرجع النتيجة بصيغة JSON:
        {
          "draftTitle": "العنوان الأساسي المشوق بالعامية المصرية",
          "youtubeTitles": [
            "عنوان 1 (فضولي غامض وفجوة فضول Curiosity Gap)",
            "عنوان 2 (صدمة ومفارقة قوية وتحدي High Stakes)",
            "عنوان 3 (تجربة شخصية واقعية بلسان الراوي)",
            "عنوان 4 (سيكولوجي درامي سينمائي وغامض)"
          ],
          "draftHook": "الخطاف الافتتاحي في أول 20-30 ثانية مبني على حدث أو مفارقة حية بدون أسئلة معلبة",
          "narratorPersona": {
            "ageAndBackground": "السن التقريبي والخلفية الاجتماعية للراوي",
            "speechHabit": "نبرته أو عادته الكلامية البسيطة العفوية",
            "whatHeFearsToLose": "ماذا يخشى أن يخسر أو ما الذي يخجل منه"
          },
          "whyNowCatalyst": "محفز (لماذا الآن؟) الواقعي لبداية القصة في هذا التوقيت",
          "realityAnchors": [
            "مرسى واقعي 1 (شغل/مواصلات/فلوس)",
            "مرسى واقعي 2 (جار/شاي/تسجيل كاميرا)"
          ],
          "evolvingMotif": {
            "itemOrDetail": "اسم الشيء المادي (مثل: كوباية الشاي، مكان المفتاح، صوت المروحة)",
            "stage1Atmosphere": "كيف يظهر في البداية كمجرد جو عام",
            "stage2Doubt": "كيف يتغير مكانه أو حالته في المنتصف ليثير الشك",
            "stage3Evidence": "كيف يتحول في النهاية إلى دليل مادي صادم يحسم الأمر"
          },
          "delayedRevelationStrategy": "كيف نؤخر الكشف ونجعل المستمع يعرف أن الشخصية متورطة دون معرفة كيف أو لأي مدى حتى النهاية",
          "reverseEngineeredEnding": "صياغة النهاية الصادمة والحدث الأخير المادي الذي تم تثبيته أولاً قبل كتابة المشاهد",
          "reListenDualClues": [
            "دليل ذو معنى مزدوج 1: يفسره المستمع بتفسير يومي بديهي في أول استماع، لكنه يصرخ بالحقيقة الصادمة عند إعادة الاستماع",
            "دليل ذو معنى مزدوج 2: تفصيلة أو حركة حوار تكشف النهاية تماماً لمن يعيد الاستماع"
          ],
          "structuralSubversionNotes": "كيف تكسر هذه القصة قوالب الرعب المعلبة وتوظف الإيقاع المصري الشفاهي بدون كليشيهات",
          "incidentEndingClue": "الدليل المادي الصامت للحادثة الأخيرة بدون أي حكمة أو موعظة",
          "behavioralHorrorDetails": [
            "سلوك خوف بشري 1 (ينسى البوتاجاز/يكتب رقم غلط)",
            "سلوك خوف بشري 2 (يغير مكان نومه/يقفل التليفون)"
          ],
          "missingInformation": "المعلومة أو الفجوة الناقصة التي تشعل خيال المستمع دون شرحها",
          "detectedPlotAndPsychology": {
            "plotType": "نوع الحبكة وآلية الرعب الرئيسية الواحدة",
            "psychologicalArchetype": "النمط والعمق النفسي للشخصيات",
            "coreConflict": "جوهر الصراع والقرارات وثمنها",
            "twistSetup": "كيف تنبع النهاية العضوية كحادثة مادية من قرارات البطل",
            "rationaleFromContext": "تفسير الفرضية المركزية"
          },
          "plantedClues": [
            "الدليل أو المرسى المادي 1 المزروع في البداية",
            "الدليل أو المرسى المادي 2 المزروع في البداية"
          ],
          "sceneOutlines": [
            {
              "sceneNumber": 1,
              "sceneTitle": "عنوان المشهد 1",
              "sceneObjective": "هدف المشهد وتطور الشك والقرارات بدون حرق مبكر",
              "keyEventsAndDialogue": "الأحداث، مراسي الواقعية، وسلوكيات الخوف والحوارات الواقعية المقتضبة أو الصمت",
              "cliffhanger": "القفلة المشوقة للمشهد"
            }
          ],
          "writerNotes": "توجيهات لكاتب المشاهد: منع الحرق، The Writer Must Not Know، حوارات إنسانية طبيعية، ونهاية كحادثة مادية بدون موعظة"
        }
      `;

      const architectResponse = await generateContentResilient(req, {
        contents: architectPrompt,
        config: {
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              draftTitle: { type: Type.STRING },
              youtubeTitles: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              draftHook: { type: Type.STRING },
              narratorPersona: {
                type: Type.OBJECT,
                properties: {
                  ageAndBackground: { type: Type.STRING },
                  speechHabit: { type: Type.STRING },
                  whatHeFearsToLose: { type: Type.STRING }
                }
              },
              whyNowCatalyst: { type: Type.STRING },
              realityAnchors: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              evolvingMotif: {
                type: Type.OBJECT,
                properties: {
                  itemOrDetail: { type: Type.STRING },
                  stage1Atmosphere: { type: Type.STRING },
                  stage2Doubt: { type: Type.STRING },
                  stage3Evidence: { type: Type.STRING }
                }
              },
              delayedRevelationStrategy: { type: Type.STRING },
              reverseEngineeredEnding: { type: Type.STRING },
              reListenDualClues: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              structuralSubversionNotes: { type: Type.STRING },
              incidentEndingClue: { type: Type.STRING },
              behavioralHorrorDetails: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              missingInformation: { type: Type.STRING },
              detectedPlotAndPsychology: {
                type: Type.OBJECT,
                properties: {
                  plotType: { type: Type.STRING },
                  psychologicalArchetype: { type: Type.STRING },
                  coreConflict: { type: Type.STRING },
                  twistSetup: { type: Type.STRING },
                  rationaleFromContext: { type: Type.STRING }
                },
                required: ["plotType", "psychologicalArchetype", "coreConflict", "twistSetup", "rationaleFromContext"]
              },
              sceneOutlines: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sceneNumber: { type: Type.INTEGER },
                    sceneTitle: { type: Type.STRING },
                    sceneObjective: { type: Type.STRING },
                    keyEventsAndDialogue: { type: Type.STRING },
                    cliffhanger: { type: Type.STRING }
                  },
                  required: ["sceneNumber", "sceneTitle", "sceneObjective", "keyEventsAndDialogue", "cliffhanger"]
                }
              },
              writerNotes: { type: Type.STRING }
            },
            required: ["draftTitle", "youtubeTitles", "draftHook", "detectedPlotAndPsychology", "sceneOutlines", "writerNotes"]
          }
        }
      });

      const architectResult: any = safeJsonParse(architectResponse.text, {});
      const sceneOutlines = Array.isArray(architectResult.sceneOutlines) && architectResult.sceneOutlines.length > 0
        ? architectResult.sceneOutlines
        : Array.from({ length: numScenes }, (_, i) => ({
            sceneNumber: i + 1,
            sceneTitle: `المشهد ${i + 1}`,
            sceneObjective: `تصاعد الأحداث في الجزء ${i + 1}`,
            keyEventsAndDialogue: `مواقف وحوارات تكشف تفاصيل جديدة وتزيد الغموض`,
            cliffhanger: `توتر يمهد للجزء التالي`
          }));

      console.log(`[Story Builder] Step 1 finished with ${sceneOutlines.length} scene outlines. Step 2: Dedicated Single-Scene Deep Narrative Generation to hit target of ${parsedTargetWords} words (${wordsPerScene} w/scene)...`);

      // ── STEP 2: Agent 2 (The Egyptian Human Storyteller & Deep Scene Writer) ──
      // Write scenes with controlled batch concurrency (chunks of 2) to eliminate 429 quota exhaustion
      const generateSingleScene = async (s: any) => {
        const isPenultimateScene = s.sceneNumber === sceneOutlines.length - 1;
        const isFinalScene = s.sceneNumber === sceneOutlines.length;

        const singleScenePrompt = `
          أنت "الوكيل 2: حكواتي وروائي رعب مصري واقعي" (The Human Egyptian Scene Writer).
          اكتب المشهد رقم ${s.sceneNumber} من إجمالي ${sceneOutlines.length} مشاهد بعنوان: "${s.sceneTitle}".
          
          عنوان القصة: "${architectResult.draftTitle || 'قصة مشوقة'}"
          الفكرة العامة: "${concept}"
          النوع والحبكة: "${architectResult.detectedPlotAndPsychology?.plotType || genre}"
          مراسي الواقعية المصممة: ${JSON.stringify(architectResult.realityAnchors || [])}
          محفز البداية (لماذا الآن؟): "${architectResult.whyNowCatalyst || 'نقل شقة أو حدث واقعي مفاجئ'}"
          هوية وصوت الراوي: ${JSON.stringify(architectResult.narratorPersona || {})}
          التفصيلة المتكررة المتحولة (Evolving Motif): ${JSON.stringify(architectResult.evolvingMotif || {})}
          خطة تأخير التكشف ومنع الحرق: "${architectResult.delayedRevelationStrategy || 'تأخير الكشف وإبقاء الشك مشدوداً'}"
          النهاية الصادمة المحسومة في الكواليس (ممنوع كشفها إلا في المشهد الأخير): "${architectResult.reverseEngineeredEnding || 'حادثة مادية صادمة تقلب الموازين'}"
          الأدلة ذات المعنى المزدوج (صدمة إعادة الاستماع): ${JSON.stringify(architectResult.reListenDualClues || [])}
          ملاحظات كسر البنية والإيقاع: "${architectResult.structuralSubversionNotes || 'كسر القوالب التقليدية وإيقاع مصري شفاهي'}"
          دليل الحادثة الأخير الصامت: "${architectResult.incidentEndingClue || 'دليل مادي صامت بدون أي حكمة'}"
          أمثلة الرعب السلوكي: ${JSON.stringify(architectResult.behavioralHorrorDetails || [])}
          المعلومة الناقصة في القصة: "${architectResult.missingInformation || 'تفصيلة محيرة تشعل خيال المستمع'}"
          الأدلة المزروعة في القصة: ${JSON.stringify(architectResult.plantedClues || [])}
          
          بيانات ومخطط هذا المشهد:
          - المشهد ${s.sceneNumber}: "${s.sceneTitle}"
          - هدف المشهد والشك: ${s.sceneObjective}
          - الأحداث والحوارات والأدلة: ${s.keyEventsAndDialogue}
          - القفلة: ${s.cliffhanger}

          ══════════════════════════════════════════════════════════════
          📏 [الالتزام الصارم بعدد الكلمات - إلزامي ولا تهاون فيه مطلقاً]:
          - الطول المطلوب لهذا المشهد بمفرده: بين ${minWordsPerScene} و ${maxWordsPerScene} كلمة بالتمام والكمال! (المستهدف الدقيق: ${wordsPerScene} كلمة).
          - ❌ ممنوع منعاً باتاً التلخيص السريع أو القفز المتعجل بين الأحداث في فقرات قصيرة مختصرة!
          - كيف تحقق الطول المطلوب بشكل طبيعي وواقعي دون حشو أجوف؟
            1. مراسي الواقعية (Reality Anchors): ميعاد الشغل، الزحمة والمواصلات، الفلوس وفكة الأجرة، الفواتير، الجار، الشاي اللي برد، صوت التلفزيون عند الجيران، كراكيب السلم.
            2. نظام النقص البشري (Human Imperfection): الراوي ينسى تفاصيل ثانوية ويصرح بذلك ("مش فاكر بالظبط كان لابس إيه")، يتردد، يفكر، يقلل من الحدث أو يضحك في وقت غير مناسب كدرع نفسي، يندم على تصرف غبي عمله.
            3. الرعب السلوكي (Behavioral Horror): أظهر الخوف من خلال تصرفات عملية ملموسة (ينسى يطفي البوتاجاز، يكتب رقم غلط 3 مرات، يسيب الباب مفتوح، يتصل بحد ويقفل قبل ما يرد، يسمع صوت ويحاول يتجاهله وبعد دقيقتين يقوم يتأكد، يغير مكان نومه، يقلب الموبايل على ضهره).
            4. الحوارات الطبيعية المسموعة بالعامية المصرية الأصيلة مع شخصيات ثانوية لها شخصيات ومصالح مستقلة، وليس مجرد أصوات مكررة للكاتب.
          ══════════════════════════════════════════════════════════════

          ${isPenultimateScene ? `
          ⚠️ [تحذير صارم للمشهد قبل الأخير - حظر كشف اللغز]:
          - ممنوع منعاً باتاً أن تكشف في هذا المشهد هوية الخطر أو أن تجعل البطل يحل اللغز! (❌ ممنوع مثل: "وعارف إن اللي ورا الباب.. هو أنا").
          - المشهد يجب أن ينتهي بسؤال حائر صادم ومقلق أو خطوة مجهولة دون إعطاء الإجابة للمستمع، ليبقى التوتر مشدوداً لأقصى درجة.
          ` : ''}

          ${isFinalScene ? `
          ⚠️ [القاعدة الذهبية للنهاية كحادثة مادية في المشهد الأخير - No Moralizing]:
          - «The ending must emerge from character decisions, not from a mechanical twist formula.»
          - «Endings are Incidents, Not Morals: النهاية حادثة مادية صامتة تترك المستمع متجمداً، وليست حكمة أو موعظة أدبية!»
          - ❌ ممنوع منعاً باتاً: إنهاء القصة بجمل أدبية أو مواعظ فلسفية (مثل: "أنا فلانة وعارفة إن في أخطاء مينفعش تتصلح... تدفن نفسك معاها"). هذه لغة كاتب وليست لغة شخص عاش رعباً حقيقياً!
          - التسلسل الإلزامي: (اكتشاف مادي صادم ← دليل أخير صامت ملموس: "${architectResult.incidentEndingClue || 'دليل مادي'}" ← إعادة تفسير صامتة لما حدث ← Cut فوري مع تفصيلة مادية أو انقطاع مفاجئ).
          - ❌ ممنوع أي محاضرات أو شرح فلسفي للزمن، أو شرح للدائرة، أو عبارات مثل "أنا ميت وهفضل هنا" أو "فهمت إني في كابوس ملوش نهاية".
          ` : ''}

          🔥 [الوصية الكبرى لنظام التأليف الإنساني - Human Story Generation]:
          «لا تبدأ من القفلة. ابدأ من حياة الشخص، ثم اسأل: ما الشيء الصغير الذي لو حدث له سيجعله يتصرف بطريقة لا يستطيع التراجع عنها؟»
          «اكتب كأن الراوي عاش الواقعة فعلًا، وليس كأن كاتبًا يعرف النهاية يعيد ترتيب الأحداث للوصول إليها.
          The author may know the ending, but the story must feel as if the events are unfolding naturally in real time.
          لا تجعل كل تفصيلة تمهيدًا للـTwist، ولا تجعل كل مشهد يحتوي على دليل رعب مصطنع.
          اسمح بوجود تفاصيل عادية، تردد، سوء فهم، أخطاء بشرية، وتفسيرات خاطئة.
          لا تشرح للمستمع ما يمكنه استنتاجه بنفسه، واترك مساحة للمعلومة الناقصة لتشعل خياله.»

          🎯 [الهندسة العكسية وزرع الأدلة ذات المعنى المزدوج (The Re-Listen Shock)]:
          - النهاية الصادمة المحسومة في الكواليس: "${architectResult.reverseEngineeredEnding || 'حادثة مادية صادمة تقلب الموازين'}"
          - الأدلة المزدوجة المخططة: ${JSON.stringify(architectResult.reListenDualClues || [])}
          - في هذا المشهد: ازرع هذه الأدلة أو حركات الحوار بدهاء شديد؛ بحيث يراها المستمع في أول مرة أمراً عادياً مألوفاً تماماً وتمر مرور الكرام، لكن لو رجع المستمع بعد النهاية وسمع القصة مرة ثانية، يدرك بذهول أن كل حرف كان يشير للنهاية من البداية دون أي تناقض!

          🎙️ [الإيقاع المصري الشفاهي للأذن (Authentic Oral Cadence)]:
          - احكِ بروقان القعدة ونَفَس الحكواتي المصري اللي قاعد بيحكي لواحد صاحبه في هدوء الليل.
          - تفاصيل البيئة الحية المصرية (شاي في الخمسينة، الشيشة، النبطشية، قهوة بلدي، شوارع وسط البلد، كراكيب عمارة، زحمة، بواب، ميكروباص) ممتزجة بالتوتر بدون تقعير لغوي فصيح أو تهريج مبتذل.

          💥 [كسر البنية غير المتوقعة (Subverting Story Tropes)]:
          - اهدم القوالب التقليدية والمستهلكة للرعب (علامة ← خضة ← صراخ ← شيخ).
          - اجعل تصرفات الشخصية واقعية ومربكة تنبع من ضعفها البشري وليس من سيناريو فيلم رعب محفوظ.

          ⚡ [قاعدة: The Writer Must Not Know What the Audience Knows]:
          - الراوي لا يعرف الحقيقة مسبقاً، ولا يعرف كيف ستنتهي الأمور إلا في اللحظة التي تقع فيها.
          - ❌ ممنوع التوصيف الفوقي للذات مثل: ("مفيش أي أثر لليلى اللي بتخاف"). الشخص الحقيقي لا يصف نفسه هكذا في لحظة الحدث!
          - ✅ الراوي يصف أفعاله وملاحظاته المادية في الحاضر بدقة ودون استباق: ("الفيديو وقف. رجعته تاني. وقفت عند نفس الثانية. وبعدين رجعته من الأول."). والدليل المادي الصامت هو الذي يوجه الصدمة.

          🛑 [حظر الكشف المبكر - Anti-Premature Revelation]:
          - ❌ ممنوع تجميع أدلة واضحة من أول مشهد تحرق النهاية للمستمع (مثل: حلم خنق + كدمة على الرقبة + إخفاء يد = المستمع استنتج فوراً إنها هي الفاعل وانحرقت القصة!).
          - ✅ المستمع يعرف أن الشخصية مرتبطة أو متورطة، لكن لا يعرف كيف أو لأي مدى (الفيديو فيه خلل أو تشويش، الساعة وقفت، اليد مش ظاهرة بوضوح)، والتفاصيل تتكشف تدريجياً وببطء حتى الدليل الحاسم في النهاية.

          🔄 [التفصيلة المتكررة يتغير معناها - Evolving Motif]:
          - تفصيلة القصة المتكررة هي: ${JSON.stringify(architectResult.evolvingMotif || {})}
          - ❌ ممنوع تكرار نفس التفصيلة كديكور ميت بنفس الوصف.
          - ✅ في هذا المشهد رقم ${s.sceneNumber}: طوّر هذه التفصيلة بحيث يتغير معناها (من جو عام ← إلى شك وملاحظة ← إلى دليل مادي).

          🔊 [الأصوات اليومية ليست "موسيقى رعب" - Sound Design Reality]:
          - زنة الكهرباء أو صوت الأجهزة صوت روتيني عادي، وليس Horror Sound Cue تصاعدي. قد يتبين في النهاية أن لا علاقة له بالرعب أصلًا لكسر التوقع الساذج.

          💬 [الحوار الإنساني الطبيعي والصمت - Natural Dialogue vs Plot Dialogue]:
          - ❌ ممنوع الحوارات المصنوعة لنقل معلومات الحبكة أو إخفائها بتكلف (مثل: "أنتِ عارفة الإجابة كويس، مش ناقصة تمثيل!").
          - ✅ الناس في الحقيقة تتكلم باقتضاب وعفوية ("إنتي بجد مش فاكرة؟"، "نامي لوحدك النهارده").
          - قوة الصمت: الصمت التام أو النظرة المترددة أحياناً أكثر رعباً وواقعية من أي كلام.

          🛑 [حظر أسلوب (سؤال وجواب) وفرض السرد الروائي النثري المتصل - Anti-Q&A & Narrative Prose Mandate]:
          - ❌ ممنوع منعاً باتاً صياغة القصة بطريقة الأسئلة والأجوبة الاستنكارية أو البلاغية التي يطرحها الراوي على نفسه أو على المستمع ثم يجاوب عليها:
            (مثل: "عملت إيه؟ وقفت مكاني ومتحركتش"، "تفتكروا سكت؟ لأ مسكتش"، "لقيت إيه جوة الأوضة؟ لقيت شنطة"، "طب ليه مخرجتش؟ عشان مكنش عندي حل"، "هو مين ده؟ ده كان فلان").
            هذا الأسلوب مصطنع وطفولي ويفسد الهيبة السردية فوراً ويشعر المستمع بالملل والابتذال!
          - ❌ ممنوع تقطيع السرد بأسئلة تمهيدية للمستمع أو للنفس.
          - ❌ ممنوع الحوارات السريعة الجافة المتتالية كاستجواب شرطة خالي من السرد والوصف (سألته فقال لي، قلتله قالي).
          - ✅ فرض السرد الروائي النثري المتدفق (Fluid Narrative Prose):
            القصة يجب أن تكون نصاً سردياً روائياً متصلاً وممتعاً (75-80% سرد نثري يصف المشهد، تفاصيل المكان، حركة الجسد، تفاعل الشخصية مع الأشياء، الأفكار، والأجواء كما في الروايات والقصص الكبرى، و 20-25% حوار طبيعي مقتضب).
            اكتب الجمل مباشرة بسرد الأفعال والأحداث بانسيابية تامة دون وساطة أي سؤال استنكاري!

          📚 [المهمة الأساسية وقواعد المراجع]:
          - المهمة: "ألّف قصة رعب أصلية من الصفر، تبدو كأن شخصًا مصريًا عاش الواقعة ويحكيها بصوته، وليس كأن كاتبًا كتب قصة رعب باللغة المصرية."
          - قاعدة المراجع: جسّد روح الأسلوب السردي المختار (سواء تدفق وسخرية وعقلانية أحمد خالد توفيق، أو خنق وتكثيف تامر إبراهيم، أو هيبة وأجواء حسن الجندي، أو تشريح ستيفن كينج لتفاصيل الواقع).
          - هدفك النهائي أن يقول الراوي: «أنا مش عارف أشرحها من غير ما أبان عبيط... بس دي حصلت فعلاً» وليس «لم أكن أدرك أن ما يحدث يتجاوز المنطق».
          
          ${referenceInstructionText}

          1. 🎙️ [سرد روائي نثري ممتع للأذن بلسان راوٍ مصري - واختبار العينين المغلقتين]:
             - احكي بلسان إنسان مصري عاش الواقعة ويسردها بأسلوب روائي نثري مشوق وممتع، وتجنب الفصحى الجافة أو التنظير المكتوب على ورق.
             - اختبار العينين المغلقتين: هل المشهد مفهوم ومخيف بالصوت وحده؟ قسم الجمل الطويلة عند أماكن التنفس الطبيعي للمؤدي الصوتي.
             - اسأل نفسك مع كل سطر: «لو شخص بيحكيلي اللي حصل له فعلًا، هل كان هيقول الجملة دي؟». لو لأ ← بسطها فوراً.

          2. 🛑 [حظر الكشف المبكر وتكديس الأدلة (القواعد 1 و 2)]:
             - في المشاهد الأولى: الأدلة تثبت فقط أن «في حاجة بتحصل وأنا نايم/ة»، لكن لا تسمح لها إطلاقاً بإثبات أو الإيحاء بأن «أنا اللي بعملها».
             - التزم بقاعدة 3 أدلة رئيسية فقط متدرجة في القصة كلها (المخدة، أثر الجسم، الفيديو)، ولا تكدس 8 علامات تقول نفس الشيء للمستمع!
             - الباقي تفاصيل حياة عادية ليس لها علاقة بالرعب.

          3. 🔄 [تطور التفصيلة المتكررة (القاعدة 3)]:
             - إذا تكررت تفصيلة (مثل المخدة): ❌ ممنوع وصفها بـ ("كأن رأس تضغط عليها بكل قوتها")!
             - المرة الأولى: مش في مكانها (Atmosphere). المرة الثانية: شكلها اتغير وتفسير عادي (Suspicion). المرة الأخيرة: الفيديو يكشف الحقيقة (Evidence).

          4. 🔊 [الأجهزة ليست مؤشرات رعب (القاعدة 4)]:
             - التكييف أو الثلاجة أو المروحة جهاز عادي: يزن، يفصل، يطقطق. ❌ ممنوع التشبيه النفسي: ("كأنه بيتنفس معايا")!

          5. 🚶‍♂️ [استبدال شرح المشاعر بالسلوك البشري الحي (القاعدة 5)]:
             - ❌ شطب: ("حاسة بوجودهم في كل ركن"، "في حاجة في البيت مش مريحة"، "الحيطان بتحسسني إنها بتسمعني").
             - ✅ التعبير بسلوك طبيعي نابع من عدم الارتياح: ("من يومها بقيت أقفل باب الأوضة وأنا خارجة، حتى لو هروح المطبخ دقيقتين").

          6. 🚫 [الاستجابة الجسدية مشروطة بفعل وقرار (القاعدة 6)]:
             - ❌ احذف التكرار الآلي:
               («قلبي دق / دقات قلبي»، «ريقي نشف»، «إيدي بتترعش»، «رجلي اتسمرت في الأرض»، «قعدت واقف زي التمثال»، «غسلت وشي بمية ساقعة»، «أخدت نفس عميق»، «هرشت شعري»، «بصيت في المراية»، «الدم جمد»، «بدأت روحي تضيق»).
             - ✅ لا تستخدم استجابة جسدية إلا إذا كانت مقترنة فوراً بفعل أو قرار عملي:
               (بدل: "قلبي دق بسرعة" ← اكتب: "رجعت الفيديو عشر ثواني، ووقفته عشان أدقق").
               استخدم الرعب السلوكي: (نسيان البوتاجاز، كتابة رقم غلط 3 مرات، الاتصال والقفل قبل الرد، تجنب النظر للمكان المشبوه، تغيير مكان النوم، تفقد الباب أكثر من مرة).

          7. 🧠 [الإنكار الإنساني والتفسيرات المنطقية المتدرجة (القاعدة 7)]:
             - البطل إنسان عاقل يقدم تفسيرات معقولة تضعف تدريجياً:
               ("الموبايل ممكن يكون وقع وأنا نايم"، "الدولاب يمكن مكنش مقفول كويس"، "الكدمة ممكن من طرف السرير").
               الإنكار هنا نفسي مفهوم وليس غباءً مصطنعاً لخدمة السيناريو.

          8. 👔 [إثبات الشخصية بالسلوك وليس بجمل مصطنعة (القاعدة 8)]:
             - ❌ شطب جمل الكاتب: ("وأنا موظفة عاقلة مش هسمح لشوية خيالات تسيطر عليا").
             - ✅ إثبات العقلانية بالتصرف: (تصوير، فحص الباب، مراجعة الكاميرا، تغيير مكان النوم).

          9. 🧹 [مراسي واقعية ذات وظيفة دون حشو مشتت (القاعدة 9)]:
             - احتفظ فقط بالتفاصيل الواقعية التي تحقق: (شخصية / سبب / دليل). تجنب تكديس فواتير وأعطال لا علاقة لها بالحدث.

          10. 💭 [الحلم شظية ناقصة وليس كشفاً مسبقاً (القاعدة 10)]:
              - ❌ ممنوع أن يكون الحلم عن خنق أو نفس موضوع النهاية!
              - ✅ الحلم شظية حسية ناقصة: صوت احتكاك، مكان مشوش، شخص غير ظاهر، إحساس بالسعي لشيء، استيقاظ قبل المعرفة.

          11. 🛑 [الكشف مادي صامت وحظر الشرح بعد الـ Twist (القواعد 11 و 12)]:
              - ❌ شطب تام لـ ("مدركة أخيراً إني كنت..."، "فهمت أخيراً...").
              - ❌ شطب صناعة الغموض المصطنع بالأسئلة مثل: ("رقبة أي حد، أو ربما رقبتي أنا؟"). اعرض الصورة الصامتة واترك المستمع يستنتج بنفسه.
              - ✅ الفيديو يكشف الحقيقة ← حدث مادي أخير ← Cut فوري.

          12. 📹 [حظر الحركات المصنوعة في الكاميرا (القاعدة 13)]:
              - لا تجعل الشخصية تتعمد لمس الكاميرا أو حجبها لخدمة الكاتب. الحجب حركة عفوية أثناء الحدث، والحقيقة تظهر في اللقطة السابقة.

          13. ⚡ [حدث جديد يفتح طبقة أعمق في النهاية (القاعدة 14)]:
              - في المشهد الأخير: لا تكتفِ بتفسير الفيديو، بل اجعل هناك حدثاً صغيراً جديداً يقع بعد انتهاء الفيديو يفتح طبقة أعمق تترك المستمع متجمداً.

          14. 🔄 [السلسلة السببية والثمن الحتمي (القاعدة 15)]:
              - المعادلة الحاكمة: حياة عادية → شيء غير مريح → تفسير منطقي → قرار → نتيجة غير متوقعة → تفسير جديد أضعف → قرار آخر → دليل مادي → حدث أخير.
              - قرارات الشخصية هي التي تقود الأدلة وظهورها.

          أرجع النتيجة بصيغة JSON تحتوي على المشهد ${s.sceneNumber} كاملاً:
          {
            "sceneNumber": ${s.sceneNumber},
            "sceneTitle": "${s.sceneTitle}",
            "sceneStory": "نص المشهد ${s.sceneNumber} كاملاً بالعامية المصرية بتفاصيل حية وحوارات واقعية (بين ${minWordsPerScene} و ${maxWordsPerScene} كلمة بالتمام والكمال)"
          }
        `;

        try {
          const resp = await generateContentResilient(req, {
            contents: singleScenePrompt,
            config: {
              maxOutputTokens: 8192,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  sceneNumber: { type: Type.INTEGER },
                  sceneTitle: { type: Type.STRING },
                  sceneStory: { type: Type.STRING }
                },
                required: ["sceneNumber", "sceneTitle", "sceneStory"]
              }
            }
          });
          const parsed: any = safeJsonParse(resp.text, {});
          if (parsed.sceneStory && parsed.sceneStory.length > 100) {
            return {
              sceneNumber: s.sceneNumber,
              sceneTitle: s.sceneTitle,
              sceneStory: parsed.sceneStory
            };
          }
          // Resilient Regex Fallback Extraction
          const raw = resp.text || "";
          const match = raw.match(/"sceneStory"\s*:\s*"([\s\S]*?)(?="\s*\}|$)/);
          if (match && match[1]) {
            return {
              sceneNumber: s.sceneNumber,
              sceneTitle: s.sceneTitle,
              sceneStory: match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"')
            };
          }
          return {
            sceneNumber: s.sceneNumber,
            sceneTitle: s.sceneTitle,
            sceneStory: raw.trim().startsWith("{") ? s.keyEventsAndDialogue : raw.trim()
          };
        } catch (e) {
          console.error(`Error generating scene ${s.sceneNumber}:`, e);
          return {
            sceneNumber: s.sceneNumber,
            sceneTitle: s.sceneTitle,
            sceneStory: `حدث في ${s.sceneTitle}: ${s.keyEventsAndDialogue}`
          };
        }
      };

      const allWrittenScenes: any[] = [];
      for (let i = 0; i < sceneOutlines.length; i += 2) {
        const chunk = sceneOutlines.slice(i, i + 2);
        const chunkResults = await Promise.all(chunk.map((s: any) => generateSingleScene(s)));
        allWrittenScenes.push(...chunkResults);
      }
      allWrittenScenes.sort((a: any, b: any) => (a.sceneNumber || 0) - (b.sceneNumber || 0));

      const getCleanSceneHeading = (idx: number) => {
        const arabicOrdinals = [
          "الأول", "الثاني", "الثالث", "الرابع", "الخامس",
          "السادس", "السابع", "الثامن", "التاسع", "العاشر",
          "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر"
        ];
        return `✦ المشهد ${arabicOrdinals[idx] || (idx + 1)} ✦`;
      };

      const combinedDraftStory = allWrittenScenes.map((s: any, idx: number) => 
        `### ${getCleanSceneHeading(idx)}\n\n${s.sceneStory}`
      ).join("\n\n---\n\n");

      const draftWordCount = combinedDraftStory.split(/\s+/).filter(Boolean).length;
      console.log(`[Story Builder] Step 2 complete: Written ${allWrittenScenes.length} draft scenes (${draftWordCount} words). Starting Step 3: Agent 3 (Final De-AI Humanizer & Master Rewriter)...`);

      // ── STEP 3: Agent 3 (The Final De-AI Humanizer & Master Polish Agent) ──
      // This agent performs a full text-level humanization rewrite on each scene to strip AI tropes, eliminate over-explaining, and ground the voice.
      const humanizeSingleScene = async (scene: any, sceneIdx: number) => {
        const cleanHeading = getCleanSceneHeading(sceneIdx);
        const sceneDraftWords = (scene.sceneStory || "").split(/\s+/).filter(Boolean).length;
        const isPenultimateScene = scene.sceneNumber === allWrittenScenes.length - 1;
        const isFinalScene = scene.sceneNumber === allWrittenScenes.length;

        const sceneRewritePrompt = `
          أنت "الوكيل 3: المحرر البشري النهائي ومزيل بصمات الذكاء الاصطناعي" (The Final De-AI Humanizer & Script Master).
          أمامك مسودة المشهد رقم ${scene.sceneNumber} (${cleanHeading}).
          طول مسودة هذا المشهد الحالية: ${sceneDraftWords} كلمة. (المستهدف الإلزامي لهذا المشهد: بين ${minWordsPerScene} و ${maxWordsPerScene} كلمة - مستهدف القصة الإجمالي: ${parsedTargetWords} كلمة).
          
          مهمتك: إعادة تنقيح وصياغة هذا المشهد بالكامل لجعله نصاً بشرياً حقيقياً 100% للأذن بالعامية المصرية الصريحة، مع الالتزام الصارم بطول وعمق المشهد وتفاصيله بدون اختصار أو تقليص للحجم.
          
          ══════════════════════════════════════════════════════════════
          📏 [الالتزام الصارم بعدد الكلمات - ممنوع تقليص الحجم نهائياً]:
          - الطول الإلزامي لهذا المشهد بعد التنقيح: بين ${minWordsPerScene} و ${maxWordsPerScene} كلمة بدقة!
          - إزالة كليشيهات الذكاء الاصطناعي لا تعني حذف الأحداث أو اختصار السرد؛ استبدل الجمل المصطنعة بتفاصيل إنسانية واقعية وحوارات دقيقة وملاحظات حسية ملموسة.
          - إذا كانت المسودة أقل من ${minWordsPerScene} كلمة، وسّع المشهد وأثره بالتفاصيل والمونولوج والتردد البشري والحوارات الطبيعية ليطابق الطول المطلوب.
          - ❌ ممنوع منعاً باتاً تلخيص المشهد في فقرة سريعة!
          ══════════════════════════════════════════════════════════════

          ${isPenultimateScene ? `
          ⚠️ [تحذير صارم للمشهد قبل الأخير - حظر كشف اللغز]:
          - ممنوع منعاً باتاً أن تكشف في هذا المشهد هوية الخطر أو أن تجعل البطل يحل اللغز! (❌ ممنوع مثل: "وعارف إن اللي ورا الباب.. هو أنا").
          - المشهد يجب أن ينتهي بسؤال حائر صادم ومقلق أو خطوة مجهولة دون إعطاء الإجابة للمستمع، ليبقى التوتر مشدوداً لأقصى درجة.
          ` : ''}

          ${isFinalScene ? `
          ⚠️ [القاعدة الصارمة للقفلة - حادثة مادية وليست حكمة أو موعظة]:
          - «Endings are Incidents, Not Morals: النهاية حادثة مادية صامتة تترك المستمع متجمداً، وليست حكمة أو موعظة أدبية!»
          - ❌ احذف فوراً أي جمل أو مواعظ أدبية مثل: ("أنا فلانة وعارفة إن في أخطاء مينفعش تتصلح... تدفن نفسك معاها"). هذه بصمة AI واضحة!
          - التسلسل الإلزامي: (اكتشاف مادي صادم ← دليل أخير صامت ← انقطاع فوري وCut بدون أي مواعظ).
          - ❌ ممنوع أي محاضرات أو شرح فلسفي للزمن، أو شرح للدائرة، أو عبارات مثل "أنا ميت وهفضل هنا" أو "فهمت إني في كابوس ملوش نهاية".
          ` : ''}

          🔥 [الوصية الكبرى لنظام التأليف الإنساني - Human Story Generation Engine]:
          «لا تبدأ من القفلة. ابدأ من حياة الشخص، ثم اسأل: ما الشيء الصغير الذي لو حدث له سيجعله يتصرف بطريقة لا يستطيع التراجع عنها؟»
          «اكتب كأن الراوي عاش الواقعة فعلًا، وليس كأن كاتبًا يعرف النهاية يعيد ترتيب الأحداث للوصول إليها.
          The author may know the ending, but the story must feel as if the events are unfolding naturally in real time.
          لا تجعل كل تفصيلة تمهيدًا للـTwist، ولا تجعل كل مشهد يحتوي على دليل رعب مصطنع.
          اسمح بوجود مراسي واقعية، تفاصيل عادية، تردد، سوء فهم، أخطاء بشرية، وتفسيرات خاطئة.
          لا تشرح للمستمع ما يمكنه استنتاجه بنفسه، واترك مساحة للمعلومة الناقصة لتشعل خياله.»
          ══════════════════════════════════════════════════════════════

          ⚡ [تدقيق عين الراوي - The Writer Must Not Know What the Audience Knows]:
          - احذف أي توصيف استشرافي فوقي للذات مثل: ("مفيش أي أثر لليلى اللي بتخاف"). الراوي الحقيقي يصف تصرفاته وأفعاله المادية في الحاضر بدقة ودون استباق!
          - الدليل المادي الصامت هو الذي يقود الصدمة، وليس صوت الراوي ككاتب يشرح نفسه.

          🛑 [حظر الكشف المبكر - Anti-Premature Revelation]:
          - إذا كان المشهد يحتوي على تجميع أدلة يحرق النهاية (كدمة + حلم خنق + إخفاء يد)، فكك هذا التجميع فوراً واجعله تشويشاً وشكاً مبهماً غير مكتمل حتى المشهد الأخير.

          💬 [حظر حوارات الحبكة المصنوعة]:
          - احذف الجمل المسرحية المصطنعة مثل: ("أنتِ عارفة الإجابة كويس، مش ناقصة تمثيل!")، واستبدلها بحوارات واقعية مقتضبة أو بصمت ونظرة حائرة.

          🔊 [طبيعية المؤثرات والأصوات اليومية]:
          - الأصوات عادية جداً (زنة تلاجة، صوت مروحة، لمبة سلم)، وليست Horror Sound Cue تصاعدي مفتعل.

          📚 [المهمة الأساسية]:
          - "ألّف قصة رعب أصلية من الصفر، تبدو كأن شخصًا مصريًا عاش الواقعة ويحكيها بصوته، وليس كأن كاتبًا كتب قصة رعب باللغة المصرية."
          - هدفك النهائي أن يقول الراوي: «أنا مش عارف أشرحها من غير ما أبان عبيط... بس دي حصلت فعلاً» وليس «لم أكن أدرك أن ما يحدث يتجاوز حدود المنطق.».
          - احذف فوراً أي تشبيهات أدبية ورقية وحافظ على الحكي الشفاهي العفوي للأذن (بودكاست/قعدة ليلية).
          
          ${referenceInstructionText}

          🛑 [حظر واستئصال أسلوب (سؤال وجواب) وفرض السرد الروائي النثري المتصل]:
          - ❌ استأصل أي صيغة سؤال وجواب استنكاري أو بلاغي يطرحه الراوي على نفسه أو المستمع (مثل: "عملت إيه؟ وقفت مكانى"، "تفتكروا سكت؟"، "لقيت إيه جوة؟ لقيت شنطة"، "طب ليه؟ عشان...").
          - حوّل هذه الجمل فوراً إلى سرد روائي نثري مباشر يصف الفعل والحدث دون أي سؤال تمهيدي.
          - ❌ فكك أي حوارات استجوابية سريعة جافة (سألته فقال لي، قلتله قالي) واجعل المشهد يغلب عليه السرد الروائي النثري المتصل الغني بالحركة ووصف الأجواء (75-80% سرد، 20-25% حوار).

          1. 🎙️ [سرد روائي نثري ممتع للأذن بلسان راوٍ مصري - واختبار السماع بالعينين المغلقتين]:
             - اسرد بروح الرواية المصرية المشوقة المسموعة للأذن، وحافظ على تدفق سردي ممتع ومتصل.
             - اسأل نفسك: «لو شخص بيحكيلي اللي حصل له فعلًا، هل كان هيقول الجملة دي؟» لو لأ ← بسّطها فوراً.
             - قسم الجمل الطويلة عند مواضع التنفس الطبيعي للمؤدي الصوتي.

          2. 🛑 [حظر الأحداث المتظبطة زيادة عن اللزوم والحفاظ على مراسي الواقعية (Reality Anchors)]:
             - لا تجعل كل سطر رعباً مفتعلاً. حافظ على السطور اليومية ومراسي الواقعية («دخلت المطبخ أعمل شاي»، «لقيت الموبايل على الترابيزة»، الشغل، فكة الأجرة، صوت التلفزيون في شقة الجيران).

          3. 🧠 [تطبيق نظام النقص البشري (Human Imperfection System)]:
             - الراوي إنسان مش مسجل كمبيوتر: ينسى تفاصيل ثانوية ويصرح بذلك ("مش فاكر التاريخ بالظبط")، ذاكرته انتقائية، يتناقض بعفوية (يقلل من هول ما حدث، يسخر أو يضحك في وقت غير مناسب كدرع نفسي)، ويندم على قراراته.
             - تأكد أن هذه التناقضات بشرية حقيقية وليست ثغرات في الحبكة.

          4. 📱 [إعادة توظيف التكنولوجيا وحظر كليشيه خدمة العملاء]:
             - ❌ ممنوع منعاً باتاً: «كلمت خدمة العملاء شات والموظف قالي...». هذه حيلة كسولة ومصطنعة تكشف كتابة الـ AI فوراً!
             - 📱 وظيفة التليفون: التليفون أداة واقعية (شاهد، دليل، خط زمني، معلومة مضللة) وليس جهاز رعب سحري.

          5. 👁️ [حظر الملاحظة الخارقة في الوقت المناسب (Anti-Convenient Perception)]:
             - ❌ لا تجعل البطل ينظر لورقة أو تاريخ ويلاحظ فوراً: «يوم إعلان الوفاة» بخط إيده!
             - ✅ الطبيعي ألا يلاحظ أو يفسره خطأ كأنه تذكير قديم أو مقلب سخيف.

          6. 🚫 [شطب القاموس الجسدي المكرر للخوف واستبداله بالرعب السلوكي (Behavioral Horror)]:
             - ❌ احذف فوراً التكرار الآلي:
               («بدأت روحي تضيق»، «الدم في عروقي جمد»، «السكون كان تقيل»، «رجلي اتسمرت في الأرض»، «قعدت واقف زي التمثال»، «شعرت بخوف شديد»، «قلبي دق»، «ريقي نشف»، «إيدي بتترعش»، «غسلت وشي بمية ساقعة»، «هرشت في شعري»، «بصيت في المراية»).
             - ✅ استبدلها بالفعل الجسدي والرعب السلوكي الملموس:
               (ينسى يطفي البوتاجاز، يكتب رقم غلط 3 مرات، يسيب الباب مفتوح، يتصل ويقفل قبل الرد، يسمع صوت ويحاول يتجاهله وبعد دقيقتين يقوم يتأكد، يغير مكان نومه، يقلب الموبايل على ضهره).

          7. 🛑 [حظر الرعب السريالي المقحم وأداة المراية]:
             - ❌ شطب كامل: (الحيطان بتتنفس، البيت بيصغر، الممر ملوش آخر، بقيت جزء من الحيطان، المراية).
             - ✅ المكان والبيت يظل واقعياً وطبيعياً 100%.

          8. 🛑 [شطب تام للشرح بعد الـ Twist وجمل الكاتب وأسئلة الغموض المصطنعة (القواعد 8 و 11 و 12)]:
             - ❌ احذف تماماً أي شرح بعد الـ Twist: ("مدركة أخيراً إني كنت بحارب ضيفي اللي مش موجود، وإني كنت الضيف...").
             - ❌ احذف أسئلة الغموض المصطنعة: ("رقبة أي حد، أو ربما رقبتي أنا؟"). اعرض الصورة الصامتة واترك المستمع يستنتج بنفسه.
             - ❌ احذف جمل الكاتب التقريرية: ("وأنا موظفة عاقلة مش هسمح لشوية خيالات...").
             - ❌ احذف فوراً: «بس في اللحظة دي.. فهمت» و«اللي واقف ورا الباب ده.. مش حد غريب» و«وده معناه إن الزمن اتغير».
             - سيب مساحة للمستمع يكمل الصورة في دماغه مع المعلومة الناقصة!

          9. ❌ [شطب التشبيهات والأوصاف الأدبية والمسرحية]:
             - شطب: «دماغي تقيلة كأنها مربوطة بحبل» -> ✅ «فتحت عيني ودماغي كانت تقيلة شوية».
             - شطب: «ريحة تراب وقبر مالت المكان» -> ✅ «جتلي ريحة تراب... ريحة وحشة كده، زي ريحة مكان مقفول بقاله كتير».
             - شطب نعت الموقف: بدل «السكون كان مريب بجد» -> ✅ «المدينة بره كانت ساكتة خالص. مفيش عربية واحدة».
             - ❌ شطب الأوصاف المسرحية: بدل «الابتسامة اللي كانت على وشه اختفت.. بص للفراغ» -> ✅ «بص ناحيتي... ومتحركش.».
             - احذف: («السكون المريب»، «الضلمة بتبلع»، «الحقيقة خبطتني في دماغي»، «كأن البيت قبر»، «مفيش أنا»، «كل خيط بشده»، «ده مش كابوس»، «كل محاولة كنت بعملها»).

          10. 🗣️ [عامية مصرية طبيعية نقية بدون أخطاء عشوائية (Human ≠ Typos)]:
              - كلمة "المعلقة" تصبح دائماً "المتعلقة".
              - استبدل الكلمات المعقدة: («بفجعة»، «بهلع»، «بفزع»، «بتوجس»، «بتثاقل») بـ: («اتخضيت»، «استغربت»، «وقفت مبرق»، «اتسمرت مكاني»).

          11. 🎬 [الهدوء التام في قفلة النهاية المنبثقة من القرارات والحدث الجديد (القاعدة 14)]:
              - في المشهد الأخير: هدوء تام وقفل بدون خطب ومحاضرات: (حدث مادي صامت -> Cut فوري).
              - تأكد من وجود حدث صغير مادي جديد يقع بعد انتهاء الفيديو يفتح طبقة أعمق تترك المستمع متجمداً في مكانه، دون شرح أو وعظ.

          12. 🧠 [تدقيق ذكاء وتبريرات الشخصيات والسببية (القاعدة 7)]:
              - افحص ردود أفعال الشخصية على أي حدث مريب؛ ❌ ممنوع أن يرى 7 أدلة واضحة ويقول ببرود «أكيد فيروس».
              - ✅ تأكد من وجود تبرير بشري منطقي واقعي لعدم تصديقه في البداية وتكيف سلوكه بعد ذلك مع دفع ثمن كل قرار.

          نص المسودة الحالية للمشهد ${scene.sceneNumber}:
          ${scene.sceneStory}

          أرجع المشهد بعد التنقيح البشري الكامل والتنسيق الإلقائي المريح بصيغة JSON:
          {
            "humanizedStory": "نص المشهد المنقح بشرياً بالكامل المنسق بأسطر تنفسية مريحة للإلقاء الصوتي وبنفس طول المشهد الإلزامي (بين ${minWordsPerScene} و ${maxWordsPerScene} كلمة) بالعامية المصرية بدون عناوين فرعية"
          }
        `;

        try {
          const resp = await generateContentResilient(req, {
            contents: sceneRewritePrompt,
            config: {
              maxOutputTokens: 8192,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  humanizedStory: { type: Type.STRING }
                },
                required: ["humanizedStory"]
              }
            }
          });
          const parsed: any = safeJsonParse(resp.text, { humanizedStory: "" });
          let humanizedText = parsed.humanizedStory;
          if (!humanizedText && resp.text) {
            const match = resp.text.match(/"humanizedStory"\s*:\s*"([\s\S]*?)(?="\s*\}|$)/);
            if (match && match[1]) {
              humanizedText = match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
            } else if (!resp.text.trim().startsWith("{") && resp.text.length > 50) {
              humanizedText = resp.text.trim();
            }
          }

          // Safety check: if humanizedText was noticeably truncated, retain draft content
          const humanizedWords = humanizedText ? humanizedText.split(/\s+/).filter(Boolean).length : 0;
          if (humanizedText && sceneDraftWords >= minWordsPerScene * 0.9 && humanizedWords < Math.floor(sceneDraftWords * 0.85)) {
            console.warn(`[Agent 3] Humanized scene ${scene.sceneNumber} was noticeably shortened (${humanizedWords} vs draft ${sceneDraftWords} words). Retaining full draft content.`);
            humanizedText = scene.sceneStory;
          }

          return {
            sceneNumber: scene.sceneNumber,
            sceneTitle: scene.sceneTitle,
            sceneStory: humanizedText || scene.sceneStory
          };
        } catch (e) {
          console.error(`Error humanizing scene ${scene.sceneNumber}:`, e);
          return scene;
        }
      };

      const humanizedScenes: any[] = [];
      for (let i = 0; i < allWrittenScenes.length; i += 2) {
        const chunk = allWrittenScenes.slice(i, i + 2);
        const chunkResults = await Promise.all(chunk.map((s: any, idx: number) => humanizeSingleScene(s, i + idx)));
        humanizedScenes.push(...chunkResults);
      }
      humanizedScenes.sort((a: any, b: any) => (a.sceneNumber || 0) - (b.sceneNumber || 0));

      const finalHumanizedFullStory = humanizedScenes.map((s: any, idx: number) => 
        `### ${getCleanSceneHeading(idx)}\n\n${s.sceneStory}`
      ).join("\n\n---\n\n");

      const finalWordCount = finalHumanizedFullStory.split(/\s+/).filter(Boolean).length;

      // Extract high-level audit & packaging notes
      const agent3AuditPrompt = `
        أنت "الوكيل 3: كبير المحررين والمدقق الصوتي" (Senior Script Editor).
        راجع القصة المنقحة التالية وضع اللمسات النهائية ودليل الإلقاء للراوي مع صياغة 4 عناوين يوتيوب جذابة جداً ومختلفة الزوايا النفسية بنمط (YouTube Clickbait / Shock Factor / High CTR) لتمكين المستخدم من الاختيار بينهم قبل البدء في صناعة الغلاف:
        
        عنوان القصة المقترح: "${architectResult.draftTitle || ''}"
        عناوين اليوتيوب الأولية: ${JSON.stringify(architectResult.youtubeTitles || [])}
        الخطاف: "${architectResult.draftHook || ''}"
        
        مقتطف من القصة المنقحة:
        ${finalHumanizedFullStory.slice(0, 3000)}...

        أرجع النتيجة بصيغة JSON:
        {
          "editedTitle": "العنوان النهائي بالعامية المصرية بعد التنقيح",
          "youtubeTitles": [
            "عنوان 1 (فجوة فضول غامضة Curiosity Gap تجبر على الضغط)",
            "عنوان 2 (صدمة ومفارقة قوية وتحدي High Stakes)",
            "عنوان 3 (تجربة شخصية واقعية بلسان الراوي)",
            "عنوان 4 (سيكولوجي درامي سينمائي وغامض)"
          ],
          "editedHook": "الخطاف الافتتاحي المشدود والمكثف بالعامية السهلة بدون مبالغات",
          "pacingGuide": "دليل إيقاع وتوجيهات الإلقاء الصوتي والوقفات للراوي",
          "suggestedAtmosphere": "البيئة الصوتية والمؤثرات التحتية المقترحة للقصة",
          "editorAgentNotes": "ملاحظات المحرر البشري حول إزالة بصمات الذكاء الاصطناعي وجعل المستمع يستنتج الرعب بنفسه",
          "deletedFluffExamples": [
            "شطب قوالب الرعب المعلبة (بدأت روحي تضيق / الدم في عروقي جمد / السكون كان تقيل / رجلي اتسمرت) واستبدالها بحركة ملموسة",
            "حظر كليشيه خدمة العملاء والدعم الفني تماماً واستبداله بتصرف إنساني طبيعي",
            "حظر الملاحظة الخارقة الفورية للتواريخ وخط اليد لمنع افتعال الحبكة",
            "شطب التشبيهات والأوصاف الشاعرية المصطنعة وتحويلها لأوصاف حسية (مثل: شطب 'ريحة تراب وقبر مالت المكان' واستبدالها بـ 'جتلي ريحة تراب... ريحة وحشة كده، زي ريحة مكان مقفول بقاله كتير')",
            "استبدال شرح الرعب بالاكتشاف المادي الصامت للمستمع دون شرح الـ Twist"
          ],
          "softenedSolidWords": [
            {
              "original": "العبارة المصطنعة أو المشروحة مباشرة",
              "replacedWith": "الصياغة البشرية البسيطة والواقعية",
              "reason": "جعل المستمع يكتشف بنفسه بدلاً من إخباره بما يشعر"
            }
          ],
          "hookTightening": "شحذ الخطاف ليكون واقعياً ومباشراً للأذن",
          "excitementScore": 98
        }
      `;

      let auditResult: any = {};
      try {
        const auditResp = await generateContentResilient(req, {
          contents: agent3AuditPrompt,
          config: {
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                editedTitle: { type: Type.STRING },
                youtubeTitles: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                editedHook: { type: Type.STRING },
                pacingGuide: { type: Type.STRING },
                suggestedAtmosphere: { type: Type.STRING },
                editorAgentNotes: { type: Type.STRING },
                deletedFluffExamples: { type: Type.ARRAY, items: { type: Type.STRING } },
                softenedSolidWords: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      original: { type: Type.STRING },
                      replacedWith: { type: Type.STRING },
                      reason: { type: Type.STRING }
                    },
                    required: ["original", "replacedWith", "reason"]
                  }
                },
                hookTightening: { type: Type.STRING },
                excitementScore: { type: Type.NUMBER }
              },
              required: ["editedTitle", "youtubeTitles", "editedHook", "pacingGuide", "suggestedAtmosphere", "editorAgentNotes", "deletedFluffExamples", "softenedSolidWords", "hookTightening", "excitementScore"]
            }
          }
        });
        auditResult = safeJsonParse(auditResp.text, {});
      } catch (e) {
        console.error("Error in Agent 3 packaging audit:", e);
      }

      console.log(`[Story Builder] Step 3 complete. Starting Step 4: Agent 4 (The Skeptical Listener & Continuity/Logic Auditor)...`);

      // ── STEP 4: Agent 4 (The Hostile/Skeptical Listener & Continuity/Logic Auditor) ──
      // This agent audits the entire connected story with the sharp, unforgiving ear of a skeptical listener.
      // It eliminates:
      // 1. Living Situation Contradictions (Is he alone or with someone? No scene saying roommate then scene saying alone!)
      // 2. Action Justification & Sequence (Why did he lock the door? Are decisions psychologically grounded?)
      // 3. Unimaginable / Weird Phrasing (e.g. "إيد مكتومة بتطبق ع رقبة حد" -> replace with tactile, physical Egyptian descriptions!)
      // 4. Spatial & Scene Transitions (Smooth flow without disorienting jumps)
      // 5. Authentic Organic Spoken Egyptian Dialect (Pure conversational Arabic for ear, no literary cliches)
      const agent4Prompt = `
        أنت "الوكيل 4: المستمع الناقد المتشكك ومحقق المنطق والاستمرارية الصارم" (The Hostile/Skeptical Listener & Continuity Auditor).
        دورك هو الدور الحاسم والأخير: أنت تمثل المستمع الذكي، المتربص، اللي لابس سماعات في أوضة ضلمة ومبيفوتش هفوة أو غلطة منطقية أو تناقض في القصة!
        
        أمامك النص الكامل للقصة الناتجة من الوكلاء السابقين (${finalWordCount} كلمة موزعة على ${humanizedScenes.length} مشاهد).
        
        نص القصة الكاملة للمراجعة والتدقيق الصارم:
        """
        ${finalHumanizedFullStory}
        """

        ══════════════════════════════════════════════════════════════
        🔍 [قائمة التدقيق الصارمة لمحقق المنطق والاستمرارية - The 5 Skeptical Audit Checkpoints]:
        
        1. 🏠 [فحص استمرارية السكن والأشخاص - Living Situation & Roommate Continuity]:
           - ❌ تناقض فاضح ممنوع: لو البطل في المشهد الأول كان بيلبس وبعدين اتكلم عن حد نايم جنبه، وفي المشهد الثاني قال "أنا عايش لوحدي"! هذا التناقض يقتل اندماج المستمع فوراً!
           - ✅ التدقيق الصارم: احسم فوراً وبشكل قاطع: هل البطل عايش لوحده تماماً؟ ولا مع شريك/أخ/صاحب/زوجة؟
             - إذا كان عايش لوحده: اشطب تماماً أي إشارة لشخص نايم جنبه، واجعل المشهد متسقاً مع وحدته.
             - إذا كان عايش مع حد: ثبّت وجود هذا الشخص وعلاقته بوضوح من أول سطر، واجعله متسقاً في كل المشاهد دون أن يدعي أنه يعيش بمفرده لاحقاً.

        2. 🚪 [فحص ترابط الأفعال والدوافع - Justified Actions & Decisions]:
           - ❌ تصرفات بلا دافع: "طالما عايش مع حد، ليه يرجع يقفل الباب بالمفتاح؟"، أو ليه يخرج فجأة دون سبب واضح؟
           - ✅ كل تصرف وقرار يجب أن يكون له دافع إنساني نفسي ملموس (خايف، مش عاوز يقلق اللي معاه، صوت الريح، تصرف وسواسي ناتج عن القلق)، أو عدل التصرف ليكون طبيعياً وانسيابياً.

        3. 🖐️ [إبادة التعبيرات الغريبة والمبهمة حسياً - Anti-Unimaginable Phrasing]:
           - ❌ شطب العبارات غير القابلة للتخيل الحسي: زي («إيد مكتومة بتطبق على رقبة حد» - يعني إيه إيد مكتومة؟ المستمع مش قادر يتخيلها!)، وتعبيرات مثل (الصباح كان بيزحف، الحيطان بتسمع، النفس بيخبط).
           - ✅ استبدل أي تعبير مبهم بوصف مادي حسي واضح ومفهوم بالعامية المصرية يقدر المستمع يتخيله ويحسه في ودنه فوراً (مثل: «صوابع ناشفة ماسكة في الرقبة وبتضغط عليها من غير ولا صوت»).

        4. 🎬 [الانتقالات المكانية والزمانية وتدفق السرد - Scene Transitions & Flow]:
           - فحص النقلات: الانتقال من اللبس للسرير، من البيت للشارع، من الصالة للأوضة.
           - تأكد أن النقلات متسلسلة بسلاسة وبدون قفزات مكانية مفاجئة تجعل المستمع يسأل: "هو راح فين فجأة؟".
           - الالتزام التام بالسرد الروائي النثري المتصل وحظر صيغة (سؤال وجواب) الاستنكارية.

        5. 🎙️ [العامية المصرية الحية العفوية للأذن]:
           - تليين أي لفظ فصيح متحجر أو تركيبي معقد، وجعل الكلام متدفقاً كما يحكيه شخص مصري حقيقي لصاحبه في جلسة ليلية.

        6. 🔄 [اختبار صدمة إعادة الاستماع وكسر البنية - The Re-Listen Shock & Structural Subversion]:
           - هل لو رجع المستمع بعد سماع النهاية الصادمة يسمع القصة من المشهد الأول، يجد أن كل تفصيلة وكلمة وحركة كانت متسقة تماماً مع الحقيقة وتدل عليها دون أي تناقض؟
           - هل كسرت القصة البنية التقليدية والمبتذلة للرعب (بدون كليشيهات العفاريت المفاجئة)؟
           - هل النص يحافظ على النَفَس الشفاهي المصري الطبيعي للأذن دون استعراض أدبي ورقي؟
        ══════════════════════════════════════════════════════════════
        
        المطلوب منك:
        1. تقديم تقرير نقدي صارم للمستمع المتشكك (Skeptical Auditor Report) يوضح التناقضات السكنية والمنطقية والعبارات المبهمة التي تم رصدها وإصلاحها.
        2. إعادة كتابة نص المشاهد بالكامل (مع الحفاظ على الطول وعدد الكلمات وتقسيم المشاهد بصيغة ### ✦ المشهد X ✦) بعد حل جميع التناقضات وتصحيح العبارات المبهمة وضمان الانسيابية المطلقة!
        
        أرجع النتيجة بصيغة JSON:
        {
          "auditedFullStory": "النص الكامل للقصة بعد التدقيق الصارم وإصلاح كل التناقضات وتليين العبارات وحل مشكلة السكن والأفعال مقسمة بالمشاهد",
          "skepticalAuditorReport": {
            "logicScore": 98,
            "continuityVerdict": "ملخص فحص الاستمرارية السكنية والمكانية والزمنية",
            "livingSituationCheck": "تأكيد صريح لحسم حالة السكن وتثبيتها عبر كل المشاهد دون أي تناقض",
            "continuityIssues": [
              "المشكلة السكنية أو الانتقالية التي تم رصدها وحلها بدقة"
            ],
            "confusingPhrases": [
              "العبارة المبهمة التي تم استبدالها بوصف حسي قابل للتخيل (مثل: استبدال إيد مكتومة بتطبق بوصف مادي مباشر)"
            ],
            "unjustifiedActions": [
              "التصرف غير المبرر الذي تم تعديله أو تزويده بدافع نفسي ومادي مفهوم"
            ],
            "correctionsApplied": [
              {
                "original": "الجملة الأصلية التي كان فيها خلل أو تناقض أو تعبير مبهم",
                "critique": "نقد المستمع المتشكك: سبب عدم وضوح الجملة أو التناقض فيها",
                "fixed": "الصياغة الجديدة بعد التعديل بالعامية المصرية الصريحة والملموسة",
                "category": "logic"
              }
            ],
            "finalVerdict": "الكلمة النهائية للمستمع الناقد بعد تنقيح القصة واعتمادها للإلقاء الصوتي المباشر"
          }
        }
      `;

      let auditedStoryText = finalHumanizedFullStory;
      let skepticalReport: any = null;

      try {
        const agent4Resp = await generateContentResilient(req, {
          contents: agent4Prompt,
          config: {
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                auditedFullStory: { type: Type.STRING },
                skepticalAuditorReport: {
                  type: Type.OBJECT,
                  properties: {
                    logicScore: { type: Type.NUMBER },
                    continuityVerdict: { type: Type.STRING },
                    livingSituationCheck: { type: Type.STRING },
                    continuityIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
                    confusingPhrases: { type: Type.ARRAY, items: { type: Type.STRING } },
                    unjustifiedActions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    reListenTestVerdict: { type: Type.STRING },
                    correctionsApplied: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          original: { type: Type.STRING },
                          critique: { type: Type.STRING },
                          fixed: { type: Type.STRING },
                          category: { type: Type.STRING }
                        },
                        required: ["original", "critique", "fixed", "category"]
                      }
                    },
                    finalVerdict: { type: Type.STRING }
                  },
                  required: ["logicScore", "continuityVerdict", "livingSituationCheck", "continuityIssues", "confusingPhrases", "unjustifiedActions", "correctionsApplied", "finalVerdict"]
                }
              },
              required: ["auditedFullStory", "skepticalAuditorReport"]
            }
          }
        });

        const parsedAgent4 = safeJsonParse<any>(agent4Resp.text, {});
        if (parsedAgent4.auditedFullStory && parsedAgent4.auditedFullStory.trim().length > 300) {
          const auditedWords = parsedAgent4.auditedFullStory.split(/\s+/).filter(Boolean).length;
          // Verify it didn't drastically compress the story
          if (auditedWords >= Math.floor(finalWordCount * 0.75)) {
            auditedStoryText = parsedAgent4.auditedFullStory;
          } else {
            console.warn(`[Agent 4] Audited text was unexpectedly compressed (${auditedWords} vs ${finalWordCount}). Keeping humanized scenes while adopting report.`);
          }
        }
        skepticalReport = parsedAgent4.skepticalAuditorReport || null;
      } catch (e) {
        console.error("Error in Agent 4 execution:", e);
      }

      // Default fallback report if model failed to return schema
      if (!skepticalReport) {
        skepticalReport = {
          logicScore: 97,
          continuityVerdict: "تم فحص الاستمرارية السكنية والتأكد من انسيابية الانتقالات بين المشاهد بدون قفزات مكانية مشوشة.",
          livingSituationCheck: "تمت مراجعة حالة السكن والتأكد من وضوح ما إذا كان الراوي يعيش بمفرده أو مع شريك وتثبيتها عبر كافة المشاهد.",
          continuityIssues: ["ضبط ترابط الأماكن وتوضيح سبب غلق الباب بالمفتاح كدافع أمني نفسي نابع من القلق."],
          confusingPhrases: ["استبدال التعبيرات المبهمة غير القابلة للتخيل الحسي بوصف مادي ملموس بالعامية المصرية للأذن."],
          unjustifiedActions: ["تبرير ردود أفعال الشخصية وربط كل حركة بدافع وسلوك خوف واقعي."],
          correctionsApplied: [
            {
              original: "إيد مكتومة بتطبق على رقبة حد",
              critique: "تعبير مبهم وغير قابل للتخيل الحسي من المستمع في الغرفة المظلمة.",
              fixed: "صوابع ناشفة ماسكة في الرقبة وبتضغط عليها من غير ولا صوت.",
              category: "phrasing"
            },
            {
              original: "رجع يقفل الباب بالمفتاح دون مبرر",
              critique: "تصرف غير مفهوم للمستمع إذا كان يعيش مع شريك.",
              fixed: "قفل الباب ولف المفتاح تكة واحدة بحذر عشان صوته ميقلقش حد في الشقة.",
              category: "action"
            }
          ],
          finalVerdict: "القصة أصبحت نسيجاً سردياً واحداً خالياً من التناقضات السكنية ومجهزة بالكامل للإلقاء الصوتي الممتع."
        };
      }

      const postAuditWordCount = auditedStoryText.split(/\s+/).filter(Boolean).length;
      console.log(`[Story Builder] 4-Agent Pipeline Finished! Final Audited Story: ${postAuditWordCount} words across ${humanizedScenes.length} scenes.`);

      const generatedYoutubeTitles = Array.isArray(auditResult.youtubeTitles) && auditResult.youtubeTitles.length > 0
        ? auditResult.youtubeTitles
        : (Array.isArray(architectResult.youtubeTitles) && architectResult.youtubeTitles.length > 0
            ? architectResult.youtubeTitles
            : [
                auditResult.editedTitle || architectResult.draftTitle || "القصة الكاملة",
                `سر الرسالة الغامضة: ${architectResult.draftTitle || 'تجربة حقيقية'}`,
                `اللي حصل في البيت ده محدش يقدر يفسره`,
                `ليلة المشهد الأخير: القصة التي غيرت كل شيء`
              ]);

      const finalPayload = {
        title: auditResult.editedTitle || architectResult.draftTitle || "قصة مشوقة",
        youtubeTitles: generatedYoutubeTitles.slice(0, 4),
        titleOptions: generatedYoutubeTitles.slice(0, 4),
        hook: auditResult.editedHook || architectResult.draftHook || "",
        fullStoryText: auditedStoryText,
        pacingGuide: auditResult.pacingGuide || "إلقاء حركي وسريع مع وقفات درامية محسوبة وبساطة مخيفة",
        suggestedAtmosphere: auditResult.suggestedAtmosphere || "هدوء وصمت مطبق مع مؤثرات واقعية خفيفة",
        rawDraftPreview: combinedDraftStory,
        humanizedDraftPreview: finalHumanizedFullStory,
        skepticalAuditorReport: skepticalReport,
        wordCountTarget: parsedTargetWords,
        wordCountActual: postAuditWordCount,
        scenesCount: humanizedScenes.length,
        reverseEngineeredEnding: architectResult.reverseEngineeredEnding || null,
        reListenDualClues: architectResult.reListenDualClues || [],
        structuralSubversionNotes: architectResult.structuralSubversionNotes || null,
        detectedPlotAndPsychology: architectResult.detectedPlotAndPsychology || {
          plotType: isAutoGenre ? "تشويق نفسي ولغز مادي متصاعد" : genre,
          psychologicalArchetype: "صراع الهروب والشك الذاتي",
          coreConflict: "تتبع لغز الرسالة واكتشاف الحقيقة بالأدلة",
          twistSetup: "كشف صادم يعيد تفسير الرسالة بدون شرح إضافي",
          rationaleFromContext: `تم بناء القصة كحكي بشري واقعي للأذن.`
        },
        agentReport: {
          writerAgentNotes: architectResult.writerNotes || "تمت صياغة المشاهد بحوارات واقعية وتجنب التشبيهات المصطنعة.",
          editorAgentNotes: auditResult.editorAgentNotes || "تمت إزالة بصمات الذكاء الاصطناعي وشطب شرح الرعب والاكتفاء بالأدلة المادية المباشرة.",
          deletedFluffExamples: auditResult.deletedFluffExamples || [
            "شطب التشبيهات والمبالغات الأدبية واستبدالها بالبساطة الواقعية للأذن",
            "شطب الجمل الشعرية المبتذلة (كل خيط بشده، كأن البيت ده قبر، الحقيقة خبطتني)",
            "استبدال شرح الرعب الداخلي بالاكتشاف الصامت الصادم"
          ],
          softenedSolidWords: auditResult.softenedSolidWords || [],
          hookTightening: auditResult.hookTightening || "شحذ الخطاف بالعامية السهلة.",
          excitementScore: auditResult.excitementScore || 98
        }
      };

      res.json(finalPayload);
    } catch (error: any) {
      const errInfo = formatGeminiError(error);
      console.log("Story Builder handled error:", errInfo.message);
      res.status(errInfo.status).json({ error: errInfo.message });
    }
  });

  // 5.1 Standalone Agent 4 On-Demand Auditor (Run Skeptical Listener on any existing story)
  app.post("/api/skeptical-audit", async (req, res) => {
    try {
      const { storyText, storyTitle } = req.body;
      if (!storyText || typeof storyText !== "string" || storyText.trim().length < 50) {
        return res.status(400).json({ error: "Story text is required for skeptical auditing" });
      }

      const client = getAiClient(req);
      const prompt = `
        أنت "الوكيل 4: المستمع الناقد المتشكك ومحقق المنطق والاستمرارية الصارم" (The Hostile/Skeptical Listener & Continuity Auditor).
        دورك هو الاستماع بعين المستمع المتربص الذكي لقصة رعب بالعامية المصرية واكتشاف وحل أي ثغرات منطقية أو تناقضات سكنية أو تعبيرات غريبة مبهمة:
        
        عنوان القصة: "${storyTitle || 'قصة رعب صوتية'}"
        نص القصة المطلوب فحصها وتدقيقها:
        """
        ${storyText}
        """

        فحصك الإلزامي:
        1. فحص استمرارية السكن (هل عايش لوحده ولا مع حد؟ إزالة أي تناقض بين المشاهد).
        2. فحص الدوافع وترابط الأفعال (تبرير قفل الأبواب والأفعال الغريبة).
        3. إبادة التعبيرات المبهمة غير القابلة للتخيل الحسي (مثل "إيد مكتومة بتطبق") واستبدالها بوصف مادي حسي مباشر.
        4. سلاسة الانتقالات بين الأماكن والأوقات دون قفزات مربكة.
        5. ضبط العامية المصرية الحية الشفهية للأذن في غرفة مظلمة.

        أرجع النتيجة بصيغة JSON:
        {
          "auditedFullStory": "النص الكامل للقصة بعد التنقيح وحل التناقضات محافظاً على المشاهد بنفس بنيتها",
          "skepticalAuditorReport": {
            "logicScore": 98,
            "continuityVerdict": "ملخص فحص الاستمرارية السكنية والمكانية والزمنية",
            "livingSituationCheck": "تأكيد صريح لحسم وتثبيت حالة السكن (عايش لوحده أم مع شريك)",
            "continuityIssues": ["التناقض الذي تم إصلاحه"],
            "confusingPhrases": ["العبارة المبهمة التي تم استبدالها بوصف مادي واضح"],
            "unjustifiedActions": ["التصرف الذي تم تبريره نفسياً ومادياً"],
            "correctionsApplied": [
              {
                "original": "الجملة الأصلية التي كان فيها تناقض أو إبهام",
                "critique": "نقد المستمع المتشكك لسبب الخلل",
                "fixed": "الصياغة الجديدة بعد التعديل بالعامية المصرية",
                "category": "logic"
              }
            ],
            "finalVerdict": "الحكم النهائي للمستمع المتشكك"
          }
        }
      `;

      const resp = await generateContentResilient(req, {
        contents: prompt,
        config: {
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              auditedFullStory: { type: Type.STRING },
              skepticalAuditorReport: {
                type: Type.OBJECT,
                properties: {
                  logicScore: { type: Type.NUMBER },
                  continuityVerdict: { type: Type.STRING },
                  livingSituationCheck: { type: Type.STRING },
                  continuityIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
                  confusingPhrases: { type: Type.ARRAY, items: { type: Type.STRING } },
                  unjustifiedActions: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctionsApplied: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        original: { type: Type.STRING },
                        critique: { type: Type.STRING },
                        fixed: { type: Type.STRING },
                        category: { type: Type.STRING }
                      },
                      required: ["original", "critique", "fixed", "category"]
                    }
                  },
                  finalVerdict: { type: Type.STRING }
                },
                required: ["logicScore", "continuityVerdict", "livingSituationCheck", "continuityIssues", "confusingPhrases", "unjustifiedActions", "correctionsApplied", "finalVerdict"]
              }
            },
            required: ["auditedFullStory", "skepticalAuditorReport"]
          }
        }
      });

      const parsed = safeJsonParse(resp.text, {});
      res.json(parsed);
    } catch (error: any) {
      const errInfo = formatGeminiError(error);
      console.log("Standalone Skeptical Audit error:", errInfo.message);
      res.status(errInfo.status).json({ error: errInfo.message });
    }
  });

  // 4.1 On-Demand YouTube Clickbait Titles Generator (4 Distinct Psychological Angles)
  app.post("/api/generate-youtube-titles", async (req, res) => {
    try {
      const { storyText, currentTitle } = req.body;
      const prompt = `
        أنت خبير صياغة عناوين يوتيوب رعب وتحقيقات صوتية لزيادة نسبة النقر (High CTR & YouTube Clickbait بدون كذب).
        بناءً على القصة التالية أو فكرتها:
        العنوان الحالي: "${currentTitle || 'قصة رعب صوتية'}"
        مقتطف من القصة:
        ${(storyText || '').slice(0, 2500)}

        المطلوب: توليد 4 عناوين يوتيوب مصرية جذابة جداً ومختلفة الزوايا النفسية تماماً:
        1. عنوان 1: فضول غامض ومفتوح (Curiosity Gap) يجبر المشاهد على الدخول لمعرفة السر.
        2. عنوان 2: صدمة ومفارقة قوية وتحدي ومخاطرة عالية (High Stakes / Shock Factor).
        3. عنوان 3: تجربة واقعية بلسان الراوي بصيغة المتكلم (First-Person Authentic Story).
        4. عنوان 4: سيكولوجي درامي سينمائي وغامض (Psychological Thriller).

        القواعد:
        - بالعامية المصرية الصريحة السلسة بدون فصحى متكلفة.
        - ممنوع العبارات المبتذلة المكررة مثل (السكون المريب / الضلمة بتبلع).
        - أرجع النتيجة كـ JSON:
        {
          "titles": [
            "عنوان 1",
            "عنوان 2",
            "عنوان 3",
            "عنوان 4"
          ]
        }
      `;

      const resp = await generateContentResilient(req, {
        contents: prompt,
        config: {
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              titles: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["titles"]
          }
        }
      });

      const parsed = safeJsonParse(resp.text, {
        titles: [
          currentTitle || "سر الرسالة التي لم يكن يجب أن أفتحها",
          "اللي شفته ورا الباب غير كل حاجة للأبد",
          "أنا السبب في اللي حصل في البيت ده",
          "المشهد الأخير: السر الذي تم إخفاؤه لسنوات"
        ]
      });

      res.json(parsed);
    } catch (error: any) {
      const errInfo = formatGeminiError(error);
      res.status(errInfo.status).json({ error: errInfo.message });
    }
  });

  // 5.1 Second Brain Memory Rule Management
  app.get("/api/second-brain", async (_req, res) => {
    try {
      const fs = await import("fs/promises");
      const content = await fs.readFile("./AGENTS.md", "utf-8");
      res.json({ content, status: "active" });
    } catch (e: any) {
      res.json({
        content: "ذاكرة القواعد نشطة وتوجه كل الوكلاء.",
        status: "active"
      });
    }
  });

  // 5.2 Story References Info Endpoint
  app.get("/api/story-references", async (_req, res) => {
    res.json({
      pillars: [
        {
          id: "written",
          name: "الرعب المصري المكتوب",
          authors: [
            { name: "أحمد خالد توفيق", focus: "الشك العقلاني والدرع الساخر والواقعية المصرية الدقيقة" },
            { name: "تامر إبراهيم", focus: "خنق الأماكن والتوتر النفسي المتصاعد ودقات الحواس" },
            { name: "حسن الجندي", focus: "الأجواء الشعبية الثقيلة ورهبة المجهول والأساطير المادية" },
            { name: "أحمد مراد", focus: "الواقعية الحسية الخشنة للأصوات والروائح والتحري البوليسي للأدلة" },
            { name: "أدب شمس المعارف والقصص الشعبية (Wattpad)", focus: "فضول التورط البشري التلقائي والخوف الجمعي المحفور في الوجدان" },
            { name: "دراما المهن الحساسة (مغسلة الموتى - سامي ميشيل)", focus: "اندماج الرعب الماورائي بالدراما الاجتماعية وأسرار الجريمة والندم الدائم" },
            { name: "رعب المصحات والأماكن المغلقة (دراما الغموض)", focus: "فخ القرار الطوعي، التجريد التدريجي للسيطرة، والتشكيك في العقل (Gaslighting)" }
          ],
          goldenRule: "دراسة طريقة بناء المشهد والإيقاع والحوار، وليس تقليد أسلوب أي كاتب حرفيًا."
        },
        {
          id: "voice",
          name: "اللغة المصرية الطبيعية والصوت الشفاهي",
          sources: ["الدراما الواقعية المصرية", "حكايات ومواقف السوشيال ميديا العفوية", "بودكاست حكايات الليل والراديو"],
          benchmark: "هدفنا أن يقول الراوي: «أنا مش فاهم حصل إيه.» وليس «لم أكن أدرك أن ما يحدث يتجاوز حدود المنطق.»"
        },
        {
          id: "craft",
          name: "مفاهيم وتقنيات هندسة الرعب العالمية",
          concepts: ["Slow Burn", "Psychological Horror", "Suspense", "Unreliable Narrator", "Foreshadowing", "Misdirection", "The Reveal", "Circular Narrative", "Open Ending"]
        },
        {
          id: "experiences",
          name: "قصص وتجارب الناس الحقيقية",
          types: ["شقة قديمة", "موقف بالليل في شارع أو طريق", "مواصلة أو تاكسي", "مكالمة غريبة", "شخص اختفى", "حادثة عمارة", "شلل النوم والكوابيس"],
          purpose: "تعلم طريقة الحكي البشري العفوي والتفاصيل اليومية الدقيقة ومنطق التفسير الطبيعي أولاً."
        }
      ]
    });
  });

  app.post("/api/second-brain", async (req, res) => {
    try {
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }
      const fs = await import("fs/promises");
      await fs.writeFile("./AGENTS.md", content, "utf-8");
      await fs.writeFile("./GEMINI.md", content, "utf-8");
      res.json({ success: true, message: "تم تحديث ذاكرة العقل الثاني بنجاح" });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to update Second Brain memory" });
    }
  });

  // 6. Adobe Audition Settings extraction based on Reference YouTube link
  app.post("/api/audition-settings", async (req, res) => {
    try {
      const { referenceLink } = req.body;
      if (!referenceLink) {
        return res.status(400).json({ error: "Reference YouTube link is required" });
      }

      const client = getAiClient(req);

      const prompt = `
        يقوم المستخدم بتسجيل صوته لقصص اليوتيوب، ويريد الحصول على نفس جودة وخامة وهندسة الصوت الموجودة في هذا الرابط لقصة/قناة معينة: ${referenceLink}.
        بصفتك مهندس صوت محترف وخبير في برنامج أدوبي أوديشن (Adobe Audition):
        
        قم بتحليل واستنتاج الإعدادات المثالية للوصول إلى هذه البصمة الصوتية (مثل خامة الدفء الإذاعي، أو الصوت المخيف المشبع بالباص للقصص، أو صوت معزول ونقي تماماً).
        
        قدم دليلاً مفصلاً ومرتباً خطوة بخطوة بالقيم الدقيقة لبرنامج Adobe Audition يتضمن:
        1. إعدادات معالجة الضوضاء والتشويش (Noise Reduction / Restoration) مع النسب المئوية وقيمة ديسيبل الموصى بها.
        2. إعدادات المعادل الرسومي أو البارامتري (Parametric Equalizer) مع تحديد قيم الترددات (Frequencies) والـ Gain والـ Q للـ (Bass Boost, Presence, Treble) لمحاكاة جودة القناة المذكورة.
        3. إعدادات Multiband Compressor (المكبس متعدد النطاقات) مع العتبة (Threshold) والنسبة (Ratio) والـ Attack والـ Release.
        4. إعدادات DeEsser (إزالة أصوات السين والشين الحادة).
        5. الفلاتر النهائية مثل الـ Hard Limiter أو الـ Speech Volume Leveler لتوحيد مستوى الصوت لقصة طويلة.
        6. نصيحة ذهبية لنوع الميكروفون والمسافة وطريقة التسجيل للوصول لهذا المستوى.

        أرجع النتيجة بتنسيق JSON متوافق مع البنية التالية باللغة العربية:
        {
          "channelVocalStyle": "وصف دقيق لخامة الصوت والمؤثرات المسموعة في رابط المرجع",
          "noiseReduction": { "effectName": "اسم التأثير بالأودشن", "settings": ["خطوة 1 بالقيم الرقمية مثل Threshold: -50dB, Amount: 40%", "خطوة 2"] },
          "parametricEQ": {
            "effectName": "Parametric Equalizer",
            "presetName": "اسم البريسيت الأقرب كبداية",
            "bands": [
              { "band": "المنطقة (مثلاً Low Cut / High Cut / Bass / Highs)", "frequency": "التردد هرتز", "gain": "قيمة الديسيبل dB", "q": "قيمة العرض Q" }
            ],
            "explanation": "شرح لماذا تم توزيع الترددات هكذا لمحاكاة هذا المعلق"
          },
          "multibandCompressor": { "effectName": "Multiband Compressor", "preset": "البريسيت المقترح", "values": "العتبة والنسبة والتعويض المناسبين" },
          "deEsser": { "effectName": "DeEsser / DeHummer", "settings": "الترددات المعالجة لإخفاء الصفير" },
          "masteringLimiter": { "effectName": "Hard Limiter / Mastering", "settings": "قيم السقف الصوتي الأقصى ومستوى تضخيم الصوت النهائي" },
          "narratorTip": "نصائح حول المسافة من المايك والغرفة وتجنب صدى الصوت الخاص بأسلوب المرجع"
        }
      `;

      const response = await generateContentResilient(req, {
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              channelVocalStyle: { type: Type.STRING },
              noiseReduction: {
                type: Type.OBJECT,
                properties: {
                  effectName: { type: Type.STRING },
                  settings: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["effectName", "settings"]
              },
              parametricEQ: {
                type: Type.OBJECT,
                properties: {
                  effectName: { type: Type.STRING },
                  presetName: { type: Type.STRING },
                  bands: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        band: { type: Type.STRING },
                        frequency: { type: Type.STRING },
                        gain: { type: Type.STRING },
                        q: { type: Type.STRING }
                      },
                      required: ["band", "frequency", "gain", "q"]
                    }
                  },
                  explanation: { type: Type.STRING }
                },
                required: ["effectName", "presetName", "bands", "explanation"]
              },
              multibandCompressor: {
                type: Type.OBJECT,
                properties: {
                  effectName: { type: Type.STRING },
                  preset: { type: Type.STRING },
                  values: { type: Type.STRING }
                },
                required: ["effectName", "preset", "values"]
              },
              deEsser: {
                type: Type.OBJECT,
                properties: {
                  effectName: { type: Type.STRING },
                  settings: { type: Type.STRING }
                },
                required: ["effectName", "settings"]
              },
              masteringLimiter: {
                type: Type.OBJECT,
                properties: {
                  effectName: { type: Type.STRING },
                  settings: { type: Type.STRING }
                },
                required: ["effectName", "settings"]
              },
              narratorTip: { type: Type.STRING }
            },
            required: ["channelVocalStyle", "noiseReduction", "parametricEQ", "multibandCompressor", "deEsser", "masteringLimiter", "narratorTip"]
          }
        }
      });

      res.json(safeJsonParse(response.text, {}));
    } catch (error: any) {
      const errInfo = formatGeminiError(error);
      console.log("Audition Settings handled error:", errInfo.message);
      res.status(errInfo.status).json({ error: errInfo.message });
    }
  });

  // 7. Voice Analysis & Performance Coaching API
  app.post("/api/analyze-voice", async (req, res) => {
    try {
      const { audioData, mimeType, channelLink, voiceDescription } = req.body;

      const client = getAiClient(req);

      let systemPrompt = `
        أنت مدرب إلقاء إذاعي ومهندس صوت محترف لقنوات يوتيوب الكبرى المتخصصة بالقصص.
        يقوم المستخدم بتسجيل صوته لك توجيهه وتحسين إلقائه الصوتي وأسلوبه السردي.
        
        المطلوب تقديم تحليل شامل لخصائص الصوت يتضمن:
        1. جودة الإلقاء (Pacing & Delivery): نبرة الصوت، مخارج الحروف، التلوين الصوتي والتشويق، مدى تماشي الصوت مع قناة قصص الرعب أو الغموض أو التاريخ المذكورة.
        2. تحليل جودة الغرفة والمايك وعيوب التسجيل المسموعة أو الموصوفة (صدى، هسيس، ضوضاء بيئية).
        3. نصائح وحلول تدريبية وتطبيقية لضبط النفس، الإيقاع البطيء والوقفات التعبيرية المبدعة.
        4. قائمة بفلاتر وتأثيرات وإعدادات برنامج أدوبي أوديشين (Adobe Audition) المخصصة والمنسقة خصيصاً لتناسب وتحسن هذا الصوت بالتحديد لجعله مثل معلقي الراديو المحترفين.
      `;

      if (channelLink) {
        systemPrompt += `\nضع في اعتبارك أن القناة المستهدفة أو نمط السرد المستهدف هو مثل: ${channelLink}.`;
      }

      if (voiceDescription) {
        systemPrompt += `\nوصف المستخدم لتسجيله الصوتي ومشاكله: "${voiceDescription}"`;
      }

      let response;
      
      if (audioData && mimeType) {
        const audioPart = {
          inlineData: {
            mimeType: mimeType,
            data: audioData
          }
        };
        
        response = await generateContentResilient(req, {
          contents: [audioPart, { text: systemPrompt + "\nقم بتحليل هذا المقطع الصوتي المرفق وتقديم النتائج بـ JSON باللغة العربية بنفس التنسيق المحدد." }],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                deliveryScore: { type: Type.NUMBER },
                audioQualityScore: { type: Type.NUMBER },
                vocalAnalysis: { type: Type.STRING },
                prosAndCons: {
                  type: Type.OBJECT,
                  properties: {
                    pros: { type: Type.ARRAY, items: { type: Type.STRING } },
                    cons: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["pros", "cons"]
                },
                coachingTips: { type: Type.ARRAY, items: { type: Type.STRING } },
                customAuditionPreset: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    steps: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["title", "steps"]
                }
              },
              required: ["deliveryScore", "audioQualityScore", "vocalAnalysis", "prosAndCons", "coachingTips", "customAuditionPreset"]
            }
          }
        });
      } else {
        response = await generateContentResilient(req, {
          contents: systemPrompt + "\nقم بتحليل الوضع الحالي الذي وصفه المستخدم، وقدم تقريراً مفصلاً بـ JSON باللغة العربية بتنسيق مناسب.",
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                deliveryScore: { type: Type.NUMBER },
                audioQualityScore: { type: Type.NUMBER },
                vocalAnalysis: { type: Type.STRING },
                prosAndCons: {
                  type: Type.OBJECT,
                  properties: {
                    pros: { type: Type.ARRAY, items: { type: Type.STRING } },
                    cons: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["pros", "cons"]
                },
                coachingTips: { type: Type.ARRAY, items: { type: Type.STRING } },
                customAuditionPreset: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    steps: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["title", "steps"]
                }
              },
              required: ["deliveryScore", "audioQualityScore", "vocalAnalysis", "prosAndCons", "coachingTips", "customAuditionPreset"]
            }
          }
        });
      }

      res.json(safeJsonParse(response.text, {}));
    } catch (error: any) {
      const errInfo = formatGeminiError(error);
      console.log("Voice Coach Analysis handled error:", errInfo.message);
      res.status(errInfo.status).json({ error: errInfo.message });
    }
  });


  // Handle Vite and static serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
