import { supabaseServer } from './supabase'

export type SBProfile = {
  email: string
  name?: string | null
  bio?: string | null
  location?: string | null
  website?: string | null
  avatar_url?: string | null
  cover_url?: string | null
  friends_count?: number | null
  created_at?: string
  updated_at?: string
}

export async function sbGetProfile(email: string): Promise<SBProfile | null> {
  const sb = supabaseServer()
  const { data, error } = await sb.from('profiles').select('*').eq('email', email).single()
  if (error && error.code !== 'PGRST116') throw error
  return (data as SBProfile) || null
}

export async function sbUpsertProfile(profile: SBProfile): Promise<SBProfile> {
  const sb = supabaseServer()
  const payload = { ...profile, updated_at: new Date().toISOString() }
  const { data, error } = await sb.from('profiles').upsert(payload, { onConflict: 'email' }).select('*').single()
  if (error) throw error
  return data as SBProfile
}

export type SBPost = {
  id?: string
  text: string
  image_urls?: string[] | null
  video_url?: string | null
  email: string
  name?: string | null
  created_at?: string
}

export async function sbInsertPost(post: SBPost): Promise<void> {
  const sb = supabaseServer()
  const insert = {
    text: post.text,
    image_urls: post.image_urls || null,
    video_url: post.video_url || null,
    email: post.email,
    name: post.name || null,
    created_at: new Date().toISOString(),
  }
  const { error } = await sb.from('posts').insert(insert)
  if (error) throw error
}

export async function sbFetchPosts(filterEmail?: string) {
  const sb = supabaseServer()
  const query = sb.from('posts').select('*').order('created_at', { ascending: false })
  const { data: posts, error } = filterEmail ? await query.eq('email', filterEmail) : await query
  if (error) throw error

  const emails = Array.from(new Set((posts || []).map((p: any) => p.email)))
  let profiles: SBProfile[] = []
  if (emails.length) {
    const { data, error: e2 } = await sb.from('profiles').select('email,name,avatar_url').in('email', emails)
    if (e2) throw e2
    profiles = data as SBProfile[]
  }
  const nameMap = new Map(profiles.map((p) => [p.email, p.name]))
  const avatarMap = new Map(profiles.map((p) => [p.email, p.avatar_url]))

  return (posts || []).map((p: any) => ({
    _id: p.id,
    text: p.text,
    imageUrl: null,
    imageUrls: p.image_urls || [],
    videoUrl: p.video_url || null,
    email: p.email,
    name: p.name,
    createdAt: p.created_at,
    displayName: nameMap.get(p.email) || p.name || (p.email?.split('@')[0]) || 'Anonymous',
    authorAvatarUrl: avatarMap.get(p.email) || null,
    reactionCounts: {},
    currentUserReaction: null,
    commentCount: 0,
    shareCount: 0,
    sharedFrom: null,
  }))
}

