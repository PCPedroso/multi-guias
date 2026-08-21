// Gerenciamento de Persistência no LocalStorage
import { DEFAULT_WORKSPACES } from './presets.js';

const STORAGE_KEYS = {
  CURRENT_STATE: 'multi_guias_current_state_v1',
  SAVED_WORKSPACES: 'multi_guias_workspaces_v1',
  SETTINGS: 'multi_guias_settings_v1'
};

export const Storage = {
  // Carrega o estado atual salvo ou padrão
  getCurrentState() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_STATE);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Erro ao carregar estado do LocalStorage:', e);
    }
    return {
      layout: 'layout-3-cols',
      activePanesCount: 3,
      panes: [
        { url: 'https://devdocs.io', title: 'DevDocs' },
        { url: 'https://excalidraw.com', title: 'Excalidraw' },
        { url: 'https://pomofocus.io', title: 'Pomodoro Timer' }
      ]
    };
  },

  // Salva o estado atual
  saveCurrentState(state) {
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_STATE, JSON.stringify(state));
    } catch (e) {
      console.warn('Erro ao salvar estado:', e);
    }
  },

  // Obtém lista de workspaces (padrões + customizados)
  getWorkspaces() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SAVED_WORKSPACES);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Erro ao carregar workspaces:', e);
    }
    return DEFAULT_WORKSPACES;
  },

  // Salva um novo workspace customizado
  saveWorkspace(workspace) {
    const list = this.getWorkspaces();
    const existingIndex = list.findIndex(w => w.id === workspace.id);
    if (existingIndex >= 0) {
      list[existingIndex] = workspace;
    } else {
      list.push(workspace);
    }
    localStorage.setItem(STORAGE_KEYS.SAVED_WORKSPACES, JSON.stringify(list));
    return list;
  },

  // Exclui um workspace
  deleteWorkspace(id) {
    let list = this.getWorkspaces();
    list = list.filter(w => w.id !== id);
    localStorage.setItem(STORAGE_KEYS.SAVED_WORKSPACES, JSON.stringify(list));
    return list;
  },

  // Configurações do usuário (Tema, Motor de busca padrão, etc.)
  getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Erro ao carregar configurações:', e);
    }
    return {
      theme: 'theme-dark',
      defaultSearchEngine: 'duckduckgo'
    };
  },

  saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.warn('Erro ao salvar configurações:', e);
    }
  }
};
