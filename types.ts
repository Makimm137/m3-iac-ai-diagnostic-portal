
export type AnalysisStatus = 'idle' | 'uploading' | 'processing' | 'completed';

export interface FileEntry {
  id: string;
  name: string;
  size: string;
  status: 'ready' | 'error' | 'pending';
  errorMessage?: string;
}

export interface RiskIndicator {
  label: string;
  value: string;
  isHighRisk?: boolean;
}

export interface ChartData {
  category: string;
  probability: number;
  color: string;
}

export interface AnalysisResult {
  toothPosition: string;
  fdiCode: string;
  minDistance: string;
  contactRelationship: string;
  relativePosition: string;
  riskScore: string;
  injuryProbability: string;
  highRiskSigns: string[];
  recommendation: string;
}

export interface HistoryRecord {
  id: string;
  caseName: string;
  previewUrl: string;
  date: string;
  leftRisk: 'High' | 'Medium' | 'Low';
  rightRisk: 'High' | 'Medium' | 'Low';
  results?: { left: AnalysisResult; right: AnalysisResult };
}
