import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Square,
  Code as CodeIcon, 
  Share2, 
  Network,
  Cpu, 
  Terminal, 
  ChevronDown, 
  Maximize2,
  RefreshCw,
  Sparkles,
  Database,
  TreeDeciduous,
  BookOpen,
  X,
  Settings,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import { atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';

SyntaxHighlighter.registerLanguage('python', python);

// --- Mock Data & Constants ---

// --- Components ---

const Header = () => (
  <header className="flex items-center justify-center px-6 py-4 bg-white text-slate-900 border-b border-slate-200">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
        <Network size={24} className="text-white" />
      </div>
      <div>
        <h1 className="text-xl font-bold tracking-tight">GameInterpreter</h1>
        <p className="text-xs text-slate-500 font-medium tracking-wide">AI-POWERED GAME THEORY MODELING</p>
      </div>
    </div>
  </header>
);

const CodeWindow = ({ code, isGenerating, codeWindowRef, variantCount, currentVariantIndex, onNext, onPrev }) => (
  <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
      <div className="flex items-center gap-2">
        <CodeIcon size={16} className="text-blue-400" />
        <span className="font-semibold text-slate-700 text-sm">Generated Python Code (PyGambit)</span>
      </div>
      {variantCount > 1 && (
        <div className="flex items-center gap-2 bg-white rounded-md border border-slate-200 p-0.5">
          <button 
            onClick={onPrev} 
            disabled={currentVariantIndex === 0}
            className="p-1 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed text-slate-600"
            title="Previous Variant"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-mono text-slate-500 w-12 text-center select-none">
            {currentVariantIndex + 1} / {variantCount}
          </span>
          <button 
            onClick={onNext} 
            disabled={currentVariantIndex === variantCount - 1}
            className="p-1 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed text-slate-600"
            title="Next Variant"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
    <div 
      ref={codeWindowRef}
      className="flex-1 overflow-auto p-4 font-mono text-sm relative group bg-gray-50 scroll-smooth">
      {isGenerating ? (
         <div className="flex items-center justify-center h-full text-slate-400 animate-pulse">
            <span className="flex items-center gap-2"><RefreshCw className="animate-spin" size={16} /> Generating PyGambit model...</span>
         </div>
      ) : code ? (
        <SyntaxHighlighter
          language="python"
          style={atomOneLight}
          customStyle={{ background: 'transparent', padding: 0, margin: 0, fontSize: '0.875rem' }}
          wrapLongLines={true}
        >
          {code}
        </SyntaxHighlighter>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
           <CodeIcon size={32} className="mb-2 opacity-50"/>
           <p>Enter a description and generate code to view it here.</p>
        </div>
      )}
    </div>
  </div>
);

// A simple tree visualizer mockup using SVG
const GameTreeVisualizer = ({ svgContent, show, isLoading, error }) => {
  if (!show) return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50/50">
       <p className="text-sm">Click "Draw Game" to render</p>
    </div>
  );

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-full text-slate-500 animate-pulse">
       <span className="flex items-center gap-2"><RefreshCw className="animate-spin" size={16} /> Rendering Tree...</span>
    </div>
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
          <p className="text-red-800 font-semibold mb-2">Error rendering visualization</p>
          <p className="text-red-700 text-sm whitespace-pre-wrap break-words">{error}</p>
        </div>
      </div>
    );
  }

  if (svgContent) {
    return (
      <div 
        className="w-full h-full p-4 flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:h-auto"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    );
  }

  return null;
};


export default function App() {
  const [prompt, setPrompt] = useState("");
  const [activeGameId, setActiveGameId] = useState(null);
  const [presets, setPresets] = useState([]);
  const [promptEdited, setPromptEdited] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [isGeminiEnabled, setIsGeminiEnabled] = useState(false);
  
  // Pipeline States
  const [isCodeGenerating, setIsCodeGenerating] = useState(false);
  const [isGeminiGenerating, setIsGeminiGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [generationService, setGenerationService] = useState('gemini');
  const [generationModel, setGenerationModel] = useState('gemini-2.5-flash');
  const [generationSetting, setGenerationSetting] = useState('A');
  const [codeVariants, setCodeVariants] = useState([]);
  const [currentVariantIndex, setCurrentVariantIndex] = useState(0);
  
  const [showVisual, setShowVisual] = useState(false);
  const [visualSvg, setVisualSvg] = useState(null);
  const [isVisualLoading, setIsVisualLoading] = useState(false);
  const [showFullscreenSvg, setShowFullscreenSvg] = useState(false);
  
  // Visualization Settings
  const [vizSettings, setVizSettings] = useState({
    shared_terminal_depth: false,
    scale_factor: 1.0,
    level_scaling: 1.0,
    sublevel_scaling: 1.0,
    width_scaling: 1.0,
    edge_thickness: 1.0,
    action_label_position: 0.5,
    color_scheme: "gambit"
  });
  const [showVizSettings, setShowVizSettings] = useState(false);
  const [vizSettingsPos, setVizSettingsPos] = useState({ x: 0, y: 0 });
  const [isDraggingSettings, setIsDraggingSettings] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const handleSettingsDragStart = (e) => {
    setIsDraggingSettings(true);
    setDragOffset({
      x: e.clientX - vizSettingsPos.x,
      y: e.clientY - vizSettingsPos.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingSettings) return;
      setVizSettingsPos({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };

    const handleMouseUp = () => {
      setIsDraggingSettings(false);
    };

    if (isDraggingSettings) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSettings, dragOffset]);

  useEffect(() => {
    if (showVizSettings) {
      const leftX = 24; // Position on the left side of the screen
      const centerY = (window.innerHeight - 400) / 2;
      setVizSettingsPos({ x: leftX, y: centerY });
    }
  }, [showVizSettings]);

  const [isComputingNash, setIsComputingNash] = useState(false);
  const [nashAlgorithm, setNashAlgorithm] = useState("enumpure");
  const [nashResults, setNashResults] = useState(null);
  const [computationTaskId, setComputationTaskId] = useState(null);
  const [visualError, setVisualError] = useState(null);
  const nashConsoleRef = useRef(null);
  const codeWindowRef = useRef(null);
  const activeTaskRef = useRef(null);

  // Auto-scroll Nash console when results appear
  useEffect(() => {
    if (nashResults && nashConsoleRef.current) {
      setTimeout(() => {
        nashConsoleRef.current.scrollTop = nashConsoleRef.current.scrollHeight;
      }, 0);
    }
  }, [nashResults]);

  // Auto-scroll code window when code is generated
  useEffect(() => {
    if (generatedCode && codeWindowRef.current) {
      setTimeout(() => {
        codeWindowRef.current.scrollTop = codeWindowRef.current.scrollHeight;
      }, 0);
    }
  }, [generatedCode]);

  // Load presets from server
  const fetchGames = () => {
    setConnectionError(null);
    fetch('http://127.0.0.1:5000/games')
      .then(res => {
        if (!res.ok) throw new Error("Server returned " + res.status);
        return res.json();
      })
      .then(data => setPresets(data))
      .catch(err => {
        console.error("Failed to load games:", err);
        setConnectionError("Cannot connect to backend server. Make sure 'server.py' is running.");
      });
  };

  useEffect(() => {
    fetchGames();
  }, []);

  useEffect(() => {
    fetch('http://127.0.0.1:5000/config')
      .then(res => res.json())
      .then(data => setIsGeminiEnabled(!!data.gemini_enabled))
      .catch(err => console.error("Failed to load config:", err));
  }, []);

  // Handle Preset Selection
  const loadPreset = (gameId) => {
    const game = presets.find(g => g.id === gameId);
    if (game) {
      setPrompt(game.description);
      setActiveGameId(gameId);
      setPromptEdited(false);
      setCodeVariants([]);
      setCurrentVariantIndex(0);
      // Reset pipeline
      setGeneratedCode("");
      setShowVisual(false);
      setVisualSvg(null);
      setNashResults(null);
    }
  };

  const handleGeminiGenerate = () => {
    if (!prompt) return;
    setGeneratedCode("");
    setIsGeminiGenerating(true);
    setShowVisual(false);
    setNashResults(null);
    setCodeVariants([]);
    setCurrentVariantIndex(0);

    fetch('http://127.0.0.1:5000/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        service: generationService,
        model: generationModel,
        setting: generationSetting,
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        throw new Error(data.error);
      }
      const code = data.code || "# No code returned";
      setGeneratedCode(code);
      setCodeVariants([code]);
    })
    .catch(err => {
      console.error(err);
      setGeneratedCode(`# Error: ${err.message}\n\n# Please check the following:\n# 1. Your backend server is running.\n# 2. The GEMINI_API_KEY in your .env file is correct and has billing enabled.\n# 3. Your prompt does not violate safety policies.`);
    })
    .finally(() => {
      setIsGeminiGenerating(false);
    });
  };

  // Mock API Call: Generate Code
  const handleGenerateCode = () => {
    if (!prompt) return;
    setIsCodeGenerating(true);
    setGeneratedCode("");
    setShowVisual(false);
    setNashResults(null);
    setCodeVariants([]);
    setCurrentVariantIndex(0);
    
    const game = presets.find(g => g.id === activeGameId);
    
    let code = "";
    let variants = [];

    if (game) {
      variants = game.codeVariants || (game.mockCode ? [game.mockCode] : []);
      if (variants.length > 0) {
        code = variants[0];
      } else {
        // Fallback
        code = `# Generated Code based on prompt...`;
        variants = [code];
      }
    } else {
      // Custom prompt fallback
      code = `# Generated Code based on prompt\nimport pygambit as g\ngame = g.Game.new_table([2,2])\n# Logic inferred from prompt...\ngame.title = "Custom Game"`;
      variants = [code];
    }
    
    setCodeVariants(variants);
    setGeneratedCode(code);
    setIsCodeGenerating(false);
  };

  const handleNextVariant = () => {
    if (currentVariantIndex < codeVariants.length - 1) {
      const newIndex = currentVariantIndex + 1;
      setCurrentVariantIndex(newIndex);
      setGeneratedCode(codeVariants[newIndex]);
      setShowVisual(false);
      setNashResults(null);
      setVisualSvg(null);
    }
  };

  const handlePrevVariant = () => {
    if (currentVariantIndex > 0) {
      const newIndex = currentVariantIndex - 1;
      setCurrentVariantIndex(newIndex);
      setGeneratedCode(codeVariants[newIndex]);
      setShowVisual(false);
      setNashResults(null);
      setVisualSvg(null);
    }
  };

  // This effect handles drawing/redrawing the tree.
  // It runs when the visual is toggled on, or when settings change while it's visible.
  useEffect(() => {
    if (generatedCode) {
      if (showVisual) {
        setIsVisualLoading(true);
        setVisualError(null);
        fetch('http://127.0.0.1:5000/visualize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: generatedCode, ...vizSettings })
        })
        .then(res => {
          if (!res.ok) {
            return res.json().then(err => { 
              const msg = err.details ? `${err.error}\n\n${err.details}` : err.error;
              throw new Error(msg || 'Failed to generate visualization');
            });
          }
          return res.json();
        })
        .then(data => {
          if (data.svg) {
            setVisualSvg(data.svg);
          } else if (data.error) {
            setVisualError(data.error);
          }
        })
        .catch(err => {
          console.error(err);
          setVisualError(err.message || 'Failed to generate visualization');
        })
        .finally(() => setIsVisualLoading(false));
      }
    }
  }, [showVisual, vizSettings, generatedCode]);

  // Toggle Visualization
  const handleVisualize = () => {
    setShowVisual(true);
  };

  // Mock API Call: Compute Nash
  const handleComputeNash = () => {
    setIsComputingNash(true);
    setNashResults(null);
    const taskId = Math.random().toString(36).substring(7);
    setComputationTaskId(taskId);
    activeTaskRef.current = taskId;

    fetch('http://127.0.0.1:5000/compute-nash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: generatedCode, algorithm: nashAlgorithm, task_id: taskId })
    })
    .then(res => {
      if (!res.ok) {
        return res.json().then(err => { throw new Error(err.error || 'Server error') });
      }
      return res.json();
    })
    .then(data => {
      if (activeTaskRef.current === taskId) {
        if (data.error) {
          setNashResults(`Error: ${data.error}`);
        } else {
          setNashResults(data.results || "No results returned from solver.");
        }
      }
    })
    .catch(err => {
      console.error(err);
      if (activeTaskRef.current === taskId) {
        setNashResults(`Error: ${err.message}`);
      }
    })
    .finally(() => {
      if (activeTaskRef.current === taskId) {
        setIsComputingNash(false);
        setComputationTaskId(null);
        activeTaskRef.current = null;
      }
    });
  };

  const handleStopNash = () => {
    if (computationTaskId) {
      fetch('http://127.0.0.1:5000/kill-nash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: computationTaskId })
      })
      .catch(err => console.error("Failed to stop task:", err));
      
      activeTaskRef.current = null;
      setIsComputingNash(false);
      setNashResults(null);
      setComputationTaskId(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-200">
      <Header />
      
      {connectionError && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center justify-center gap-2 text-red-700 text-sm animate-in slide-in-from-top-2">
          <AlertCircle size={16} />
          <span className="font-medium">{connectionError}</span>
          <button 
            onClick={fetchGames} 
            className="ml-2 px-3 py-1 bg-red-100 hover:bg-red-200 rounded-md text-xs font-bold transition-colors"
          >
            Retry
          </button>
        </div>
      )}
      
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full flex flex-col gap-6">
        
        {/* SECTION 1: Natural Language Input */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <label className="text-sm font-semibold text-slate-700">
                  Describe your game
                </label>
                <div className="flex gap-2 items-center">
                  {presets.length === 0 && (
                    <button 
                      onClick={fetchGames}
                      className="p-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-500 rounded-md transition-colors"
                      title="Refresh Examples"
                    >
                      <RefreshCw size={14} />
                    </button>
                  )}
                  <select 
                     onChange={(e) => loadPreset(e.target.value)}
                     className="bg-slate-100 border border-slate-300 text-slate-600 text-xs rounded-md px-2 py-1 hover:bg-slate-200 cursor-pointer outline-none"
                     defaultValue=""
                   >
                     <option value="" disabled>📚 Load Example Game...</option>
                     {presets.map(g => (
                       <option key={g.id} value={g.id}>{g.name}</option>
                     ))}
                   </select>
                </div>
              </div>
              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    setPromptEdited(true);
                  }}
                  placeholder="E.g., Two firms are competing for market share. If both set high prices..."
                  className="w-full h-32 p-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none transition-shadow text-slate-700 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="w-full md:w-64 flex flex-col justify-end gap-3">   
              <button 
                onClick={handleGeminiGenerate}
                disabled={!prompt || isCodeGenerating || isGeminiGenerating || (generationService === 'gemini' && !isGeminiEnabled)}
                title={generationService === 'gemini' && !isGeminiEnabled ? "Gemini API Key missing in .env" : "Generate Code"}
                className={`flex items-center justify-center gap-2 w-full py-3 rounded-lg font-semibold text-white shadow-lg shadow-purple-500/30 transition-all transform active:scale-95 ${
                  !prompt || (generationService === 'gemini' && !isGeminiEnabled) ? 'bg-slate-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 hover:-translate-y-0.5'
                }`}
              >
                {isGeminiGenerating ? (
                  <RefreshCw className="animate-spin" size={20} />
                ) : (
                  <Sparkles size={20} className="text-white" /> 
                )}
                Generate Code
              </button>
              <div className="grid grid-cols-3 gap-2 px-2 text-xs">
                <div>
                    <label className="block text-slate-500 font-medium mb-1 text-center">Service</label>
                    <select
                        value={generationService}
                        onChange={(e) => setGenerationService(e.target.value)}
                        className="w-full bg-slate-100 border border-slate-300 text-slate-600 rounded px-1 py-1 hover:bg-slate-200 cursor-pointer outline-none"
                    >
                        <option value="gemini" disabled={!isGeminiEnabled}>Gemini{!isGeminiEnabled ? " (No Key)" : ""}</option>
                        <option value="chatgpt" disabled>ChatGPT</option>
                        <option value="claude" disabled>Claude</option>
                    </select>
                </div>
                <div>
                    <label className="block text-slate-500 font-medium mb-1 text-center">Model</label>
                    <select
                        value={generationModel}
                        onChange={(e) => setGenerationModel(e.target.value)}
                        className="w-full bg-slate-100 border border-slate-300 text-slate-600 rounded px-1 py-1 hover:bg-slate-200 cursor-pointer outline-none"
                    >
                        <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                        <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                        <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview</option>
                    </select>
                </div>
                <div>
                    <label className="block text-slate-500 font-medium mb-1 text-center">GameInterpreter</label>
                    <select
                        value={generationSetting}
                        onChange={(e) => setGenerationSetting(e.target.value)}
                        className="w-full bg-slate-100 border border-slate-300 text-slate-600 rounded px-1 py-1 hover:bg-slate-200 cursor-pointer outline-none"
                    >
                        <option value="A">Setting A</option>
                        <option value="B" disabled>Setting B</option>
                        <option value="C" disabled>Setting C</option>
                        <option value="D" disabled>Setting D</option>
                    </select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleGenerateCode}
                  disabled={!activeGameId || promptEdited || isCodeGenerating || isGeminiGenerating}
                  className={`flex items-center justify-center gap-2 w-full py-3 rounded-lg font-semibold text-white shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 ${
                    !activeGameId || promptEdited ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 hover:-translate-y-0.5'
                  }`}
                >
                  {isCodeGenerating ? (
                    <RefreshCw className="animate-spin" size={20} />
                  ) : (
                    <Database size={20} className="text-white" />
                  )}
                  V1 code
                </button>
                <p className="text-xs text-slate-500 text-center leading-relaxed px-2">
                  Code from GameInterpreter V1 experiment Setting D with GPT4o, see{' '}
                  <a
                    href="https://github.com/edwardchalstrey1/game?tab=readme-ov-file#example-games-data-source"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 underline"
                  >
                    details
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: Grid Layout for Tools */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COL: Code & Computation */}
          <div className="lg:col-span-7 h-[50vh] flex flex-col gap-6">
            {/* TOP: Generated Code */}
            <CodeWindow 
              code={generatedCode} 
              isGenerating={isCodeGenerating || isGeminiGenerating} 
              codeWindowRef={codeWindowRef}
              variantCount={codeVariants.length}
              currentVariantIndex={currentVariantIndex}
              onNext={handleNextVariant}
              onPrev={handlePrevVariant}
            />
            {/* BOTTOM: Nash Solver */}
            <div className="h-64 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center gap-4 px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Cpu size={16} className="text-emerald-600" />
                  <span className="font-semibold text-slate-700 text-sm">Nash Equilibria Solver</span>
                </div>
                <div className="h-4 w-px bg-slate-300"></div>
                
                <div className="flex items-center gap-2 flex-1">
                  <label className="text-xs text-slate-600">Algorithm:</label>
                  <div className="relative group">
                    <select 
                      value={nashAlgorithm}
                      onChange={(e) => setNashAlgorithm(e.target.value)}
                      className="appearance-none bg-white text-slate-700 text-xs py-1 px-3 pr-8 rounded border border-slate-300 hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-400/30 outline-none cursor-pointer transition-colors"
                    >
                      <option value="enumpure">Pure Strategies (enumpure)</option>
                      <option value="enummixed">Mixed Strategies (enummixed)</option>
                      <option value="lp">Linear Programming (lp)</option>
                      <option value="lcp">Linear Complementarity (lcp)</option>
                      <option value="liap">Liapunov Method (liap)</option>
                      <option value="logit">Logit Response (logit)</option>
                      <option value="simpdiv">Simplicial Subdivision (simpdiv)</option>
                      <option value="ipa">Iterated Polymatrix Approx. (ipa)</option>
                      <option value="gnm">Global Newton Method (gnm)</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1.5 text-slate-600 pointer-events-none" />
                  </div>
                </div>
                <button 
                  onClick={isComputingNash ? handleStopNash : handleComputeNash}
                  disabled={!generatedCode || (isComputingNash && !computationTaskId)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isComputingNash ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {isComputingNash ? 'Stop' : 'Run Solver'}
                  {isComputingNash ? <Square size={10} className="fill-current" /> : <Play size={10} className="fill-current" />}
                </button>
              </div>

              {/* Console Output */}
              <div 
                ref={nashConsoleRef}
                className="flex-1 p-4 font-mono text-sm overflow-y-auto bg-slate-50 scroll-smooth"
              >
                {!generatedCode ? (
                  <div className="text-slate-600 italic">Waiting for game model generation...</div>
                ) : !nashResults && !isComputingNash ? (
                  <div className="text-slate-500">Ready to compute. Select an algorithm and run.</div>
                ) : isComputingNash ? (
                   <div className="flex flex-col gap-2">
                     <div className="text-emerald-600">&gt; Initializing solver engine...</div>
                     <div className="text-emerald-600">&gt; Loading pygambit.{nashAlgorithm}...</div>
                     <div className="text-slate-700 animate-pulse">&gt; Computing...</div>
                   </div>
                ) : (
                  <div className="flex flex-col gap-2 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="text-slate-600 text-xs border-b border-slate-200 pb-2 mb-2">
                      Output for {activeGameId || 'Custom Game'} using <span className="text-emerald-600 font-medium">{nashAlgorithm}</span>:
                    </div>
                    {nashResults.split('\n').map((line, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-emerald-600">➜</span>
                        <span className="text-slate-700">{line}</span>
                      </div>
                    ))}
                    <div className="text-slate-500 text-xs mt-2">&gt; Process finished with exit code 0</div>
                  </div>
                )}
              </div>
            </div>

          </div>
          {/* RIGHT COL: Visualizer */}
          <div className="lg:col-span-5 h-[50vh] flex flex-col gap-4">
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
              <div className="flex gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50">
                <button
                  onClick={handleVisualize}
                  disabled={!generatedCode}
                  className={`flex items-center justify-center gap-2 flex-1 py-3 rounded-lg font-semibold text-white shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 ${
                    !generatedCode ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 hover:-translate-y-0.5'
                  }`}
                >
                  <TreeDeciduous size={16} className="text-white" />
                  Draw Game
                </button>
                <button
                  onClick={() => setShowVizSettings(!showVizSettings)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors"
                  title="Toggle visualization settings"
                >
                  <Settings size={16} />
                </button>
                <button
                  onClick={() => setShowFullscreenSvg(true)}
                  disabled={!visualSvg}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors disabled:opacity-50"
                  title="Expand fullscreen"
                >
                  <Maximize2 size={16} />
                </button>
              </div>

              <div className="flex-1 relative bg-slate-50/30 h-[40vh]">
                <GameTreeVisualizer svgContent={visualSvg} show={showVisual} isLoading={isVisualLoading} error={visualError} />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Visualization Settings Modal */}
      {showVizSettings && (
        <div 
          className="fixed bg-white rounded-lg shadow-xl border border-slate-200 w-80 max-h-[70vh] overflow-y-auto z-50"
          style={{
            left: `${vizSettingsPos.x}px`,
            top: `${vizSettingsPos.y}px`,
            cursor: isDraggingSettings ? 'grabbing' : 'default'
          }}
        >
          <div 
            className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 sticky top-0 cursor-grab hover:bg-slate-100 transition-colors"
            onMouseDown={handleSettingsDragStart}
          >
            <span className="font-semibold text-slate-700 text-sm">Settings</span>
            <button
              onClick={() => setShowVizSettings(false)}
              className="p-1 hover:bg-slate-200 rounded transition-colors"
            >
              <X size={16} className="text-slate-600" />
            </button>
          </div>
          <div className="px-4 py-3 space-y-3 text-xs">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Scale Factor</label>
              <input 
                type="range" 
                min="0.1" 
                max="2" 
                step="0.1" 
                value={vizSettings.scale_factor}
                onChange={(e) => setVizSettings({...vizSettings, scale_factor: parseFloat(e.target.value)})}
                className="w-full h-1.5 bg-slate-300 rounded-lg"
              />
              <span className="text-slate-500">{vizSettings.scale_factor.toFixed(1)}</span>
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Level Spacing</label>
              <input 
                type="range" 
                min="0.1" 
                max="2" 
                step="0.1" 
                value={vizSettings.level_scaling}
                onChange={(e) => setVizSettings({...vizSettings, level_scaling: parseFloat(e.target.value)})}
                className="w-full h-1.5 bg-slate-300 rounded-lg"
              />
              <span className="text-slate-500">{vizSettings.level_scaling.toFixed(1)}</span>
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Sublevel Spacing</label>
              <input 
                type="range" 
                min="0" 
                max="2" 
                step="0.1" 
                value={vizSettings.sublevel_scaling}
                onChange={(e) => setVizSettings({...vizSettings, sublevel_scaling: parseFloat(e.target.value)})}
                className="w-full h-1.5 bg-slate-300 rounded-lg"
              />
              <span className="text-slate-500">{vizSettings.sublevel_scaling.toFixed(1)}</span>
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Width Scaling</label>
              <input 
                type="range" 
                min="0.5" 
                max="2" 
                step="0.1" 
                value={vizSettings.width_scaling}
                onChange={(e) => setVizSettings({...vizSettings, width_scaling: parseFloat(e.target.value)})}
                className="w-full h-1.5 bg-slate-300 rounded-lg"
              />
              <span className="text-slate-500">{vizSettings.width_scaling.toFixed(1)}</span>
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Edge Thickness</label>
              <input 
                type="range" 
                min="0.5" 
                max="3" 
                step="0.1" 
                value={vizSettings.edge_thickness}
                onChange={(e) => setVizSettings({...vizSettings, edge_thickness: parseFloat(e.target.value)})}
                className="w-full h-1.5 bg-slate-300 rounded-lg"
              />
              <span className="text-slate-500">{vizSettings.edge_thickness.toFixed(1)}</span>
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Action Label Position</label>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.1" 
                value={vizSettings.action_label_position}
                onChange={(e) => setVizSettings({...vizSettings, action_label_position: parseFloat(e.target.value)})}
                className="w-full h-1.5 bg-slate-300 rounded-lg"
              />
              <span className="text-slate-500">{vizSettings.action_label_position.toFixed(1)}</span>
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Terminal Depth</label>
              <button
                onClick={() => setVizSettings({...vizSettings, shared_terminal_depth: !vizSettings.shared_terminal_depth})}
                className={`w-full px-2 py-1 rounded text-xs font-medium transition-colors ${vizSettings.shared_terminal_depth ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
              >
                {vizSettings.shared_terminal_depth ? 'Aligned' : 'Default'}
              </button>
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Color Scheme</label>
              <select 
                value={vizSettings.color_scheme}
                onChange={(e) => setVizSettings({...vizSettings, color_scheme: e.target.value})}
                className="w-full px-2 py-1 rounded text-xs border border-slate-300 bg-white text-slate-700"
              >
                <option value="gambit">Gambit</option>
                <option value="distinctipy">Distinctipy</option>
                <option value="colorblind">Colorblind</option>
                <option value="default">Default</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen SVG Modal */}
      {showFullscreenSvg && visualSvg && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-[95vw] h-[95vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Network size={18} className="text-indigo-500" />
                <span className="font-semibold text-slate-700">Game Tree Visualization (Fullscreen)</span>
              </div>
              <button
                onClick={() => setShowFullscreenSvg(false)}
                className="p-1 hover:bg-slate-200 rounded transition-colors"
              >
                <X size={20} className="text-slate-600" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-slate-50/30">
              <div 
                className="min-w-full min-h-full [&>svg]:w-full [&>svg]:h-full"
                dangerouslySetInnerHTML={{ __html: visualSvg }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
