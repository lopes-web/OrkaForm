import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lwnqrzyfmepgwrqjxhms.supabase.co';
const supabaseAnonKey = 'sb_publishable_7OyXUOCYJdRQKBdX4c6AUA_4pJj5-0G';

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
