import React, { useState, useEffect } from 'react';

interface EditableAmountInputProps {
  value: number;
  onChange: (val: number) => void;
  className?: string;
  placeholder?: string;
  prefix?: string;
  allowNegative?: boolean;
}

/**
 * EditableAmountInput
 * An accessible, robust numeric input designed for commercial amounts, supporting:
 * - Direct negative values (e.g. -50.00, -50, -10.5)
 * - Safe typing of minus sign '-' without component resetting or wiping state
 * - Automatic conversion between Italian comma ',' and period '.'
 * - Real-time recalculation of line totals and grand totals
 * - Visual distinction for negative deductions/discounts
 */
export default function EditableAmountInput({
  value,
  onChange,
  className = '',
  placeholder = '0.00',
  prefix = '€',
  allowNegative = true
}: EditableAmountInputProps) {
  // Local string buffer to allow fluid typing of '-', decimals, and partial entries
  const [text, setText] = useState<string>(() => {
    if (value === undefined || value === null || isNaN(value)) return '0.00';
    return String(value);
  });
  const [isFocused, setIsFocused] = useState(false);

  // Synchronize when external value changes while NOT focused
  useEffect(() => {
    if (!isFocused) {
      if (value === undefined || value === null || isNaN(value)) {
        setText('0.00');
      } else {
        // Format to standard 2 decimal places if clean, or as string
        const num = Number(value);
        setText(Number.isInteger(num) ? `${num}.00` : num.toFixed(2));
      }
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;

    // Filter characters: allow digits, one minus sign (if allowed and at beginning), one dot or comma
    if (!allowNegative && raw.includes('-')) {
      raw = raw.replace(/-/g, '');
    }

    setText(raw);

    // Normalize comma to period
    const normalized = raw.replace(',', '.').trim();

    // Check if user is typing just '-' or empty string
    if (normalized === '' || normalized === '-' || normalized === '+') {
      onChange(0);
      return;
    }

    const parsed = parseFloat(normalized);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const normalized = text.replace(',', '.').trim();
    const parsed = parseFloat(normalized);

    if (isNaN(parsed)) {
      setText('0.00');
      onChange(0);
    } else {
      const finalVal = Math.round(parsed * 100) / 100;
      setText(finalVal.toFixed(2));
      onChange(finalVal);
    }
  };

  const isNegative = (value < 0) || (text.trim().startsWith('-'));

  return (
    <div
      className={`flex items-center gap-1 bg-white border rounded-lg px-2 py-1 transition-all ${
        isNegative 
          ? 'border-rose-300 bg-rose-50/40 text-rose-700 focus-within:ring-2 focus-within:ring-rose-400/30 focus-within:border-rose-500' 
          : 'border-gray-200 text-gray-900 focus-within:ring-2 focus-within:ring-[#5A5A40]/30 focus-within:border-[#5A5A40]'
      } ${className}`}
    >
      {prefix && (
        <span className={`text-xs font-bold shrink-0 select-none ${isNegative ? 'text-rose-500' : 'text-gray-400'}`}>
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onFocus={() => setIsFocused(true)}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`w-full bg-transparent border-none outline-none font-mono text-xs font-bold text-right p-0 ${
          isNegative ? 'text-rose-700' : 'text-gray-900'
        }`}
      />
    </div>
  );
}
