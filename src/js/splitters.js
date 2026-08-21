// Controle de redimensionamento dinâmico (Splitters) via CSS Grid

export class SplitterManager {
  constructor(workspaceElement, onSizeChangeCallback) {
    this.workspace = workspaceElement;
    this.onSizeChange = onSizeChangeCallback;
    this.isDragging = false;
    this.currentSplitter = null;
    this.dragContext = null;
    this.overlay = null;

    this.createIframeOverlay();
    this.bindEvents();
  }

  createIframeOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'splitter-drag-overlay';
    this.overlay.style.position = 'fixed';
    this.overlay.style.top = '0';
    this.overlay.style.left = '0';
    this.overlay.style.width = '100vw';
    this.overlay.style.height = '100vh';
    this.overlay.style.zIndex = '9999';
    this.overlay.style.cursor = 'col-resize';
    this.overlay.style.display = 'none';
    document.body.appendChild(this.overlay);
  }

  bindEvents() {
    this.workspace.addEventListener('mousedown', (e) => {
      const splitter = e.target.closest('.splitter-handle');
      if (splitter) {
        e.preventDefault();
        this.startDrag(splitter, e.clientX, e.clientY);
      }
    });

    this.workspace.addEventListener('touchstart', (e) => {
      const splitter = e.target.closest('.splitter-handle');
      if (splitter && e.touches.length === 1) {
        this.startDrag(splitter, e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    this.workspace.addEventListener('dblclick', (e) => {
      const splitter = e.target.closest('.splitter-handle');
      if (splitter) {
        this.equalizeCurrentLayout();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.onDrag(e.clientX, e.clientY);
      }
    });

    window.addEventListener('touchmove', (e) => {
      if (this.isDragging && e.touches.length === 1) {
        this.onDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    const stopDragHandler = () => {
      if (this.isDragging) {
        this.stopDrag();
      }
    };

    window.addEventListener('mouseup', stopDragHandler);
    window.addEventListener('touchend', stopDragHandler);
    window.addEventListener('touchcancel', stopDragHandler);
    window.addEventListener('blur', stopDragHandler);
  }

  startDrag(splitter, clientX, clientY) {
    this.isDragging = true;
    this.currentSplitter = splitter;
    const isVertical = splitter.dataset.direction === 'vertical';

    this.overlay.style.cursor = isVertical ? 'col-resize' : 'row-resize';
    this.overlay.style.display = 'block';
    document.body.classList.add('is-resizing');
    splitter.classList.add('active');

    const rect = this.workspace.getBoundingClientRect();
    const layout = this.getCurrentLayout();

    // Captura estado atual das colunas/linhas
    const p1 = document.getElementById('pane-1')?.getBoundingClientRect();
    const p2 = document.getElementById('pane-2')?.getBoundingClientRect();
    const p3 = document.getElementById('pane-3')?.getBoundingClientRect();

    this.dragContext = {
      isVertical,
      splitterId: splitter.classList.contains('splitter-1-2') ? 's12' : 's23',
      workspaceRect: rect,
      layout,
      p1,
      p2,
      p3
    };
  }

  getCurrentLayout() {
    const classList = Array.from(this.workspace.classList);
    const layoutClass = classList.find(c => c.startsWith('layout-'));
    return layoutClass || 'layout-3-cols';
  }

  onDrag(clientX, clientY) {
    if (!this.dragContext) return;

    const { isVertical, splitterId, workspaceRect, layout, p1, p2, p3 } = this.dragContext;
    const minSizePx = 120;

    if (layout === 'layout-2-cols' && splitterId === 's12') {
      const relX = clientX - workspaceRect.left;
      const clampedX = Math.max(minSizePx, Math.min(workspaceRect.width - minSizePx, relX));
      const pctA = ((clampedX / workspaceRect.width) * 100).toFixed(2);
      const pctB = (100 - pctA).toFixed(2);
      this.workspace.style.setProperty('--col-1', `${pctA}%`);
      this.workspace.style.setProperty('--col-2', `${pctB}%`);
      this.setTooltip(`${Math.round(pctA)}% | ${Math.round(pctB)}%`);
    } 
    else if (layout === 'layout-2-rows' && splitterId === 's12') {
      const relY = clientY - workspaceRect.top;
      const clampedY = Math.max(minSizePx, Math.min(workspaceRect.height - minSizePx, relY));
      const pctA = ((clampedY / workspaceRect.height) * 100).toFixed(2);
      const pctB = (100 - pctA).toFixed(2);
      this.workspace.style.setProperty('--row-1', `${pctA}%`);
      this.workspace.style.setProperty('--row-2', `${pctB}%`);
      this.setTooltip(`${Math.round(pctA)}% | ${Math.round(pctB)}%`);
    }
    else if (layout === 'layout-3-cols') {
      if (splitterId === 's12') {
        const relX = clientX - workspaceRect.left;
        const currentP3Width = p3 ? p3.width : workspaceRect.width / 3;
        const availableWidth = workspaceRect.width - currentP3Width - 12;
        const clampedX = Math.max(minSizePx, Math.min(availableWidth - minSizePx, relX));
        const width2 = availableWidth - clampedX;

        const pct1 = ((clampedX / workspaceRect.width) * 100).toFixed(2);
        const pct2 = ((width2 / workspaceRect.width) * 100).toFixed(2);
        const pct3 = ((currentP3Width / workspaceRect.width) * 100).toFixed(2);

        this.workspace.style.setProperty('--col-1', `${pct1}%`);
        this.workspace.style.setProperty('--col-2', `${pct2}%`);
        this.workspace.style.setProperty('--col-3', `${pct3}%`);
        this.setTooltip(`${Math.round(pct1)}% | ${Math.round(pct2)}%`);
      } else if (splitterId === 's23') {
        const relX = clientX - workspaceRect.left;
        const currentP1Width = p1 ? p1.width : workspaceRect.width / 3;
        const availableStart = currentP1Width + 6;
        const availableWidth = workspaceRect.width - availableStart;
        const width2 = Math.max(minSizePx, Math.min(availableWidth - minSizePx, relX - availableStart));
        const width3 = availableWidth - width2;

        const pct1 = ((currentP1Width / workspaceRect.width) * 100).toFixed(2);
        const pct2 = ((width2 / workspaceRect.width) * 100).toFixed(2);
        const pct3 = ((width3 / workspaceRect.width) * 100).toFixed(2);

        this.workspace.style.setProperty('--col-1', `${pct1}%`);
        this.workspace.style.setProperty('--col-2', `${pct2}%`);
        this.workspace.style.setProperty('--col-3', `${pct3}%`);
        this.setTooltip(`${Math.round(pct2)}% | ${Math.round(pct3)}%`);
      }
    }
    else if (layout === 'layout-3-rows') {
      if (splitterId === 's12') {
        const relY = clientY - workspaceRect.top;
        const currentP3Height = p3 ? p3.height : workspaceRect.height / 3;
        const availableHeight = workspaceRect.height - currentP3Height - 12;
        const clampedY = Math.max(minSizePx, Math.min(availableHeight - minSizePx, relY));
        const height2 = availableHeight - clampedY;

        const pct1 = ((clampedY / workspaceRect.height) * 100).toFixed(2);
        const pct2 = ((height2 / workspaceRect.height) * 100).toFixed(2);
        const pct3 = ((currentP3Height / workspaceRect.height) * 100).toFixed(2);

        this.workspace.style.setProperty('--row-1', `${pct1}%`);
        this.workspace.style.setProperty('--row-2', `${pct2}%`);
        this.workspace.style.setProperty('--row-3', `${pct3}%`);
        this.setTooltip(`${Math.round(pct1)}% | ${Math.round(pct2)}%`);
      } else if (splitterId === 's23') {
        const relY = clientY - workspaceRect.top;
        const currentP1Height = p1 ? p1.height : workspaceRect.height / 3;
        const availableStart = currentP1Height + 6;
        const availableHeight = workspaceRect.height - availableStart;
        const height2 = Math.max(minSizePx, Math.min(availableHeight - minSizePx, relY - availableStart));
        const height3 = availableHeight - height2;

        const pct1 = ((currentP1Height / workspaceRect.height) * 100).toFixed(2);
        const pct2 = ((height2 / workspaceRect.height) * 100).toFixed(2);
        const pct3 = ((height3 / workspaceRect.height) * 100).toFixed(2);

        this.workspace.style.setProperty('--row-1', `${pct1}%`);
        this.workspace.style.setProperty('--row-2', `${pct2}%`);
        this.workspace.style.setProperty('--row-3', `${pct3}%`);
        this.setTooltip(`${Math.round(pct2)}% | ${Math.round(pct3)}%`);
      }
    }
    else if (layout === 'layout-1-plus-2') {
      if (splitterId === 's12') {
        // Vertical divider entre Pane 1 e Stack Direita
        const relX = clientX - workspaceRect.left;
        const clampedX = Math.max(minSizePx, Math.min(workspaceRect.width - minSizePx, relX));
        const pctMain = ((clampedX / workspaceRect.width) * 100).toFixed(2);
        const pctSide = (100 - pctMain).toFixed(2);
        this.workspace.style.setProperty('--col-main', `${pctMain}%`);
        this.workspace.style.setProperty('--col-side', `${pctSide}%`);
        this.setTooltip(`${Math.round(pctMain)}% | ${Math.round(pctSide)}%`);
      } else if (splitterId === 's23') {
        // Horizontal divider entre Pane 2 e Pane 3
        const relY = clientY - workspaceRect.top;
        const clampedY = Math.max(minSizePx, Math.min(workspaceRect.height - minSizePx, relY));
        const pctTop = ((clampedY / workspaceRect.height) * 100).toFixed(2);
        const pctBottom = (100 - pctTop).toFixed(2);
        this.workspace.style.setProperty('--row-top', `${pctTop}%`);
        this.workspace.style.setProperty('--row-bottom', `${pctBottom}%`);
        this.setTooltip(`${Math.round(pctTop)}% | ${Math.round(pctBottom)}%`);
      }
    }
    else if (layout === 'layout-2-plus-1') {
      if (splitterId === 's12') {
        // Horizontal divider entre Pane 1 e Pane 2 na esquerda
        const relY = clientY - workspaceRect.top;
        const clampedY = Math.max(minSizePx, Math.min(workspaceRect.height - minSizePx, relY));
        const pctTop = ((clampedY / workspaceRect.height) * 100).toFixed(2);
        const pctBottom = (100 - pctTop).toFixed(2);
        this.workspace.style.setProperty('--row-top', `${pctTop}%`);
        this.workspace.style.setProperty('--row-bottom', `${pctBottom}%`);
        this.setTooltip(`${Math.round(pctTop)}% | ${Math.round(pctBottom)}%`);
      } else if (splitterId === 's23') {
        // Vertical divider entre Stack Esquerda e Pane 3
        const relX = clientX - workspaceRect.left;
        const clampedX = Math.max(minSizePx, Math.min(workspaceRect.width - minSizePx, relX));
        const pctSide = ((clampedX / workspaceRect.width) * 100).toFixed(2);
        const pctMain = (100 - pctSide).toFixed(2);
        this.workspace.style.setProperty('--col-side', `${pctSide}%`);
        this.workspace.style.setProperty('--col-main', `${pctMain}%`);
        this.setTooltip(`${Math.round(pctSide)}% | ${Math.round(pctMain)}%`);
      }
    }
  }

  setTooltip(text) {
    if (this.currentSplitter) {
      this.currentSplitter.setAttribute('data-tooltip', text);
    }
  }

  stopDrag() {
    this.isDragging = false;
    this.overlay.style.display = 'none';
    document.body.classList.remove('is-resizing');

    if (this.currentSplitter) {
      this.currentSplitter.classList.remove('active');
      this.currentSplitter = null;
    }
    this.dragContext = null;

    if (typeof this.onSizeChange === 'function') {
      this.onSizeChange();
    }
  }

  equalizeCurrentLayout() {
    // Limpa todas as variáveis CSS Grid personalizadas, voltando ao default proporcional 1fr
    this.workspace.style.removeProperty('--col-1');
    this.workspace.style.removeProperty('--col-2');
    this.workspace.style.removeProperty('--col-3');
    this.workspace.style.removeProperty('--col-main');
    this.workspace.style.removeProperty('--col-side');
    this.workspace.style.removeProperty('--row-1');
    this.workspace.style.removeProperty('--row-2');
    this.workspace.style.removeProperty('--row-3');
    this.workspace.style.removeProperty('--row-top');
    this.workspace.style.removeProperty('--row-bottom');

    const panes = this.workspace.querySelectorAll('.browser-pane');
    panes.forEach(pane => {
      pane.style.flex = '';
      pane.style.width = '';
      pane.style.height = '';
    });

    if (typeof this.onSizeChange === 'function') {
      this.onSizeChange();
    }
  }
}
