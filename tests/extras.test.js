import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App } from '../assets/js/main.js';
// MOCKS GLOBALES
const mockEditor = {
    innerHTML: '',
    innerText: '',
    addEventListener: vi.fn(),
    focus: vi.fn()
};
const mockChatContainer = {
    innerHTML: '',
    appendChild: vi.fn(),
    scrollTop: 0,
    scrollHeight: 100
};
const mockAnalyzeBtn = {
    addEventListener: vi.fn(),
    disabled: false
};
// Simulamos document.getElementById y querySelector
document.getElementById = vi.fn((id) => {
    if (id === 'thesis-editor') return mockEditor;
    if (id === 'analyze-btn') return mockAnalyzeBtn;
    if (id === 'doc-name') return { value: 'Tesis.docx', addEventListener: vi.fn() };
    return null;
});
document.querySelector = vi.fn((sel) => {
    if (sel === '.flex-1.space-y-4') return mockChatContainer;
    return null;
});
document.createElement = vi.fn(() => ({ className: '', innerHTML: '' }));
// SOLUCIÓN 1: Mock de Toastify (Global)
global.Toastify = vi.fn(() => ({ showToast: vi.fn() }));
// Mock de Supabase
vi.mock('../assets/js/supabaseClient.js', () => ({
    supabase: {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: '123' } } }) },
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({ data: { title: 'Tesis Guardada' } }),
                    order: vi.fn().mockResolvedValue({ data: [] })
                }))
            }))
        })),
        rpc: vi.fn().mockResolvedValue({ error: null })
    }
}));
describe('Pruebas Funcionales Extra (UX y Estabilidad)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        mockEditor.innerHTML = '';
        mockEditor.innerText = '';

        // SOLUCIÓN 2: Simulamos que marked ya cargó para que no espere
        window.markedReady = true;
        // Pero NO definimos 'marked' globalmente, para probar el fallback
    });
    afterEach(() => {
        vi.useRealTimers();
    });
    // Prueba 1: Auto-Guardado
    it('UX-01: Debería iniciar el temporizador de auto-guardado al escribir', async () => {
        await App.initAutoSave();

        const inputHandler = mockEditor.addEventListener.mock.calls.find(c => c[0] === 'input')[1];
        inputHandler();
        vi.advanceTimersByTime(3000);
        const { supabase } = await import('../assets/js/supabaseClient.js');
        expect(supabase.rpc).toHaveBeenCalled();
    });
    // Prueba 2: Chat UI con Fallback
    it('UX-02: Debería mostrar mensajes incluso si la librería Markdown falla', () => {
        // window.markedReady es true (por beforeEach), pero 'marked' es undefined
        // Esto fuerza a tu código a usar el fallback simple

        App.addChatMessage('Hola **mundo**');
        const bubble = mockChatContainer.appendChild.mock.calls[0][0];
        expect(bubble.innerHTML).toContain('<strong>mundo</strong>');
    });
    // Prueba 3: Validación de Análisis
    it('UX-03: No debería permitir analizar si el texto es muy corto', () => {
        App.initDocumentAnalysis();

        const clickHandler = mockAnalyzeBtn.addEventListener.mock.calls[0][1];

        mockEditor.innerText = 'Hola';
        clickHandler();
        expect(mockAnalyzeBtn.disabled).toBe(false);
        // Ahora sí se llamará porque markedReady es true
        expect(mockChatContainer.appendChild).toHaveBeenCalled();
    });
});