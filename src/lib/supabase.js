import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 환경 변수가 없으면 null이고, 앱은 로컬 모드로 동작한다.
export const supabase = url && anonKey ? createClient(url, anonKey) : null
