'use client';

import { useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from 'cn';

/**
 * Campo de senha com botão para mostrar/ocultar e aviso de Caps Lock ligado.
 * Aceita as mesmas propriedades do Input (id, value, onChange, autoComplete...).
 */
export function PasswordInput({ className, onKeyDown, onKeyUp, onBlur, ...props }: Omit<ComponentProps<typeof Input>, 'type'>) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const hintId = props.id ? `${props.id}-caps` : undefined;

  function readCapsLock(event: React.KeyboardEvent<HTMLInputElement>) {
    if (typeof event.getModifierState === 'function') setCapsLock(event.getModifierState('CapsLock'));
  }

  return (
    <div>
      <div className="relative">
        <Input
          {...props}
          type={visible ? 'text' : 'password'}
          aria-describedby={capsLock ? hintId : props['aria-describedby']}
          className={cn('pr-10', className)}
          onKeyDown={(e) => { readCapsLock(e); onKeyDown?.(e); }}
          onKeyUp={(e) => { readCapsLock(e); onKeyUp?.(e); }}
          onBlur={(e) => { setCapsLock(false); onBlur?.(e); }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-slate-500 transition-colors hover:text-slate-700 focus-visible:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      {capsLock && (
        <p id={hintId} className="mt-1.5 text-xs text-amber-700">
          Caps Lock está ativado.
        </p>
      )}
    </div>
  );
}
