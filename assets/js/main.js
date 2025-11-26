// assets/js/main.js
import { supabase } from './supabaseClient.js'

class App {
  static async init() { // Añadir async aquí
    // Si es login, solo inicializar login
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
      this.initLogin();
      return;
    }

    if (!(await this.checkAuth())) { // Añadir await
      window.location.href = 'index.html';
      return;
    }
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
        this.initSidebarToggle();
        this.initLogout();
        this.updateUserInfo();
      })
      .catch(err => console.error('Error loading sidebar:', err));
  }

  // Inicializar botón de logout
  static initLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout());
    }
  }

  // Actualizar información del usuario en el sidebar
  static async updateUserInfo() {
    const { data: { user } } = await supabase.auth.getUser();

    if (user && user.email) {
      const email = user.email;
      const initial = email.charAt(0).toUpperCase();

      const emailEl = document.getElementById('user-email');
      const initialEl = document.getElementById('user-initial');

      if (emailEl) emailEl.textContent = email;
      if (initialEl) initialEl.textContent = initial;
    }
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

  static initSidebarToggle() {
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar-container');
    if (!toggleBtn || !sidebar) return;

    const icon = toggleBtn.querySelector('.material-icons');
    const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';

    if (isCollapsed) {
      sidebar.classList.add('collapsed');
      if (icon) icon.textContent = 'menu';
    }

    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      const collapsed = sidebar.classList.contains('collapsed');
      localStorage.setItem('sidebar-collapsed', collapsed);
      if (icon) icon.textContent = collapsed ? 'menu' : 'menu_open';
    });
  }

  // VERSIÓN 100% ESTABLE: Funciona con gemini-2.5-flash


  // VERSIÓN 100% ESTABLE: Funciona con gemini-2.5-flash
  static async generateChatResponse(query, context = '') {
    const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("PEGA")) {
      return 'Error: Configura VITE_GEMINI_API_KEY en .env';
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
  // INICIAR EL CHAT con selección de agente
  static initChat() {
    const checkElements = setInterval(() => {
      const sendButton = document.getElementById('chat-send-btn');
      const input = document.getElementById('chat-input');
      const agentSelector = document.getElementById('agent-selector');
      const chatContainer = document.querySelector('.flex-1.space-y-4');

      if (sendButton && input && chatContainer && agentSelector) {
        clearInterval(checkElements);
        const handleSend = async () => {
          const query = input.value.trim();
          if (!query) return;

          const selectedAgent = agentSelector.value;

          // Mostrar mensaje del usuario
          this.addChatMessage(query, true);
          input.value = '';

          // Mostrar indicador de carga
          this.addChatMessage('⏳ Consultando...', false);

          try {
            let reply;

            if (selectedAgent === 'gemini') {
              // Usar Gemini para consultas generales
              reply = await this.generateChatResponse(query);
            } else {
              // Usar agente especializado de Langflow
              const editor = document.getElementById('thesis-editor');
              const context = editor ? editor.innerText.substring(0, 5000) : '';
              reply = await this.callLangflowAgent(selectedAgent, query, context);
            }

            // Reemplazar mensaje de carga con la respuesta
            const chatMessages = chatContainer.querySelectorAll('div');
            const loadingMsg = chatMessages[chatMessages.length - 1];
            chatContainer.removeChild(loadingMsg);
            this.addChatMessage(reply, false);

            // Si es el agente de citas, extraer referencias
            if (selectedAgent === 'citas') {
              this.extractAgentCitations(reply);
            }

          } catch (error) {
            const chatMessages = chatContainer.querySelectorAll('div');
            const loadingMsg = chatMessages[chatMessages.length - 1];
            chatContainer.removeChild(loadingMsg);
            this.addChatMessage(`❌ Error: ${error.message}`, false);
          }
        };

        sendButton.addEventListener('click', handleSend);
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') handleSend();
        });
      }
    }, 100);
  }

  // NUEVO: Llamar a agentes específicos de Langflow
  static async callLangflowAgent(agentType, query, context = '') {
    const API_KEY = import.meta.env.VITE_LANGFLOW_API_KEY;

    const AGENT_URLS = {
      estructura: "http://localhost:7860/api/v1/run/6e2da7d9-13d0-40eb-b4f1-b605de6d0253",
      redaccion: "http://localhost:7860/api/v1/run/7514afd6-fef8-4fb9-82e2-431f818217d4",
      citas: "http://localhost:7860/api/v1/run/6c816e03-1803-40a5-a7fe-03078cec9aa9"
    };

    const url = AGENT_URLS[agentType];
    if (!url) throw new Error(`Agente desconocido: ${agentType}`);

    // Construir prompt con contexto si está disponible
    const fullPrompt = context.trim()
      ? `Contexto del documento:\n${context}\n\nConsulta: ${query}`
      : query;

    console.log('🔍 Enviando a Langflow (NUEVO FORMATO):');
    console.log('URL:', url);
    console.log('Prompt:', fullPrompt);

    // NUEVO FORMATO: Enviar directamente el input_value
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        input_value: fullPrompt,
        output_type: "chat",
        input_type: "chat",
        tweaks: {}
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Error ${response.status}: ${err.substring(0, 200)}`);
    }

    const data = await response.json();
    console.log('📥 Respuesta de Langflow:', JSON.stringify(data, null, 2));

    // Buscar texto en las rutas posibles de Langflow
    const paths = [
      data?.outputs?.[0]?.outputs?.[0]?.results?.message?.text,
      data?.outputs?.[0]?.outputs?.[0]?.messages?.[0]?.message,
      data?.outputs?.[0]?.outputs?.[0]?.text,
      data?.result?.outputs?.[0]?.results?.message?.text,
      data?.result?.outputs?.[0]?.results?.message?.data?.text,
      data?.outputs?.[0]?.results?.message?.text,
      data?.message?.text,
      data?.text,
    ];

    for (const text of paths) {
      if (text && typeof text === "string" && text.trim().length > 10) {

        // === NUEVO: Detectar error de búsqueda ===
        if (text.includes("Error running graph") || text.includes("Name cannot be empty")) {
          return "⚠️ Lo siento, en este momento no puedo acceder a los motores de búsqueda para verificar las citas. Por favor intenta más tarde.";
        }
        // ========================================
        return text.trim();
      }
    }
    console.warn(`No se encontró texto en la respuesta de ${agentType}:`, data);
    throw new Error("El agente respondió, pero no se pudo extraer el texto.");
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
      const bibContext = bibliografia.length > 0
        ? `BIBLIOGRAFÍA GUARDADA:\n${bibliografia.map(b => `- ${b.autor} (${b.año}). ${b.titulo}`).join('\n')}`
        : 'No hay referencias guardadas en la bibliografía';

      // 1. AGENTE ESTRUCTURA (igual que chat manual)
      this.addChatMessage('**Agente Estructura** activado...', false);
      const estructura = await this.callLangflowAgent('estructura', text);
      this.addCollapsibleMessage('Análisis de Estructura', estructura, '📊');

      // 2. AGENTE REDACCIÓN (igual que chat manual)
      this.addChatMessage('**Agente Redacción** activado...', false);
      const redaccion = await this.callLangflowAgent('redaccion', text);
      this.addCollapsibleMessage('Análisis de Redacción', redaccion, '✍️');

      // 3. AGENTE CITAS (igual que chat manual, con contexto de bibliografía)
      this.addChatMessage('**Agente Citas** activado...', false);
      const citas = await this.callLangflowAgent('citas', text, bibContext);
      this.addCollapsibleMessage('Análisis de Citas', citas, '📚');

      // Final
      this.addChatMessage('**Análisis completo.** si quieres que profundice en algo, selecciona el agente correspondiente.', false);
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

  // Añadir mensaje colapsable al chat
  static addCollapsibleMessage(title, content, icon = '📊') {
    const chatContainer = document.querySelector('.flex-1.space-y-4');
    if (!chatContainer) return;

    const accordionId = `accordion-${Date.now()}`;

    const bubble = document.createElement('div');
    bubble.className = 'bg-gray-100 dark:bg-gray-800 rounded-xl p-0 shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden';

    bubble.innerHTML = `
      <button 
        onclick="document.getElementById('${accordionId}').classList.toggle('hidden'); this.querySelector('.toggle-icon').classList.toggle('rotate-180')"
        class="w-full flex items-center justify-between p-4 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <div class="flex items-center gap-2 font-semibold text-gray-800 dark:text-white">
          <span>${icon}</span>
          <span>${title}</span>
        </div>
        <span class="material-icons toggle-icon transition-transform">expand_more</span>
      </button>
      <div id="${accordionId}" class="hidden p-4 pt-0 prose dark:prose-invert max-w-none">
        ${marked.parse(content)}
      </div>
    `;

    chatContainer.appendChild(bubble);
    chatContainer.scrollTop = chatContainer.scrollHeight;
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

  // NUEVO: Guardar documento automáticamente en Supabase
  static async initAutoSave() {
    const editor = document.getElementById('thesis-editor');
    const chatContainer = document.querySelector('.flex-1.space-y-4');
    const docNameInput = document.getElementById('doc-name'); // <--- Referencia al input de nombre
    if (!editor || !chatContainer) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Cargar al inicio desde Supabase
    const { data: doc } = await supabase
      .from('documents')
      .select('content, title') // <--- Pedir también el título
      .eq('user_id', user.id)
      .single();
    if (doc) {
      if (doc.content) editor.innerHTML = doc.content;
      if (doc.title && docNameInput) docNameInput.value = doc.title; // <--- Restaurar título
    }
    // Cargar historial de chat (localStorage)
    const savedChat = localStorage.getItem('thesis-chat');
    if (savedChat) chatContainer.innerHTML = savedChat;
    // Guardar cada 3 segundos (debounce)
    let timeout;

    // Función de guardado
    const saveToSupabase = async () => {
      console.log('💾 Guardando en Supabase...');
      const currentTitle = docNameInput ? docNameInput.value : 'Sin título';

      await supabase
        .from('documents')
        .upsert({
          user_id: user.id,
          content: editor.innerHTML,
          title: currentTitle, // <--- Guardar título
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
    };
    editor.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(saveToSupabase, 3000);
    });

    // Escuchar cambios en el título también
    if (docNameInput) {
      docNameInput.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(saveToSupabase, 3000);
      });
    }
    // Guardar chat en localStorage
    setInterval(() => {
      localStorage.setItem('thesis-chat', chatContainer.innerHTML);
    }, 3000);
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
        // NUEVO: Extraer y guardar citas
        this.extractAndSaveCitations(html);
        this.addChatMessage(`Documento cargado: "${file.name}"`, false);

        editor.dispatchEvent(new Event('input'));

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

        // NUEVO: Marcar todas las referencias como "sin usar"
        const bibliografia = JSON.parse(localStorage.getItem('bibliografia') || '[]');
        bibliografia.forEach(ref => ref.inDocument = false);
        localStorage.setItem('bibliografia', JSON.stringify(bibliografia));
        console.log('📚 Referencias marcadas como "sin usar"');

        this.addChatMessage('Nuevo chat iniciado. ¿En qué puedo ayudarte?', false);
      }
    });
  }

  // NUEVO: Cargar bibliografía al inicio
  static async initBibliography() { // Añadir async
    console.log('📚 initBibliography ejecutándose');
    if (document.body.dataset.page !== 'bibliografia') return;

    const usedList = document.getElementById('used-references-list');
    const unusedList = document.getElementById('unused-references-list');

    // Cargar desde Supabase
    const { data: saved, error } = await supabase
      .from('references')
      .select('*');

    if (error) {
      console.error('Error cargando bibliografía:', error);
      return;
    }

    // Separate references
    const usedRefs = saved.filter(ref => ref.in_document); // Nota: in_document (snake_case)
    const unusedRefs = saved.filter(ref => !ref.in_document);

    // Render both lists
    this.renderReferences(usedRefs, usedList, true);
    this.renderReferences(unusedRefs, unusedList, false);

    // Botón de exportar
    const exportBtn = document.getElementById('export-bibliography-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportBibliography());
    }

    document.getElementById('add-citation').addEventListener('click', () => {
      const text = document.getElementById('citation-text').value;
      if (text) {
        const ref = this.parseAPACitation(text);
        if (ref) {
          this.addReference(ref); // addReference también será async
          document.getElementById('citation-text').value = '';
        }
      }
    });

    // El listener de 'storage' ya no es necesario con Supabase realtime, 
    // pero por ahora lo podemos quitar o dejar comentado.
  }

  // Añadir referencia a Supabase
  static async addReference(ref) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('references')
      .insert([{
        user_id: user.id,
        author: ref.autor,
        year: ref.año,
        title: ref.titulo,
        source: ref.revista,
        doi_link: ref.doi,
        in_document: ref.inDocument || false,
        from_agent: ref.fromAgent || false
      }]);

    if (error) {
      console.error('Error guardando referencia:', error);
    } else {
      // Recargar lista
      this.initBibliography();
    }
  }

  // NUEVO: Parsear cita APA
  static parseAPACitation(text) {
    const regex = /^([^,]+),\s*([^\(]+)\s*\((\d{4})\)\.\s*(.+?)\.\s*(.+)$/;
    const match = text.match(regex);

    // Si no coincide con el formato estricto, crear objeto básico
    const autorMatch = text.match(/^([^(]+)/);
    const añoMatch = text.match(/\((\d{4})\)/);

    return {
      id: Date.now().toString(),
      autor: match ? match[1].trim() : (autorMatch ? autorMatch[1].trim() : 'Autor desconocido'),
      inicial: match ? match[2].trim() : '',
      año: match ? match[3] : (añoMatch ? añoMatch[1] : new Date().getFullYear().toString()),
      titulo: match ? match[4].trim() : text,
      editorial: match ? match[5].trim() : '',
      revista: '',
      doi: '',
      inDocument: false,    // Por defecto no está en documento
      fromAgent: false,     // Por defecto no es del agente
      dateAdded: new Date().toISOString()
    };
  }

  // Eliminar referencia
  static async deleteReference(id) {
    const { error } = await supabase
      .from('references')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando referencia:', error);
    } else {
      this.initBibliography();
    }
  }

  static async extractAndSaveCitations(htmlContent) { // Añadir async
    const text = htmlContent.replace(/<[^>]*>/g, ' ');
    console.log('🔍 Extrayendo citas y referencias del documento');

    const allReferences = new Map();

    // 1. BUSCAR REFERENCIAS BIBLIOGRÁFICAS COMPLETAS
    const fullRefPattern = /([A-ZÁ-Ú][a-zá-ú]+(?:\s+[A-ZÁ-Ú][a-zá-ú]+)*(?:,\s+[A-Z]\.)*(?:,?\s+(?:y|&)\s+[A-ZÁ-Ú][a-zá-ú]+(?:,\s+[A-Z]\.)*)*)\s*\((\d{4})\)\.\s*([^.]+)\.\s*([^.]*)/g;

    let match;
    while ((match = fullRefPattern.exec(text)) !== null) {
      const autores = match[1].trim();
      const año = match[2];
      const titulo = match[3].trim();
      const revista = match[4].trim();
      const primerAutor = autores.split(',')[0].trim();
      const key = `${primerAutor}-${año}`;

      if (!allReferences.has(key)) {
        allReferences.set(key, {
          autor: autores,
          año: año,
          titulo: titulo,
          revista: revista,
          doi: '',
          inDocument: true,
          fromAgent: false
        });
      }
    }

    // 2. BUSCAR CITAS EN EL TEXTO
    const inTextPattern = /\(([A-ZÁ-Ú][a-zá-ú]+(?:\s+et al\.)?),?\s*(\d{4})\)/g;

    while ((match = inTextPattern.exec(text)) !== null) {
      const autor = match[1].trim();
      const año = match[2];
      const key = `${autor}-${año}`;

      if (!allReferences.has(key)) {
        allReferences.set(key, {
          autor: autor,
          año: año,
          titulo: 'Cita extraída del texto (sin referencia completa)',
          revista: '',
          doi: '',
          inDocument: true,
          fromAgent: false
        });
      }
    }

    if (allReferences.size === 0) {
      console.log('❌ No se encontraron citas ni referencias');
      return;
    }

    // 3. GUARDAR EN SUPABASE
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Obtener referencias existentes para evitar duplicados
    const { data: saved } = await supabase.from('references').select('*');
    let newCount = 0;

    for (const [key, newRef] of allReferences) {
      // Verificar si ya existe (por autor y año)
      const existing = saved.find(ref =>
        ref.author.includes(newRef.autor.split(',')[0]) && ref.year === newRef.año
      );

      if (!existing) {
        // Insertar nueva
        await supabase.from('references').insert([{
          user_id: user.id,
          author: newRef.autor,
          year: newRef.año,
          title: newRef.titulo,
          source: newRef.revista,
          doi_link: newRef.doi,
          in_document: true,
          from_agent: false
        }]);
        newCount++;
      } else {
        // Actualizar existente a in_document = true si no lo estaba
        if (!existing.in_document) {
          await supabase
            .from('references')
            .update({ in_document: true })
            .eq('id', existing.id);
        }
      }
    }

    console.log(`✅ ${allReferences.size} referencias encontradas, ${newCount} nuevas agregadas`);
  }

  // Extraer referencias sugeridas por el agente de Citas
  static async extractAgentCitations(agentResponse) { // Añadir async
    console.log('🤖 Extrayendo sugerencias del agente de Citas');

    const references = [];

    // Buscar tablas markdown
    const tableRowPattern = /\|\s*\d+\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]*)\s*\|/g;

    let match;
    while ((match = tableRowPattern.exec(agentResponse)) !== null) {
      const autoresYear = match[1].trim();
      const titulo = match[2].trim();
      const revista = match[3].trim();
      const doi = match[4].trim();

      const authorYearMatch = autoresYear.match(/([^(]+)\((\d{4})\)/);
      if (authorYearMatch) {
        references.push({
          autor: authorYearMatch[1].trim(),
          año: authorYearMatch[2],
          titulo: titulo,
          revista: revista,
          doi: doi,
          inDocument: false,
          fromAgent: true
        });
      }
    }

    // Buscar referencias en formato de lista
    const listPattern = /([A-ZÁ-Ú][a-zá-ú]+(?:\s+[A-ZÁ-Ú][a-zá-ú]+)*(?:,\s+[A-Z]\.)*(?:,?\s+&\s+[A-ZÁ-Ú][a-zá-ú]+)*)\s*\((\d{4})\)\s*([^.]+)\.\s*([^.]*)/g;

    while ((match = listPattern.exec(agentResponse)) !== null) {
      const autor = match[1].trim();
      const año = match[2];
      const titulo = match[3].trim();
      const revista = match[4].trim();

      const exists = references.some(r => r.autor === autor && r.año === año);
      if (!exists) {
        references.push({
          autor: autor,
          año: año,
          titulo: titulo,
          revista: revista,
          doi: '',
          inDocument: false,
          fromAgent: true
        });
      }
    }

    if (references.length === 0) {
      console.log('No se encontraron referencias en la respuesta del agente');
      return;
    }

    // GUARDAR EN SUPABASE
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: saved } = await supabase.from('references').select('*');
    let newCount = 0;

    for (const newRef of references) {
      const exists = saved.some(ref =>
        ref.author.includes(newRef.autor.split(',')[0]) && ref.year === newRef.año
      );

      if (!exists) {
        await supabase.from('references').insert([{
          user_id: user.id,
          author: newRef.autor,
          year: newRef.año,
          title: newRef.titulo,
          source: newRef.revista,
          doi_link: newRef.doi,
          in_document: false,
          from_agent: true
        }]);
        newCount++;
      }
    }

    console.log(`✅ ${references.length} referencias del agente, ${newCount} nuevas agregadas`);
  }

  // Exportar bibliografía en formato APA
  static exportBibliography() {
    const saved = JSON.parse(localStorage.getItem('bibliografia') || '[]');

    if (saved.length === 0) {
      alert('No hay referencias para exportar');
      return;
    }

    // Generar texto en formato APA
    let apaText = '═══════════════════════════════════════════════════\n';
    apaText += '       BIBLIOGRAFÍA EN FORMATO APA 7\n';
    apaText += '       Generado por Asesor Tesis UPAO\n';
    apaText += '       Fecha: ' + new Date().toLocaleDateString('es-PE') + '\n';
    apaText += '═══════════════════════════════════════════════════\n\n';

    // Ordenar por autor
    const sorted = saved.sort((a, b) => a.autor.localeCompare(b.autor));

    sorted.forEach((ref, index) => {
      apaText += `${index + 1}. ${ref.autor} (${ref.año}). ${ref.titulo}.`;
      if (ref.revista) apaText += ` ${ref.revista}.`;
      if (ref.doi) apaText += ` ${ref.doi}`;
      apaText += '\n\n';
    });

    apaText += '\n═══════════════════════════════════════════════════\n';
    apaText += `Total de referencias: ${saved.length}\n`;
    apaText += `Referencias usadas en documento: ${saved.filter(r => r.inDocument).length}\n`;
    apaText += `Referencias sugeridas por agente: ${saved.filter(r => r.fromAgent).length}\n`;

    // Crear y descargar archivo
    const blob = new Blob([apaText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bibliografia_APA_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

  }

  // Inicializar login
  static initLogin() {
    const form = document.getElementById('login-form');
    const errorDiv = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    const successDiv = document.getElementById('success-message');
    const successText = document.getElementById('success-text');
    const toggleBtn = document.getElementById('toggle-auth');
    const toggleText = document.getElementById('toggle-text');
    const submitBtnText = document.getElementById('submit-text');
    const confirmPassContainer = document.getElementById('confirm-password-container');

    // === NUEVOS ELEMENTOS ===
    const formTitle = document.getElementById('form-title');
    const rememberMeContainer = document.getElementById('remember-me-container');
    if (!form) return;
    let isRegistering = false;
    // Toggle entre Login y Registro
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isRegistering = !isRegistering;
        if (isRegistering) {
          // MODO REGISTRO
          confirmPassContainer.classList.remove('hidden');
          if (formTitle) formTitle.textContent = 'Crear Cuenta'; // Cambiar título
          if (rememberMeContainer) rememberMeContainer.classList.add('hidden'); // Ocultar Recordarme

          submitBtnText.textContent = 'Registrarse';
          toggleText.textContent = '¿Ya tienes cuenta?';
          toggleBtn.textContent = 'Inicia sesión aquí';
          document.getElementById('confirm-password').required = true;
        } else {
          // MODO LOGIN
          confirmPassContainer.classList.add('hidden');
          if (formTitle) formTitle.textContent = 'Iniciar Sesión'; // Restaurar título
          if (rememberMeContainer) rememberMeContainer.classList.remove('hidden'); // Mostrar Recordarme
          submitBtnText.textContent = 'Iniciar Sesión';
          toggleText.textContent = '¿No tienes cuenta?';
          toggleBtn.textContent = 'Regístrate aquí';
          document.getElementById('confirm-password').required = false;
        }
        errorDiv.classList.add('hidden');
        successDiv.classList.add('hidden');
      });
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorDiv.classList.add('hidden');
      successDiv.classList.add('hidden');
      const email = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      if (isRegistering) {
        const confirmPass = document.getElementById('confirm-password').value;

        // === VALIDACIÓN DE CONTRASEÑA SEGURA ===
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d|.*[\W_]).{8,}$/;
        if (!passwordRegex.test(password)) {
          errorDiv.classList.remove('hidden');
          errorText.textContent = 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un carácter especial.';
          return;
        }
        if (password !== confirmPass) {
          errorDiv.classList.remove('hidden');
          errorText.textContent = 'Las contraseñas no coinciden';
          return;
        }
        if (await this.handleRegister(email, password)) {
          successDiv.classList.remove('hidden');
          successText.textContent = 'Registro exitoso. Revisa tu correo para confirmar (o inicia sesión si el auto-confirm está activo).';

          setTimeout(() => {
            isRegistering = false;
            toggleBtn.click(); // Volver a modo login
          }, 2000);
        } else {
          errorDiv.classList.remove('hidden');
          errorText.textContent = 'Error al registrarse. Intenta con otro correo.';
        }
      } else {
        // LOGIN
        if (await this.handleLogin(email, password)) {
          window.location.href = 'revision.html';
        } else {
          errorDiv.classList.remove('hidden');
          errorText.textContent = 'Usuario o contraseña incorrectos';
        }
      }
    });
  }

  // Validar credenciales (Login)
  static async handleLogin(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
    if (error) {
      console.error('Error login:', error.message);
      return false;
    }
    return true;
  }
  // Registrar usuario
  static async handleRegister(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });
    if (error) {
      console.error('Error registro:', error.message);
      return false;
    }

    console.log('✅ Registro exitoso:', data);
    return true;
  }
  // Verificar si el usuario está autenticado
  static async checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  }

  // Cerrar sesión
  static logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    localStorage.removeItem('loginTime');
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('loginTime');

    console.log('✅ Sesión cerrada');
    window.location.href = 'index.html';
  }

  // NUEVO: Renderizar lista
  static renderReferences(refs, container, isUsed) {
    if (refs.length === 0) {
      const emptyMessage = isUsed
        ? 'No hay referencias usadas en el documento actual.'
        : 'No hay referencias guardadas.';
      container.innerHTML = `<p class="text-[var(--text-secondary)] text-sm italic">${emptyMessage}</p>`;
      return;
    }

    container.innerHTML = refs.map((ref) => `
        <div class="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4 flex justify-between items-start shadow-sm hover:shadow-md transition-shadow">
          <div class="flex-1">
            <h4 class="font-bold text-[var(--text)]">${ref.author} (${ref.year})</h4>
            <p class="text-sm text-[var(--text)] mt-1 italic">${ref.title}</p>
            ${ref.source ? `<p class="text-xs text-[var(--text-secondary)] mt-1">${ref.source}</p>` : ''}
            ${ref.doi_link ? `<p class="text-xs text-[var(--text-secondary)] mt-1">${ref.doi_link}</p>` : ''}
            ${ref.from_agent ? `<span class="inline-block mt-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded">Sugerido por agente</span>` : ''}
          </div>
          <button data-delete-id="${ref.id}" class="delete-ref-btn ml-4 text-red-500 hover:text-red-700 transition-colors">
            <span class="material-icons text-sm">delete</span>
          </button>
        </div>`).join('');

    // Re-attach event listeners for delete buttons
    container.querySelectorAll('.delete-ref-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.deleteReference(btn.dataset.deleteId);
      });
    });
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