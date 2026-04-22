import { useState, useEffect, useRef } from 'react';

export interface UseTypewriterOptions {
  text: string;
  speed?: number; // milliseconds per character
  delay?: number; // initial delay before starting
  onComplete?: () => void;
}

export interface UseTypewriterReturn {
  displayedText: string;
  isTyping: boolean;
}

export function useTypewriter({
  text,
  speed = 1,
  delay = 0,
  onComplete,
}: UseTypewriterOptions): UseTypewriterReturn {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const indexRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousTextRef = useRef('');

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!text) {
      setDisplayedText('');
      previousTextRef.current = '';
      indexRef.current = 0;
      setIsTyping(false);
      return;
    }

    const previousText = previousTextRef.current;

    if (!text.startsWith(previousText)) {
      setDisplayedText('');
      indexRef.current = 0;
    } else {
      setDisplayedText(previousText);
      indexRef.current = previousText.length;
    }

    previousTextRef.current = text;
    setIsTyping(indexRef.current < text.length);

    const type = () => {
      if (indexRef.current < text.length) {
        const nextIndex = indexRef.current + 1;
        setDisplayedText(text.slice(0, nextIndex));
        indexRef.current = nextIndex;
        timeoutRef.current = setTimeout(type, speed);
      } else {
        setIsTyping(false);
        onComplete?.();
      }
    };

    timeoutRef.current = setTimeout(type, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [text, speed, delay, onComplete]);

  return { displayedText, isTyping };
}
