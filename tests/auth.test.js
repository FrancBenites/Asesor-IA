import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App } from '../assets/js/main.js';
import { supabase } from '../assets/js/supabaseClient.js';
// MOCK DE SUPABASE
// Le decimos a Vitest: "No uses el archivo real, usa estas funciones falsas"
vi.mock('../assets/js/supabaseClient.js', () => ({
    supabase: {
        auth: {
            signInWithPassword: vi.fn(),
            getSession: vi.fn(),
        },
    },
}));
// MOCK DEL DOM (Checkbox 'Recordarme')
const mockCheckbox = { checked: false };
document.getElementById = vi.fn((id) => {
    if (id === 'remember-me') return mockCheckbox;
    return null;
});
describe('Pruebas de Autenticación (Indicador I5)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckbox.checked = false; // Resetear checkbox
    });
    // Prueba 1: Login Exitoso
    it('AU-01: Debería permitir login con credenciales correctas', async () => {
        // Simulamos que Supabase responde "OK"
        supabase.auth.signInWithPassword.mockResolvedValue({
            data: { session: { user: { id: '123' } } },
            error: null
        });
        const result = await App.handleLogin('test@upao.edu.pe', '123456');
        expect(result).toBe(true);
        expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
            email: 'test@upao.edu.pe',
            password: '123456'
        });
    });
    // Prueba 2: Login Fallido
    it('AU-02: Debería rechazar login con credenciales incorrectas', async () => {
        // Simulamos que Supabase responde "Error"
        supabase.auth.signInWithPassword.mockResolvedValue({
            data: { session: null },
            error: { message: 'Invalid login credentials' }
        });
        const result = await App.handleLogin('test@upao.edu.pe', 'badpass');
        expect(result).toBe(false);
    });
    // Prueba 3: Verificar Sesión Activa
    it('AU-03: checkAuth debería devolver true si hay sesión', async () => {
        // Simulamos que getSession devuelve una sesión
        supabase.auth.getSession.mockResolvedValue({
            data: { session: { user: { id: '123' } } }
        });
        const isAuthenticated = await App.checkAuth();
        expect(isAuthenticated).toBe(true);
    });
});