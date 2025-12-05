import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App } from '../assets/js/main.js';
// MOCK GLOBAL: Fetch (para simular API de IA)
global.fetch = vi.fn();
// MOCK GLOBAL: Mammoth (para simular conversión de Docx)
global.mammoth = {
    convertToHtml: vi.fn(),
    images: {
        imgElement: vi.fn()
    }
};
// MOCK GLOBAL: DOM
const mockUploadInput = { addEventListener: vi.fn(), value: '' };
const mockEditor = { innerHTML: '', dispatchEvent: vi.fn() };
const mockAnalyzeBtn = { disabled: false, innerHTML: '', click: vi.fn() };
const mockDocName = { value: '' };
document.getElementById = vi.fn((id) => {
    if (id === 'docx-upload') return mockUploadInput;
    if (id === 'thesis-editor') return mockEditor;
    if (id === 'analyze-btn') return mockAnalyzeBtn;
    if (id === 'doc-name') return mockDocName;
    return null;
});
// MOCK GLOBAL: Toastify
global.Toastify = vi.fn(() => ({ showToast: vi.fn() }));
describe('Pruebas de Servicios Externos (OE1 y OE2)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    // Prueba 1: Conversión de Docx (Indicador I1)
    it('DOC-01: Debería procesar un archivo .docx válido', async () => {
        // 1. Simulamos el evento de subida de archivo
        const mockFile = {
            name: 'Tesis.docx',
            size: 1000,
            arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8))
        };

        // 2. Simulamos que Mammoth convierte el archivo a HTML
        global.mammoth.convertToHtml.mockResolvedValue({ value: '<p>Contenido Tesis</p>' });
        // 3. Iniciamos el listener
        App.initDocxUpload();
        // 4. Disparamos el evento manualmente (simulando el usuario)
        const changeHandler = mockUploadInput.addEventListener.mock.calls[0][1];
        await changeHandler({ target: { files: [mockFile] } });
        // Verificaciones
        expect(global.mammoth.convertToHtml).toHaveBeenCalled();
        expect(mockEditor.innerHTML).toBe('<p>Contenido Tesis</p>');
        expect(mockDocName.value).toBe('Tesis.docx');
    });
    // Prueba 2: Llamada a Agente IA (Indicador I3)
    it('AG-01: Debería llamar a la API de Langflow y devolver texto', async () => {
        // 1. Simulamos respuesta exitosa de la API
        const mockResponse = {
            ok: true,
            json: async () => ({
                outputs: [{ results: { message: { text: 'Análisis completado' } } }]
            })
        };
        global.fetch.mockResolvedValue(mockResponse);
        // 2. Llamamos a la función
        const result = await App.callLangflowAgent('estructura', 'Consulta de prueba');
        // Verificaciones
        expect(result).toBe('Análisis completado');
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('langflow.datastax.com'),
            expect.objectContaining({ method: 'POST' })
        );
    });
    // Prueba 3: Manejo de Error en IA (Indicador I3)
    it('AG-02: Debería manejar errores del servidor de IA', async () => {
        // 1. Simulamos error 500
        global.fetch.mockResolvedValue({
            ok: false,
            status: 500,
            text: async () => 'Internal Server Error'
        });
        // 2. Esperamos que la función lance un error
        await expect(App.callLangflowAgent('estructura', 'Consulta'))
            .rejects
            .toThrow('Error interno del servidor de IA');
    });
});