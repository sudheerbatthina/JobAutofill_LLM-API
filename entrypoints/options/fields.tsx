import React from 'react';

interface TextProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  full?: boolean;
  type?: string;
}

export function Text({ label, value, onChange, placeholder, full, type = 'text' }: TextProps) {
  return (
    <div className={`field${full ? ' full' : ''}`}>
      <label>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

interface AreaProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}

export function Area({ label, value, onChange, placeholder, rows = 3 }: AreaProps) {
  return (
    <div className="field full">
      <label>{label}</label>
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** Yes / No / Unanswered toggle backed by `boolean | null`. */
export function TriState({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <div className="field full">
      <label>{label}</label>
      <div className="tristate">
        <button
          type="button"
          className={value === true ? 'active' : ''}
          onClick={() => onChange(value === true ? null : true)}
        >
          Yes
        </button>
        <button
          type="button"
          className={value === false ? 'active' : ''}
          onClick={() => onChange(value === false ? null : false)}
        >
          No
        </button>
      </div>
    </div>
  );
}

const OTHER = '__other__';

/**
 * Native <select> with preset options. Selecting "Other…" reveals a text
 * input so the user can type a custom value that doesn't match any preset.
 */
export function Suggest({
  label,
  value,
  onChange,
  options,
  full,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  full?: boolean;
}) {
  const isOther = value !== '' && !options.includes(value);
  const selectVal = isOther ? OTHER : value;

  return (
    <div className={`field${full ? ' full' : ''}`}>
      <label>{label}</label>
      <select
        value={selectVal}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            onChange('');
          } else {
            onChange(e.target.value);
          }
        }}
      >
        <option value="">— select —</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value={OTHER}>Other…</option>
      </select>
      {(isOther || selectVal === OTHER) && (
        <input
          style={{ marginTop: 4 }}
          type="text"
          placeholder="Type your answer"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
        />
      )}
    </div>
  );
}

/** Comma/Enter separated chips, e.g. skills. */
export function Chips({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = React.useState('');

  const commit = () => {
    const parts = draft
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) onChange([...value, ...parts]);
    setDraft('');
  };

  return (
    <div className="field full">
      <label>{label}</label>
      <div className="chip-input">
        {value.map((chip, i) => (
          <span className="chip" key={`${chip}-${i}`}>
            {chip}
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          placeholder={placeholder ?? 'Type and press Enter'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Backspace' && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={commit}
        />
      </div>
    </div>
  );
}
