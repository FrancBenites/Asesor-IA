import { createClient } from '@supabase/supabase-js'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
// Nombre clave donde Supabase guarda el token (depende de tu Project ID, pero usaremos un adaptador)
// Para simplificar, usaremos un adaptador personalizado que decide dónde guardar.

const HybridStorage = {
    getItem: (key) => {
        // 1. Intentar leer de localStorage (Persistente)
        const local = window.localStorage.getItem(key);
        if (local) return local;
        // 2. Si no, leer de sessionStorage (Temporal)
        return window.sessionStorage.getItem(key);
    },
    setItem: (key, value) => {
        // Por defecto guardamos en sessionStorage (Temporal)
        // La lógica de "Recordarme" moverá esto a localStorage manualmente en el login
        window.sessionStorage.setItem(key, value);
        // Si ya existía en localStorage (usuario recordado), actualizamos allí también
        if (window.localStorage.getItem(key)) {
            window.localStorage.setItem(key, value);
        }
    },
    removeItem: (key) => {
        // Borrar de ambos sitios al salir
        window.localStorage.removeItem(key);
        window.sessionStorage.removeItem(key);
    }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: HybridStorage, // Usamos nuestro adaptador inteligente
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
})
