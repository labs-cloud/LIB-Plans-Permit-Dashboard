'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get('e')
    if (e === 'not_team') setMsg({ kind: 'err', text: 'That account is an owner login. The team dashboard is for staff only.' })
    else if (e === 'auth') setMsg({ kind: 'err', text: 'That sign-in link was invalid or expired. Try again.' })
  }, [])

  async function sendMagicLink() {
    if (!email) return setMsg({ kind: 'err', text: 'Enter your email first.' })
    setBusy(true); setMsg(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setBusy(false)
    setMsg(error ? { kind: 'err', text: error.message } : { kind: 'ok', text: 'Check your email for a sign-in link.' })
  }

  async function signInWithPassword() {
    setBusy(true); setMsg(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setMsg({ kind: 'err', text: error.message })
    else router.replace('/')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <svg width="34" height="38" viewBox="0 0 64 64" aria-hidden="true">
            <rect x="29" y="3" width="6" height="26" fill="#F47832" />
            <polygon points="32,12 52,22 52,46 32,56 12,46 12,22" fill="#000000" />
          </svg>
          <div className="leading-tight">
            <div className="text-base font-bold tracking-tight">LEAD IT <span style={{ color: '#F47832' }}>BUILDERS</span></div>
            <div className="text-xs text-neutral-500">Team dashboard</div>
          </div>
        </div>

        <label className="mb-1 block text-sm font-medium text-neutral-700">Email</label>
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="you@leaditbuilders.com" autoComplete="email"
          className="mb-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-black"
        />

        <button
          onClick={sendMagicLink} disabled={busy}
          className="mb-4 w-full rounded-lg py-2 text-sm font-semibold text-black disabled:opacity-50"
          style={{ backgroundColor: '#F47832' }}
        >
          {busy ? 'Working…' : 'Email me a sign-in link'}
        </button>

        <details className="mb-2">
          <summary className="cursor-pointer text-xs text-neutral-500">Use a password instead</summary>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password" autoComplete="current-password"
            className="my-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-black"
          />
          <button
            onClick={signInWithPassword} disabled={busy}
            className="w-full rounded-lg border border-black py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            Sign in
          </button>
        </details>

        {msg && (
          <p className={`mt-3 text-sm ${msg.kind === 'err' ? 'text-red-600' : 'text-green-700'}`}>{msg.text}</p>
        )}
      </div>
    </main>
  )
}
