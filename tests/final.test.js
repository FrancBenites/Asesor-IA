import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App } from '../assets/js/main.js';
// MOCKS GLOBALES
const mockPdfBtn = {
    addEventListener: vi.fn(),
    disabled: false,
    innerHTML: ''
};
const mockNewChatBtn = { addEventListener: vi.fn() };
const mockEditor = { innerText: '', innerHTML: '' };
const mockDocName = { value: 'Tesis.docx' };
// Mock de html2pdf
const mockHtml2PdfInstance = {
    from: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    save: vi.fn().mockResolvedValue(true)
};
global.html2pdf = vi.fn(() => mockHtml2PdfInstance);
// SOLUCIÓN 1: Mock de Toastify
global.Toastify = vi.fn(() => ({ showToast: vi.fn() }));
// Mock del DOM
document.getElementById = vi.fn((id) => {
    if (id === 'generate-pdf') return mockPdfBtn;
    if (id === 'new-chat-btn') return mockNewChatBtn;
    if (id === 'thesis-editor') return mockEditor;
    if (id === 'doc-name') return mockDocName;
    return null;
});
document.querySelector = vi.fn(() => ({ querySelectorAll: () => [] }));
// SOLUCIÓN 2: Mock de Supabase Corregido (Encadenamiento)
vi.mock('../assets/js/supabaseClient.js', () => ({
    supabase: {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: '123' } } }) },
        from: vi.fn(() => ({
            // select ahora devuelve un objeto con eq, que devuelve la promesa
            select: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ data: [] })
            })),
            delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({}) })),
            update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({}) }))
        }))
    }
}));
// Mock de Window
global.confirm = vi.fn();
global.window.location = { reload: vi.fn() };
global.window.matchMedia = vi.fn(() => ({ matches: false }));
describe('Pruebas Finales (Cobertura Total)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mockPdfBtn.disabled = false;
    });
    // Prueba 1: Generación de PDF
    it('FIN-01: Debería generar PDF si el documento es válido', async () => {
        App.initPDFGeneration();

        mockEditor.innerText = 'Contenido de tesis suficientemente largo para generar el reporte PDF...';

        const clickHandler = mockPdfBtn.addEventListener.mock.calls[0][1];
        await clickHandler();
        expect(global.html2pdf).toHaveBeenCalled();
        expect(mockHtml2PdfInstance.save).toHaveBeenCalled();
    });
    // Prueba 2: Validación PDF
    it('FIN-02: No debería generar PDF si el documento es muy corto', async () => {
        App.initPDFGeneration();

        mockEditor.innerText = 'Muy corto';

        const clickHandler = mockPdfBtn.addEventListener.mock.calls[0][1];
        try { await clickHandler(); } catch (e) { }
        expect(mockHtml2PdfInstance.save).not.toHaveBeenCalled();
    });
    // Prueba 3: Tema
    it('FIN-03: Debería detectar preferencia de sistema (Dark Mode)', () => {
        global.window.matchMedia.mockReturnValue({ matches: true });
        App.initTheme();
        expect(document.documentElement.className).toBe('dark');
    });
    // Prueba 4: Reset Total
    it('FIN-04: Debería borrar datos y recargar al iniciar nuevo chat', async () => {
        App.initNewChat();

        global.confirm.mockReturnValue(true);
        const clickHandler = mockNewChatBtn.addEventListener.mock.calls[0][1];
        await clickHandler();
        const { supabase } = await import('../assets/js/supabaseClient.js');
        expect(supabase.from).toHaveBeenCalledWith('documents');
        expect(window.location.reload).toHaveBeenCalled();
    });
});