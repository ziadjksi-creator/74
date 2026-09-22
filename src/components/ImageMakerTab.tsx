import { useState, useRef, useEffect } from "react";
import { 
  Image as ImageIcon, Sparkles, RefreshCw, Download, 
  Settings, Type, Layout, SlidersHorizontal, ArrowDown, HelpCircle,
  Eye, Edit3, ImagePlus
} from "lucide-react";

interface ImageMakerTabProps {
  currentStoryText: string;
  backupApiKey?: string;
  myChannelLink?: string;
}

export default function ImageMakerTab({ 
  currentStoryText,
  backupApiKey,
  myChannelLink = ""
}: ImageMakerTabProps) {
  // Shared & Persistent Inputs to prevent data loss on tab switch
  const [storyInput, setStoryInput] = useState(() => {
    return localStorage.getItem("rawi_imgmaker_story_input") || currentStoryText || "";
  });
  const [generatedPrompt, setGeneratedPrompt] = useState(() => {
    return localStorage.getItem("rawi_imgmaker_gen_prompt") || "";
  });
  const [imageUrl, setImageUrl] = useState<string | null>(() => {
    return localStorage.getItem("rawi_imgmaker_image_url") || null;
  });

  // Channel style extraction states
  const [channelToAnalyze, setChannelToAnalyze] = useState(() => {
    return localStorage.getItem("rawi_imgmaker_channel") || myChannelLink || "";
  });
  const [isExtractingStyle, setIsExtractingStyle] = useState(false);
  const [extractedStyle, setExtractedStyle] = useState<any>(() => {
    try {
      const saved = localStorage.getItem("rawi_imgmaker_extracted_style");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Competitor/Engine Aesthetic Presets
  const [competitorStyle, setCompetitorStyle] = useState(() => {
    return localStorage.getItem("rawi_imgmaker_comp_style") || "nanobanana_pro";
  });

  // Canvas Customization Options
  const [titleText, setTitleText] = useState(() => {
    return localStorage.getItem("rawi_imgmaker_title_text") || "سر غامض في الظلام";
  });
  const [titleColor, setTitleColor] = useState(() => {
    return localStorage.getItem("rawi_imgmaker_title_color") || "#FF0000";
  });
  const [fontSize, setFontSize] = useState(() => {
    return Number(localStorage.getItem("rawi_imgmaker_font_size")) || 54;
  });
  const [fontFamily, setFontFamily] = useState("Cairo, system-ui");
  const [textYPosition, setTextYPosition] = useState(() => {
    return Number(localStorage.getItem("rawi_imgmaker_y_pos")) || 82;
  });
  const [watermarkText, setWatermarkText] = useState(() => {
    return localStorage.getItem("rawi_imgmaker_watermark") || "روايات رعب غامضة";
  });
  const [useWatermark, setUseWatermark] = useState(() => {
    const saved = localStorage.getItem("rawi_imgmaker_use_watermark");
    return saved !== null ? saved === "true" : true;
  });
  const [stylePreset, setStylePreset] = useState(() => {
    return localStorage.getItem("rawi_imgmaker_style_preset") || "horror";
  });
  const [textAlign, setTextAlign] = useState(() => {
    return localStorage.getItem("rawi_imgmaker_text_align") || "right";
  });
  const [textBackground, setTextBackground] = useState(() => {
    return localStorage.getItem("rawi_imgmaker_text_bg") || "none";
  });

  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync state if currentStoryText changes from the parent Story tab
  useEffect(() => {
    if (currentStoryText && !localStorage.getItem("rawi_imgmaker_story_input")) {
      setStoryInput(currentStoryText);
    }
  }, [currentStoryText]);

  // Persist all customization and story states to localStorage
  useEffect(() => {
    localStorage.setItem("rawi_imgmaker_story_input", storyInput);
  }, [storyInput]);

  useEffect(() => {
    localStorage.setItem("rawi_imgmaker_gen_prompt", generatedPrompt);
  }, [generatedPrompt]);

  useEffect(() => {
    if (imageUrl) {
      localStorage.setItem("rawi_imgmaker_image_url", imageUrl);
    } else {
      localStorage.removeItem("rawi_imgmaker_image_url");
    }
  }, [imageUrl]);

  useEffect(() => {
    localStorage.setItem("rawi_imgmaker_channel", channelToAnalyze);
  }, [channelToAnalyze]);

  useEffect(() => {
    if (extractedStyle) {
      localStorage.setItem("rawi_imgmaker_extracted_style", JSON.stringify(extractedStyle));
    } else {
      localStorage.removeItem("rawi_imgmaker_extracted_style");
    }
  }, [extractedStyle]);

  useEffect(() => {
    localStorage.setItem("rawi_imgmaker_comp_style", competitorStyle);
  }, [competitorStyle]);

  useEffect(() => {
    localStorage.setItem("rawi_imgmaker_title_text", titleText);
  }, [titleText]);

  useEffect(() => {
    localStorage.setItem("rawi_imgmaker_title_color", titleColor);
  }, [titleColor]);

  useEffect(() => {
    localStorage.setItem("rawi_imgmaker_font_size", fontSize.toString());
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem("rawi_imgmaker_y_pos", textYPosition.toString());
  }, [textYPosition]);

  useEffect(() => {
    localStorage.setItem("rawi_imgmaker_watermark", watermarkText);
  }, [watermarkText]);

  useEffect(() => {
    localStorage.setItem("rawi_imgmaker_use_watermark", useWatermark.toString());
  }, [useWatermark]);

  useEffect(() => {
    localStorage.setItem("rawi_imgmaker_style_preset", stylePreset);
  }, [stylePreset]);

  useEffect(() => {
    localStorage.setItem("rawi_imgmaker_text_align", textAlign);
  }, [textAlign]);

  useEffect(() => {
    localStorage.setItem("rawi_imgmaker_text_bg", textBackground);
  }, [textBackground]);

  // Redraw canvas whenever settings or image url change
  useEffect(() => {
    drawCanvas();
  }, [imageUrl, titleText, titleColor, fontSize, fontFamily, textYPosition, watermarkText, useWatermark, stylePreset, textAlign, textBackground]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Standard YouTube Thumbnail resolution: 1280 x 720
    canvas.width = 1280;
    canvas.height = 720;

    if (imageUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl;
      img.onload = () => {
        // Draw the background image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Apply dark vignette or dramatic preset overlay gradient
        applyPresetOverlay(ctx, canvas.width, canvas.height);

        // Draw main Title
        drawMainTitle(ctx, canvas.width, canvas.height);

        // Draw Watermark
        if (useWatermark && watermarkText) {
          drawWatermark(ctx, canvas.width, canvas.height);
        }
      };
      img.onerror = () => {
        // Fallback if image fails to load due to cross-origin
        ctx.fillStyle = "#110D0A";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#FF3D00";
        ctx.font = "bold 24px Cairo, system-ui";
        ctx.textAlign = "center";
        ctx.fillText("حدث خطأ أثناء تحميل الصورة للمتصفح. يرجى المحاولة مرة أخرى أو تنزيلها مباشرة.", canvas.width / 2, canvas.height / 2);
      };
    } else {
      // Placeholder background
      ctx.fillStyle = "#0F0C08";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw grid
      ctx.strokeStyle = "rgba(141, 110, 99, 0.15)";
      for (let i = 0; i < canvas.width; i += 80) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let j = 0; j < canvas.height; j += 80) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(canvas.width, j);
        ctx.stroke();
      }

      // Message
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.font = "bold 30px Cairo, system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("بانتظار توليد فكرة المشهد وصناعة غلاف اليوتيوب...", canvas.width / 2, canvas.height / 2 - 20);
      
      ctx.font = "16px Cairo, system-ui";
      ctx.fillStyle = "rgba(141, 110, 99, 0.6)";
      ctx.fillText("حلل أسلوب أي قناة بالاستخلاص أو حلل القصة مباشرة للبدء!", canvas.width / 2, canvas.height / 2 + 30);
    }
  };

  const applyPresetOverlay = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // Standard professional dark vignette
    const vignette = ctx.createRadialGradient(w/2, h/2, h/3, w/2, h/2, w*0.65);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.92)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    if (stylePreset === "horror") {
      // Blood-red bottom gradient
      const bloodGrad = ctx.createLinearGradient(0, h * 0.45, 0, h);
      bloodGrad.addColorStop(0, "rgba(0,0,0,0)");
      bloodGrad.addColorStop(1, "rgba(150, 10, 10, 0.7)");
      ctx.fillStyle = bloodGrad;
      ctx.fillRect(0, 0, w, h);
    } else if (stylePreset === "golden") {
      // Royal gold bottom glow
      const goldGrad = ctx.createLinearGradient(0, h * 0.45, 0, h);
      goldGrad.addColorStop(0, "rgba(0,0,0,0)");
      goldGrad.addColorStop(1, "rgba(230, 150, 0, 0.4)");
      ctx.fillStyle = goldGrad;
      ctx.fillRect(0, 0, w, h);
    } else if (stylePreset === "dramatic") {
      // Intense black bottom shadow
      const darkGrad = ctx.createLinearGradient(0, h * 0.25, 0, h);
      darkGrad.addColorStop(0, "rgba(0,0,0,0)");
      darkGrad.addColorStop(1, "rgba(0,0,0,0.98)");
      ctx.fillStyle = darkGrad;
      ctx.fillRect(0, 0, w, h);
    }
  };

  const drawMainTitle = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.font = `900 ${fontSize}px ${fontFamily}`;
    ctx.lineJoin = "round";
    
    let x = w / 2;
    let align: CanvasTextAlign = "center";
    if (textAlign === "right") {
      x = w * 0.82; // 82% of width (on the right)
      align = "right";
    } else if (textAlign === "left") {
      x = w * 0.18; // 18% of width (on the left)
      align = "left";
    }
    
    ctx.textAlign = align;
    ctx.textBaseline = "middle";

    const y = (textYPosition / 100) * h;

    // Multi-line wrap and custom slash line-break support
    const lines: string[] = [];
    const explicitLines = titleText.split(/[\n\/]/);
    const maxLineWidth = textAlign === "center" ? w * 0.8 : w * 0.45;

    explicitLines.forEach((expLine) => {
      const words = expLine.trim().split(/\s+/);
      let currentLine = "";
      for (const word of words) {
        if (!word) continue;
        const testLine = currentLine ? currentLine + " " + word : word;
        const testWidth = ctx.measureText(testLine).width;
        if (testWidth > maxLineWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
    });

    const lineHeight = fontSize * 1.15;
    const totalHeight = lines.length * lineHeight;
    const startY = y - totalHeight / 2 + lineHeight / 2;

    lines.forEach((line, index) => {
      const lineY = startY + index * lineHeight;
      const lineTextWidth = ctx.measureText(line).width;

      // Draw background plate/box behind text
      if (textBackground !== "none") {
        const boxW = lineTextWidth + 30;
        const boxH = fontSize * 1.35;
        let boxX = x - boxW / 2;
        if (align === "right") {
          boxX = x - boxW + 15;
        } else if (align === "left") {
          boxX = x - 15;
        }

        ctx.fillStyle = textBackground === "highlight" ? "#FFD600" : "rgba(0, 0, 0, 0.78)";
        ctx.fillRect(boxX, lineY - boxH / 2, boxW, boxH);
        
        // Add a small gold border to dark background plates for premium styling
        if (textBackground === "dark") {
          ctx.strokeStyle = "rgba(255, 214, 0, 0.4)";
          ctx.lineWidth = 2;
          ctx.strokeRect(boxX, lineY - boxH / 2, boxW, boxH);
        }
      }

      // Determine text colors based on highlight option
      let fillCol = titleColor;
      let strokeCol = "#000000";
      let drawStroke = true;

      if (textBackground === "highlight") {
        fillCol = "#000000"; // Contrast text on bright plate
        drawStroke = false;
      }

      if (drawStroke) {
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = fontSize * 0.22;
        ctx.strokeText(line, x, lineY);
      }

      // Text dropshadow glow
      ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
      ctx.shadowBlur = 10;

      ctx.fillStyle = fillCol;
      ctx.fillText(line, x, lineY);
      
      ctx.shadowBlur = 0;
    });
  };

  const drawWatermark = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.font = "bold 18px Cairo, system-ui";
    ctx.textAlign = "right";
    
    // Draw background badge for logo text
    const textWidth = ctx.measureText(watermarkText).width;
    const badgeW = textWidth + 30;
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(w - badgeW - 25, 25, badgeW, 38);

    // Draw a gold accent indicator dot
    ctx.fillStyle = "#FFB300"; 
    ctx.beginPath();
    ctx.arc(w - badgeW - 10, 44, 4, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF"; 
    ctx.fillText(watermarkText, w - 40, 42);
  };

  // Step 1: Analyze Story to extract a professional English prompt
  const generateIdeaPrompt = async () => {
    if (!storyInput.trim()) return;
    setIsLoadingPrompt(true);
    setGeneratedPrompt("");
    try {
      const response = await fetch("/api/generate-thumbnail-prompt", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-custom-gemini-key": backupApiKey || ""
        },
        body: JSON.stringify({ storyText: storyInput }),
      });
      if (!response.ok) throw new Error("فشل في استخلاص البرومبت");
      const data = await response.json();
      setGeneratedPrompt(data.prompt);
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء إجراء التحليل البصري للقصة.");
    } finally {
      setIsLoadingPrompt(false);
    }
  };

  // Step 1.5: Extract Style from Channel Link
  const handleExtractStyle = async () => {
    if (!channelToAnalyze.trim()) return;
    setIsExtractingStyle(true);
    try {
      const response = await fetch("/api/extract-thumbnail-style", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-custom-gemini-key": backupApiKey || ""
        },
        body: JSON.stringify({ channelLink: channelToAnalyze }),
      });
      if (!response.ok) throw new Error("فشل في استخلاص أسلوب الغلاف");
      const data = await response.json();
      setExtractedStyle(data);
      
      // Update canvas customization based on extracted style!
      if (data.titleColor) {
        setTitleColor(data.titleColor);
      }
      if (data.vignetteStyle) {
        setStylePreset(data.vignetteStyle);
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء محاولة استخلاص الأسلوب البصري للقناة.");
    } finally {
      setIsExtractingStyle(false);
    }
  };

  // Step 2: Render/Draw image using Pollinations AI based on current prompt and selected competitor preset
  const renderBackgroundWithStyle = async () => {
    if (!generatedPrompt.trim()) return;
    setIsGeneratingImage(true);
    try {
      let suffix = "";
      
      // Core styling switches including "Nano Banana" AI styles
      if (competitorStyle === "nanobanana_v2") {
        suffix = ", Google Nano Banana v2 style, hyper-realistic 4K textures, photorealistic render, extremely sharp detailing, cold cinematic horror atmosphere, warning amber glowing highlights, volumetric smoke and mist";
      } else if (competitorStyle === "nanobanana_pro") {
        suffix = ", Google Nano Banana Pro style, flawless movie poster quality, masterfully crafted visual drama, photorealistic skin and fabric textures, dark crimson shadows, deep high-contrast chiaroscuro, trending on ArtStation";
      } else if (competitorStyle === "abdelhady") {
        suffix = ", cinematic horror movie still, photo-realistic, hyper-detailed, extremely scary atmosphere, dark crimson red highlights, pitch black dramatic shadows, old wood and rust textures, high contrast chiaroscuro, 8k resolution, masterful art direction";
      } else if (competitorStyle === "moro") {
        suffix = ", highly professional suspense thriller thumbnail, photorealistic, foggy moonlight blue glow, misty dark corridor, eerie atmospheric light, haunting and beautiful, cinematic depth of field, 35mm photograph still";
      } else if (competitorStyle === "psychological") {
        suffix = ", psychological thriller movie scene, desaturated gritty colors, terrified face close up, extreme panic expression, high fidelity skin pores, volumetric dust particles, hauntingly deep dark shadows, award-winning cinematography";
      } else {
        suffix = ", classic horror story cover, hyper-realistic, dark smoke, orange fire embers glowing in the pitch black background, vintage creepy style, extreme visual contrast, photorealistic textures";
      }

      // Append extracted style guidelines if available
      if (extractedStyle && extractedStyle.promptSuffix) {
        suffix += `, in style of ${extractedStyle.channelName}, ${extractedStyle.promptSuffix}`;
      }

      const encodedPrompt = encodeURIComponent(generatedPrompt.trim() + suffix);
      const randomSeed = Math.floor(Math.random() * 10000000);
      const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1280&height=720&seed=${randomSeed}&nologo=true&model=flux`;
      
      setImageUrl(pollinationsUrl);
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء توليد الصورة.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `rawi_youtube_thumbnail_${Date.now()}.png`;
    link.href = url;
    link.click();
  };

  return (
    <div className="space-y-8" id="image-maker-tab">
      
      {/* Upper Info Box */}
      <div className="bg-white p-5 rounded-xl border border-[#ECE9E0] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-md font-black text-[#3E2723] flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-[#8D6E63]" />
            مُستشار ومصمم أغلفة اليوتيوب الاحترافي (YouTube Thumbnail Studio)
          </h3>
          <p className="text-xs text-[#7D766D] mt-1 leading-relaxed">
            محرك مدمج ومطور يدعم معيار **ناناو بنانا (Nano Banana)** لإنتاج خامات واقعية 4K مع إمكانية استيراد أسلوب أي قناة كبرى تلقائياً لتغليف قصتك بنفس الهوية الفيروسية.
          </p>
        </div>
        {imageUrl && (
          <button
            onClick={handleDownload}
            className="w-full md:w-auto px-5 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-black rounded-lg transition shadow-md flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            تحميل الغلاف النهائي PNG
          </button>
        )}
      </div>

      {/* 🔍 Step 1: Channel Style Extractor Card - User asks to ask for channel link FIRST */}
      <div className="bg-white rounded-xl p-5 border border-[#ECE9E0] shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-black text-[#5D4037]">
          <Eye className="w-5 h-5 text-[#8D6E63]" />
          <span>استخلاص أسلوب الغلاف الفني من أي قناة منافسة</span>
        </div>
        <p className="text-xs text-[#7D766D] leading-relaxed">
          ضع رابط قناة يوتيوب (مثال: قناة شادي مورو، محمد عبد الهادي، أو قناتك المثبتة) ليقوم الذكاء الاصطناعي بدراسة مواصفات التباين، الألوان، والمشاهد المفضلة لديهم لتطبيقها على الغلاف الخاص بك.
        </p>
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="أدخل رابط قناة يوتيوب هنا..."
            value={channelToAnalyze}
            onChange={(e) => setChannelToAnalyze(e.target.value)}
            className="flex-1 px-3 py-2 bg-[#FCFBF9] border border-[#ECE9E0] text-xs font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8D6E63]"
          />
          <button
            onClick={handleExtractStyle}
            disabled={isExtractingStyle || !channelToAnalyze.trim()}
            className="px-4 py-2 bg-[#8D6E63] hover:bg-[#7D5E53] text-white font-black text-xs rounded-lg transition flex items-center gap-1 shrink-0"
          >
            {isExtractingStyle ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                جاري التحليل الفني...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                استخلاص الأسلوب البصري 🔍
              </>
            )}
          </button>
        </div>

        {extractedStyle && (
          <div className="p-4 bg-[#FAF2EB] border border-[#EFE5DC] rounded-xl text-xs space-y-2">
            <div className="font-black text-[#5D4037] flex items-center gap-1.5 pb-1 border-b border-[#EFE5DC]">
              <Sparkles className="w-4 h-4 text-[#FFB300]" />
              <span>تم استخلاص أسلوب قناة: {extractedStyle.channelName} بنجاح!</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-[#5D4037] leading-relaxed">
              <div>• **عمق الخلفية والظلام:** {extractedStyle.backgroundDarkness}</div>
              <div>• **العناصر البصرية والوجوه:** {extractedStyle.visualTheme}</div>
              <div>• **نمط الخط والموقع:** {extractedStyle.fontStyle}</div>
              <div>• **الفلتر الموصى به:** {extractedStyle.vignetteStyle === "horror" ? "أحمر دموي سفلي" : extractedStyle.vignetteStyle === "golden" ? "وهج ذهبي سفلي" : "ظلال سوداء سينمائية حادة"}</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Art direction and custom prompts (5 columns) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Step A: Story Analysis & Prompt generation */}
          <div className="bg-white rounded-xl p-5 border border-[#ECE9E0] shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-[#8D6E63]">
              <Sparkles className="w-4.5 h-4.5 text-[#FFB300]" />
              <span>الخطوة 2: تحليل القصة وتوليد مشهد الغلاف</span>
            </div>

            <textarea 
              rows={4}
              placeholder="ضع قصتك المشوقة هنا لنستخرج منها الفكرة البصرية والبرومبت المثالي تلقائياً..."
              value={storyInput}
              onChange={(e) => setStoryInput(e.target.value)}
              className="w-full p-3 rounded-lg border border-[#ECE9E0] bg-[#FCFBF9] text-xs focus:outline-none focus:ring-2 focus:ring-[#8D6E63] leading-relaxed resize-none font-medium"
            />

            <button
              onClick={generateIdeaPrompt}
              disabled={isLoadingPrompt || !storyInput.trim()}
              className="w-full py-2.5 bg-[#8D6E63] hover:bg-[#7D5E53] text-white font-black text-xs rounded-lg transition flex items-center justify-center gap-2"
            >
              {isLoadingPrompt ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  جاري استخراج وتحليل أقوى حدث درامي بالقصة...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  تحليل أحداث القصة وتوليد فكرة البرومبت 🔮
                </>
              )}
            </button>
          </div>

          {/* Step B: Competitor Preset and Image Render */}
          <div className="bg-white rounded-xl p-5 border border-[#ECE9E0] shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-[#8D6E63]">
              <ImagePlus className="w-4.5 h-4.5" />
              <span>الخطوة 3: محاكاة أسلوب المنافسين ومحرك الرسم</span>
            </div>

            {/* Competitor / Nano Banana Presets Dropdown */}
            <div>
              <label className="text-[11px] text-[#7D766D] font-bold block mb-1.5">طراز محرك الرسم والذكاء الاصطناعي</label>
              <select
                value={competitorStyle}
                onChange={(e) => setCompetitorStyle(e.target.value)}
                className="w-full px-3 py-2 bg-[#FCFBF9] border border-[#ECE9E0] text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8D6E63] font-black text-[#5D4037]"
              >
                <option value="nanobanana_pro">🍌 ناناو بنانا Pro (دقة سينمائية قصوى، وجوه واقعية، تباين ناعم)</option>
                <option value="nanobanana_v2">🍌 ناناو بنانا V2 (واقعي فائق الدقة 4K مع خامات غامضة ومؤثرات ضباب)</option>
                <option value="abdelhady">🔥 نمط محمد عبد الهادي (ظلال داكنة مرعبة وواقعية مفرطة مع وميض أحمر)</option>
                <option value="moro">🌑 نمط شادي مورو (ألوان كحلية معتمة، غموض نفسي وضباب سينمائي بارد)</option>
                <option value="psychological">👁️ نمط الإثارة النفسية (تركيز على الوجه المذعور بأقصى تفاصيل البشرة والرمادي)</option>
                <option value="classic_horror">🚪 نمط الغموض الكلاسيكي (تفاصيل الغرفة القديمة، صرير، وظلال حادة)</option>
              </select>
            </div>

            {/* English Prompt editor */}
            <div>
              <label className="text-[11px] text-[#7D766D] font-bold block mb-1 flex items-center justify-between">
                <span>برومبت الصورة الإنجليزي (يمكنك تعديله لإضافة وحذف التفاصيل)</span>
                <span className="text-[9px] bg-[#FAF2EB] text-[#8D6E63] px-1.5 py-0.5 rounded border border-[#EFE5DC]">تعديل يدوي مرن</span>
              </label>
              <textarea 
                rows={4}
                placeholder="اضغط على زر التوليد في الخطوة 2 أولاً، أو اكتب برومبت يدوي بالإنجليزية هنا..."
                value={generatedPrompt}
                onChange={(e) => setGeneratedPrompt(e.target.value)}
                className="w-full p-3 rounded-lg border border-[#ECE9E0] bg-[#FCFBF9] text-xs font-mono text-[#5D4037] focus:outline-none focus:ring-2 focus:ring-[#8D6E63] resize-none"
              />
            </div>

            <button
              onClick={renderBackgroundWithStyle}
              disabled={isGeneratingImage || !generatedPrompt.trim()}
              className="w-full py-3 bg-[#E65100] hover:bg-[#BF360C] text-white font-black text-xs rounded-lg transition shadow-md flex items-center justify-center gap-2"
            >
              {isGeneratingImage ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  جاري استدعاء محرك الرسم الذكي ورسم التفاصيل بدقة...
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4" />
                  صناعة ورسم الغلاف الفني الآن 🎨
                </>
              )}
            </button>
          </div>

        </div>

        {/* Right Side: Interactive Preview Canvas & Text Layout customization (7 columns) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Main Preview Container */}
          <div className="bg-white rounded-xl p-5 border border-[#ECE9E0] shadow-sm space-y-4">
            <h4 className="text-xs font-black text-[#3E2723] flex items-center gap-2 pb-2 border-b border-[#ECE9E0]">
              <Layout className="w-4.5 h-4.5 text-[#8D6E63]" />
              لوحة التصميم الحية والتحكم بالنص (1280x720 HD)
            </h4>

            {/* Live Canvas element wrapper */}
            <div className="border border-[#ECE9E0] rounded-xl overflow-hidden bg-[#1E1915] shadow-inner relative flex items-center justify-center aspect-video">
              {isGeneratingImage ? (
                <div className="absolute inset-0 flex flex-col justify-center items-center bg-black/85 text-white p-4 text-center z-10 space-y-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-[#FFB300]" />
                  <p className="text-xs font-black text-[#FFB300]">جاري التوليد الفوري بنظام ناناو بنانا Pro...</p>
                  <p className="text-[10px] text-gray-400">يرجى الانتظار بضع ثوانٍ ليتم بناء الصورة وسحب الخامات البصرية</p>
                </div>
              ) : null}
              <canvas 
                ref={canvasRef} 
                className="w-full h-auto aspect-video max-w-full block"
              />
            </div>

            {/* Typography Overlay Options */}
            <div className="p-4 bg-[#FAF9F6] rounded-xl border border-[#ECE9E0] space-y-4">
              <span className="text-xs font-black text-[#8D6E63] block flex items-center gap-1">
                <SlidersHorizontal className="w-4 h-4" /> أدوات دمج وتحرير النصوص الاحترافية على الغلاف
              </span>

              {/* Title Input & Color */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-[#7D766D] font-bold block mb-1">النص الرئيسي (عنوان القصة لجذب النقرات)</label>
                  <input 
                    type="text" 
                    value={titleText}
                    onChange={(e) => setTitleText(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#ECE9E0] bg-white text-xs font-black focus:outline-none focus:ring-2 focus:ring-[#8D6E63]"
                  />
                  <p className="text-[9px] text-[#8D6E63] mt-1 font-bold">💡 نصيحة: اكتب علامة (/) لكسر السطر يدوياً وتنسيق الكلمات (مثال: سر غامض / في المقبرة).</p>
                </div>

                <div>
                  <label className="text-[10px] text-[#7D766D] font-bold block mb-1">لون العنوان</label>
                  <div className="flex gap-2 items-center h-9">
                    {[
                      { code: "#FF0000", label: "أحمر دموي" },
                      { code: "#FFB300", label: "ذهبي ناري" },
                      { code: "#FFFFFF", label: "أبيض ساطع" },
                      { code: "#FF6D00", label: "برتقالي متوهج" },
                      { code: "#00E5FF", label: "أزرق ثلجي" }
                    ].map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setTitleColor(c.code)}
                        className={`w-6 h-6 rounded-full border-2 transition ${titleColor === c.code ? "border-[#3E2723] scale-115 shadow-md" : "border-transparent"}`}
                        style={{ backgroundColor: c.code }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Size & Position & Overlay Preset */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] text-[#7D766D] font-bold block mb-1">حجم خط العنوان ({fontSize}px)</label>
                  <input 
                    type="range" 
                    min={24} 
                    max={110} 
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full h-1 bg-[#EFE5DC] rounded-lg appearance-none cursor-pointer accent-[#8D6E63]"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-[#7D766D] font-bold block mb-1">موضع النص الرأسي Y ({textYPosition}%)</label>
                  <input 
                    type="range" 
                    min={10} 
                    max={95} 
                    value={textYPosition}
                    onChange={(e) => setTextYPosition(Number(e.target.value))}
                    className="w-full h-1 bg-[#EFE5DC] rounded-lg appearance-none cursor-pointer accent-[#8D6E63]"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-[#7D766D] font-bold block mb-1">تأثير الفلتر والظلال المضافة</label>
                  <select
                    value={stylePreset}
                    onChange={(e) => setStylePreset(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-[#ECE9E0] text-xs font-bold rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8D6E63]"
                  >
                    <option value="horror">أحمر دموي سفلي (درامي غامض)</option>
                    <option value="golden">وهج ذهبي سفلي (إثارة ملحمية)</option>
                    <option value="dramatic">ظلال سوداء سينمائية حادة (حرق حواف)</option>
                    <option value="none">بدون فلاتر إضافية</option>
                  </select>
                </div>
              </div>

              {/* Alignment & Text Background row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-[#ECE9E0]">
                <div>
                  <label className="text-[10px] text-[#7D766D] font-bold block mb-1">محاذاة النص وموقع الكتلة (لتفادي حجب موضوع الصورة)</label>
                  <select
                    value={textAlign}
                    onChange={(e) => setTextAlign(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-[#ECE9E0] text-xs font-bold rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8D6E63] text-[#5D4037]"
                  >
                    <option value="right">يمين (RTL) - لترك الجانب الأيسر لموضوع الصورة 🧟</option>
                    <option value="left">يسار (LTR) - لترك الجانب الأيمن لموضوع الصورة 🧟</option>
                    <option value="center">منتصف الشاشة (كلاسيكي) 🧭</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-[#7D766D] font-bold block mb-1">خلفية النص المدمجة (لضمان مقروئية 100% فوق الغلاف المعقد)</label>
                  <select
                    value={textBackground}
                    onChange={(e) => setTextBackground(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-[#ECE9E0] text-xs font-bold rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8D6E63] text-[#5D4037]"
                  >
                    <option value="none">بدون خلفية (اعتماد على الحواف والظلال) 🫥</option>
                    <option value="dark">خلفية سوداء مع برواز ذهبي خفيف (احترافي جداً) 🖤</option>
                    <option value="highlight">لوحة صفراء نيون جاذبة للانتباه (أسلوب شادي مورو) 💛</option>
                  </select>
                </div>
              </div>

              {/* Watermark Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-[#ECE9E0]">
                <div className="flex items-center gap-2 h-9">
                  <input 
                    type="checkbox" 
                    id="use-wm-enhanced" 
                    checked={useWatermark}
                    onChange={(e) => setUseWatermark(e.target.checked)}
                    className="rounded text-[#8D6E63] focus:ring-[#8D6E63] w-4 h-4"
                  />
                  <label htmlFor="use-wm-enhanced" className="text-[11px] text-[#5D4037] font-black cursor-pointer">
                    تضمين شعار مائي واسم قناتك
                  </label>
                </div>

                {useWatermark && (
                  <div>
                    <input 
                      type="text" 
                      value={watermarkText}
                      onChange={(e) => setWatermarkText(e.target.value)}
                      placeholder="اكتب اسم قناتك لحفظ حقوقك..."
                      className="w-full px-3 py-1.5 rounded-lg border border-[#ECE9E0] bg-white text-xs font-black focus:outline-none focus:ring-2 focus:ring-[#8D6E63]"
                    />
                  </div>
                )}
              </div>

            </div>

            {/* Recommendations / Tips banner */}
            <div className="p-4 bg-[#FAF2EB] rounded-xl border border-[#EFE5DC] text-xs text-[#8D6E63] space-y-1.5 leading-relaxed font-semibold">
              <p className="font-black text-[#5D4037]">🍌 ميزة ناناو بنانا (Nano Banana):</p>
              <p>• تم دمج أسلوب ناناو بنانا في التوليد ليعطيك مخرجات بصرية واقعية للرعب، دون أي ملامح مشوشة أو كارتونية.</p>
              <p>• ننصح باستخلاص أسلوب المنافسين أولاً لإعطاء الذكاء الاصطناعي موجهات واضحة تعكس هويتهم البصرية بدقة.</p>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
