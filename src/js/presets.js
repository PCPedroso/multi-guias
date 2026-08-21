// Predefinições de sites e motores de busca populares
export const SEARCH_ENGINES = [
  { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=', icon: '🦆' },
  { id: 'google', name: 'Google Search', url: 'https://www.google.com/search?q=', icon: '🔍' },
  { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q=', icon: '🔎' },
  { id: 'wikipedia', name: 'Wikipédia', url: 'https://pt.wikipedia.org/w/index.php?search=', icon: '📖' },
  { id: 'ecosia', name: 'Ecosia', url: 'https://www.ecosia.org/search?q=', icon: '🌱' },
  { id: 'brave', name: 'Brave Search', url: 'https://search.brave.com/search?q=', icon: '🦁' }
];

export const POPULAR_PRESETS = [
  {
    category: 'Produtividade & Criação',
    items: [
      { name: 'Excalidraw', desc: 'Quadro branco virtual', url: 'https://excalidraw.com', icon: '🎨', badge: 'Compatível' },
      { name: 'CodePen', desc: 'Editor HTML/CSS/JS online', url: 'https://codepen.io/pen/', icon: '💻', badge: 'Dev' },
      { name: 'StackBlitz', desc: 'IDE web rápida', url: 'https://stackblitz.com', icon: '⚡', badge: 'Dev' },
      { name: 'Regex101', desc: 'Testador de Expressões Regulares', url: 'https://regex101.com', icon: '🔍', badge: 'Dev' }
    ]
  },
  {
    category: 'Documentação & Estudos',
    items: [
      { name: 'DevDocs.io', desc: 'Documentações para desenvolvedores', url: 'https://devdocs.io', icon: '📚', badge: 'Produtivo' },
      { name: 'MDN Web Docs', desc: 'Referência Web JavaScript/HTML', url: 'https://developer.mozilla.org', icon: '🌐', badge: 'Doc' },
      { name: 'Wikipédia (PT)', desc: 'Enciclopédia livre', url: 'https://pt.wikipedia.org', icon: '📖', badge: 'Educação' },
      { name: 'W3Schools', desc: 'Tutoriais de Programação', url: 'https://www.w3schools.com', icon: '🎓', badge: 'Estudos' }
    ]
  },
  {
    category: 'Ferramentas & Utilitários',
    items: [
      { name: 'Calculadora Desmos', desc: 'Calculadora científica e gráfica', url: 'https://www.desmos.com/scientific', icon: '🧮', badge: 'Math' },
      { name: 'Pomofocus', desc: 'Timer Pomodoro minimalista', url: 'https://pomofocus.io', icon: '⏱️', badge: 'Foco' },
      { name: 'WorldTimeServer', desc: 'Relógio mundial e fusos', url: 'https://www.worldtimeserver.com', icon: '🌍', badge: 'Tempo' },
      { name: 'JSON Crack', desc: 'Visualizador interativo de JSON', url: 'https://jsoncrack.com/editor', icon: '📊', badge: 'Dev' }
    ]
  },
  {
    category: 'Mídia & Notícias',
    items: [
      { name: 'Hacker News', desc: 'Notícias de tecnologia e startups', url: 'https://news.ycombinator.com', icon: '📰', badge: 'News' },
      { name: 'Radio Garden', desc: 'Rádios do mundo inteiro', url: 'https://radio.garden', icon: '📻', badge: 'Áudio' },
      { name: 'OpenWeatherMap', desc: 'Previsão do tempo global', url: 'https://openweathermap.org', icon: '⛅', badge: 'Clima' }
    ]
  }
];

export const DEFAULT_WORKSPACES = [
  {
    id: 'ws-dev',
    name: '💻 Setup Desenvolvedor',
    layout: 'layout-3-cols',
    panes: [
      { url: 'https://devdocs.io', title: 'DevDocs' },
      { url: 'https://codepen.io/pen/', title: 'CodePen Editor' },
      { url: 'https://regex101.com', title: 'Regex101' }
    ]
  },
  {
    id: 'ws-study',
    name: '📚 Foco & Estudos',
    layout: 'layout-1-plus-2',
    panes: [
      { url: 'https://pt.wikipedia.org/wiki/Portal:Conte%C3%BAdo_destacado', title: 'Wikipédia' },
      { url: 'https://pomofocus.io', title: 'Pomodoro Timer' },
      { url: 'https://www.desmos.com/scientific', title: 'Calculadora' }
    ]
  },
  {
    id: 'ws-compare',
    name: '⚖️ Comparativo Dual',
    layout: 'layout-2-cols',
    panes: [
      { url: 'https://pt.wikipedia.org', title: 'Wikipédia' },
      { url: 'https://devdocs.io', title: 'DevDocs' }
    ]
  }
];
