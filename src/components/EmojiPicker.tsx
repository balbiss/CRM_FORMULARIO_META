import { useState } from 'react';
import { Smile } from 'lucide-react';

const EMOJIS = ['😀', '😂', '😉', '😍', '👍', '🙏', '🙌', '👏', '🎉', '❤️', '🔥', '✅', '📅', '📍', '🏠', '💰'];

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative', flex: 'none' }}>
      <button
        type="button"
        title="Emojis"
        onClick={() => setOpen(o => !o)}
        style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--line)', borderRadius: 8, background: open ? 'var(--terraSoft)' : 'none', color: open ? 'var(--terra)' : 'var(--muted)' }}
      >
        <Smile size={16} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
          <div style={{
            position: 'absolute', bottom: 46, left: 0, zIndex: 21, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10,
            padding: 8, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, boxShadow: '0 8px 24px rgba(0,0,0,.18)',
          }}>
            {EMOJIS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => { onPick(e); setOpen(false); }}
                style={{ width: 34, height: 34, fontSize: 18, border: 'none', background: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                {e}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
