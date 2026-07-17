import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase 未配置。云端功能不可用。')
}

export const supabase = createClient(
  supabaseUrl || 'http://placeholder',
  supabaseKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
)

export function isSupabaseConfigured(): boolean {
  return !!supabaseUrl && supabaseUrl.includes('supabase.co')
}
