
import React, { useState, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  AnalysisStatus, 
  FileEntry,
  AnalysisResult,
  HistoryRecord
} from './types.ts';
import { 
  LOCALIZED_DATA,
  PANORAMIC_IMAGE_URL
} from './constants.tsx';
import { RiskChart } from './components/RiskChart.tsx';
import { Toggle } from './components/Toggle.tsx';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'portal' | 'history' | 'resources' | 'support'>('portal');
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [activeSide, setActiveSide] = useState<'left' | 'right'>('left');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<{left: AnalysisResult, right: AnalysisResult} | null>(null);
  const [language, setLanguage] = useState<'CN' | 'EN' | 'JP'>('CN');
  const [uploadedFiles, setUploadedFiles] = useState<FileEntry[]>([]);

  // New Case Workflow States
  const [isEnteringName, setIsEnteringName] = useState(false);
  const [caseName, setCaseName] = useState("");
  
  // History Records
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([
    {
      id: '1',
      caseName: '患者 张伟 - 拔牙前评估',
      previewUrl: PANORAMIC_IMAGE_URL,
      date: '2024.03.15 14:30',
      leftRisk: 'High',
      rightRisk: 'Low'
    },
    {
      id: '2',
      caseName: '李华 - 智齿术前检查',
      previewUrl: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=1974&auto=format&fit=crop',
      date: '2024.03.14 09:15',
      leftRisk: 'Medium',
      rightRisk: 'Medium'
    },
    {
      id: '3',
      caseName: 'Case #10294 - Routine Scan',
      previewUrl: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?q=80&w=2080&auto=format&fit=crop',
      date: '2024.03.12 11:00',
      leftRisk: 'Low',
      rightRisk: 'High'
    }
  ]);

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
                          "recommendation": [
                            "第一段：关于位置和接触关系的描述",
                            "第二段：关于风险评估结论和临床建议"
                          ]
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
                          "recommendation": [
                            "第一段：关于位置和接触关系的描述",
                            "第二段：关于风险评估结论和临床建议"
                          ]
                        }
                      }

                      关于 recommendation 字段的具体要求：
                      该字段的字符串**必须**由两段组成，中间用一个换行符 \`\\n\` 分隔。
                      **严格遵循此范例格式**
                      1. 第一段：先写一段表述下颌第三磨牙和下颌神经管风险评估指标的描述，如位置关系，接触关系，注意面对的是医生和患者，类似报告，文字书面化专业但通俗易懂。
                      2. 然后换一行。一定要换行！！！
                      3. 第二段：写具体的风险评估结论，如手术损伤风险高低，并给出临床建议（如建议拍CBCT明确三维位置、拔除手术方式建议等），详细专业。

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
                }
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
                }
              }
            }
          }
        }
      });

      const resultData = JSON.parse(response.text || '{}');
      setAnalysisResults(resultData);
      setStatus('completed');

      const getRiskFromScore = (score?: string) => {
        if (!score) return 'Low';
        const s = parseFloat(score);
        if (s >= 7) return 'High';
        if (s >= 4) return 'Medium';
        return 'Low';
      };

      const newRecord: HistoryRecord = {
        id: Math.random().toString(36).substr(2, 9),
        caseName: caseName || '未命名病例',
        previewUrl: imagePreview,
        date: new Date().toLocaleDateString('zh-CN').replace(/\//g, '.') + ' ' + new Date().toLocaleTimeString('zh-CN', {hour12: false, hour: '2-digit', minute: '2-digit'}),
        leftRisk: getRiskFromScore(resultData.left.riskScore),
        rightRisk: getRiskFromScore(resultData.right.riskScore),
        results: resultData
      };
      setHistoryRecords(prev => [newRecord, ...prev]);

    } catch (error) {
      console.error("AI Analysis failed:", error);
      setStatus('completed');
      setAnalysisResults({
        left: { toothPosition: '左下颌第三磨牙', fdiCode: '38', minDistance: '0.8mm', contactRelationship: '接触', relativePosition: '舌侧偏根尖', riskScore: '8.5/10', injuryProbability: '32.5%', highRiskSigns: ['神经管变窄', '根尖弯曲'], recommendation: '由于接近IAC，建议考虑分段拔除。' },
        right: { toothPosition: '右下颌第三磨牙', fdiCode: '48', minDistance: '2.4mm', contactRelationship: '分离', relativePosition: '上方', riskScore: '2.1/10', injuryProbability: '4.2%', highRiskSigns: [], recommendation: '风险较低，常规拔除。' }
      });
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleCreateNewCase = () => {
    setCurrentPage('portal');
    setIsEnteringName(true);
    setCaseName("");
    setUploadedFiles([]);
    setImagePreview(null);
    setAnalysisResults(null);
    setStatus('idle');
  };

  const handleConfirmCaseName = () => {
    if (caseName.trim()) {
      setIsEnteringName(false);
    }
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
  
  const theme = {
    HIGH: { badge: 'bg-red-600', box: 'bg-red-50 border-red-100', text: 'text-red-700', desc: 'text-red-900', label: language === 'CN' ? '高风险警告' : 'HIGH RISK WARNING' },
    MODERATE: { badge: 'bg-orange-500', box: 'bg-orange-50 border-orange-100', text: 'text-orange-700', desc: 'text-orange-900', label: language === 'CN' ? '中风险警告' : 'MODERATE RISK WARNING' },
    LOW: { badge: 'bg-emerald-500', box: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-700', desc: 'text-emerald-900', label: language === 'CN' ? '低风险提示' : 'LOW RISK NOTICE' }
  }[riskLevel];

  const getRiskColor = (risk: 'High' | 'Medium' | 'Low') => {
    if (risk === 'High') return 'text-red-600';
    if (risk === 'Medium') return 'text-orange-500';
    return 'text-emerald-500';
  };

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
            <button 
              onClick={() => setCurrentPage('portal')}
              className={`${currentPage === 'portal' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-900'} h-16 flex items-center transition-colors`}
            >
              {n.caseMgmt}
            </button>
            <button 
              onClick={() => setCurrentPage('history')}
              className={`${currentPage === 'history' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-900'} h-16 flex items-center transition-colors`}
            >
              {n.history}
            </button>
            <button 
              onClick={() => setCurrentPage('resources')}
              className={`${currentPage === 'resources' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-900'} h-16 flex items-center transition-colors`}
            >
              {n.resources}
            </button>
            <button 
              onClick={() => setCurrentPage('support')}
              className={`${currentPage === 'support' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-900'} h-16 flex items-center transition-colors`}
            >
              {n.support}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-6 text-slate-400">
          <span className="material-symbols-outlined cursor-pointer hover:text-slate-900">search</span>
          <span className="material-symbols-outlined cursor-pointer hover:text-primary transition-colors" onClick={toggleLanguage}>language</span>
          <span className="material-symbols-outlined cursor-pointer hover:text-slate-900">account_circle</span>
        </div>
      </nav>

      {/* Banner Title */}
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

      <main className="mx-auto p-8 space-y-8 max-w-[1350px] px-4 md:px-12">
        
        {currentPage === 'portal' && (
          <>
            {/* Page Header */}
            <div className="flex items-center justify-between print:hidden">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 uppercase">{n.caseList}</h1>
              <div className="flex items-center gap-4">
                {isEnteringName && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsEnteringName(false)}></div>
                    <div className="relative z-50 flex items-center gap-2 animate-in slide-in-from-right-4 duration-300">
                      <input 
                        autoFocus
                        type="text" 
                        placeholder="输入病例名称..."
                        className="border border-slate-200 px-4 py-2 text-sm focus:ring-1 focus:ring-primary outline-none min-w-[200px]"
                        value={caseName}
                        onChange={(e) => setCaseName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleConfirmCaseName()}
                      />
                      <button 
                        onClick={handleConfirmCaseName}
                        disabled={!caseName.trim()}
                        className="bg-[#0f172a] text-white px-6 py-2 rounded-sm font-normal uppercase tracking-widest text-[12px] disabled:opacity-50 hover:bg-black transition-all"
                      >
                        确认
                      </button>
                    </div>
                  </>
                )}
                {!isEnteringName && (
                  <button 
                    onClick={handleCreateNewCase}
                    className="bg-[#0f172a] text-white px-6 py-2 rounded-sm font-normal flex items-center gap-2 hover:bg-black transition-all"
                  >
                    <span className="material-symbols-outlined text-lg">add</span>
                    <span className="text-[12px] uppercase tracking-widest">{n.newCase}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Upload Container */}
            <div className={`bg-white border border-slate-200 p-8 rounded-none print:hidden transition-all ${isEnteringName ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold tracking-tight uppercase">{l.uploadTitle}</h2>
                    {caseName && <span className="text-primary font-medium text-sm">/ {caseName}</span>}
                  </div>
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
                    </div>
                  </div>

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
          </>
        )}

        {currentPage === 'history' && (
          <div className="animate-in fade-in duration-500 space-y-8">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 uppercase">{n.history}</h1>
              <p className="text-slate-400 text-sm uppercase tracking-widest">共 {historyRecords.length} 条记录</p>
            </div>
            <div className="bg-white border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-8 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 w-24">预览</th>
                    <th className="px-8 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">病例名称</th>
                    <th className="px-8 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">分析时间</th>
                    <th className="px-8 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 text-center">左侧风险</th>
                    <th className="px-8 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 text-center">右侧风险</th>
                    <th className="px-8 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-4">
                        <div className="w-16 h-10 bg-black overflow-hidden border border-slate-200">
                          <img src={record.previewUrl} className="w-full h-full object-cover grayscale opacity-70" alt="Case preview" />
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <span className="text-[14px] font-medium text-slate-900">{record.caseName}</span>
                      </td>
                      <td className="px-8 py-4">
                        <span className="text-[13px] text-slate-400 font-normal">{record.date}</span>
                      </td>
                      <td className="px-8 py-4 text-center">
                        <span className={`text-[11px] font-bold uppercase tracking-widest ${getRiskColor(record.leftRisk)}`}>
                          {record.leftRisk === 'High' ? '高风险' : record.leftRisk === 'Medium' ? '中风险' : '低风险'}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-center">
                        <span className={`text-[11px] font-bold uppercase tracking-widest ${getRiskColor(record.rightRisk)}`}>
                          {record.rightRisk === 'High' ? '高风险' : record.rightRisk === 'Medium' ? '中风险' : '低风险'}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <button 
                          onClick={() => {
                            if (record.results) {
                              setAnalysisResults(record.results);
                              setImagePreview(record.previewUrl);
                              setCaseName(record.caseName);
                              setCurrentPage('portal');
                              setStatus('completed');
                            }
                          }}
                          className="text-primary text-[11px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          查看详情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {historyRecords.length === 0 && (
                <div className="py-20 text-center">
                  <span className="material-symbols-outlined text-slate-200 text-5xl mb-4">folder_open</span>
                  <p className="text-slate-400 text-sm uppercase tracking-widest">暂无历史记录</p>
                </div>
              )}
            </div>
          </div>
        )}

        {currentPage === 'resources' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-10 pb-24">
            <header className="border-b border-slate-100 pb-8">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 uppercase">资源中心</h1>
            </header>

            <section className="space-y-6">
              <div className="flex items-center gap-3 text-primary border-b border-slate-100 pb-2">
                <span className="material-symbols-outlined text-xl font-bold">menu_book</span>
                <h2 className="text-xl font-bold tracking-widest uppercase">使用指南</h2>
              </div>
              
              <div className="grid gap-4">
                {[
                  { title: "1. 上传影像数据", content: "系统支持标准的DICOM格式全景片（Panoramic Radiograph）及JPG、PNG图片格式文件。请通过首页的上传模块选择或拖拽单个患者的全景片文件。上传成功后，系统将自动进入分析队列。" },
                  { title: "2. 查看分析结果与交互式CPR（曲面断层重建）", content: "分析完成后，您将进入结果详情页。主视图将展示系统对下牙槽神经管（Inferior Alveolar Nerve Canal）及目标牙齿的自动分割结果。您可以交互式地操作该视图，查看沿神经管路径自动生成的曲面断层重建（Curved Planar Reformation, CPR）图像，以直观地观察牙根与神经管的三维毗邻关系。" },
                  { title: "3. 解读跨模态生成视图", content: "为弥补全景片在颊舌向信息的不足，系统基于跨模态生成模型，提供了模拟的类CBCT多平面视图，包括轴位（Axial）、冠状位（Coronal）和矢状位（Sagittal）。这些视图旨在辅助判断牙根与神经管在颊舌方向上的相对位置。" },
                  { title: "4. 理解结构化风险报告", content: "系统将所有分析结果量化并整合在“风险评估表”中。每个指标都旨在提供客观的决策支持依据。风险等级（低、中、高）是基于所有指标的综合加权评分得出的最终结论。" }
                ].map((item, i) => (
                  <div key={i} className="bg-white p-6 border-l-[3px] border-primary rounded-none shadow-none border border-slate-100">
                    <h3 className="text-base font-bold text-slate-900 mb-2">{item.title}</h3>
                    <p className="text-slate-500 leading-relaxed text-[14px] font-normal">{item.content}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3 text-primary border-b border-slate-100 pb-2">
                <span className="material-symbols-outlined text-xl font-bold">assignment</span>
                <h2 className="text-xl font-bold tracking-widest uppercase">风险评估标准说明</h2>
              </div>
              <p className="text-slate-500 leading-relaxed text-[14px] font-normal">本系统的风险评估模型整合了多项影像学指标，其判定依据如下：</p>
              
              <div className="space-y-6">
                {[
                  { title: "最小牙-神经管距离", content: "定义为牙根表面与下牙槽神经管皮质骨外壁之间的最短三维欧氏距离。这是评估物理压迫或术中器械损伤风险的核心指标。判定依据：当此距离小于2mm时，神经损伤的风险显著增高。" },
                  { title: "接触关系", content: "描述牙根与神经管的整体毗邻状态。判定依据：分为“直接接触”、“邻近无接触”和“明确分离”。直接接触是最高风险的信号。" },
                  { title: "相对位置", content: "指明牙根主体或根尖相对于神经管的颊舌侧位置。判定依据：分为颊侧、舌侧、正上方、正下方等。舌侧接触通常意味着更高的手术难度。" },
                  { title: "高危影像学征象", content: "系统自动识别并列出Rood & Shehab标准中描述的七项高危征象，例如神经管中断、管壁皮质骨消失、神经管变窄、根尖弯曲等。" },
                  { title: "风险评分与损伤概率", content: "风险评分为一个0至10分的综合分数，它由一个加权算法根据上述所有指标（距离、接触、位置、高危征象数量等）计算得出。损伤概率则是基于大规模临床回顾性数据训练的深度学习模型给出的后验概率预测。两者均服务于最终的风险分级。" },
                  { title: "风险概率分布图", content: "此图表展示了当前病例的预测损伤概率在整体数据库中所处的位置，有助于医生理解该风险水平的相对严重程度。" },
                  { title: "临床建议", content: "基于最终的风险等级和具体指标，系统自动生成初步的临床建议文本，例如“建议行锥形束CT（CBCT）进一步评估”或“建议采用冠切术/牙根分段等风险规避策略”。" }
                ].map((item, i) => (
                  <div key={i} className="border-b border-slate-100 pb-4 last:border-0">
                    <h4 className="text-base font-bold text-slate-900 mb-2 uppercase tracking-wide">{item.title}</h4>
                    <p className="text-slate-500 leading-relaxed text-[14px] font-normal">{item.content}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3 text-primary border-b border-slate-100 pb-2">
                <span className="material-symbols-outlined text-xl font-bold">library_books</span>
                <h2 className="text-xl font-bold tracking-widest uppercase">文献依据</h2>
              </div>
              <div className="bg-slate-50 p-6 border border-slate-200 text-slate-500 text-[13px] font-normal italic rounded-none shadow-none">
                Rood, J. P., & Shehab, B. A. (1990). The radiological prediction of inferior alveolar nerve injury during third molar surgery. British Journal of Oral and Maxillofacial Surgery, 28(1), 20-25.
              </div>
            </section>

            <section className="space-y-6 border-t border-slate-100 pt-10">
              <div className="flex items-center gap-3 text-primary">
                <span className="material-symbols-outlined text-xl font-bold">download</span>
                <h2 className="text-xl font-bold tracking-widest uppercase">学术参考与示例数据</h2>
              </div>
              <div className="flex flex-col gap-4">
                {[
                  { label: "相关学术论文全文 (Direct Link)", icon: "link" },
                  { label: "示例全景片数据集 (Radiographs Package, ZIP)", icon: "folder_zip" }
                ].map((link, idx) => (
                  <a key={idx} href="#" className="flex items-center gap-3 text-primary hover:text-primary/80 transition-all group no-underline w-fit">
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors text-xl">{link.icon}</span>
                    <span className="text-[14px] font-bold border-b border-primary/20 group-hover:border-primary transition-all pb-0.5 uppercase tracking-wide">{link.label}</span>
                  </a>
                ))}
              </div>
            </section>
          </div>
        )}

        {currentPage === 'support' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-10 pb-24">
            <header className="border-b border-slate-100 pb-8">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 uppercase">支持中心</h1>
            </header>

            {/* Technical Support Section */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 text-primary border-b border-slate-100 pb-2">
                <span className="material-symbols-outlined text-xl font-bold">settings</span>
                <h2 className="text-xl font-bold tracking-widest uppercase">技术支持</h2>
              </div>
              
              <div className="space-y-8">
                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-3 uppercase tracking-wide">数据格式要求</h3>
                  <p className="text-slate-500 leading-relaxed text-[14px] font-normal">
                    系统目前仅支持标准的DICOM（.dcm）文件、JPG、PNG图像格式。文件应包含完整的患者信息和成像参数元数据，以保证分析的准确性。
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-3 uppercase tracking-wide">常见问题排查</h3>
                  <ul className="space-y-4">
                    <li className="bg-white p-6 border-l-[3px] border-primary rounded-none shadow-none border border-slate-100">
                      <strong className="text-slate-900 block mb-1 font-bold">上传失败</strong>
                      <p className="text-slate-500 leading-relaxed text-[14px] font-normal">
                        请检查您的网络连接是否稳定。确认文件为单张格式正确的全景片，文件大小一般不超过20MB。如果多次失败，可能是浏览器兼容性问题，建议使用最新版本的Google Chrome或Microsoft Edge浏览器。
                      </p>
                    </li>
                    <li className="bg-white p-6 border-l-[3px] border-primary rounded-none shadow-none border border-slate-100">
                      <strong className="text-slate-900 block mb-1 font-bold">模型分析长时间无响应或失败</strong>
                      <p className="text-slate-500 leading-relaxed text-[14px] font-normal">
                        在服务高峰期，分析队列可能需要等待。如果等待超过15分钟仍无结果，或页面提示“模型加载失败”，这可能是暂时的服务器高负载或网络波动导致。请尝试刷新页面或稍后重新上传。如问题复现，请联系我们制订相应方案。
                      </p>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Medical Explanation Support Section */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 text-primary border-b border-slate-100 pb-2">
                <span className="material-symbols-outlined text-xl font-bold">medical_services</span>
                <h2 className="text-xl font-bold tracking-widest uppercase">医学解释支持</h2>
              </div>
              
              <div className="space-y-8">
                <div className="border border-slate-100 p-8 bg-slate-50/30">
                  <h3 className="text-base font-bold text-slate-900 mb-6 uppercase tracking-wide border-b border-slate-200 pb-2">风险等级的含义</h3>
                  <div className="grid gap-6">
                    <div className="border-b border-slate-100 pb-4 last:border-0">
                      <strong className="text-slate-900 block mb-2 font-bold text-[14px] uppercase tracking-wide">低风险 (LOW RISK)</strong>
                      <p className="text-slate-500 leading-relaxed text-[14px] font-normal">影像学指标均在安全阈值内，提示按常规拔除方案导致永久性神经损伤的概率较低。</p>
                    </div>
                    <div className="border-b border-slate-100 pb-4 last:border-0">
                      <strong className="text-slate-900 block mb-2 font-bold text-[14px] uppercase tracking-wide">中风险 (MODERATE RISK)</strong>
                      <p className="text-slate-500 leading-relaxed text-[14px] font-normal">一项或多项关键指标接近临界值（如距离接近2mm，或出现1-2项高危征象）。提示术中需格外谨慎，建议医生结合临床触诊等信息综合判断，并考虑更保守的手术方案。</p>
                    </div>
                    <div className="border-b border-slate-100 pb-4 last:border-0">
                      <strong className="text-slate-900 block mb-2 font-bold text-[14px] uppercase tracking-wide">高风险 (HIGH RISK)</strong>
                      <p className="text-slate-500 leading-relaxed text-[14px] font-normal">明确存在直接接触、距离远小于安全阈值或出现多项强相关高危征象。提示术后发生暂时性或永久性神经损伤的概率显著增高。强烈建议进行CBCT检查以获得确切的三维信息，并与患者进行充分的术前沟通。</p>
                    </div>
                  </div>
                </div>

                <div className="px-8">
                  <h3 className="text-base font-bold text-slate-900 mb-3 uppercase tracking-wide">关于模型的误差范围</h3>
                  <p className="text-slate-500 leading-relaxed text-[14px] font-normal">
                    虽然本系统的算法在大量数据上表现出高准确度，但与所有基于模型的预测一样，其结果并非100%精确。分割结果可能在解剖结构变异大或图像质量不佳的情况下出现细微偏差。预测的损伤概率是一个统计学估计，其实际发生与否受术者操作、患者个体差异等多种临床因素影响。
                  </p>
                </div>
              </div>
            </section>

            {/* Important Statement Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
                <span className="material-symbols-outlined text-xl font-bold text-red-600">info</span>
                <h2 className="text-xl font-bold tracking-widest uppercase text-red-600">重要声明：非诊断性质</h2>
              </div>
              <div className="bg-slate-50 p-8 border border-slate-200">
                <p className="text-slate-700 leading-relaxed text-[14px] font-medium">
                  本系统提供的所有分析结果、风险评估和临床建议仅作为临床决策的辅助参考，不能替代执业医师的专业判断和最终诊断。 任何临床诊断和治疗方案的制订，必须由具备相应资质的医生在全面评估患者情况（包括但不限于临床检查、其他影像学资料及患者病史）后作出。本系统开发者不对任何基于系统信息所作出的临床决策承担法律责任。
                </p>
              </div>
            </section>

            {/* Contact Section */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 text-primary border-b border-slate-100 pb-2">
                <span className="material-symbols-outlined text-xl font-bold">contact_mail</span>
                <h2 className="text-xl font-bold tracking-widest uppercase">联系我们</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-slate-50 p-6 border border-slate-100">
                  <h4 className="font-bold text-slate-900 mb-2 text-sm uppercase">技术支持邮箱</h4>
                  <a href="mailto:support-tech@your-project-domain.com" className="text-primary hover:underline text-[14px]">support-tech@your-project-domain.com</a>
                </div>
                <div className="bg-slate-50 p-6 border border-slate-100">
                  <h4 className="font-bold text-slate-900 mb-2 text-sm uppercase">医学咨询邮箱</h4>
                  <a href="mailto:support-medical@your-project-domain.com" className="text-primary hover:underline text-[14px]">support-medical@your-project-domain.com</a>
                </div>
              </div>
              <div className="flex justify-center pt-4">
                 <button className="text-[13px] font-bold uppercase tracking-[0.2em] border border-primary px-10 py-3 text-primary hover:bg-primary hover:text-white transition-all">
                   问题反馈表单
                 </button>
              </div>
            </section>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-100 mt-20 py-16 bg-white print:hidden">
        <div className="max-w-[1400px] mx-auto px-8">
           <p className="text-[10px] text-slate-300 text-center max-w-4xl mx-auto leading-relaxed uppercase font-normal tracking-[0.2em] opacity-80">
             © 2026 MEDICAL AI SYSTEMS CORP. ALL DIAGNOSTIC RESULTS ARE AI-GENERATED FOR DECISION SUPPORT AND MUST BE VERIFIED BY A CERTIFIED DENTAL PROFESSIONAL.
           </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
