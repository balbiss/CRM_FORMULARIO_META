import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useRoleInfo } from '../lib/selectors';
import { ini } from '../lib/format';
import { HorarioAtendimento } from '../components/HorarioAtendimento';

type Tab = 'perfil' | 'seguranca' | 'imobiliaria' | 'atendimento' | 'uso';

export default function Configuracoes() {
  const savePerfil = useAppStore(s => s.savePerfil);
  const toast = useAppStore(s => s.toast);
  const { role, meNome, isManager } = useRoleInfo();
  const [tab, setTab] = useState<Tab>('perfil');

  const tabs: [Tab, string][] = [
    ['perfil', 'Perfil'], ['seguranca', 'Segurança'],
    ...(isManager ? ([['imobiliaria', 'Imobiliária'], ['atendimento', 'Atendimento'], ['uso', 'Uso']] as [Tab, string][]) : []),
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Conta</p>
        <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>Ajustes</h1>
      </div>

      <div style={{ display: 'flex', gap: 20, borderBottom: '1px solid var(--line)', marginBottom: 20 }}>
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '0 0 12px', border: 'none', background: 'none', fontSize: 13.5, fontWeight: tab === id ? 700 : 500, color: tab === id ? 'var(--ink)' : 'var(--muted)', borderBottom: '2px solid ' + (tab === id ? 'var(--terra)' : 'transparent'), marginBottom: -1 }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'perfil' && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <span style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--terraSoft)', color: 'var(--terra)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>{ini(meNome)}</span>
            <span>
              <span style={{ display: 'block', fontFamily: 'Newsreader,serif', fontSize: 24 }}>{meNome}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 3 }}>{role} · Visita IA</span>
            </span>
          </div>
          <label style={{ display: 'block', fontSize: 11.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 7 }}>Nome</label>
          <input defaultValue={meNome} style={{ width: '100%', padding: '11px 13px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13.5, marginBottom: 16 }} />
          <label style={{ display: 'block', fontSize: 11.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 7 }}>E-mail</label>
          <input defaultValue="camila.rocha@novaimob.com.br" style={{ width: '100%', padding: '11px 13px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13.5, marginBottom: 16 }} />
          <label style={{ display: 'block', fontSize: 11.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 7 }}>Telefone</label>
          <input defaultValue="(11) 98812-4477" style={{ width: '100%', padding: '11px 13px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13.5, marginBottom: 22 }} />
          <button onClick={savePerfil} style={{ padding: '11px 18px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600 }}>Salvar alterações</button>
        </div>
      )}

      {tab === 'seguranca' && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 24 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, margin: '0 0 6px' }}>Alterar senha</p>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 14px' }}>Recomendamos trocar sua senha a cada 90 dias.</p>
          <input type="password" placeholder="Senha atual" style={{ width: '100%', padding: '11px 13px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13.5, marginBottom: 10 }} />
          <input type="password" placeholder="Nova senha" style={{ width: '100%', padding: '11px 13px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13.5, marginBottom: 18 }} />
          <button onClick={() => toast('Senha atualizada')} style={{ padding: '11px 18px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 22 }}>Atualizar senha</button>

          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 14 }}>
            <span>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>Verificação em duas etapas</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Camada extra de proteção.</span>
            </span>
            <button onClick={() => toast('Verificação em duas etapas ativada')} style={{ padding: '8px 14px', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12.5, fontWeight: 600 }}>Ativar</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <span>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>Sessões ativas</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Você está logado em um navegador neste dispositivo.</span>
            </span>
            <button onClick={() => toast('Outras sessões encerradas')} style={{ padding: '8px 14px', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12.5, fontWeight: 600, color: 'var(--terra)' }}>Encerrar outras sessões</button>
          </div>
        </div>
      )}

      {tab === 'imobiliaria' && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 24 }}>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 18px' }}>Informações públicas exibidas para os leads.</p>
          <label style={{ display: 'block', fontSize: 11.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 7 }}>Nome da imobiliária</label>
          <input defaultValue="Minha Imobiliária" style={{ width: '100%', padding: '11px 13px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13.5, marginBottom: 16 }} />
          <label style={{ display: 'block', fontSize: 11.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 7 }}>CNPJ</label>
          <input defaultValue="00.000.000/0001-00" style={{ width: '100%', padding: '11px 13px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13.5, marginBottom: 16 }} />
          <label style={{ display: 'block', fontSize: 11.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 7 }}>Endereço</label>
          <input defaultValue="Rua Joaquim Antunes, 480 — São Paulo, SP" style={{ width: '100%', padding: '11px 13px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13.5, marginBottom: 22 }} />
          <button onClick={() => toast('Dados da imobiliária atualizados')} style={{ padding: '11px 18px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600 }}>Salvar alterações</button>
        </div>
      )}

      {tab === 'atendimento' && <HorarioAtendimento />}

      {tab === 'uso' && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 24 }}>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 18px' }}>Uso atual dos recursos da plataforma.</p>
          {[['Corretores ativos', '6 de 10'], ['Leads no mês', '28 de 500'], ['Instâncias de WhatsApp', '4 de 10'], ['Armazenamento de mídia', '1,2 GB de 20 GB']].map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--line)', fontSize: 13.5 }}>
              <span style={{ color: 'var(--muted)' }}>{label}</span><span style={{ fontWeight: 600 }}>{val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
