import { type ChangeEvent, type InputHTMLAttributes, useId } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  onValueChange?: (value: string) => void;
}

export function Input({ label, onValueChange, onChange, id, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange?.(e);
    onValueChange?.(e.target.value);
  };

  return (
    <div className="input-wrapper">
      {label && (
        <label className="input-label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <input id={inputId} className="input-base" onChange={handleChange} {...props} />
    </div>
  );
}
