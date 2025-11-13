// assets/js/main.js
class App {
  static init() {
    this.loadSidebar();
    this.initTheme();
    this.initChat();
    this.initDocumentAnalysis();
    this.initAutoSave();
    this.initDocxUpload(); // ← NUEVA LÍNEA
    this.initNewChat(); // ← NUEVA LÍNEA
    this.initBibliography(); // ← NUEVA LÍNEA
    this.initPDFGeneration(); // ← NUEVA LÍNEA
  }

  static loadSidebar() {
    fetch('components/sidebar.html')
      .then(r => r.text())
      .then(html => {
        document.getElementById('sidebar').innerHTML = html;
        this.highlightCurrentPage();
        this.setupThemeToggle();
      })
      .catch(err => console.error('Error loading sidebar:', err));
  }

  static highlightCurrentPage() {
    const page = document.body.dataset.page;
    const link = document.querySelector(`[data-page="${page}"]`);
    if (link) link.classList.add('active');
  }

  static initTheme() {
    const saved = localStorage.getItem('theme');
    const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const theme = saved || preferred;
    document.documentElement.className = theme;
  }

  static setupThemeToggle() {
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
      });
    });
  }


  // VERSIÓN 100% ESTABLE: Funciona con gemini-2.5-flash
  static async generateChatResponse(query, context = '') {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("PEGA")) {
      return 'Error: Configura tu clave en config.js';
    }

    const prompt = `
      Eres un Asesor Virtual de Tesis experto en metodología, redacción y bibliografía académica.
      Responde en español, de forma clara, estructurada y útil para estudiantes universitarios.
      Usa listas numeradas o viñetas cuando sea apropiado.
      Consulta del estudiante: ${query}
      Contexto del documento (opcional): ${context}
    `;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Error HTTP:', error);
        return 'Error del servidor. Intenta de nuevo.';
      }

      const data = await response.json();
      console.log('GEMINI RESPONSE:', data); // ← Para depurar

      // EXTRAER TEXTO DE FORMA SEGURA
      const candidate = data.candidates?.[0];
      const part = candidate?.content?.parts?.[0];
      const text = part?.text;

      if (text) {
        return text.trim();
      } else {
        console.warn('Sin texto en la respuesta:', data);
        return 'Lo siento, no pude generar una respuesta. Intenta reformular.';
      }

    } catch (error) {
      console.error('Error de red:', error);
      return 'Error de conexión. Revisa tu internet.';
    }
  }

  // INICIAR EL CHAT
  static initChat() {
    const checkElements = setInterval(() => {
      const sendButton = document.querySelector('button .material-icons');
      const input = document.querySelector('input[placeholder="Escribe tu consulta aquí..."]');
      const chatContainer = document.querySelector('.flex-1.space-y-4');

      if (sendButton && input && chatContainer) {
        clearInterval(checkElements);

        const addMessage = (text, isUser = false) => {
          const bubble = document.createElement('div');
          bubble.className = `p-3 rounded-lg max-w-xs ${isUser ? 'bg-primary text-white ml-auto' : 'bg-[var(--secondary)]'}`;
          bubble.textContent = text;
          chatContainer.appendChild(bubble);
          chatContainer.scrollTop = chatContainer.scrollHeight;
        };

        const handleSend = async () => {
          const query = input.value.trim();
          if (!query) return;

          addMessage(query, true);
          input.value = '';
          addMessage('Escribiendo...');

          try {
            const reply = await this.generateChatResponse(query);
            chatContainer.lastChild.textContent = reply;
          } catch (error) {
            chatContainer.lastChild.textContent = 'Error: No se pudo conectar con la IA. Revisa la consola (F12).';
          }
        };

        sendButton.parentElement.addEventListener('click', handleSend);
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') handleSend();
        });
      }
    }, 100);
  }

    // NUEVO: Análisis con 3 agentes + integración con bibliografía
  static async initDocumentAnalysis() {
    const analyzeBtn = document.getElementById('analyze-btn');
    const editor = document.getElementById('thesis-editor');

    if (!analyzeBtn || !editor) return;

    analyzeBtn.addEventListener('click', async () => {
      const text = editor.innerText.trim();
      if (!text || text.length < 50) {
        this.addChatMessage('Por favor, escribe al menos 50 caracteres para analizar.', false);
        return;
      }

      analyzeBtn.disabled = true;
      analyzeBtn.innerHTML = '<span class="material-icons">hourglass_empty</span> 3 Agentes analizando...';

      // === CARGAR BIBLIOGRAFÍA ===
      const bibliografia = JSON.parse(localStorage.getItem('bibliografia') || '[]');
      const bibCitas = bibliografia.map(b => `(${b.autor.split(',')[0].trim()}, ${b.año})`).join(', ');

      // 1. AGENTE ESTRUCTURA
      this.addChatMessage('**Agente Estructura** activado...', false);
      const estructura = await this.generateChatResponse(
        `Eres experto en estructura de tesis UPAO. Verifica si hay introducción, objetivos, justificación. Da 2 sugerencias concretas. Texto: "${text}"`
      );
      this.addChatMessage(estructura, false);

      // 2. AGENTE REDACCIÓN
      this.addChatMessage('**Agente Redacción** activado...', false);
      const redaccion = await this.generateChatResponse(
        `Corrige gramática, estilo y claridad. Da 2 correcciones específicas. Texto: "${text}"`
      );
      this.addChatMessage(redaccion, false);

      // 3. AGENTE CITAS (INTEGRADO)
      this.addChatMessage('**Agente Citas** activado...', false);
      const citasPrompt = `
        Eres experto en APA. Analiza el texto y:
        1. Extrae todas las citas en formato (Autor, Año)
        2. Compara con estas referencias guardadas: ${bibCitas || 'Ninguna'}
        3. Di cuáles faltan en bibliografía
        4. Da 2 sugerencias de mejora
        Texto: "${text}"
      `;
      const citas = await this.generateChatResponse(citasPrompt);
      this.addChatMessage(citas, false);

      // Final
      this.addChatMessage('**Análisis completo.** ¿Quieres que profundice en algo?', false);
      analyzeBtn.disabled = false;
      analyzeBtn.innerHTML = '<span class="material-icons">smart_toy</span> Analizar con 3 Agentes IA';
    });
  }

  // NUEVO: Añadir mensaje con Markdown (ESPERA A marked)
  static addChatMessage(text, isUser = false) {
    const chatContainer = document.querySelector('.flex-1.space-y-4');
    if (!chatContainer) return;

    const bubble = document.createElement('div');
    bubble.className = `p-3 rounded-lg max-w-xs ${isUser ? 'bg-primary text-white ml-auto' : 'bg-[var(--secondary)]'} prose prose-sm dark:prose-invert max-w-none`;

    // ESPERAR A QUE marked ESTÉ LISTO
    const renderMarkdown = () => {
      if (window.markedReady && typeof marked !== 'undefined') {
        bubble.innerHTML = marked.parse(text);
      } else {
        // Si marked no está listo, usar fallback simple
        const simple = text
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/^- (.*)$/gm, '<li>$1</li>')
          .replace(/^(\d+)\. (.*)$/gm, '<li>$2</li>')
          .replace(/(<li>.*<\/li>)/s, '<ul class="list-disc ml-4">$1</ul>')
          .replace(/\n/g, '<br>');
        bubble.innerHTML = simple;
      }
      chatContainer.appendChild(bubble);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    };

    // Si ya está listo, renderizar
    if (window.markedReady) {
      renderMarkdown();
    } else {
      // Si no, esperar
      const check = setInterval(() => {
        if (window.markedReady) {
          clearInterval(check);
          renderMarkdown();
        }
      }, 50);
    }
  }
  // NUEVO: Convertir Markdown simple a HTML
  static markdownToHtml(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // **negrita**
      .replace(/\*(.*?)\*/g, '<em>$1</em>')              // *cursiva*
      .replace(/^- (.*)$/gm, '<li class="ml-4">$1</li>') // - lista
      .replace(/^\d+\. (.*)$/gm, '<li class="ml-4 list-decimal">$1</li>') // 1. lista
      .replace(/<li>.*<\/li>/gs, '<ul class="list-disc space-y-1">$&</ul>') // envolver listas
      .replace(/\n/g, '<br>');
  }

  // NUEVO: Guardar documento automáticamente
  static initAutoSave() {
    const editor = document.getElementById('thesis-editor');
    const chatContainer = document.querySelector('.flex-1.space-y-4');

    if (!editor || !chatContainer) return;

    // Cargar al inicio
    const savedDoc = localStorage.getItem('thesis-document');
    const savedChat = localStorage.getItem('thesis-chat');
    if (savedDoc) editor.innerHTML = savedDoc;
    if (savedChat) chatContainer.innerHTML = savedChat;

    // Guardar cada 3 segundos
    setInterval(() => {
      localStorage.setItem('thesis-document', editor.innerHTML);
      localStorage.setItem('thesis-chat', chatContainer.innerHTML);
    }, 3000);

    // Guardar al cerrar
    window.addEventListener('beforeunload', () => {
      localStorage.setItem('thesis-document', editor.innerHTML);
      localStorage.setItem('thesis-chat', chatContainer.innerHTML);
    });
  }
  // NUEVO: Subir y leer .docx
  static initDocxUpload() {
    const uploadInput = document.getElementById('docx-upload');
    const editor = document.getElementById('thesis-editor');

    if (!uploadInput || !editor) return;

    uploadInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      // Mostrar nombre del documento
      document.getElementById('doc-name').value = file.name;
      if (!file) return;

      // Mostrar "Cargando..."
      const analyzeBtn = document.getElementById('analyze-btn');
      analyzeBtn.disabled = true;
      analyzeBtn.innerHTML = '<span class="material-icons">hourglass_empty</span> Cargando...';

      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const html = result.value;

        // Insertar en el editor
        editor.innerHTML = html;
        this.addChatMessage(`Documento cargado: "${file.name}"`, false);

        // Analizar automáticamente
        setTimeout(() => {
          document.getElementById('analyze-btn').click();
        }, 500);

      } catch (error) {
        console.error('Error al leer .docx:', error);
        this.addChatMessage('Error: No se pudo leer el archivo. Asegúrate de que sea .docx válido.', false);
      } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<span class="material-icons">auto_awesome</span> Analizar con IA';
      }
    });
  }

  // NUEVO: Limpiar chat y editor
  static initNewChat() {
    const newChatBtn = document.getElementById('new-chat-btn');
    const editor = document.getElementById('thesis-editor');
    const chatContainer = document.querySelector('.flex-1.space-y-4');
    const docName = document.getElementById('doc-name');

    if (!newChatBtn || !editor || !chatContainer || !docName) return;

    newChatBtn.addEventListener('click', () => {
      if (confirm('¿Iniciar un nuevo chat? Se borrará el contenido actual.')) {
        editor.innerHTML = '<p>Escribe aquí el contenido de tu tesis...</p>';
        chatContainer.innerHTML = '';
        docName.value = 'Ningún documento';
        localStorage.removeItem('thesis-document');
        localStorage.removeItem('thesis-chat');
        this.addChatMessage('Nuevo chat iniciado. ¿En qué puedo ayudarte?', false);
      }
    });
  }

    // NUEVO: Cargar bibliografía al inicio
  static initBibliography() {
    if (document.body.dataset.page !== 'bibliografia') return;

    const list = document.getElementById('references-list');
    const saved = JSON.parse(localStorage.getItem('bibliografia') || '[]');
    this.renderReferences(saved, list);

    document.getElementById('add-citation').addEventListener('click', () => {
      const raw = document.getElementById('raw-citation').value.trim();
      if (!raw) return;

      const parsed = this.parseAPACitation(raw);
      if (!parsed) {
        alert('Formato APA no válido. Ej: García, J. (2023). Título. Editorial.');
        return;
      }

      const refs = JSON.parse(localStorage.getItem('bibliografia') || '[]');
      refs.push(parsed);
      localStorage.setItem('bibliografia', JSON.stringify(refs));
      this.renderReferences(refs, list);
      document.getElementById('raw-citation').value = '';
    });
  }

  // NUEVO: Parsear cita APA
  static parseAPACitation(text) {
    const regex = /^([^,]+),\s*([^\(]+)\s*\((\d{4})\)\.\s*(.+?)\.\s*(.+)$/;
    const match = text.match(regex);
    if (!match) return null;
    return { autor: match[1].trim(), inicial: match[2].trim(), año: match[3], titulo: match[4].trim(), editorial: match[5].trim() };
  }

  // NUEVO: Renderizar lista
  static renderReferences(refs, container) {
    container.innerHTML = refs.length === 0
      ? '<p class="text-[var(--secondary-text)]">No hay referencias aún.</p>'
      : refs.map(r => `<div class="p-3 bg-[var(--background)] rounded border border-[var(--secondary)]">
          <strong>${r.autor}, ${r.inicial}. (${r.año}).</strong> <em>${r.titulo}</em>. ${r.editorial}.
        </div>`).join('');
  }

    // NUEVO: Generar Informe PDF
  static initPDFGeneration() {
    const pdfBtn = document.getElementById('generate-pdf');
    if (!pdfBtn) return;

    pdfBtn.addEventListener('click', async () => {
      pdfBtn.disabled = true;
      pdfBtn.innerHTML = '<span class="material-icons">hourglass_empty</span> Generando...';

      // === RECOPILAR DATOS ===
      const editor = document.getElementById('thesis-editor');
      const docText = editor.innerText;
      const docName = document.getElementById('doc-name').value;
      const bibliografia = JSON.parse(localStorage.getItem('bibliografia') || '[]');

      // === CREAR CONTENIDO HTML PARA PDF ===
      const reportHTML = `
        <div style="font-family: Arial, sans-serif; padding: 2rem; color: #000;">
          <h1 style="text-align: center; color: #1e40af;">Informe de Tesis - Asesor IA UPAO</h1>
          <hr style="margin: 1rem 0;">
          <h2>📄 Documento: ${docName}</h2>
          <p><strong>Palabras:</strong> ${docText.split(' ').length}</p>
          <h3>📝 Contenido Actual</h3>
          <div style="background: #f3f4f6; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
            ${docText.replace(/\n/g, '<br>')}
          </div>

          <h3>🤖 Análisis de los 3 Agentes IA</h3>
          <div style="margin: 1rem 0;">
            <h4>🧱 Agente Estructura</h4>
            <p><em>Verifica introducción, objetivos, justificación...</em></p>
            <h4>✍️ Agente Redacción</h4>
            <p><em>Corrige gramática, estilo y coherencia...</em></p>
            <h4>📚 Agente Citas</h4>
            <p><em>Verifica formato APA y coincidencias con bibliografía...</em></p>
          </div>

          <h3>📖 Bibliografía (${bibliografia.length} referencias)</h3>
          <ul style="list-style: disc; padding-left: 1.5rem;">
            ${bibliografia.map(b => `<li><strong>${b.autor}, ${b.inicial}. (${b.año}).</strong> <em>${b.titulo}</em>. ${b.editorial}.</li>`).join('')}
          </ul>

          <footer style="margin-top: 3rem; text-align: center; color: #666; font-size: 0.8rem;">
            Generado por <strong>Asesor Virtual de Tesis UPAO</strong> | ${new Date().toLocaleDateString('es-PE')}
          </footer>
        </div>
      `;

      // === GENERAR PDF ===
      const element = document.createElement('div');
      element.innerHTML = reportHTML;
      document.body.appendChild(element);

      const opt = {
        margin: 1,
        filename: `Informe_Tesis_${docName.replace(/[^a-z0-9]/gi, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'cm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(element).save();
      document.body.removeChild(element);

      pdfBtn.disabled = false;
      pdfBtn.innerHTML = '<span class="material-icons">picture_as_pdf</span> Generar Informe PDF';
      this.addChatMessage('**Informe PDF generado y descargado.**', false);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => App.init());