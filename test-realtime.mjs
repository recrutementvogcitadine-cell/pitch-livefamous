import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const SUPABASE_URL = https://jxhgmetivgnsphyowjcw.supabase.co
const ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4aGdtZXRpdmduc3BoeW93amN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjM5NjIsImV4cCI6MjA4Njk5OTk2Mn0.YDNrWT5zWx9rilV__-IATggmzButiQmTWn59RskkLBI
const EMAIL = recrutementvogcitadine@gmail.com
'use client'
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function GithubLoginButton() {
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: 'http://localhost:3000/auth/callback', // mets ton URL
      },
    })
    if (error) console.error(error.message)
  }

  return <button onClick={handleLogin}>Se connecter avec GitHub</button>
}'
const LIVE_ID = '8b0f7f2a-1c6f-4b2e-b5a4-0f3d1a6f2c9e'

const supabase = const SUPABASE_URL = https://jxhgmetivgnsphyowjcw.supabase.co
const ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4aGdtZXRpdmduc3BoeW93amN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjM5NjIsImV4cCI6MjA4Njk5OTk2Mn0.YDNrWT5zWx9rilV__-IATggmzButiQmTWn59RskkLBI

const { error: signErr } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
if (signErr) { console.error('Auth error:', signErr); process.exit(1) }

const { data: { session } } = await supabase.auth.getSession()
if (!session?.access_token) { console.error('No access token'); process.exit(1) }

await supabase.realtime.setAuth(session.access_token)

const channel = supabase.channel(`live:${LIVE_ID}:overlays`, {
  config: { private: true, broadcast: { ack: true } }
})

channel.on('broadcast', { event: 'overlay_added' }, (payload) => {
  console.log('Received broadcast:', payload)
})

const status = await new Promise((resolve) => channel.subscribe((s) => resolve(s)))
console.log('Subscribe status:', status)

const { sent } = await channel.send({
  type: 'broadcast',
  event: 'overlay_added',
  payload: { hello: 'world' }
})
console.log('Send ack:', sent)

setTimeout(async () => {
  await supabase.removeChannel(channel)
  process.exit(0)
}, 1500)