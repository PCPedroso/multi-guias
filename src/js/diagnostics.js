// =============================================================================
// Live Diagnostics & Tab Conflict Monitor
// =============================================================================

export class ConflictDiagnostics {
  constructor(app) {
    this.app = app;
    this.logs = [];
    this.maxLogs = 150;
    this.panelVisible = false;

    this.initDOM();
    this.bindGlobalMonitors();
  }

  initDOM() {
    // Cria o painel flutuante de diagnóstico
    const panel = document.createElement('div');
    panel.id = 'diagnostics-panel';
    panel.className = 'diagnostics-panel';
    panel.innerHTML = `
      <div class="diag-header">
        <div class="diag-title">
          <span class="diag-indicator">●</span>
          <strong>🐞 Monitor de Conflitos & Logs em Tempo Real</strong>
          <span class="diag-count" id="diag-log-count">(0 eventos)</span>
        </div>
        <div class="diag-actions">
          <button class="diag-btn" id="btn-diag-clear" title="Limpar Logs">🗑️ Limpar</button>
          <button class="diag-btn" id="btn-diag-copy" title="Copiar todos os logs">📋 Copiar Logs</button>
          <button class="diag-btn diag-btn-close" id="btn-diag-toggle" title="Minimizar / Fechar">✕</button>
        </div>
      </div>
      <div class="diag-body" id="diag-log-list">
        <div class="diag-empty">Monitorando eventos em tempo real nas 3 guias... Interaja com o site e os eventos aparecerão aqui.</div>
      </div>
    `;
    document.body.appendChild(panel);

    // Botão flutuante para abrir o painel se minimizado
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'diagnostics-toggle-btn';
    toggleBtn.className = 'diagnostics-toggle-btn';
    toggleBtn.title = 'Abrir Monitor de Diagnóstico / Logs';
    toggleBtn.innerHTML = `🐞 <span>Logs ao Vivo</span> <span class="badge-dot" id="diag-badge-dot"></span>`;
    document.body.appendChild(toggleBtn);

    this.panelEl = panel;
    this.listEl = document.getElementById('diag-log-list');
    this.countEl = document.getElementById('diag-log-count');
    this.badgeDot = document.getElementById('diag-badge-dot');
    this.toggleBtn = toggleBtn;

    // Listeners do Painel
    toggleBtn.addEventListener('click', () => this.togglePanel());
    document.getElementById('btn-diag-toggle').addEventListener('click', () => this.togglePanel(false));
    document.getElementById('btn-diag-clear').addEventListener('click', () => this.clearLogs());
    document.getElementById('btn-diag-copy').addEventListener('click', () => this.copyLogs());
  }

  togglePanel(show) {
    this.panelVisible = show !== undefined ? show : !this.panelVisible;
    if (this.panelVisible) {
      this.panelEl.classList.add('open');
      this.toggleBtn.classList.add('active');
      this.badgeDot.classList.remove('has-new');
    } else {
      this.panelEl.classList.remove('open');
      this.toggleBtn.classList.remove('active');
    }
  }

  log(category, type, message, data = null) {
    const time = new Date().toLocaleTimeString('pt-BR', { hour12: false }) + '.' + String(new Date().getMilliseconds()).padStart(3, '0');
    const entry = { time, category, type, message, data };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) this.logs.shift();

    // Log detalhado no console do navegador para inspeção profunda
    console.log(`%c[${time}] [${category}] ${type}:`, 'color: #38bdf8; font-weight: bold;', message, data || '');

    this.renderLogEntry(entry);
  }

  renderLogEntry(entry) {
    if (!this.listEl) return;

    const empty = this.listEl.querySelector('.diag-empty');
    if (empty) empty.remove();

    const row = document.createElement('div');
    row.className = `diag-row diag-type-${entry.type.toLowerCase()}`;

    let categoryClass = 'badge-generic';
    if (entry.category.includes('Guia 1')) categoryClass = 'badge-pane-1';
    else if (entry.category.includes('Guia 2')) categoryClass = 'badge-pane-2';
    else if (entry.category.includes('Guia 3')) categoryClass = 'badge-pane-3';
    else if (entry.category.includes('Storage')) categoryClass = 'badge-storage';
    else if (entry.category.includes('Message')) categoryClass = 'badge-message';

    let dataHtml = '';
    if (entry.data) {
      try {
        const jsonStr = typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data);
        dataHtml = `<pre class="diag-data">${jsonStr.substring(0, 300)}</pre>`;
      } catch {
        dataHtml = `<pre class="diag-data">${String(entry.data)}</pre>`;
      }
    }

    row.innerHTML = `
      <span class="diag-time">${entry.time}</span>
      <span class="diag-badge ${categoryClass}">${entry.category}</span>
      <span class="diag-type">${entry.type}</span>
      <span class="diag-msg">${entry.message}</span>
      ${dataHtml}
    `;

    this.listEl.appendChild(row);
    this.listEl.scrollTop = this.listEl.scrollHeight;

    if (this.countEl) {
      this.countEl.textContent = `(${this.logs.length} eventos)`;
    }

    if (!this.panelVisible && this.badgeDot) {
      this.badgeDot.classList.add('has-new');
    }
  }

  clearLogs() {
    this.logs = [];
    if (this.listEl) {
      this.listEl.innerHTML = `<div class="diag-empty">Logs limpos. Monitorando novos eventos...</div>`;
    }
    if (this.countEl) {
      this.countEl.textContent = `(0 eventos)`;
    }
  }

  copyLogs() {
    const text = this.logs.map(l => `[${l.time}] [${l.category}] [${l.type}] ${l.message} ${l.data ? JSON.stringify(l.data) : ''}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      this.app.showToast('📋 Logs copiados para a área de transferência!');
    });
  }

  bindGlobalMonitors() {
    // 1. Monitor de postMessage entre frames e janelas
    window.addEventListener('message', (e) => {
      let originHost = '';
      try { originHost = new URL(e.origin).hostname; } catch { originHost = e.origin; }
      
      let msgSummary = '';
      if (typeof e.data === 'string') {
        msgSummary = e.data.substring(0, 120);
      } else if (e.data && typeof e.data === 'object') {
        msgSummary = e.data.type || e.data.event || e.data.action || JSON.stringify(e.data).substring(0, 120);
      }

      this.log('Message Event', 'PostMessage', `Origem: ${originHost} | Dado: ${msgSummary}`, e.data);
    });

    // 2. Monitor de Storage Events (LocalStorage/SessionStorage cross-tab sync)
    window.addEventListener('storage', (e) => {
      this.log('Storage Event', 'CrossTabStorage', `Chave modificada: "${e.key}" (Antigo: ${e.oldValue?.substring(0, 40)} ➔ Novo: ${e.newValue?.substring(0, 40)})`, {
        key: e.key,
        oldValue: e.oldValue,
        newValue: e.newValue,
        url: e.url
      });
    });

    // 3. Monitor de Foco / Visibilidade
    window.addEventListener('focus', () => {
      this.log('Window Focus', 'Focus', 'Janela principal Multi-Guias recuperou o foco');
    });

    window.addEventListener('blur', () => {
      this.log('Window Blur', 'Blur', 'Foco transferido para um Iframe ou outra janela');
    });

    document.addEventListener('visibilitychange', () => {
      this.log('Page Visibility', 'Visibility', `Estado da página: ${document.visibilityState}`);
    });

    // 4. Monitor de Erros Globais
    window.addEventListener('error', (e) => {
      this.log('Error', 'ScriptError', e.message || 'Erro de script capturado', { filename: e.filename, lineno: e.lineno });
    });

    window.addEventListener('unhandledrejection', (e) => {
      this.log('Error', 'PromiseRejection', e.reason?.message || String(e.reason));
    });
  }

  // Monitor específico para cada guia
  monitorPane(pane) {
    const paneName = `Guia ${pane.id}`;

    // Monitora carregamento do Iframe
    pane.iframeEl.addEventListener('load', () => {
      let currentSrc = '';
      try {
        currentSrc = pane.iframeEl.contentWindow?.location?.href || pane.iframeEl.src;
      } catch {
        currentSrc = pane.iframeEl.src;
      }
      this.log(paneName, 'IframeLoad', `Iframe carregou: ${currentSrc}`);
    });

    pane.iframeEl.addEventListener('error', (err) => {
      this.log(paneName, 'IframeError', `Erro no iframe da ${paneName}`, err);
    });

    // Monitor de mutações no src do iframe
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(m => {
        if (m.attributeName === 'src') {
          this.log(paneName, 'SrcChanged', `Atributo src alterado para: ${pane.iframeEl.src}`);
        }
      });
    });
    observer.observe(pane.iframeEl, { attributes: true, attributeFilter: ['src'] });
  }
}
