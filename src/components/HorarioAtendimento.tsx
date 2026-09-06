import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { DIAS_SEMANA, minToHHMM, hhmmToMin, type DiaAtendimento } from '../lib/schedule';

/** Painel do Dono/Gerente: define em que dias e faixas de horário a equipe pode ficar
 *  "No Plantão" (recebendo leads da roleta). Vale pra todos os corretores da imobiliária. */
export function HorarioAtendimento() {
  const salvo = useAppStore(s => s.horarioAtendimento);
  const salvarHorario = useAppStore(s => s.salvarHorario);
  const fetchHorario = useAppStore(s => s.fetchHorario);
  const [dias, setDias] = useState<DiaAtendimento[]>(salvo);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchHorario(); }, [fetchHorario]);
  useEffect(() => { setDias(salvo); }, [salvo]);

  const upd = (i: number, patch: Partial<DiaAtendimento>) =>
    setDias(d => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const invalido = dias.some(d => d.ativo && d.fechaMin <= d.abreMin);
  const mudou = JSON.stringify(dias) !== JSON.stringify(salvo);

  const submit = async () => {
    if (invalido) return;
    setSaving(true);
    await salvarHorario(dias);
    setSaving(false);
  };

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 24 }}>
      <p style={{ fontSize: 13.5, fontWeight: 700, margin: '0 0 4px' }}>Horário de atendimento da equipe</p>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 18px', lineHeight: 1.6 }}>
        Define quando o corretor pode ficar <strong>No Plantão</strong> e receber leads da roleta. Fora dessa
        janela, ao tentar entrar no plantão ele vê um aviso. Horário sempre no fuso de Brasília.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {dias.map((d, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 9,
              border: '1px solid var(--line)', background: d.ativo ? 'var(--card)' : 'var(--bg)', flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              role="switch"
              aria-checked={d.ativo}
              onClick={() => upd(i, { ativo: !d.ativo })}
              style={{ display: 'flex', alignItems: 'center', gap: 9, border: 'none', background: 'none', padding: 0, minWidth: 118 }}
            >
              <span style={{ position: 'relative', width: 34, height: 19, borderRadius: 10, background: d.ativo ? 'var(--terra)' : 'var(--line)', flex: 'none', transition: 'background .15s' }}>
                <span style={{ position: 'absolute', top: 2, left: d.ativo ? 17 : 2, width: 15, height: 15, borderRadius: '50%', background: '#fff', transition: 'left .15s ease' }} />
              </span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{DIAS_SEMANA[i]}</span>
            </button>

            {d.ativo ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="time"
                  value={minToHHMM(d.abreMin)}
                  onChange={e => upd(i, { abreMin: hhmmToMin(e.target.value) })}
                  style={{ padding: '7px 9px', border: '1px solid var(--line)', borderRadius: 7, background: 'var(--bg)', fontSize: 13 }}
                />
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>às</span>
                <input
                  type="time"
                  value={minToHHMM(d.fechaMin)}
                  onChange={e => upd(i, { fechaMin: hhmmToMin(e.target.value) })}
                  style={{ padding: '7px 9px', border: '1px solid ' + (d.fechaMin <= d.abreMin ? 'var(--terra)' : 'var(--line)'), borderRadius: 7, background: 'var(--bg)', fontSize: 13 }}
                />
              </span>
            ) : (
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Fechado</span>
            )}
          </div>
        ))}
      </div>

      {invalido && <p style={{ fontSize: 12, color: 'var(--terra)', margin: '12px 0 0' }}>O horário de fechamento precisa ser depois do de abertura.</p>}

      <button
        onClick={submit}
        disabled={saving || invalido || !mudou}
        style={{ marginTop: 18, padding: '11px 18px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600, opacity: saving || invalido || !mudou ? 0.55 : 1 }}
      >
        {saving ? 'Salvando…' : 'Salvar horário'}
      </button>
    </div>
  );
}
