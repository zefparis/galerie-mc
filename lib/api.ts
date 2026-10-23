import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function notFound(message = 'Introuvable') {
  return NextResponse.json({ error: message }, { status: 404 })
}

export function handleRouteError(err: unknown) {
  if (err instanceof ZodError) {
    const issue = err.issues[0]
    const path = issue?.path.join('.')
    if (issue && (path.startsWith('photos') || path.startsWith('images') || path === 'imageUrl' || path === 'imagePublicId')) {
      const msg = issue.message.startsWith('Une photo')
        ? issue.message
        : `Une photo n'est pas valide (${issue.message})`
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    const message = issue
      ? `Champ invalide${path ? ` « ${path} »` : ''} : ${issue.message}`
      : 'Données invalides'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const code = (err as { code?: string })?.code
  // Violation de clé unique (ex. id de toile déjà pris) : conflit, pas 500.
  if (code === '23505') {
    return NextResponse.json(
      { error: 'Un élément avec cet identifiant existe déjà' },
      { status: 409 }
    )
  }
  if (code === '42P01') {
    return NextResponse.json(
      { error: 'Base de données non initialisée — lancez npm run migrate' },
      { status: 503 }
    )
  }

  console.error('[api]', err)
  return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
}
