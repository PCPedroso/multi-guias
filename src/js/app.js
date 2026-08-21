import { SEARCH_ENGINES, POPULAR_PRESETS } from './presets.js';
import { Storage } from './storage.js';
import { SplitterManager } from './splitters.js';
import { ConflictDiagnostics } from './diagnostics.js';

class MultiGuiasApp {
  constructor() {
    this.state = Storage.getCurrentState();
    this.settings = Storage.getSettings();
    this.maximizedPaneId = null;

    this.diagnostics = new ConflictDiagnostics(this);
    this.initElements();
    this.initSplitters();
    this.initEventListeners();
    this.applyTheme(this.settings.theme || 'theme-dark');
    this.applyLayout(this.state.layout, false);
    this.loadSavedPanes();
    this.renderWorkspacesList();
  }

  initElements() {
    this.workspace = document.getElementById('split-workspace');
    this.viewport = document.getElementById('workspace-viewport');
    this.activeCountText = document.getElementById('active-count-text');
    this.layoutButtons = document.querySelectorAll('.layout-btn');
    
    // Modals
    this.modalWorkspaces = document.getElementById('modal-workspaces');
    this.modalShortcuts = document.getElementById('modal-shortcuts');
    this.workspacesGrid = document.getElementById('workspaces-grid');
    this.toastContainer = document.getElementById('toast-container');

    const isElectron = !!(window.electronAPI?.isElectron || navigator.userAgent.includes('Electron'));

    // Panes instances
    this.panes = [1, 2, 3].map(id => {
      let frameEl = document.getElementById(`pane-${id}-iframe`);

      // No Electron, utiliza <webview> com partição de sessão 100% isolada e persistente
      if (isElectron && frameEl && frameEl.tagName !== 'WEBVIEW') {
        const webview = document.createElement('webview');
        webview.className = 'pane-iframe';
        webview.id = `pane-${id}-iframe`;
        webview.name = `pane-frame-${id}`;
        webview.setAttribute('partition', `persist:pane-${id}`);
        webview.setAttribute('allowpopups', 'true');
        webview.setAttribute('webpreferences', 'contextIsolation=yes');
        webview.style.display = 'none';

        frameEl.parentNode.replaceChild(webview, frameEl);
        frameEl = webview;
      }

      return {
        id,
        isElectron,
        element: document.getElementById(`pane-${id}`),
        titleEl: document.getElementById(`pane-${id}-title`),
        inputEl: document.getElementById(`pane-${id}-input`),
        iframeEl: frameEl,
        speedDialEl: document.getElementById(`pane-${id}-speed-dial`),
        progressBar: document.querySelector(`#pane-${id} .pane-progress-bar`),
        clearBtn: document.querySelector(`#pane-${id} .btn-clear-url`),
        history: [],
        historyIndex: -1,
        currentUrl: ''
      };
    });

    // Renderiza speed dials e menus de presets e monitora diagnósticos
    this.panes.forEach(pane => {
      this.diagnostics.monitorPane(pane);
      this.renderSpeedDial(pane);
      this.renderPresetsMenu(pane);
      this.bindPaneEvents(pane);
    });
  }

  initSplitters() {
    this.splitterManager = new SplitterManager(this.workspace, () => {
      this.persistState();
    });
  }

  // =========================================================================
  // Layout Management (1, 2 e 3 Telas)
  // =========================================================================

  applyLayout(layoutName, notify = true) {
    this.state.layout = layoutName;

    // Remove classes anteriores
    this.workspace.className = 'split-workspace ' + layoutName;

    // Atualiza botões ativos no header
    this.layoutButtons.forEach(btn => {
      if (btn.dataset.layout === layoutName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Reorganiza a estrutura DOM caso seja layout híbrido (1+2 ou 2+1)
    this.restructureDOMForLayout(layoutName);

    // Atualiza contagem de guias ativas
    const activeCount = this.getActivePanesCount(layoutName);
    this.state.activePanesCount = activeCount;
    this.activeCountText.textContent = `${activeCount} Guia${activeCount > 1 ? 's' : ''}`;

    // Equaliza as proporções ao trocar de layout
    this.splitterManager.equalizeCurrentLayout();

    this.persistState();

    if (notify) {
      this.showToast(`Layout alterado: ${this.getLayoutFriendlyName(layoutName)}`);
    }
  }

  getActivePanesCount(layout) {
    if (layout === 'layout-1-col') return 1;
    if (layout.startsWith('layout-2')) return 2;
    return 3;
  }

  getLayoutFriendlyName(layout) {
    switch (layout) {
      case 'layout-1-col': return '1 Guia (Foco Total)';
      case 'layout-2-cols': return '2 Colunas (50/50)';
      case 'layout-2-rows': return '2 Linhas Horizontais';
      case 'layout-3-cols': return '3 Colunas (33/33/33)';
      case 'layout-1-plus-2': return '1 Principal + 2 Empilhadas';
      case 'layout-2-plus-1': return '2 Empilhadas + 1 Principal';
      case 'layout-3-rows': return '3 Linhas Horizontais';
      default: return layout;
    }
  }

  restructureDOMForLayout(layout) {
    const splitter12 = document.querySelector('.splitter-1-2');
    const splitter23 = document.querySelector('.splitter-2-3');
    if (!splitter12 || !splitter23) return;

    // Configura direções dos splitters sem mover nenhum nó do DOM
    if (layout === 'layout-2-rows' || layout === 'layout-3-rows') {
      splitter12.dataset.direction = 'horizontal';
      splitter23.dataset.direction = 'horizontal';
    } else if (layout === 'layout-1-plus-2') {
      splitter12.dataset.direction = 'vertical';
      splitter23.dataset.direction = 'horizontal';
    } else if (layout === 'layout-2-plus-1') {
      splitter12.dataset.direction = 'horizontal';
      splitter23.dataset.direction = 'vertical';
    } else {
      splitter12.dataset.direction = 'vertical';
      splitter23.dataset.direction = 'vertical';
    }
  }

  // =========================================================================
  // Pane Navigation & URL Handling
  // =========================================================================

  bindPaneEvents(pane) {
    const paneEl = pane.element;

    // Focus state no clique do painel
    paneEl.addEventListener('mousedown', () => {
      this.setActivePaneFocus(pane.id);
    });

    // Input Enter ou Go
    pane.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.navigatePane(pane, pane.inputEl.value);
      }
    });

    pane.inputEl.addEventListener('input', () => {
      if (pane.inputEl.value.trim().length > 0) {
        pane.clearBtn.classList.add('has-text');
      } else {
        pane.clearBtn.classList.remove('has-text');
      }
    });

    const goBtn = paneEl.querySelector('.btn-go-url');
    if (goBtn) {
      goBtn.addEventListener('click', () => {
        this.navigatePane(pane, pane.inputEl.value);
      });
    }

    // Botão Limpar URL
    if (pane.clearBtn) {
      pane.clearBtn.addEventListener('click', () => {
        pane.inputEl.value = '';
        pane.clearBtn.classList.remove('has-text');
        pane.inputEl.focus();
      });
    }

    // Botões de navegação
    paneEl.querySelector('.btn-nav-reload').addEventListener('click', () => {
      this.reloadPane(pane);
    });

    paneEl.querySelector('.btn-nav-home').addEventListener('click', () => {
      this.showSpeedDial(pane);
    });

    paneEl.querySelector('.btn-nav-back').addEventListener('click', () => {
      if (pane.isElectron && pane.iframeEl.canGoBack && pane.iframeEl.canGoBack()) {
        pane.iframeEl.goBack();
      } else if (pane.historyIndex > 0) {
        pane.historyIndex--;
        this.loadUrlInIframe(pane, pane.history[pane.historyIndex], false);
      }
    });

    paneEl.querySelector('.btn-nav-forward').addEventListener('click', () => {
      if (pane.isElectron && pane.iframeEl.canGoForward && pane.iframeEl.canGoForward()) {
        pane.iframeEl.goForward();
      } else if (pane.historyIndex < pane.history.length - 1) {
        pane.historyIndex++;
        this.loadUrlInIframe(pane, pane.history[pane.historyIndex], false);
      }
    });

    // Eventos do Webview / Iframe
    if (pane.isElectron) {
      pane.iframeEl.addEventListener('did-start-loading', () => {
        pane.progressBar.classList.add('loading');
      });
      pane.iframeEl.addEventListener('did-stop-loading', () => {
        pane.progressBar.classList.remove('loading');
      });
      pane.iframeEl.addEventListener('page-title-updated', (e) => {
        if (e.title) {
          pane.titleEl.textContent = e.title.length > 25 ? e.title.substring(0, 25) + '...' : e.title;
        }
      });
      pane.iframeEl.addEventListener('did-navigate', (e) => {
        pane.currentUrl = e.url;
        pane.inputEl.value = e.url;
        pane.clearBtn.classList.add('has-text');
        this.persistState();
      });
      pane.iframeEl.addEventListener('did-navigate-in-page', (e) => {
        if (e.isMainFrame) {
          pane.currentUrl = e.url;
          pane.inputEl.value = e.url;
          pane.clearBtn.classList.add('has-text');
          this.persistState();
        }
      });
    } else {
      pane.iframeEl.addEventListener('load', () => {
        pane.progressBar.classList.remove('loading');
      });
    }

    // Pop-out em nova janela
    paneEl.querySelector('.btn-popout').addEventListener('click', () => {
      if (pane.currentUrl) {
        window.open(pane.currentUrl, '_blank');
      } else if (pane.inputEl.value) {
        window.open(this.parseUrlOrSearch(pane.inputEl.value), '_blank');
      }
    });

    // Maximizar guia individual (Foco temporário)
    paneEl.querySelector('.btn-maximize-pane').addEventListener('click', () => {
      this.toggleMaximizePane(pane.id);
    });

    // Botão flutuante de recarregar no canto superior direito
    const floatingReload = paneEl.querySelector('.pane-floating-reload');
    if (floatingReload) {
      floatingReload.addEventListener('click', (e) => {
        e.stopPropagation();
        floatingReload.classList.add('spinning');
        setTimeout(() => floatingReload.classList.remove('spinning'), 600);
        this.reloadPane(pane);
      });
    }

    // Iframe Load Handler
    pane.iframeEl.addEventListener('load', () => {
      pane.progressBar.classList.remove('loading');
    });
  }

  transformEmbedUrl(rawUrl) {
    try {
      // 1. YouTube transformations
      // https://www.youtube.com/watch?v=VIDEO_ID
      const ytWatchMatch = rawUrl.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]+)/i);
      if (ytWatchMatch && ytWatchMatch[1]) {
        return `https://www.youtube-nocookie.com/embed/${ytWatchMatch[1]}?enablejsapi=1&autoplay=0`;
      }

      // https://youtu.be/VIDEO_ID
      const ytShortMatch = rawUrl.match(/(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]+)/i);
      if (ytShortMatch && ytShortMatch[1]) {
        return `https://www.youtube-nocookie.com/embed/${ytShortMatch[1]}?enablejsapi=1&autoplay=0`;
      }

      // https://www.youtube.com/shorts/VIDEO_ID
      const ytShortsMatch = rawUrl.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/i);
      if (ytShortsMatch && ytShortsMatch[1]) {
        return `https://www.youtube-nocookie.com/embed/${ytShortsMatch[1]}?enablejsapi=1&autoplay=0`;
      }

      // 2. Vimeo transformation
      const vimeoMatch = rawUrl.match(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/i);
      if (vimeoMatch && vimeoMatch[1]) {
        return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
      }

      // 3. Spotify transformation
      const spotifyMatch = rawUrl.match(/(?:https?:\/\/)?open\.spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/i);
      if (spotifyMatch && spotifyMatch[1] && spotifyMatch[2]) {
        return `https://open.spotify.com/embed/${spotifyMatch[1]}/${spotifyMatch[2]}`;
      }
    } catch {
      // Mantém original se houver erro
    }
    return rawUrl;
  }

  parseUrlOrSearch(query) {
    const trimmed = query.trim();
    if (!trimmed) return '';

    // Atalhos especiais de busca (ex: "yt: lofi" ou "youtube: trailer")
    if (/^(yt:|youtube:)/i.test(trimmed)) {
      const searchTerm = trimmed.replace(/^(yt:|youtube:)\s*/i, '');
      return `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(searchTerm)}`;
    }

    // Verifica se é uma URL válida ou se parece com domínio
    const hasProtocol = /^https?:\/\//i.test(trimmed);
    const looksLikeUrl = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/i.test(trimmed) || trimmed.startsWith('localhost:');

    let finalUrl = '';
    if (hasProtocol) {
      finalUrl = trimmed;
    } else if (looksLikeUrl) {
      finalUrl = 'https://' + trimmed;
    } else {
      // É uma busca padrão
      const engine = SEARCH_ENGINES.find(e => e.id === this.settings.defaultSearchEngine) || SEARCH_ENGINES[0];
      return engine.url + encodeURIComponent(trimmed);
    }

    // Transforma URLs para versões compatíveis com iframe e multi-guias
    return this.transformEmbedUrl(finalUrl);
  }

  navigatePane(pane, rawInput) {
    if (!rawInput || !rawInput.trim()) {
      this.showSpeedDial(pane);
      return;
    }

    const targetUrl = this.parseUrlOrSearch(rawInput);
    this.loadUrlInIframe(pane, targetUrl, true);
  }

  loadUrlInIframe(pane, url, pushHistory = true) {
    pane.currentUrl = url;
    pane.inputEl.value = url;
    pane.clearBtn.classList.add('has-text');

    // Atualiza título da guia
    try {
      const parsed = new URL(url);
      pane.titleEl.textContent = parsed.hostname.replace('www.', '');
    } catch {
      pane.titleEl.textContent = url;
    }

    // Gerencia histórico
    if (pushHistory) {
      if (pane.historyIndex < pane.history.length - 1) {
        pane.history = pane.history.slice(0, pane.historyIndex + 1);
      }
      pane.history.push(url);
      pane.historyIndex = pane.history.length - 1;
    }

    // Oculta speed dial e exibe iframe
    pane.speedDialEl.style.display = 'none';
    pane.iframeEl.style.display = 'block';

    // Barra de progresso animada
    pane.progressBar.classList.add('loading');
    this.diagnostics.log(`Guia ${pane.id}`, 'Navigate', `Carregando URL: ${url}`);
    
    if (pane.isElectron && pane.iframeEl.tagName === 'WEBVIEW' && typeof pane.iframeEl.loadURL === 'function') {
      try {
        pane.iframeEl.loadURL(url);
      } catch {
        pane.iframeEl.src = url;
      }
    } else {
      pane.iframeEl.src = url;
    }

    this.persistState();
  }

  reloadPane(pane) {
    if (pane.currentUrl) {
      pane.progressBar.classList.add('loading');
      this.diagnostics.log(`Guia ${pane.id}`, 'Reload', `Recarregando URL: ${pane.currentUrl}`);
      if (pane.isElectron && pane.iframeEl.tagName === 'WEBVIEW' && typeof pane.iframeEl.reload === 'function') {
        pane.iframeEl.reload();
      } else {
        pane.iframeEl.src = pane.currentUrl;
      }
      this.showToast(`Guia ${pane.id} recarregada`);
    }
  }

  showSpeedDial(pane) {
    pane.currentUrl = '';
    pane.inputEl.value = '';
    pane.clearBtn.classList.remove('has-text');
    pane.titleEl.textContent = `Guia ${pane.id}`;
    pane.iframeEl.src = 'about:blank';
    pane.iframeEl.style.display = 'none';
    pane.speedDialEl.style.display = 'flex';
    this.persistState();
  }

  setActivePaneFocus(paneId) {
    this.panes.forEach(p => {
      if (p.id === paneId) {
        p.element.classList.add('is-focused');
      } else {
        p.element.classList.remove('is-focused');
      }
    });
  }

  toggleMaximizePane(paneId) {
    if (this.maximizedPaneId === paneId) {
      // Desmaximizar: restaura layout original
      this.maximizedPaneId = null;
      this.applyLayout(this.state.layout, false);
      this.showToast('Visualização normal restaurada');
    } else {
      // Maximizar temporariamente este painel
      this.maximizedPaneId = paneId;
      this.panes.forEach(p => {
        if (p.id === paneId) {
          p.element.style.display = 'flex';
          p.element.style.flex = '1 1 100%';
          p.element.style.width = '100%';
          p.element.style.height = '100%';
        } else {
          p.element.style.display = 'none';
        }
      });
      document.querySelectorAll('.splitter-handle').forEach(s => s.style.display = 'none');
      this.showToast(`Guia ${paneId} em foco total (Pressione Esc para sair)`);
    }
  }

  // =========================================================================
  // Speed Dial & Presets Rendering
  // =========================================================================

  renderSpeedDial(pane) {
    const speedDial = pane.speedDialEl;
    let html = `
      <div class="speed-dial-hero">
        <h3>🚀 Guia ${pane.id} Pronta</h3>
        <p>Selecione um atalho rápido ou digite um link/pesquisa acima</p>
      </div>
      <div class="speed-dial-grid">
    `;

    POPULAR_PRESETS.forEach(cat => {
      cat.items.slice(0, 2).forEach(item => {
        html += `
          <div class="speed-dial-card" data-url="${item.url}">
            <span class="card-icon">${item.icon}</span>
            <span class="card-name">${item.name}</span>
            <span class="card-desc">${item.desc}</span>
          </div>
        `;
      });
    });

    html += `
      </div>
      <div class="iframe-security-banner">
        <span>💡</span>
        <p><strong>Dica de Navegação:</strong> A maioria das ferramentas e páginas web funcionam perfeitamente aqui. Caso algum site com proteção avançada não carregue, utilize o botão <strong>↗ (Popout)</strong> no topo para abrir direto em uma janela do navegador.</p>
      </div>
    `;

    speedDial.innerHTML = html;

    speedDial.querySelectorAll('.speed-dial-card').forEach(card => {
      card.addEventListener('click', () => {
        const url = card.dataset.url;
        this.navigatePane(pane, url);
      });
    });
  }

  renderPresetsMenu(pane) {
    const menu = pane.element.querySelector('.presets-menu');
    const btn = pane.element.querySelector('.btn-presets');
    let html = '';

    POPULAR_PRESETS.forEach(category => {
      html += `<div class="preset-category-title">${category.category}</div>`;
      category.items.forEach(item => {
        html += `
          <div class="preset-item" data-url="${item.url}">
            <span>${item.icon}</span>
            <span>${item.name}</span>
            <span class="preset-item-badge">${item.badge}</span>
          </div>
        `;
      });
    });

    menu.innerHTML = html;

    // Toggle dropdown
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.presets-menu').forEach(m => {
        if (m !== menu) m.classList.remove('open');
      });
      menu.classList.toggle('open');
    });

    // Clique no item de preset
    menu.querySelectorAll('.preset-item').forEach(item => {
      item.addEventListener('click', () => {
        const url = item.dataset.url;
        this.navigatePane(pane, url);
        menu.classList.remove('open');
      });
    });

    // Fecha ao clicar fora
    document.addEventListener('click', () => {
      menu.classList.remove('open');
    });
  }

  // =========================================================================
  // Workspaces & Persistência
  // =========================================================================

  persistState() {
    const stateToSave = {
      layout: this.state.layout,
      activePanesCount: this.state.activePanesCount,
      panes: this.panes.map(p => ({
        url: p.currentUrl,
        title: p.titleEl.textContent
      }))
    };
    Storage.saveCurrentState(stateToSave);
  }

  loadSavedPanes() {
    if (this.state.panes && Array.isArray(this.state.panes)) {
      this.state.panes.forEach((saved, index) => {
        if (this.panes[index] && saved.url) {
          this.loadUrlInIframe(this.panes[index], saved.url, true);
        } else if (this.panes[index]) {
          this.showSpeedDial(this.panes[index]);
        }
      });
    }
  }

  renderWorkspacesList() {
    const workspaces = Storage.getWorkspaces();
    this.workspacesGrid.innerHTML = '';

    workspaces.forEach(ws => {
      const card = document.createElement('div');
      card.className = 'workspace-card';
      card.innerHTML = `
        <div class="workspace-card-info">
          <h4>${ws.name}</h4>
          <p>${this.getLayoutFriendlyName(ws.layout)} • ${ws.panes.length} guias configuradas</p>
        </div>
        <div class="workspace-card-actions">
          <button class="btn-workspace-load" data-id="${ws.id}">Carregar</button>
          <button class="btn-workspace-delete" data-id="${ws.id}">🗑️</button>
        </div>
      `;

      card.querySelector('.btn-workspace-load').addEventListener('click', () => {
        this.loadWorkspace(ws);
        this.modalWorkspaces.classList.remove('open');
      });

      card.querySelector('.btn-workspace-delete').addEventListener('click', () => {
        Storage.deleteWorkspace(ws.id);
        this.renderWorkspacesList();
        this.showToast('Workspace removido');
      });

      this.workspacesGrid.appendChild(card);
    });
  }

  loadWorkspace(ws) {
    this.applyLayout(ws.layout);
    ws.panes.forEach((p, idx) => {
      if (this.panes[idx]) {
        if (p.url) {
          this.loadUrlInIframe(this.panes[idx], p.url, true);
        } else {
          this.showSpeedDial(this.panes[idx]);
        }
      }
    });
    this.showToast(`Workspace carregado: ${ws.name}`);
  }

  saveCurrentAsWorkspace(name) {
    if (!name.trim()) return;
    const newWs = {
      id: 'ws-' + Date.now(),
      name: name.trim(),
      layout: this.state.layout,
      panes: this.panes.map(p => ({
        url: p.currentUrl,
        title: p.titleEl.textContent
      }))
    };
    Storage.saveWorkspace(newWs);
    this.renderWorkspacesList();
    this.showToast(`Workspace "${name}" salvo com sucesso!`);
  }

  // =========================================================================
  // Global Event Listeners & Shortcuts
  // =========================================================================

  initEventListeners() {
    // Botões de layout
    this.layoutButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const layout = btn.dataset.layout;
        this.applyLayout(layout);
      });
    });

    // Equalizar
    const btnEqualize = document.getElementById('btn-equalize');
    if (btnEqualize) {
      btnEqualize.addEventListener('click', () => {
        this.splitterManager.equalizeCurrentLayout();
        this.showToast('Painéis equalizados com sucesso');
      });
    }

    // Recarregar todas
    const btnReloadAll = document.getElementById('btn-reload-all');
    if (btnReloadAll) {
      btnReloadAll.addEventListener('click', () => {
        this.panes.forEach(pane => {
          if (pane.currentUrl) this.reloadPane(pane);
        });
        this.showToast('Todas as guias foram recarregadas');
      });
    }

    // Modal Workspaces
    const btnWorkspaces = document.getElementById('btn-workspaces');
    if (btnWorkspaces) {
      btnWorkspaces.addEventListener('click', () => {
        this.renderWorkspacesList();
        this.modalWorkspaces.classList.add('open');
      });
    }
    const btnCloseWorkspaces = document.getElementById('btn-close-workspaces');
    if (btnCloseWorkspaces) {
      btnCloseWorkspaces.addEventListener('click', () => {
        this.modalWorkspaces.classList.remove('open');
      });
    }
    const btnSaveWorkspace = document.getElementById('btn-save-workspace') || document.getElementById('btn-save-new-workspace');
    if (btnSaveWorkspace) {
      btnSaveWorkspace.addEventListener('click', () => {
        const input = document.getElementById('workspace-name-input') || document.getElementById('new-workspace-name');
        if (input) {
          this.saveCurrentAsWorkspace(input.value);
          input.value = '';
        }
      });
    }

    // Modal Atalhos
    const btnShortcuts = document.getElementById('btn-shortcuts');
    if (btnShortcuts) {
      btnShortcuts.addEventListener('click', () => {
        this.modalShortcuts.classList.add('open');
      });
    }
    const btnCloseShortcuts = document.getElementById('btn-close-shortcuts');
    if (btnCloseShortcuts) {
      btnCloseShortcuts.addEventListener('click', () => {
        this.modalShortcuts.classList.remove('open');
      });
    }

    // Alternar Tema
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    if (btnThemeToggle) {
      btnThemeToggle.addEventListener('click', () => {
        const themes = ['theme-dark', 'theme-cyber', 'theme-light'];
        const currentIdx = themes.indexOf(this.settings.theme || 'theme-dark');
        const nextTheme = themes[(currentIdx + 1) % themes.length];
        this.applyTheme(nextTheme);
      });
    }

    // Botão Modo Imersivo no Header (F10)
    const btnToggleZen = document.getElementById('btn-toggle-zen') || document.getElementById('btn-fullscreen');
    if (btnToggleZen) {
      btnToggleZen.addEventListener('click', () => {
        this.toggleZenMode();
      });
    }

    // Badge de saída do modo imersivo
    const zenPill = document.getElementById('zen-exit-pill');
    if (zenPill) {
      zenPill.addEventListener('click', () => {
        this.toggleZenMode(false);
      });
    }

    // Fechar modais ao clicar no backdrop
    [this.modalWorkspaces, this.modalShortcuts].forEach(modal => {
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) modal.classList.remove('open');
        });
      }
    });

    // Recuperação de foco ao passar o mouse sobre o header e barras da aplicação
    document.querySelectorAll('.app-header, .pane-navbar, .splitter-handle, .zen-exit-pill').forEach(el => {
      el.addEventListener('mouseenter', () => {
        window.focus();
      });
    });

    // Atalhos globais de teclado (com Capture para máxima prioridade)
    const handleKeydown = (e) => {
      const isF10 = e.key === 'F10' || e.code === 'F10' || e.keyCode === 121 || e.which === 121;
      const isAltZ = e.altKey && (e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ');

      // F10 ou Alt+Z: Alterna a ocultação do painel de colunas e barras de navegação (Modo Imersivo)
      if (isF10 || isAltZ) {
        e.preventDefault();
        e.stopPropagation();
        this.toggleZenMode();
        return;
      }

      // F11: Tela cheia + Modo Imersivo
      if (e.key === 'F11' || e.code === 'F11') {
        this.toggleZenMode(true, false);
      }

      // Esc para fechar modais, sair do modo imersivo ou desmaximizar painel
      if (e.key === 'Escape' || e.code === 'Escape') {
        if (document.body.classList.contains('is-zen-mode')) {
          this.toggleZenMode(false, true);
          return;
        }
        if (this.modalWorkspaces) this.modalWorkspaces.classList.remove('open');
        if (this.modalShortcuts) this.modalShortcuts.classList.remove('open');
        if (this.maximizedPaneId) {
          this.toggleMaximizePane(this.maximizedPaneId);
        }
      }

      // Alt + 1, 2, 3, 4
      if (e.altKey && (e.key === '1' || e.code === 'Digit1')) {
        e.preventDefault();
        this.applyLayout('layout-1-col');
      } else if (e.altKey && (e.key === '2' || e.code === 'Digit2')) {
        e.preventDefault();
        this.applyLayout('layout-2-cols');
      } else if (e.altKey && (e.key === '3' || e.code === 'Digit3')) {
        e.preventDefault();
        this.applyLayout('layout-3-cols');
      } else if (e.altKey && (e.key === '4' || e.code === 'Digit4')) {
        e.preventDefault();
        this.applyLayout('layout-1-plus-2');
      } else if (e.altKey && (e.key === 'e' || e.key === 'E' || e.code === 'KeyE')) {
        e.preventDefault();
        this.splitterManager.equalizeCurrentLayout();
        this.showToast('Painéis equalizados');
      } else if (e.altKey && (e.key === 'r' || e.key === 'R' || e.code === 'KeyR')) {
        e.preventDefault();
        this.panes.forEach(pane => {
          if (pane.currentUrl) this.reloadPane(pane);
        });
      }
    };

    window.addEventListener('keydown', handleKeydown, { capture: true });
    document.addEventListener('keydown', handleKeydown, { capture: true });

    // Escuta saída nativa de tela cheia
    document.addEventListener('fullscreenchange', () => {
      const isFullscreen = !!document.fullscreenElement;
      if (!isFullscreen && document.body.classList.contains('is-zen-mode')) {
        this.toggleZenMode(false, false);
      }
    });
  }

  toggleZenMode(forcedState = null, triggerNativeFullscreen = false) {
    const isZen = forcedState !== null ? forcedState : !document.body.classList.contains('is-zen-mode');
    const zenPill = document.getElementById('zen-exit-pill');

    if (isZen) {
      document.body.classList.add('is-zen-mode');
      
      if (triggerNativeFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }

      if (zenPill) {
        zenPill.classList.add('visible-temporarily');
        setTimeout(() => {
          zenPill.classList.remove('visible-temporarily');
        }, 3500);
      }

      this.showToast('Barras ocultadas (F10 ou Esc para restaurar)');
    } else {
      document.body.classList.remove('is-zen-mode');

      if (triggerNativeFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      if (zenPill) {
        zenPill.classList.remove('visible-temporarily');
      }

      this.showToast('Barras e painel superior restaurados');
    }
  }

  applyTheme(themeName) {
    document.body.className = document.body.classList.contains('is-zen-mode') ? `${themeName} is-zen-mode` : themeName;
    this.settings.theme = themeName;
    Storage.saveSettings(this.settings);
    const name = themeName === 'theme-cyber' ? 'Cyberpunk' : (themeName === 'theme-light' ? 'Claro' : 'Escuro');
    this.showToast(`Tema: ${name}`);
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>✨</span><span>${message}</span>`;
    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2400);
  }
}

// Inicializa a aplicação ao carregar a página
window.addEventListener('DOMContentLoaded', () => {
  new MultiGuiasApp();
});

