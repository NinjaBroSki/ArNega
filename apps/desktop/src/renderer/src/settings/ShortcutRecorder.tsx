import { useCallback, useEffect, useRef, useState } from 'react';
import { acceleratorFromEvent, displayAccelerator } from '../lib/accelerator';

/**
 * Click-to-record shortcut field. While recording, the next valid key
 * combination becomes the new shortcut; Esc cancels.
 */
export function ShortcutRecorder({
  value,
  onChange,
}: {
  value: string;
  onChange: (accelerator: string) => void;
}): React.JSX.Element {
  const [recording, setRecording] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const stop = useCallback(() => setRecording(false), []);

  useEffect(() => {
    if (!recording) return;

    const onKeyDown = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        stop();
        return;
      }
      const accelerator = acceleratorFromEvent(e);
      if (accelerator) {
        onChange(accelerator);
        stop();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    const onBlur = (): void => stop();
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [recording, onChange, stop]);

  return (
    <button
      ref={buttonRef}
      className="btn shortcut-recorder"
      data-recording={recording}
      aria-label={
        recording ? 'Recording — press the new shortcut' : `Change shortcut, currently ${value}`
      }
      onClick={() => setRecording((r) => !r)}
    >
      {recording ? 'Press shortcut…' : displayAccelerator(value, window.arnega.platform as string)}
    </button>
  );
}
