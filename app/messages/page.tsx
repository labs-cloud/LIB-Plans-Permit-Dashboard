'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Project = { id: string; address: string }
type Msg = { id: string; body: string; sender_id: string; created_at: string }

const ORANGE = '#F47832'

export default function MessagesPage() {
  const [supabase] = useState(() => createClient())
  const [projects, setProjects] = useState<Project[]>([])
  const [selected, setSelected] = useState<Project | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ;(async () => {
      const { data: u } = await supabase.auth.getUser()
      setUserId(u.user?.id ?? null)
      const { data } = await supabase.from('projects').select('id,address').order('address')
      setProjects((data as Project[]) ?? [])
    })()
  }, [supabase])

  useEffect(() => {
    if (!selected) return
    loadMessages(selected.id)
  }, [selected])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadMessages(projectId: string) {
    const { data } = await supabase.from('messages')
      .select('id,body,sender_id,created_at').eq('project_id', projectId).order('created_at')
    setMessages((data as Msg[]) ?? [])
  }

  async function send() {
    const text = draft.trim()
    if (!text || !selected || !userId) return
    setSending(true)
    await supabase.from('messages').insert({ project_id: selected.id, sender_id: userId, body: text })
    setDraft('')
    await loadMessages(selected.id)
    setSending(false)
  }

  const filtered = search
    ? projects.filter(p => p.address?.toLowerCase().includes(search.toLowerCase()))
    : projects

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0b0b0c', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      {/* project list */}
      <aside style={{ width: 300, borderRight: '1px solid #2a2a2d', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #2a2a2d' }}>
          <div style={{ fontWeight: 700 }}>LEAD IT <span style={{ color: ORANGE }}>BUILDERS</span></div>
          <div style={{ fontSize: 12, color: '#9a9a9f', marginTop: 2 }}>Messages</div>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects…"
          style={{ margin: 12, padding: '8px 10px', background: '#161617', border: '1px solid #2a2a2d', borderRadius: 8, color: '#fff', fontSize: 14 }} />
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.map(p => (
            <button key={p.id} onClick={() => setSelected(p)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 16px', background: selected?.id === p.id ? '#1e1e20' : 'transparent',
                border: 'none', borderLeft: selected?.id === p.id ? `3px solid ${ORANGE}` : '3px solid transparent', color: '#fff', cursor: 'pointer', fontSize: 14 }}>
              {p.address || 'Untitled'}
            </button>
          ))}
        </div>
      </aside>

      {/* thread */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!selected ? (
          <div style={{ margin: 'auto', color: '#6a6a70' }}>Pick a project to see its messages.</div>
        ) : (
          <>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #2a2a2d', fontWeight: 600 }}>{selected.address}</div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.length === 0 && <div style={{ color: '#6a6a70', margin: 'auto' }}>No messages yet.</div>}
              {messages.map(m => {
                const mine = m.sender_id === userId
                return (
                  <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '70%',
                    background: mine ? ORANGE : '#161617', color: mine ? '#000' : '#fff',
                    padding: '10px 14px', borderRadius: 16, fontSize: 15 }}>
                    {m.body}
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>
            <div style={{ display: 'flex', gap: 10, padding: 14, borderTop: '1px solid #2a2a2d' }}>
              <input value={draft} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') send() }} placeholder="Type a reply…"
                style={{ flex: 1, padding: '10px 14px', background: '#161617', border: '1px solid #2a2a2d', borderRadius: 20, color: '#fff', fontSize: 15 }} />
              <button onClick={send} disabled={sending || !draft.trim()}
                style={{ padding: '10px 20px', background: ORANGE, color: '#000', border: 'none', borderRadius: 20, fontWeight: 600, cursor: 'pointer', opacity: sending || !draft.trim() ? 0.5 : 1 }}>
                Send
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
