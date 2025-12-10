import { createClient } from '@supabase/supabase-js'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const HybridStorage = {
    getItem: (key) => {
        const local = window.localStorage.getItem(key);
        if (local) return local;
        return window.sessionStorage.getItem(key);
    },
    setItem: (key, value) => {
        window.sessionStorage.setItem(key, value);
        if (window.localStorage.getItem(key)) {
            window.localStorage.setItem(key, value);
        }
    },
    removeItem: (key) => {
        window.localStorage.removeItem(key);
        window.sessionStorage.removeItem(key);
    }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: HybridStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
})
