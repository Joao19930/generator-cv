import React, { useRef } from 'react'
import { User, Camera, ToggleLeft, ToggleRight } from 'lucide-react'
import { useCVStore } from '../../../store/cvStore'

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  borderRadius: 10,
  padding: '10px 12px',
  color: '#1E293B',
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#64748B',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  display: 'block',
  marginBottom: 4,
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

export default function PersonalSection() {
  const { personal, setPersonal } = useCVStore()
  const fileRef = useRef<HTMLInputElement>(null)

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setPersonal({ photo: ev.target?.result as string })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Photo upload */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0' }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: '#F1F5F9',
            border: '2px solid #E2E8F0',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'pointer',
            position: 'relative',
          }}
          onClick={() => fileRef.current?.click()}
        >
          {personal.photo ? (
            <img src={personal.photo} alt="foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <User size={28} style={{ color: '#94A3B8' }} />
          )}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
          >
            <Camera size={20} style={{ color: '#fff' }} />
          </div>
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>Foto de perfil</p>
          <p style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>JPG, PNG — máx 2MB</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              padding: '5px 12px',
              background: '#F1F5F9',
              border: '1px solid #E2E8F0',
              borderRadius: 6,
              color: '#64748B',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Escolher foto
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
      </div>

      {/* Two-col grid for main fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Nome Completo">
            <input
              style={inputStyle}
              value={personal.fullName}
              onChange={e => setPersonal({ fullName: e.target.value })}
              placeholder="Ex: Maria Silva"
              onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
              onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
            />
          </Field>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Cargo / Título Profissional">
            <input
              style={inputStyle}
              value={personal.jobTitle}
              onChange={e => setPersonal({ jobTitle: e.target.value })}
              placeholder="Ex: Engenheiro de Software"
              onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
              onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
            />
          </Field>
        </div>
        <Field label="Email">
          <input
            style={inputStyle}
            type="email"
            value={personal.email}
            onChange={e => setPersonal({ email: e.target.value })}
            placeholder="email@exemplo.com"
            onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
            onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
          />
        </Field>
        <Field label="Telefone">
          <input
            style={inputStyle}
            type="tel"
            value={personal.phone}
            onChange={e => setPersonal({ phone: e.target.value })}
            placeholder="+351 912 345 678"
            onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
            onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
          />
        </Field>
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Morada">
            <input
              style={inputStyle}
              value={personal.address}
              onChange={e => setPersonal({ address: e.target.value })}
              placeholder="Lisboa, Portugal"
              onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
              onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
            />
          </Field>
        </div>
        <Field label="LinkedIn">
          <input
            style={inputStyle}
            value={personal.linkedin}
            onChange={e => setPersonal({ linkedin: e.target.value })}
            placeholder="linkedin.com/in/..."
            onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
            onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
          />
        </Field>
        <Field label="Website / Portfolio">
          <input
            style={inputStyle}
            value={personal.website}
            onChange={e => setPersonal({ website: e.target.value })}
            placeholder="www.exemplo.com"
            onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
            onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
          />
        </Field>
      </div>

      {/* Optional fields with toggles */}
      <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Campos opcionais
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => setPersonal({ showNationality: !personal.showNationality })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: personal.showNationality ? '#1E40AF' : '#CBD5E1' }}
          >
            {personal.showNationality ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
          </button>
          <div style={{ flex: 1 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Nacionalidade</label>
            {personal.showNationality && (
              <input
                style={{ ...inputStyle, marginTop: 4 }}
                value={personal.nationality}
                onChange={e => setPersonal({ nationality: e.target.value })}
                placeholder="Ex: Portuguesa"
                onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
                onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
              />
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => setPersonal({ showBirthDate: !personal.showBirthDate })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: personal.showBirthDate ? '#1E40AF' : '#CBD5E1' }}
          >
            {personal.showBirthDate ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
          </button>
          <div style={{ flex: 1 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Data de Nascimento</label>
            {personal.showBirthDate && (
              <input
                type="date"
                style={{ ...inputStyle, marginTop: 4 }}
                value={personal.birthDate}
                onChange={e => setPersonal({ birthDate: e.target.value })}
                onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
                onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
