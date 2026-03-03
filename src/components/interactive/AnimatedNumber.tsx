import { useEffect, useRef, useState } from 'preact/hooks';

interface Props {
  value: number;
  class?: string;
}

export default function AnimatedNumber({ value, class: className = '' }: Props) {
  const [displayValue, setDisplayValue] = useState(value);
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value === prevValue.current) return;

    // Check prefers-reduced-motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setDisplayValue(value);
      prevValue.current = value;
      return;
    }

    setDirection(value > prevValue.current ? 'up' : 'down');
    const timeout = setTimeout(() => {
      setDisplayValue(value);
      setDirection(null);
    }, 150);
    prevValue.current = value;
    return () => clearTimeout(timeout);
  }, [value]);

  let slideClass = '';
  if (direction === 'up') slideClass = '-translate-y-full';
  else if (direction === 'down') slideClass = 'translate-y-full';

  return (
    <span class={`inline-flex overflow-hidden ${className}`} aria-live="polite" aria-atomic="true">
      <span class={`inline-block transition-transform duration-150 ${slideClass}`}>
        {displayValue}
      </span>
    </span>
  );
}
