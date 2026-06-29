// Bilingual UI strings (English / Spanish). Person data stays in its source language;
// this only translates the interface chrome.
const STR = {
  en: {
    lockTitle: 'A Family Tree', lockSub: 'This is a private family archive. Please enter the family password.',
    lockPlaceholder: 'Family password', lockButton: 'Unlock', lockWrong: 'Incorrect password — please try again.',
    lockInsecure: 'This page must be opened over https:// to decrypt.',
    searchPlaceholder: 'Search a name…',
    navTree: 'Tree', navTimeline: 'Timeline', navJourney: 'Journey', navSources: 'Documents',
    navStory: 'Story', navRelated: 'Relate',
    footer: 'Private family tree — generated from the family GEDCOM, research vault and documents. Please do not share publicly.',
    living: 'Living', livingNote: 'Living — recorded privately for the family.',
    born: 'Born', baptized: 'Baptized', immigrated: 'Immigrated', died: 'Died', buried: 'Buried', lived: 'Lived',
    occupation: 'Occupation', parents: 'Parents', siblings: 'Siblings', children: 'Children',
    biography: 'Biography', documents: 'Documents', sources: 'Sources', notes: 'Notes',
    discrepancies: 'Conflicting records', relationships: 'Family',
    researchNotes: "Researcher's notes", archiveNotes: 'Archive notes', life: 'Life', story: 'Their story',
    readProfile: 'Read full profile', backToTree: 'Back to the tree', livingFriendly: 'A living member of the family.',
    copyLink: 'Copy link', linkCopied: 'Link copied!', printSheet: 'Print',
    introTitle: 'Welcome to the family archive',
    introBody: 'Search a name up top · click a card to centre the tree on that family · ＋ grows a branch · the tabs open the Story, Timeline, Travesía and Documents.',
    introOk: 'Explore',
    married: 'married', divorced: 'divorced', partners: 'partners', outOfMarriage: 'parents',
    alsoKnown: 'Also known as', generation: 'Generation', recenter: 'Center on the main person', fit: 'Fit to screen',
    expandAll: 'Expand all', focusView: 'Focus view', expandAllHint: 'Show the whole family tree',
    focusViewHint: 'Show one family at a time', expandBranch: 'Show more relatives',
    treeHint: 'Click a card to centre on their family · ＋ adds relatives · drag to pan, scroll to zoom',
    transcription: 'Transcription', translation: 'Translation', citation: 'Citation', fullNote: 'Full note',
    openOriginal: 'Open original (PDF)', page: 'Page', appearsOn: 'Appears on', viewDocument: 'View document',
    timelineTitle: 'A Family Through Time', timelineLead: 'Every documented event, 1847 → today.',
    journeyTitle: 'The Family Journey', journeyLead: 'Four countries, seven generations.',
    playJourney: 'Play the journey', globeView: 'Globe', mapView: 'Map', prev: 'Previous', next: 'Next',
    pause: 'Pause', whoTravelled: 'Who travelled',
    viewOnMap: 'View on the map', seeOnTimeline: 'See on the timeline', whoWasHere: 'Who was here',
    lifeMap: 'Their life on the map',
    sourcesTitle: 'The Documents', sourcesLead: 'Every record gathered for the family.',
    storyTitle: 'The Family Story', relatedTitle: 'How are we related?',
    relatedLead: 'Choose two people to see how they connect.', personA: 'Person', personB: 'and',
    personFirst: 'First person', personSecond: 'Second person', computeRel: 'Show relationship',
    allTypes: 'All', filterSurname: 'Family', filterPlace: 'Place', filterAll: 'All', voyageFilter: '✦ Migration',
    noResults: 'No matches', searchHint: 'Looking for a place or document?', closeAria: 'Close',
  },
  es: {
    lockTitle: 'Un Árbol Familiar', lockSub: 'Este es un archivo familiar privado. Por favor ingrese la contraseña de la familia.',
    lockPlaceholder: 'Contraseña familiar', lockButton: 'Entrar', lockWrong: 'Contraseña incorrecta — intente de nuevo.',
    lockInsecure: 'Esta página debe abrirse por https:// para descifrar.',
    searchPlaceholder: 'Buscar un nombre…',
    navTree: 'Árbol', navTimeline: 'Cronología', navJourney: 'Travesía', navSources: 'Documentos',
    navStory: 'Historia', navRelated: 'Parentesco',
    footer: 'Árbol familiar privado — generado del GEDCOM, el archivo de investigación y los documentos. Por favor no compartir públicamente.',
    living: 'Vive', livingNote: 'Persona viva — registrada de forma privada para la familia.',
    born: 'Nació', baptized: 'Bautizo', immigrated: 'Emigró', died: 'Falleció', buried: 'Sepelio', lived: 'Vivió',
    occupation: 'Oficio', parents: 'Padres', siblings: 'Hermanos', children: 'Hijos',
    biography: 'Biografía', documents: 'Documentos', sources: 'Fuentes', notes: 'Notas',
    discrepancies: 'Registros en conflicto', relationships: 'Familia',
    researchNotes: 'Notas del investigador', archiveNotes: 'Notas de archivo', life: 'Vida', story: 'Su historia',
    readProfile: 'Ver perfil completo', backToTree: 'Volver al árbol', livingFriendly: 'Un miembro vivo de la familia.',
    copyLink: 'Copiar enlace', linkCopied: '¡Enlace copiado!', printSheet: 'Imprimir',
    introTitle: 'Bienvenido al archivo familiar',
    introBody: 'Busca un nombre arriba · haz clic en una tarjeta para centrar el árbol en esa familia · ＋ añade una rama · las pestañas abren la Historia, la Cronología, la Travesía y los Documentos.',
    introOk: 'Explorar',
    married: 'casado', divorced: 'divorciado', partners: 'pareja', outOfMarriage: 'padres',
    alsoKnown: 'También conocido como', generation: 'Generación', recenter: 'Centrar en la persona principal', fit: 'Ajustar a pantalla',
    expandAll: 'Expandir todo', focusView: 'Vista enfocada', expandAllHint: 'Mostrar todo el árbol',
    focusViewHint: 'Mostrar una familia a la vez', expandBranch: 'Mostrar más parientes',
    treeHint: 'Clic en una tarjeta para centrar su familia · ＋ añade parientes · arrastra para mover, rueda para acercar',
    transcription: 'Transcripción', translation: 'Traducción', citation: 'Cita', fullNote: 'Nota completa',
    openOriginal: 'Abrir original (PDF)', page: 'Página', appearsOn: 'Aparece en', viewDocument: 'Ver documento',
    timelineTitle: 'Una Familia en el Tiempo', timelineLead: 'Cada evento documentado, 1847 → hoy.',
    journeyTitle: 'La Travesía Familiar', journeyLead: 'Cuatro países, siete generaciones.',
    playJourney: 'Reproducir la travesía', globeView: 'Globo', mapView: 'Mapa', prev: 'Anterior', next: 'Siguiente',
    pause: 'Pausar', whoTravelled: 'Quiénes viajaron',
    viewOnMap: 'Ver en el mapa', seeOnTimeline: 'Ver en la cronología', whoWasHere: 'Quiénes estuvieron aquí',
    lifeMap: 'Su vida en el mapa',
    sourcesTitle: 'Los Documentos', sourcesLead: 'Cada registro reunido para la familia.',
    storyTitle: 'La Historia Familiar', relatedTitle: '¿Cómo somos parientes?',
    relatedLead: 'Elige dos personas para ver cómo se conectan.', personA: 'Persona', personB: 'y',
    personFirst: 'Primera persona', personSecond: 'Segunda persona', computeRel: 'Ver parentesco',
    allTypes: 'Todos', filterSurname: 'Familia', filterPlace: 'Lugar', filterAll: 'Todos', voyageFilter: '✦ Migración',
    noResults: 'Sin coincidencias', searchHint: '¿Buscas un lugar o documento?', closeAria: 'Cerrar',
  },
};

let lang = localStorage.getItem('fam-lang') || 'es';
const listeners = [];

export function t(key) { return (STR[lang] && STR[lang][key]) || STR.en[key] || key; }
export function getLang() { return lang; }
export function onLangChange(fn) { listeners.push(fn); }

export function setLang(l) {
  lang = l; localStorage.setItem('fam-lang', l);
  applyStatic();
  listeners.forEach((fn) => fn(l));
}
export function toggleLang() { setLang(lang === 'en' ? 'es' : 'en'); }

export function applyStatic() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((n) => { n.placeholder = t(n.dataset.i18nPh); });
  const tog = document.getElementById('lang-toggle');
  if (tog) {
    tog.textContent = lang === 'en' ? 'ES' : 'EN';
    tog.title = lang === 'en' ? 'Cambiar a español' : 'Switch to English';   // clarify the target
    tog.setAttribute('aria-label', tog.title);
  }
}
