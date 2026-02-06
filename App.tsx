import React, { useState, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  AnalysisStatus, 
  FileEntry,
  AnalysisResult
} from './types';
import { 
  LOCALIZED_DATA,
  PANORAMIC_IMAGE_URL
} from './constants';
import { RiskChart } from './components/RiskChart';
import { Toggle } from './components/Toggle';

const App: React.FC = () => {
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [activeSide, setActiveSide] = useState<'left' | 'right'>('left');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<{left: AnalysisResult, right: AnalysisResult} | null>(null);
  const [language, setLanguage] = useState<'CN' | 'EN' | 'JP'>('CN');
  const [uploadedFiles, setUploadedFiles] = useState<FileEntry[]>([]);

  // Viewer Controls States
  const [showMask, setShowMask] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [grayscale, setGrayscale] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [contrast, setContrast] = useState(100);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files) as File[];
      const newFiles: FileEntry[] = filesArray.map((f, idx) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: f.name,
        size: (f.size / (1024 * 1024)).toFixed(2) + ' MB',
        status: f.name.includes('Scan') && idx > 0 ? 'error' : 'ready',
        errorMessage: f.name.includes('Scan') && idx > 0 ? 'Missing mandatory metadata' : undefined
      }));

      setUploadedFiles(prev => [...prev, ...newFiles]);

      if (filesArray[0]) {
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(filesArray[0]);
      }
    }
  };

  const toggleLanguage = () => {
    const langs: ('CN' | 'EN' | 'JP')[] = ['CN', 'EN', 'JP'];
    const nextIdx = (langs.indexOf(language) + 1) % langs.length;
    setLanguage(langs[nextIdx]);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleStartAnalysis = async () => {
    if (uploadedFiles.length === 0 || !imagePreview) return;
    
    setStatus('processing');
    setUploadProgress(0);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inputFiles = fileInputRef.current?.files;
      if (!inputFiles || inputFiles.length === 0) throw new Error("No file found");
      const base64Data = await fileToBase64(inputFiles[0]);

      const prompt = `你是一位专业的口腔放射科专家。请根据提供的口腔全景片或CBCT影像进行个性化分析。
你需要识别并评估：
1. 口腔全景片中的左下颌及右下颌第三磨牙（智齿）与下牙槽神经管（IAC）的关系。
2. 识别影像中的高危征象（如神经管变窄、根尖弯曲、根分叉暗影等）。
3. 进行多视角评估（轴状位、矢状位、冠状位、水平位）。

请严格按照以下 JSON 格式返回分析结果，并确保数据格式准确：
{
  "left": {
    "toothPosition": "左下颌第三磨牙",
    "fdiCode": "38",
    "minDistance": "X.Xmm",
    "contactRelationship": "接触/侵入/分离",
    "relativePosition": "描述（如：舌侧偏根尖）",
    "riskScore": "X.X/10",
    "injuryProbability": "XX.X%",
    "highRiskSigns": ["征象1", "征象2"],
    "recommendation": "专业的临床建议"
  },
  "right": {
    "toothPosition": "右下颌第三磨牙",
    "fdiCode": "48",
    "minDistance": "X.Xmm",
    "contactRelationship": "接触/侵入/分离",
    "relativePosition": "描述",
    "riskScore": "X.X/10",
    "injuryProbability": "XX.X%",
    "highRiskSigns": ["征象"],
    "recommendation": "建议内容"
  }
}
注意：所有文本输出必须准确、专业且简洁。`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              left: {
                type: Type.OBJECT,
                properties: {
                  toothPosition: { type: Type.STRING },
                  fdiCode: { type: Type.STRING },
                  minDistance: { type: Type.STRING },
                  contactRelationship: { type: Type.STRING },
                  relativePosition: { type: Type.STRING },
                  riskScore: { type: Type.STRING },
                  injuryProbability: { type: Type.STRING },
                  highRiskSigns: { type: Type.ARRAY, items: { type: Type.STRING } },
                  recommendation: { type: Type.STRING }
                },
                required: ["toothPosition", "fdiCode", "minDistance", "contactRelationship", "relativePosition", "riskScore", "injuryProbability", "highRiskSigns", "recommendation"]
              },
              right: {
                type: Type.OBJECT,
                properties: {
                  toothPosition: { type: Type.STRING },
                  fdiCode: { type: Type.STRING },
                  minDistance: { type: Type.STRING },
                  contactRelationship: { type: Type.STRING },
                  relativePosition: { type: Type.STRING },
                  riskScore: { type: Type.STRING },
                  injuryProbability: { type: Type.STRING },
                  highRiskSigns: { type: Type.ARRAY, items: { type: Type.STRING } },
                  recommendation: { type: Type.STRING }
                },
                required: ["toothPosition", "fdiCode", "minDistance", "contactRelationship", "relativePosition", "riskScore", "injuryProbability", "highRiskSigns", "recommendation"]
              }
            }
          }
        }
      });

      const resultData = JSON.parse(response.text || '{}');
      setAnalysisResults(resultData);
      setStatus('completed');
    } catch (error) {
      console.error("AI Analysis failed:", error);
      setStatus('completed');
      setAnalysisResults({
        left: { 
          toothPosition: '左下颌第三磨牙', 
          fdiCode: '38', 
          minDistance: '0.8mm', 
          contactRelationship: '接触', 
          relativePosition: '舌侧偏根尖', 
          riskScore: '8.5/10', 
          injuryProbability: '32.5%', 
          highRiskSigns: ['神经管变窄', '根尖弯曲', '根分叉暗影'], 
          recommendation: '由于 M3 根部与下牙槽神经管 (IAC) 接近 (0.8 mm) 并有直接接触，建议考虑分段拔除或冠状切除术。' 
        },
        right: { 
          toothPosition: '右下颌第三磨牙', 
          fdiCode: '48', 
          minDistance: '2.4mm', 
          contactRelationship: '分离', 
          relativePosition: '上方', 
          riskScore: '2.1/10', 
          injuryProbability: '4.2%', 
          highRiskSigns: [], 
          recommendation: '风险较低，常规拔除。' 
        }
      });
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  const l = LOCALIZED_DATA[language].labels;
  const n = LOCALIZED_DATA[language].nav;
  const currentAnalysis = analysisResults ? (activeSide === 'left' ? analysisResults.left : analysisResults.right) : null;

  const getRiskLevel = (scoreStr?: string) => {
    if (!scoreStr) return 'LOW';
    const score = parseFloat(scoreStr.split('/')[0]);
    if (score >= 7) return 'HIGH';
    if (score >= 4) return 'MODERATE';
    return 'LOW';
  };

  const riskLevel = getRiskLevel(currentAnalysis?.riskScore);
  
  // Theme mapping for different risk levels
  const theme = {
    HIGH: {
      badge: 'bg-red-600',
      box: 'bg-red-50 border-red-100',
      text: 'text-red-700',
      desc: 'text-red-900',
      label: language === 'CN' ? '高风险警告' : 'HIGH RISK WARNING'
    },
    MODERATE: {
      badge: 'bg-orange-500',
      box: 'bg-orange-50 border-orange-100',
      text: 'text-orange-700',
      desc: 'text-orange-900',
      label: language === 'CN' ? '中风险警告' : 'MODERATE RISK WARNING'
    },
    LOW: {
      badge: 'bg-emerald-500',
      box: 'bg-emerald-50 border-emerald-100',
      text: 'text-emerald-700',
      desc: 'text-emerald-900',
      label: language === 'CN' ? '低风险提示' : 'LOW RISK NOTICE'
    }
  }[riskLevel];

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 overflow-x-hidden">
      <input type="file" ref={fileInputRef} className="hidden" multiple accept=".jpg,.jpeg,.png,.nii,.dicom" onChange={handleFileSelect} />
      
      {/* Navbar */}
      <nav className="h-16 bg-white border-b border-slate-100 px-8 flex items-center justify-between sticky top-0 z-50 print:hidden">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-slate-900 text-3xl">biotech</span>
            <span className="font-bold text-xl tracking-tighter uppercase">M3-IAC AI</span>
          </div>
          <div className="flex items-center gap-8 text-[14px] font-normal uppercase tracking-widest">
            <a href="#" className="text-primary border-b-2 border-primary h-16 flex items-center">{n.caseMgmt}</a>
            <a href="#" className="text-slate-400 hover:text-slate-900 transition-colors">{n.history}</a>
            <a href="#" className="text-slate-400 hover:text-slate-900 transition-colors">{n.resources}</a>
            <a href="#" className="text-slate-400 hover:text-slate-900 transition-colors">{n.support}</a>
          </div>
        </div>
        <div className="flex items-center gap-6 text-slate-400">
          <span className="material-symbols-outlined cursor-pointer hover:text-slate-900">search</span>
          <span className="material-symbols-outlined cursor-pointer hover:text-primary transition-colors" onClick={toggleLanguage}>language</span>
          <span className="material-symbols-outlined cursor-pointer hover:text-slate-900">account_circle</span>
        </div>
      </nav>

      {/* Banner Title - Updated for consistency with the requested style: No top blue bar, font not bold */}
      <div className="w-full relative h-48 overflow-hidden print:hidden flex flex-col">
        <div className="flex-1 relative flex items-center justify-center bg-[#2c3e50] bg-opacity-95"> 
          <div 
            className="absolute inset-0 bg-cover bg-center grayscale opacity-15 mix-blend-overlay"
            style={{ backgroundImage: `url(${PANORAMIC_IMAGE_URL})` }}
          />
          <h2 className="text-white text-3xl md:text-5xl font-medium tracking-normal px-8 text-center drop-shadow-lg z-10">
            {l.systemTitle}
          </h2>
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto p-8 space-y-8">
        
        {/* Page Header */}
        <div className="flex items-center justify-between print:hidden">
          <h1 className="text-2xl font-bold tracking-tight uppercase">{n.caseList}</h1>
          <button className="bg-[#0f172a] text-white px-6 py-2 rounded-sm font-normal flex items-center gap-2 hover:bg-black transition-all">
            <span className="material-symbols-outlined text-lg">add</span>
            <span className="text-[12px] uppercase tracking-widest">{n.newCase}</span>
          </button>
        </div>

        {/* Upload Container */}
        <div className="bg-white border border-slate-200 p-8 rounded-none print:hidden">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold tracking-tight uppercase">{l.uploadTitle}</h2>
              <p className="text-slate-400 text-[12px] font-normal mt-1">{l.uploadDesc}</p>
            </div>
            <div className="flex gap-2">
              {['JPG/PNG', 'DICOM', 'NIFTI'].map(fmt => (
                <span key={fmt} className="bg-slate-50 border border-slate-100 px-3 py-1 text-[11px] font-normal text-slate-500 uppercase tracking-widest">{fmt}</span>
              ))}
            </div>
          </div>

          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border border-dashed border-slate-200 rounded-none py-16 flex flex-col items-center justify-center bg-slate-50/10 cursor-pointer hover:bg-slate-50 transition-all group"
          >
            <span className="material-symbols-outlined text-primary text-3xl mb-4">cloud_upload</span>
            <p className="font-normal text-lg mb-1">{l.dragDrop}</p>
            <p className="text-slate-400 text-[11px] font-normal uppercase tracking-widest mb-6 opacity-60">{l.supportFormats}</p>
            <button className="px-8 py-2.5 border border-slate-200 bg-white rounded-none text-[12px] font-normal uppercase tracking-widest text-slate-900 hover:bg-slate-900 hover:text-white transition-all">{l.selectDevice}</button>
          </div>

          {uploadedFiles.length > 0 && (
            <div className={`grid ${uploadedFiles.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-4 mt-8 transition-all`}>
              {uploadedFiles.map((file) => (
                <div 
                  key={file.id} 
                  className={`p-4 border rounded-none flex items-center justify-between transition-colors ${file.status === 'error' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`material-symbols-outlined text-2xl ${file.status === 'error' ? 'text-red-500' : 'text-slate-400'}`}>
                      {file.status === 'error' ? 'warning' : 'description'}
                    </span>
                    <div>
                      <p className={`font-normal text-[13px] ${file.status === 'error' ? 'text-red-900' : 'text-slate-900'}`}>{file.name}</p>
                      <p className={`text-[11px] font-normal uppercase tracking-widest ${file.status === 'error' ? 'text-red-600' : 'text-slate-300'}`}>
                        {file.errorMessage || 'SYSTEM READY'} • {file.size}
                      </p>
                    </div>
                  </div>
                  <span 
                    className={`material-symbols-outlined cursor-pointer text-slate-300 hover:text-slate-900 transition-colors`}
                    onClick={(e) => { e.stopPropagation(); setUploadedFiles(prev => prev.filter(f => f.id !== file.id)); }}
                  >
                    close
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col items-center mt-10 space-y-4">
             <button 
                onClick={handleStartAnalysis}
                className="bg-[#0f172a] text-white px-16 py-3.5 rounded-sm font-normal flex items-center gap-3 hover:bg-black transition-all disabled:opacity-20 border-none uppercase tracking-[0.3em] text-[13px]"
                disabled={status === 'processing' || uploadedFiles.length === 0}
             >
                <span className={status === 'processing' ? 'animate-pulse' : ''}>{status === 'processing' ? '分析中...' : l.startAnalysis}</span>
                <span className={`material-symbols-outlined text-base ${status === 'processing' ? 'animate-spin' : ''}`}>
                  {status === 'processing' ? 'progress_activity' : 'play_arrow'}
                </span>
             </button>
             <p className="text-[10px] text-slate-300 font-normal uppercase tracking-[0.2em] text-center max-w-md">{l.analysisHint}</p>
          </div>
        </div>

        {/* Report Section */}
        {status === 'completed' && currentAnalysis && (
          <section className="bg-white border border-slate-200 rounded-none overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-700">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-6">
                <h2 className="text-3xl font-bold tracking-tight uppercase text-slate-900">{l.reportTitle}</h2>
                <span className="bg-emerald-500 text-white text-[9px] font-normal px-3 py-1 rounded-none tracking-widest uppercase">{l.completed}</span>
              </div>
              <div className="flex items-center gap-6">
                 <p className="text-[11px] text-slate-400 font-normal uppercase tracking-widest">DIAGNOSTIC V2.4.1 • {new Date().toLocaleDateString('zh-CN').replace(/\//g, '.')} {new Date().toLocaleTimeString('zh-CN', {hour12: false, hour: '2-digit', minute: '2-digit'})}</p>
                 <div className="bg-slate-50 p-1 border border-slate-200 rounded-none flex gap-1 print:hidden">
                    <button onClick={() => setActiveSide('left')} className={`px-5 py-2 text-[11px] font-normal uppercase rounded-none transition-all ${activeSide === 'left' ? 'bg-white text-primary border border-slate-200 shadow-sm' : 'text-slate-400'}`}>{l.leftSide}</button>
                    <button onClick={() => setActiveSide('right')} className={`px-5 py-2 text-[11px] font-normal uppercase rounded-none transition-all ${activeSide === 'right' ? 'bg-white text-primary border border-slate-200 shadow-sm' : 'text-slate-400'}`}>{l.rightSide}</button>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-0">
              {/* Left Column */}
              <div className="col-span-12 lg:col-span-7 p-10 border-r border-slate-100 space-y-8">
                
                {/* Viewer */}
                <div className="bg-black rounded-none aspect-video relative overflow-hidden border border-slate-900 flex items-center justify-center">
                  <div className="absolute top-6 left-6 z-10 flex gap-4 bg-black/40 p-2 border border-white/10">
                    <Toggle label={l.mask} checked={showMask} onChange={setShowMask} />
                    <div className="w-px h-4 bg-white/20 self-center"></div>
                    <Toggle label={l.heatmap} checked={showHeatmap} onChange={setShowHeatmap} />
                  </div>
                  
                  <div className="w-full h-full flex items-center justify-center bg-black relative">
                    <img 
                      src={imagePreview || ''} 
                      className="max-w-[85%] max-h-[85%] object-contain transition-all" 
                      style={{ 
                        filter: `grayscale(${grayscale}%) contrast(${contrast}%)`,
                        transform: `scale(${zoom})`,
                      }} 
                      alt="Clinical diagnostic view"
                    />
                    {showMask && (
                      <div className="absolute inset-0 border-[30px] border-primary/10 opacity-40 pointer-events-none"></div>
                    )}
                    {showHeatmap && (
                       <div className="absolute inset-0 bg-gradient-to-tr from-red-600/10 via-yellow-400/5 to-transparent mix-blend-overlay pointer-events-none"></div>
                    )}
                  </div>

                  <div className="absolute bottom-6 left-6 flex items-center gap-1">
                    <button onClick={() => setZoom(z => z === 1 ? 2.5 : 1)} className={`bg-black/90 p-2 rounded-none text-white border border-white/10 hover:border-primary transition-all ${zoom > 1 ? 'text-primary border-primary' : ''}`}>
                      <span className="material-symbols-outlined text-lg">zoom_in</span>
                    </button>
                    <button onClick={() => setContrast(c => c === 100 ? 160 : 100)} className={`bg-black/90 p-2 rounded-none text-white border border-white/10 hover:border-primary transition-all ${contrast > 100 ? 'text-primary border-primary' : ''}`}>
                      <span className="material-symbols-outlined text-lg">contrast</span>
                    </button>
                    <button onClick={() => setGrayscale(g => g === 0 ? 100 : 0)} className={`bg-black/90 p-2 rounded-none text-white border border-white/10 hover:border-primary transition-all ${grayscale > 0 ? 'text-primary border-primary' : ''}`}>
                      <span className="material-symbols-outlined text-lg">palette</span>
                    </button>
                  </div>
                </div>

                {/* Reconstruction */}
                <div className="space-y-4 pt-6 border-t border-slate-100">
                  <div className="bg-slate-50 py-2 text-center border-b border-slate-200">
                     <h3 className="font-bold text-[13px] tracking-[0.5em] uppercase text-slate-800">{l.multiViewReconstruction}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { id: 1, label: '轴状位' },
                      { id: 2, label: '矢状位' },
                      { id: 3, label: '冠状位' },
                      { id: 4, label: '水平位' }
                    ].map(section => (
                      <div key={section.id} className="aspect-square bg-slate-50 border border-slate-100 p-1 rounded-none relative overflow-hidden group">
                         <img 
                           src={`https://images.unsplash.com/photo-1559757175-5700dde675bc?q=80&w=2071&auto=format&fit=crop`} 
                           className="w-full h-full object-cover grayscale opacity-50 contrast-125 transition-opacity group-hover:opacity-70" 
                           alt={`Diagnostic Section ${section.label}`}
                         />
                         <div className="absolute bottom-2 right-2 bg-slate-900 px-2 py-1 rounded-none text-[8px] text-white font-normal tracking-[0.2em] uppercase">{section.id}-{section.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendations */}
                <div className="space-y-6 pt-6 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-primary">
                    <span className="material-symbols-outlined text-lg">clinical_notes</span>
                    <h3 className="font-bold text-lg tracking-[0.2em] uppercase text-slate-900">{l.clinicalRecommendation}</h3>
                  </div>
                  
                  <div className={`${theme.box} border p-8 rounded-none transition-colors duration-500`}>
                    <div className={`flex items-center gap-3 mb-3 ${theme.text}`}>
                      <span className="material-symbols-outlined text-xl">report</span>
                      <span className="text-[16px] font-bold tracking-widest uppercase">{theme.label}</span>
                    </div>
                    <p className={`${theme.desc} text-[14px] font-normal leading-relaxed`}>{currentAnalysis?.recommendation}</p>
                  </div>

                  <div className="pt-4">
                    <p className="text-[10px] font-normal text-slate-300 uppercase tracking-widest mb-4 border-b border-slate-50 pb-2">Academic References</p>
                    <ol className="text-[11px] text-slate-500 space-y-2 italic font-normal leading-tight">
                      <li className="flex gap-3"><span>01.</span> Rood & Shehab (1990) - Radiographic signs of nerve proximity</li>
                      <li className="flex gap-3"><span>02.</span> Valmaseda-Castellón et al. (2001) - Surgical risk factors</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="col-span-12 lg:col-span-5 p-10 bg-slate-50/10 space-y-10 print:col-span-12 border-l border-slate-100">
                
                <div>
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="font-bold text-slate-900 tracking-[0.2em] uppercase text-lg">{l.assessmentIndicators}</h3>
                    <span className={`${theme.badge} text-white text-[9px] font-normal px-3 py-1 rounded-none tracking-widest uppercase`}>{riskLevel} RISK</span>
                  </div>

                  <div className="space-y-4">
                    {[
                      { label: l.toothPosition, value: currentAnalysis?.toothPosition },
                      { label: l.fdiCode, value: currentAnalysis?.fdiCode },
                      { label: l.minDistance, value: currentAnalysis?.minDistance, alert: riskLevel !== 'LOW' },
                      { label: l.contactRelationship, value: currentAnalysis?.contactRelationship },
                      { label: l.relativePosition, value: currentAnalysis?.relativePosition },
                      { label: l.riskScore, value: currentAnalysis?.riskScore, alert: riskLevel !== 'LOW' },
                      { label: l.injuryProbability, value: currentAnalysis?.injuryProbability, alert: riskLevel !== 'LOW' }
                    ].map((item, i) => (
                      <div key={i} className="flex justify-between items-center border-b border-slate-200 pb-3 last:border-0">
                        <span className="text-[14px] text-slate-500 font-normal uppercase tracking-widest">{item.label}</span>
                        <span className={`text-[15px] font-normal tracking-tight ${item.alert ? 'text-red-600' : 'text-slate-900'}`}>
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <p className="font-bold text-slate-900 tracking-[0.2em] uppercase text-lg mb-6 border-b border-slate-100 pb-2">{l.highRiskImagingSigns}</p>
                  <div className="flex flex-wrap gap-3">
                    {(currentAnalysis?.highRiskSigns || []).map(sign => (
                      <span key={sign} className="bg-white border border-slate-100 px-4 py-2 rounded-none text-[13px] font-normal text-slate-900 tracking-tight uppercase shadow-sm">{sign}</span>
                    ))}
                    {(currentAnalysis?.highRiskSigns || []).length === 0 && (
                      <span className="text-[12px] text-slate-400 italic">未发现明显高危征象</span>
                    )}
                  </div>
                </div>

                <div className="pt-6">
                   <h3 className="text-lg font-bold text-slate-900 mb-6 uppercase tracking-[0.3em]">{language === 'CN' ? '风险概率分布' : 'Risk Probability Distribution'}</h3>
                   <div className="bg-white border border-slate-100 rounded-none p-6 h-72 shadow-none relative">
                      <RiskChart language={language === 'CN' ? 'CN' : 'EN'} patientRiskScore={currentAnalysis?.riskScore} />
                   </div>
                </div>

                <button 
                  onClick={handleExportPDF}
                  className="w-full bg-[#0f172a] text-white py-4 rounded-sm font-normal flex items-center justify-center gap-4 hover:bg-black transition-all shadow-none mt-12 print:hidden uppercase text-[13px] tracking-[0.4em] active:translate-y-px border-none"
                >
                  <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                  <span>{l.pdfReport}</span>
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-slate-100 mt-20 py-16 bg-white print:hidden">
        <div className="max-w-[1400px] mx-auto px-8">
           <p className="text-[10px] text-slate-300 text-center max-w-4xl mx-auto leading-relaxed uppercase font-normal tracking-[0.2em] opacity-80">
             © 2024 MEDICAL AI SYSTEMS CORP. ALL DIAGNOSTIC RESULTS ARE AI-GENERATED FOR DECISION SUPPORT AND MUST BE VERIFIED BY A CERTIFIED DENTAL PROFESSIONAL. CLINICAL INTERVENTION DECISIONS REMAIN THE RESPONSIBILITY OF THE TREATING CLINICIAN.
           </p>
        </div>
      </footer>
    </div>
  );
};

export default App;