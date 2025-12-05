import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App } from '../assets/js/main.js';
// MOCK GLOBAL 1: Editor
const mockEditor = {
    focus: vi.fn(),
    innerHTML: '',
};
// MOCK GLOBAL 2: Toastify
global.Toastify = vi.fn(() => ({
    showToast: vi.fn(),
}));
// Simulamos document.getElementById
document.getElementById = vi.fn((id) => {
    if (id === 'thesis-editor') return mockEditor;
    return null;
});
// Simulamos execCommand
document.execCommand = vi.fn();
describe('Pruebas de Lógica de Negocio (Bibliografía)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockEditor.innerHTML = '';
    });
    // Prueba 1: Parsing de Citas APA (Indicador I6)
    it('BIB-01: Debería parsear correctamente una cadena de referencia APA completa', () => {
        const input = 'Benites, F. (2024). Inteligencia Artificial en Tesis. Editorial UPAO';
        const result = App.parseAPACitation(input);
        expect(result).toMatchObject({
            autor: 'Benites',      // El código separa la inicial
            inicial: 'F.',         // La inicial va aquí
            año: '2024',
            titulo: 'Inteligencia Artificial en Tesis', // El código quita el punto final
            editorial: 'Editorial UPAO'
        });
        expect(result.id).toBeDefined();
    });
    // Prueba 2: Inserción de Citas (Indicador I6/I7)
    it('BIB-02: Debería insertar una cita en el editor', () => {
        App.insertCitation('Benites', '2024');
        // El código agrega espacios por seguridad/formato
        expect(document.execCommand).toHaveBeenCalledWith('insertText', false, ' (Benites, 2024) ');

        expect(mockEditor.focus).toHaveBeenCalled();
        expect(global.Toastify).toHaveBeenCalled();
    });
    // Prueba 3: Manejo de errores en Parsing
    it('BIB-03: Debería manejar formatos incorrectos creando un objeto básico', () => {
        const input = 'Referencia mal formada sin año';
        const result = App.parseAPACitation(input);

        expect(result).not.toBeNull();
        expect(result.titulo).toBe(input);
    });
});