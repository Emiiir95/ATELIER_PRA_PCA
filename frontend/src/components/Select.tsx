import { useEffect, useRef, useState } from 'react';

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function Select({ options, value, onChange, placeholder = 'Sélectionner...', className = '' }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between bg-white border rounded-xl px-4 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-violet-400 ${open ? 'border-violet-400 ring-2 ring-violet-400' : 'border-slate-200 hover:border-slate-300'}`}
      >
        <span className={selected ? 'text-slate-700' : 'text-slate-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden py-1 max-h-60 overflow-y-auto">
          <li
            onClick={() => { onChange(''); setOpen(false); }}
            className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${value === '' ? 'bg-violet-50 text-violet-600 font-medium' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            {placeholder}
          </li>
          {options.map(option => (
            <li
              key={option.value}
              onClick={() => { onChange(option.value); setOpen(false); }}
              className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${value === option.value ? 'bg-violet-50 text-violet-600 font-medium' : 'text-slate-700 hover:bg-violet-50 hover:text-violet-700'}`}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
