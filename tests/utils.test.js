import { describe, it, expect } from 'vitest';
import { App } from '../assets/js/main.js';
describe('Pruebas de Utilidades (App)', () => {
    // Prueba 1: Conversión de Markdown (Negritas)
    it('UT-01: Debería convertir **texto** a negritas HTML', () => {
        const input = 'Hola **mundo**';
        const expected = 'Hola <strong>mundo</strong>';
        const result = App.markdownToHtml(input);

        expect(result).toBe(expected);
    });
    // Prueba 2: Conversión de Listas
    it('UT-02: Debería convertir listas guionadas a HTML', () => {
        const input = '- Item 1\n- Item 2';
        // La función envuelve todo en <ul> y cada item en <li>
        const result = App.markdownToHtml(input);

        expect(result).toContain('<ul class="list-disc space-y-1">');
        expect(result).toContain('<li class="ml-4">Item 1</li>');
        expect(result).toContain('<li class="ml-4">Item 2</li>');
    });
    // Prueba 3: Seguridad (Escape HTML)
    it('UT-03: Debería escapar caracteres peligrosos (XSS)', () => {
        const input = '<script>alert("hack")</script>';
        const result = App.escapeHtml(input);

        // Esperamos que < se convierta en &lt; para que no se ejecute
        expect(result).toContain('&lt;script&gt;');
        expect(result).not.toContain('<script>');
    });
});