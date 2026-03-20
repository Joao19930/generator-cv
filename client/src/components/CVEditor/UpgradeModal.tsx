import React from 'react'
import { X, Crown, Zap } from 'lucide-react'

interface UpgradeModalProps {
  onClose: () => void
}

export default function UpgradeModal({ onClose }: UpgradeModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 16,
          padding: 32,
          width: '100%',
          maxWidth: 400,
          textAlign: 'center',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute' as const,
            top: 12,
            right: 12,
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: 4,
          }}
        />

        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <Crown size={28} style={{ color: '#fff' }} />
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>
          Plano Pro necessário
        </h2>
        <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, marginBottom: 24 }}>
          Activa o plano Pro para descarregar o teu CV em PDF com qualidade profissional, sem marcas de água.
        </p>

        <div
          style={{
            background: '#0f172a',
            border: '1px solid #1e3a5f',
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              'Download em PDF ilimitado',
              'Todos os 4 templates premium',
              'Sugestões ilimitadas com IA',
              'Partilha com link personalizado',
            ].map((feature) => (
              <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#cbd5e1' }}>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={() => { window.location.href = '/pricing' }}
            style={{
              flex: 1,
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Ver Planos
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px 20px',
              background: '#334155',
              color: '#94a3b8',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
