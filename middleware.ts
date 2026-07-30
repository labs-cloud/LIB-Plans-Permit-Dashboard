import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Phase 2 gate: the team web dashboard requires a logged-in TEAM member.
 *  - not logged in        → /login
 *  - logged in as an owner → /login?e=not_team  (owners use the owner portal, Phase 4)
 *  - logged in as team     → allowed
 * RLS lets a user read only their own profile row, so the role check is safe.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const isAuthRoute = path.startsWith('/login') || path.startsWith('/auth')

  if (!user) {
    if (isAuthRoute) return response
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Logged in: enforce team role (admin/member). Owners are not allowed here.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const isTeam = profile?.role === 'admin' || profile?.role === 'member'

  if (!isTeam && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('e', 'not_team')
    return NextResponse.redirect(url)
  }
  // Already authenticated team member hitting /login → send to dashboard.
  if (isTeam && path.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
