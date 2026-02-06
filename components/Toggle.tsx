
import React from 'react';

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const Toggle: React.FC<ToggleProps> = ({ label, checked, onChange }) => {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none ${
          checked ? 'bg-blue-600' : 'bg-slate-600'
        }`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-1'
          }`}
        />
      </button>
      <span className="text-[10px] font-bold text-white uppercase tracking-wider">{label}</span>
    </div>
  );
};
