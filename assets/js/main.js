// assets/js/main.js
import { supabase } from './supabaseClient.js'
import sidebarHtml from '../../components/sidebar.html?raw'

class App {
  static async init() { // Añadir async aquí
    // Si es login, mostramos el body inmediatamente
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
      document.body.style.display = 'flex'; // <--- CAMBIAR A 'flex'
      this.initLogin();
      return;
    }

    if (!(await this.checkAuth())) { // Añadir await
      window.location.href = 'index.html';
      return;
    }

    // ¡Autenticado! Ahora sí mostramos la interfaz
    document.body.style.display = 'block';

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
    // Usamos el HTML importado directamente (más rápido y compatible con Vercel)
    const sidebarContainer = document.getElementById('sidebar');
    if (sidebarContainer) {
      sidebarContainer.innerHTML = sidebarHtml;
      this.highlightCurrentPage();
      this.setupThemeToggle();
      this.initSidebarToggle();
      this.initLogout();
      this.updateUserInfo();
    }
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
    // 1. Cargar preferencia guardada al inicio
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // 2. Usar delegación de eventos para el botón (más robusto)
    document.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('[data-theme-toggle]');
      if (toggleBtn) {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');

        // Opcional: Actualizar el estado visual del botón si es necesario
        console.log('Tema cambiado a:', isDark ? 'Oscuro' : 'Claro');
      }
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

          // === NUEVO: Bloquear input y botón ===
          input.disabled = true;
          sendButton.disabled = true;
          sendButton.classList.add('opacity-50', 'cursor-not-allowed');

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
          } finally {
            // <--- AÑADE DESDE AQUÍ
            // === NUEVO: Desbloquear siempre al terminar ===
            input.disabled = false;
            sendButton.disabled = false;
            sendButton.classList.remove('opacity-50', 'cursor-not-allowed');
            input.focus(); // Devolver el foco al input
            // ==============================================
          }
        };

        sendButton.addEventListener('click', handleSend);
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') handleSend();
        });
      }
    }, 100);
  }

  // NUEVO: Llamar a agentes específicos de Langflow (DataStax)
  static async callLangflowAgent(agentType, query, context = '') {
    const API_KEY = import.meta.env.VITE_LANGFLOW_API_KEY;

    // URLs de DataStax Langflow
    const AGENT_URLS = {
      estructura: "https://aws-us-east-2.langflow.datastax.com/lf/710f7bee-1f13-4a71-8fbf-8afad0fec6f6/api/v1/run/3fc4b074-6c2d-411f-b348-e108abe38246",
      redaccion: "https://aws-us-east-2.langflow.datastax.com/lf/710f7bee-1f13-4a71-8fbf-8afad0fec6f6/api/v1/run/f9c76890-dae3-4f88-a051-bc88aae73831",
      citas: "https://aws-us-east-2.langflow.datastax.com/lf/710f7bee-1f13-4a71-8fbf-8afad0fec6f6/api/v1/run/e3c09495-9a47-4370-9379-12215fe7ef48"
    };

    const url = AGENT_URLS[agentType];
    if (!url) throw new Error(`Agente desconocido: ${agentType}`);

    // Construir prompt con contexto si está disponible
    const fullPrompt = context.trim()
      ? `Contexto del documento:\n${context}\n\nConsulta: ${query}`
      : query;

    console.log('🔍 Enviando a Langflow (DataStax):');
    console.log('URL:', url);

    // Enviar solicitud a DataStax
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
        "X-DataStax-Current-Org": "df957b95-374f-4b44-a59a-620c249ebd0c"
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

    // Buscar texto en las rutas posibles de la respuesta
    const paths = [
      data?.outputs?.[0]?.outputs?.[0]?.results?.message?.text,
      data?.outputs?.[0]?.outputs?.[0]?.results?.message?.data?.text,
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
        if (text.includes("Error running graph") || text.includes("Name cannot be empty")) {
          return "⚠️ Lo siento, no puedo verificar las citas en este momento. Intenta más tarde.";
        }
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

      // 1. BLOQUEAR INTERFAZ
      analyzeBtn.disabled = true;
      analyzeBtn.innerHTML = '<span class="material-icons">hourglass_empty</span> 3 Agentes analizando...';
      const chatInput = document.getElementById('chat-input');
      const chatSendBtn = document.getElementById('chat-send-btn');
      if (chatInput) chatInput.disabled = true;
      if (chatSendBtn) {
        chatSendBtn.disabled = true;
        chatSendBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }

      try {
        // === CARGAR BIBLIOGRAFÍA ===
        const bibliografia = JSON.parse(localStorage.getItem('bibliografia') || '[]');
        const bibContext = bibliografia.length > 0
          ? `BIBLIOGRAFÍA GUARDADA:\n${bibliografia.map(b => `- ${b.autor} (${b.año}). ${b.titulo}`).join('\n')}`
          : 'No hay referencias guardadas en la bibliografía';

        // 1. AGENTE ESTRUCTURA
        this.addChatMessage('**Agente Estructura** activado...', false);
        const estructura = await this.callLangflowAgent('estructura', text);
        this.addCollapsibleMessage('Análisis de Estructura', estructura, '📊');

        // 2. AGENTE REDACCIÓN
        this.addChatMessage('**Agente Redacción** activado...', false);
        const redaccion = await this.callLangflowAgent('redaccion', text);
        this.addCollapsibleMessage('Análisis de Redacción', redaccion, '✍️');

        // 3. AGENTE CITAS
        this.addChatMessage('**Agente Citas** activado...', false);
        const citas = await this.callLangflowAgent('citas', text, bibContext);
        this.addCollapsibleMessage('Análisis de Citas', citas, '📚');

        // === NUEVO: Extraer citas sugeridas ===
        await this.extractAgentCitations(citas);

        this.addChatMessage('**Análisis completo.** Selecciona un agente para ver detalles.', false);

      } catch (error) {
        console.error('Error en análisis:', error);
        this.addChatMessage('Ocurrió un error durante el análisis. Por favor intenta de nuevo.', false);
      } finally {
        // 2. DESBLOQUEAR INTERFAZ
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<span class="material-icons">smart_toy</span> Analizar con 3 Agentes IA';
        if (chatInput) {
          chatInput.disabled = false;
          chatInput.focus();
        }
        if (chatSendBtn) {
          chatSendBtn.disabled = false;
          chatSendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
      }
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

  // NUEVO: Mostrar notificación Toast
  static showToast(message, type = 'info') {
    let bg = "#333"; // Default
    if (type === 'success') bg = "linear-gradient(to right, #00b09b, #96c93d)";
    if (type === 'error') bg = "linear-gradient(to right, #ff5f6d, #ffc371)";
    if (type === 'warning') bg = "linear-gradient(to right, #f7b733, #fc4a1a)";
    Toastify({
      text: message,
      duration: 3000,
      close: true,
      gravity: "top", // `top` or `bottom`
      position: "right", // `left`, `center` or `right`
      stopOnFocus: true, // Prevents dismissing of toast on hover
      style: { background: bg },
    }).showToast();
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

  // NUEVO: Guardar documento automáticamente en Supabase (CON CHUNKING)
  static async initAutoSave() {
    let hasUnsavedChanges = false;
    const editor = document.getElementById('thesis-editor');
    const chatContainer = document.querySelector('.flex-1.space-y-4');
    const docNameInput = document.getElementById('doc-name');

    if (!editor || !chatContainer) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // --- PARTE 1: CARGAR (Lectura desde Chunks) ---
    // A. Cargar Título (de tabla documents)
    const { data: doc } = await supabase
      .from('documents')
      .select('title')
      .eq('user_id', user.id)
      .single();

    if (doc?.title && docNameInput) docNameInput.value = doc.title;
    // B. Cargar Contenido (Reconstruir desde document_chunks)
    const { data: chunks } = await supabase
      .from('document_chunks')
      .select('content')
      .eq('user_id', user.id)
      .order('chunk_index', { ascending: true });
    if (chunks && chunks.length > 0) {
      // Unir todos los trocitos para formar el documento completo
      editor.innerHTML = chunks.map(c => c.content).join('');
    }
    // ------------------------------------------------
    // Cargar historial de chat (localStorage)
    const savedChat = localStorage.getItem('thesis-chat');
    if (savedChat) chatContainer.innerHTML = savedChat;
    // Guardar cada 3 segundos (debounce)
    let timeout;
    // --- PARTE 2: GUARDAR (Escritura en Chunks) ---
    const saveToSupabase = async () => {
      this.showToast('Guardando...', 'info');
      const currentTitle = docNameInput ? docNameInput.value : 'Sin título';
      const fullContent = editor.innerHTML;
      // A. Guardar solo metadatos (Título) en tabla principal
      const { error: docError } = await supabase
        .from('documents')
        .upsert({
          user_id: user.id,
          title: currentTitle,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      if (docError) {
        console.error('Error guardando título:', docError);
        return;
      }
      // B. CHUNKING: Dividir y guardar contenido
      // 1. Borrar chunks viejos
      await supabase.from('document_chunks').delete().eq('user_id', user.id);
      // 2. Crear nuevos chunks (4000 caracteres c/u)
      const chunkSize = 4000;
      const chunks = [];
      for (let i = 0; i < fullContent.length; i += chunkSize) {
        chunks.push({
          user_id: user.id,
          chunk_index: i / chunkSize,
          content: fullContent.substring(i, i + chunkSize)
        });
      }
      // 3. Insertar lotes
      const { error: chunkError } = await supabase
        .from('document_chunks')
        .insert(chunks);
      if (chunkError) {
        console.error('Error guardando chunks:', chunkError);
        this.showToast('Error al guardar documento', 'error');
      } else {
        this.showToast('Documento guardado (Chunking activo)', 'success');
        hasUnsavedChanges = false;
      }
    };
    // ------------------------------------------------
    editor.addEventListener('input', () => {
      hasUnsavedChanges = true;
      clearTimeout(timeout);
      timeout = setTimeout(saveToSupabase, 3000);
    });
    if (docNameInput) {
      docNameInput.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(saveToSupabase, 3000);
      });
    }
    setInterval(() => {
      localStorage.setItem('thesis-chat', chatContainer.innerHTML);
    }, 3000);
    // Avisar si intenta cerrar con cambios pendientes
    window.addEventListener('beforeunload', (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Tienes cambios sin guardar. ¿Estás seguro de salir?'; // Estándar para navegadores modernos
      }
    });
  }

  // NUEVO: Subir y leer .docx
  static initDocxUpload() {
    const uploadInput = document.getElementById('docx-upload');
    const editor = document.getElementById('thesis-editor');

    if (!uploadInput || !editor) return;

    uploadInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // 1. Límite más generoso (50MB)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        this.showToast('El archivo supera los 50MB. Intenta comprimirlo.', 'error');
        uploadInput.value = '';
        return;
      }

      document.getElementById('doc-name').value = file.name;
      const analyzeBtn = document.getElementById('analyze-btn');
      analyzeBtn.disabled = true;
      analyzeBtn.innerHTML = '<span class="material-icons">hourglass_empty</span> Procesando tesis...';

      try {
        const arrayBuffer = await file.arrayBuffer();

        // 2. Configuración para ignorar imágenes (Optimización clave)
        const options = {
          convertImage: mammoth.images.imgElement(function (image) {
            return Promise.resolve(null); // Devuelve null para descartar la imagen
          })
        };

        const result = await mammoth.convertToHtml({ arrayBuffer }, options); // <--- Usamos options
        const html = result.value;

        // Insertar en el editor
        editor.innerHTML = html;
        this.extractAndSaveCitations(html);
        this.addChatMessage(`Documento "${file.name}" cargado (Imágenes omitidas para rendimiento).`, false);

        editor.dispatchEvent(new Event('input'));

        setTimeout(() => {
          document.getElementById('analyze-btn').click();
        }, 500);

      } catch (error) {
        console.error('Error al leer .docx:', error);
        this.addChatMessage('Error: No se pudo procesar el archivo.', false);
      } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<span class="material-icons">auto_awesome</span> Analizar con IA';
      }
      this.showToast(`Documento cargado correctamente`, 'success');
    });
  }

  // NUEVO: Limpiar chat y editor (Y BORRAR DE SUPABASE)
  static initNewChat() {
    const newChatBtn = document.getElementById('new-chat-btn');
    const editor = document.getElementById('thesis-editor');
    const chatContainer = document.querySelector('.flex-1.space-y-4');
    const docName = document.getElementById('doc-name');

    if (!newChatBtn || !editor || !chatContainer || !docName) return;

    newChatBtn.addEventListener('click', async () => {
      if (confirm('¿Estás seguro? Esto borrará el documento actual y el chat de la base de datos permanentemente.')) {

        // 1. Limpiar Interfaz Local
        editor.innerHTML = '<p>Escribe aquí el contenido de tu tesis...</p>';
        chatContainer.innerHTML = '';
        docName.value = 'Ningún documento';
        localStorage.removeItem('thesis-document');
        localStorage.removeItem('thesis-chat');

        // 2. Limpiar Referencias Locales
        const bibliografia = JSON.parse(localStorage.getItem('bibliografia') || '[]');
        bibliografia.forEach(ref => ref.inDocument = false);
        localStorage.setItem('bibliografia', JSON.stringify(bibliografia));

        // 3. BORRAR DE SUPABASE (Base de Datos)
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            // Borrar documento y chunks
            await supabase.from('documents').delete().eq('user_id', user.id);
            await supabase.from('document_chunks').delete().eq('user_id', user.id);

            // Actualizar referencias en BD (marcarlas como no usadas)
            await supabase.from('references').update({ in_document: false }).eq('user_id', user.id);

            console.log('✅ Documento y chat eliminados de Supabase');
            App.showToast('Nuevo chat iniciado (Base de datos limpia)', 'success');

            // 4. Limpiar cambios pendientes
            hasUnsavedChanges = false;
          }
        } catch (error) {
          console.error('Error limpiando BD:', error);
          App.showToast('Error al limpiar la base de datos', 'error');
        }

        // Recargar para limpiar memoria y estado completamente
        window.location.reload();
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

    // === NUEVO: Actualizar contadores ===
    const usedCountEl = document.getElementById('used-count');
    const unusedCountEl = document.getElementById('unused-count');
    if (usedCountEl) usedCountEl.textContent = `(${usedRefs.length})`;
    if (unusedCountEl) unusedCountEl.textContent = `(${unusedRefs.length})`;

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

    // Listeners para borrado masivo
    document.getElementById('delete-all-used')?.addEventListener('click', () => this.deleteAllReferences(true));
    document.getElementById('delete-all-unused')?.addEventListener('click', () => this.deleteAllReferences(false));
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
      this.showToast('Error al guardar referencia', 'error');
    } else {
      // Recargar lista
      this.initBibliography();
      this.showToast('Referencia guardada correctamente', 'success');
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

  // NUEVO: Borrado masivo inteligente
  static async deleteAllReferences(inDocument) {
    const typeText = inDocument ? 'USADAS en el documento' : 'GUARDADAS (sin usar)';

    if (!confirm(`⚠️ ¿Estás seguro? Esto borrará TODAS las referencias ${typeText}.`)) {
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('references')
      .delete()
      .eq('user_id', user.id)
      .eq('in_document', inDocument);

    if (error) {
      console.error('Error borrando:', error);
      this.showToast('Error al borrar referencias', 'error');
    } else {
      this.showToast('Referencias eliminadas correctamente', 'success');
      this.initBibliography(); // Recargar lista
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
        // Exige: Min 8, 1 Mayúscula, 1 Minúscula, 1 Número Y 1 Especial
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

        if (!passwordRegex.test(password)) {
          errorDiv.classList.remove('hidden');
          // El mensaje ahora sí coincide con la realidad
          errorText.textContent = 'La contraseña debe tener: 8 caracteres, mayúscula, minúscula, número y símbolo.';
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
    const rememberMe = document.getElementById('remember-me').checked;

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      console.error('Error login:', error.message);
      return false;
    }

    // === MAGIA DE RECORDARME ===
    if (rememberMe && data.session) {
      // Si quiere ser recordado, copiamos el token a localStorage
      // Supabase usa una clave específica tipo 'sb-<project_ref>-auth-token'
      // Pero gracias a nuestro HybridStorage, solo necesitamos saber la clave interna.
      // Como es difícil saber la clave exacta del proyecto dinámicamente,
      // haremos un truco: iterar sessionStorage y copiar todo lo que parezca de Supabase.

      Object.keys(window.sessionStorage).forEach(key => {
        if (key.startsWith('sb-')) {
          const val = window.sessionStorage.getItem(key);
          window.localStorage.setItem(key, val);
        }
      });
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
  static async logout() { // <--- AÑADIR async
    await supabase.auth.signOut(); // <--- AÑADIR ESTO

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
            <h4 class="font-bold text-[var(--text)]">${this.escapeHtml(ref.author)} (${this.escapeHtml(ref.year)})</h4>
            <p class="text-sm text-[var(--text)] mt-1 italic">${this.escapeHtml(ref.title)}</p>
            ${ref.source ? `<p class="text-xs text-[var(--text-secondary)] mt-1">${this.escapeHtml(ref.source)}</p>` : ''}
            ${ref.doi_link ? `<p class="text-xs text-[var(--text-secondary)] mt-1">${this.escapeHtml(ref.doi_link)}</p>` : ''}
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

  // NUEVO: Generar Informe PDF Mejorado
  static initPDFGeneration() {
    const pdfBtn = document.getElementById('generate-pdf');
    if (!pdfBtn) return;

    pdfBtn.addEventListener('click', async () => {
      // 1. Bloquear botón
      pdfBtn.disabled = true;
      const originalText = pdfBtn.innerHTML; // Guardamos el texto original
      pdfBtn.innerHTML = '<span class="material-icons">hourglass_empty</span> Generando...';

      try {
        // === RECOPILAR DATOS ===
        const editor = document.getElementById('thesis-editor');
        const docText = editor.innerText; // Texto plano para conteo
        const docHtml = editor.innerHTML; // HTML para formato
        const docName = document.getElementById('doc-name').value;

        // Obtener bibliografía desde Supabase
        const { data: { user } } = await supabase.auth.getUser();
        let bibliografia = [];
        if (user) {
          const { data } = await supabase.from('references').select('*').eq('user_id', user.id);
          if (data) bibliografia = data;
        }

        // Capturar análisis del chat
        const chatContainer = document.querySelector('.flex-1.space-y-4');
        const accordionContainers = Array.from(chatContainer.querySelectorAll('.bg-gray-100.dark\\:bg-gray-800.rounded-xl'));

        const analysisBlocks = accordionContainers.map(container => {
          const titleElement = container.querySelector('button > div > span:nth-child(2)');
          const title = titleElement ? titleElement.innerText : 'Análisis sin título';
          const contentDiv = container.querySelector('div[id^="accordion-"]');
          const content = contentDiv ? contentDiv.innerHTML : '';
          return { title: title, content: content };
        }).filter(block => block.content.trim() !== '');

        // === CREAR CONTENIDO HTML PARA PDF ===
        const reportHTML = `
          <div style="font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #333; line-height: 1.6;">
            <!-- PORTADA -->
            <div style="text-align: center; margin-bottom: 50px; border-bottom: 2px solid #4f46e5; padding-bottom: 20px;">
              <h1 style="color: #1e40af; font-size: 28px; margin-bottom: 10px;">Informe de Asesoría de Tesis</h1>
              <p style="color: #6b7280; font-size: 14px;">Generado por Asesor IA UPAO</p>
              <h2 style="margin-top: 30px; font-size: 20px;">📄 ${docName}</h2>
              <p style="font-size: 12px; color: #9ca3af;">${new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <!-- RESUMEN -->
            <div style="background: #f3f4f6; padding: 20px; border-radius: 10px; margin-bottom: 30px;">
              <h3 style="color: #111827; margin-top: 0;">📊 Estadísticas del Documento</h3>
              <p><strong>Total de Palabras:</strong> ${docText.split(/\s+/).filter(w => w.length > 0).length}</p>
              <p><strong>Referencias Detectadas:</strong> ${bibliografia.length}</p>
            </div>
             <!-- CONTENIDO DEL DOCUMENTO -->
            <h3 style="color: #4f46e5; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 40px;">📄 Contenido del Documento</h3>
            <div style="font-size: 12px; text-align: justify; margin-bottom: 30px;">
              ${docHtml}
            </div>
            <!-- ANÁLISIS DE AGENTES -->
            <h3 style="color: #4f46e5; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 40px;">🤖 Análisis de Inteligencia Artificial</h3>
            
            ${analysisBlocks.length > 0 ? analysisBlocks.map(block => `
              <div style="margin-bottom: 25px;">
                <h4 style="color: #374151; background: #e0e7ff; padding: 8px 12px; border-radius: 6px; display: inline-block;">${block.title}</h4>
                <div style="font-size: 14px; text-align: justify; margin-top: 10px; padding-left: 10px; border-left: 3px solid #c7d2fe;">
                  ${block.content}
                </div>
              </div>
            `).join('') : '<p style="font-style: italic; color: #6b7280;">No se ha realizado un análisis reciente en esta sesión.</p>'}
            <!-- BIBLIOGRAFÍA -->
            <div style="page-break-before: always;"></div>
            <h3 style="color: #4f46e5; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">📖 Bibliografía Guardada</h3>
            
            ${bibliografia.length > 0 ? `
              <ul style="list-style-type: none; padding: 0;">
                ${bibliografia.map(ref => `
                  <li style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px dashed #e5e7eb;">
                    <strong style="color: #1f2937;">${ref.author} (${ref.year})</strong>. 
                    <em style="color: #4b5563;">${ref.title}</em>.
                    ${ref.source ? `<span style="color: #6b7280;"> ${ref.source}</span>` : ''}
                    ${ref.doi_link ? `<br><a href="${ref.doi_link}" style="color: #2563eb; font-size: 12px; text-decoration: none;">${ref.doi_link}</a>` : ''}
                  </li>
                `).join('')}
              </ul>
            ` : '<p>No hay referencias guardadas.</p>'}
          </div>
        `;

        // === GENERAR PDF ===
        const opt = {
          margin: [1, 1, 1, 1],
          filename: `Informe_AsesorIA_${docName.replace(/[^a-z0-9]/gi, '_')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: 'cm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        await html2pdf().set(opt).from(reportHTML).save();
        this.showToast('Informe PDF descargado', 'success');

      } catch (error) {
        console.error('Error PDF:', error);
        this.showToast('Error al generar PDF', 'error');
      } finally {
        // 2. Desbloquear SIEMPRE (incluso si falla)
        pdfBtn.disabled = false;
        pdfBtn.innerHTML = originalText;
      }
    });
  }

  // Helper de seguridad para evitar ataques XSS
  static escapeHtml(text) {
    if (!text) return '';
    return text
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

document.addEventListener('DOMContentLoaded', () => App.init());