import React, { useMemo } from 'react';
import { Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, Label, Bar, ComposedChart } from 'recharts';

interface RiskChartProps {
  language: 'CN' | 'EN';
  patientRiskScore?: string; // e.g. "8.5 / 10"
}

export const RiskChart: React.FC<RiskChartProps> = ({ language, patientRiskScore }) => {
  const data = useMemo(() => {
    const points = [];
    const mean = 0.78;
    const stdDev = 0.15;
    
    for (let i = 0; i <= 20; i++) {
      const x = i / 20;
      const density = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * 
                      Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
      points.push({ 
        x: parseFloat(x.toFixed(2)), 
        density: density,
        bar: density * (0.4 + Math.random() * 0.4)
      });
    }
    return points;
  }, []);

  const riskValue = useMemo(() => {
    if (!patientRiskScore) return 0.85;
    const scoreStr = patientRiskScore.split('/')[0].trim();
    const score = parseFloat(scoreStr);
    return isNaN(score) ? 0.85 : score / 10;
  }, [patientRiskScore]);

  const getLabelColor = (limit: number) => {
    if (riskValue < 0.25 && limit === 0) return '#10b981'; // Green for NO RISK
    if (riskValue >= 0.25 && riskValue < 0.5 && limit === 0.25) return '#10b981'; // Green for MILD
    if (riskValue >= 0.5 && riskValue < 0.75 && limit === 0.5) return '#f59e0b'; // Orange for MODERATE
    if (riskValue >= 0.75 && limit === 0.75) return '#ef4444'; // Red for SEVERE
    return '#94a3b8'; // Default slate
  };

  return (
    <div className="h-full w-full flex flex-col font-sans">
      <div className="flex-1 relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 15, right: 10, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="x" 
              type="number" 
              domain={[0, 1]} 
              ticks={[0, 0.25, 0.5, 0.75, 1.0]}
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: '400' }}
              axisLine={{ stroke: '#f1f5f9' }}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: '400' }}
              axisLine={false}
              tickLine={false}
            />
            <Bar dataKey="bar" fill="#cbd5e1" barSize={10} radius={0} />
            <Area 
              type="monotone" 
              dataKey="density" 
              stroke="#0f172a" 
              fill="transparent"
              strokeWidth={1} 
              dot={false}
            />
            <ReferenceLine x={riskValue} stroke="#ef4444" strokeWidth={1.5}>
              <Label 
                value="PATIENT RISK" 
                position="top" 
                fill="#ef4444" 
                fontSize={9} 
                fontWeight="400"
                offset={15}
                className="uppercase tracking-widest"
              />
            </ReferenceLine>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between px-4 pt-6 border-t border-slate-50">
        {[
          { label: 'NO RISK', limit: 0 },
          { label: 'MILD', limit: 0.25 },
          { label: 'MODERATE', limit: 0.5 },
          { label: 'SEVERE', limit: 0.75 }
        ].map(t => (
          <span 
            key={t.label} 
            className="text-[10px] font-bold tracking-widest uppercase transition-colors duration-300"
            style={{ color: getLabelColor(t.limit) }}
          >
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
};