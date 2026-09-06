import { useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';

/** Gravação real de áudio pelo microfone (MediaRecorder) — clique pra começar, clique de novo
 * pra parar e disparar o envio. O arquivo resultante sobe pro MinIO igual qualquer outro anexo. */
export function AudioRecordButton({ onRecorded, onError, disabled }: {
  onRecorded: (file: File) => void;
  onError: (msg: string) => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const gravar = async () => {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) window.clearInterval(timerRef.current);
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size > 0) onRecorded(new File([blob], 'audio-' + Date.now() + '.webm', { type: 'audio/webm' }));
      };
      mr.start();
      recRef.current = mr;
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds(s => s + 1), 1000);
    } catch {
      onError('Não foi possível acessar o microfone — verifique a permissão do navegador');
    }
  };

  const mmss = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');

  return (
    <button
      type="button"
      title={recording ? 'Parar e enviar áudio' : 'Gravar áudio'}
      onClick={gravar}
      disabled={disabled}
      style={{
        minWidth: 38, height: 38, padding: recording ? '0 10px' : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        border: '1px solid ' + (recording ? 'var(--terra)' : 'var(--line)'), borderRadius: 8, background: recording ? 'var(--terraSoft)' : 'none',
        color: recording ? 'var(--terra)' : 'var(--muted)', flex: 'none', opacity: disabled ? 0.5 : 1,
      }}
    >
      {recording ? (
        <>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--terra)', animation: 'pulse 1s infinite', flex: 'none' }} />
          <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{mmss}</span>
          <Square size={12} />
        </>
      ) : (
        <Mic size={16} />
      )}
    </button>
  );
}
