// src/config/busConfig.js
// Configuração completa do sistema LocalizaBus

// ========== MAPEAMENTO DE BACIAS DO DF ==========
export const BACIA_CORES = {
  PIRACICABANA: {
    cor: '#16a34a', // Verde
    nome: 'Piracicabana',
    nomeExibicao: 'Piracicabana',
    corTexto: 'text-green-700 dark:text-green-400',
    corBg: 'bg-green-100 dark:bg-green-900/30',
    corBorda: 'border-green-200 dark:border-green-800',
    corIcone: 'text-green-600',
    padroesEmpresa: ['piracicabana', 'viação piracicabana', 'piracicabana df', 'pirac'],
    tipo: 'onibus'
  },
  MARECHAL: {
    cor: '#ea580c', // Laranja
    nome: 'Marechal',
    nomeExibicao: 'Marechal',
    corTexto: 'text-orange-700 dark:text-orange-400',
    corBg: 'bg-orange-100 dark:bg-orange-900/30',
    corBorda: 'border-orange-200 dark:border-orange-800',
    corIcone: 'text-orange-600',
    padroesEmpresa: ['marechal', 'viação marechal', 'marechal df', 'marech'],
    tipo: 'onibus'
  },
  PIONEIRA: {
    cor: '#2563eb', // Azul
    nome: 'Pioneira',
    nomeExibicao: 'Pioneira',
    corTexto: 'text-blue-700 dark:text-blue-400',
    corBg: 'bg-blue-100 dark:bg-blue-900/30',
    corBorda: 'border-blue-200 dark:border-blue-800',
    corIcone: 'text-blue-600',
    padroesEmpresa: ['pioneira', 'viação pioneira', 'pioneira df', 'pion'],
    tipo: 'onibus'
  },
  URBI: {
    cor: '#7c3aed', // Violeta
    nome: 'Urbi',
    nomeExibicao: 'Urbi',
    corTexto: 'text-violet-700 dark:text-violet-400',
    corBg: 'bg-violet-100 dark:bg-violet-900/30',
    corBorda: 'border-violet-200 dark:border-violet-800',
    corIcone: 'text-violet-600',
    padroesEmpresa: ['urbi', 'viação urbi', 'urbi df'],
    tipo: 'onibus'
  },
  SAO_JOSE: {
    cor: '#dc2626', // Vermelho
    nome: 'São José',
    nomeExibicao: 'São José',
    corTexto: 'text-red-700 dark:text-red-400',
    corBg: 'bg-red-100 dark:bg-red-900/30',
    corBorda: 'border-red-200 dark:border-red-800',
    corIcone: 'text-red-600',
    padroesEmpresa: ['são josé', 'sao jose', 'viação são josé', 'sao jose df'],
    tipo: 'onibus'
  },
  METRO_GREEN: {
    cor: '#16a34a',
    nome: 'Metrô Verde',
    nomeExibicao: 'Metrô Verde',
    corTexto: 'text-green-700 dark:text-green-400',
    corBg: 'bg-green-100 dark:bg-green-900/30',
    corBorda: 'border-green-200 dark:border-green-800',
    corIcone: 'text-green-600',
    padroesEmpresa: ['metrô verde', 'metro verde'],
    tipo: 'metro'
  },
  METRO_ORANGE: {
    cor: '#ea580c',
    nome: 'Metrô Laranja',
    nomeExibicao: 'Metrô Laranja',
    corTexto: 'text-orange-700 dark:text-orange-400',
    corBg: 'bg-orange-100 dark:bg-orange-900/30',
    corBorda: 'border-orange-200 dark:border-orange-800',
    corIcone: 'text-orange-600',
    padroesEmpresa: ['metrô laranja', 'metro laranja'],
    tipo: 'metro'
  }
};

// ========== ESTADOS DE TEMPO PARA BADGES ==========
export const TEMPO_ESTADOS = {
  LIVE: 'live',
  IMMINENT: 'imminent',
  SCHEDULED: 'scheduled'
};

export const TEMPO_CONFIG = {
  LIMIAR_IMINENTE_MIN: 1,
  CORES: {
    LIVE: '#22c55e',
    IMMINENT: '#ef4444',
    SCHEDULED: '#9ca3af'
  },
  TEXTOS: {
    LIVE: 'Ao Vivo',
    IMMINENT: 'Agora!',
    SCHEDULED: 'Programado'
  }
};

// ========== CONFIGURAÇÕES TOMTOM ==========
export const TOMTOM_CONFIG = {
  API_KEY: 'kVt12B5jgJTHfcvXLLDSPgcX6bz4f7R1',
  CENTRO_BRASILIA: {
    lat: -15.7934,
    lon: -47.8823
  },
  SEARCH_PARAMS: {
    idxSet: 'POI,PAD,STR',
    countrySet: 'BR',
    limit: 5,
    language: 'pt-BR'
  }
};

// ========== FUNÇÃO PARA IDENTIFICAR BACIA POR EMPRESA ==========
export const identificarBaciaPorEmpresa = (companyName, agencyName, lineCode) => {
  if (!companyName && !agencyName && !lineCode) return null;
  
  const textoBusca = `${companyName || ''} ${agencyName || ''} ${lineCode || ''}`.toLowerCase();
  
  for (const bacia of Object.values(BACIA_CORES)) {
    if (bacia.padroesEmpresa?.some(padrao => textoBusca.includes(padrao))) {
      return bacia;
    }
  }
  
  if (textoBusca.includes('marechal') || textoBusca.includes('marech')) {
    return BACIA_CORES.MARECHAL;
  }
  if (textoBusca.includes('piracicabana') || textoBusca.includes('pirac')) {
    return BACIA_CORES.PIRACICABANA;
  }
  if (textoBusca.includes('pioneira') || textoBusca.includes('pion')) {
    return BACIA_CORES.PIONEIRA;
  }
  if (textoBusca.includes('urbi')) {
    return BACIA_CORES.URBI;
  }
  if (textoBusca.includes('são josé') || textoBusca.includes('sao jose')) {
    return BACIA_CORES.SAO_JOSE;
  }
  
  return null;
};

// ========== FUNÇÕES UTILITÁRIAS ==========
export const calcularDistancia = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 + 
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * 
            Math.sin(dLon/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

export const calcularTempoCaminhada = (distanciaKm) => {
  const velocidadeMedia = 5;
  return (distanciaKm / velocidadeMedia) * 60;
};

// ========== LOCAIS FIXOS DO DF ==========
export const DF_FAVORITE_PLACES = [
  {
    name: 'Rodoviária do Plano Piloto',
    address: 'Rodoviária do Plano Piloto, Brasília - DF',
    position: { lat: -15.7939, lon: -47.8828 },
    type: 'Terminal'
  },
  {
    name: 'Terminal Asa Sul',
    address: 'Terminal Asa Sul, Brasília - DF',
    position: { lat: -15.8371, lon: -47.9135 },
    type: 'Terminal'
  },
  {
    name: 'Terminal Asa Norte',
    address: 'Terminal Asa Norte, Brasília - DF',
    position: { lat: -15.7356, lon: -47.8956 },
    type: 'Terminal'
  },
  {
    name: 'Terminal Ceilândia',
    address: 'Terminal Ceilândia, Brasília - DF',
    position: { lat: -15.8162, lon: -48.1068 },
    type: 'Terminal'
  },
  {
    name: 'Terminal Taguatinga',
    address: 'Terminal Taguatinga, Brasília - DF',
    position: { lat: -15.8324, lon: -48.0573 },
    type: 'Terminal'
  },
  {
    name: 'EPCT 85.3 Sul',
    address: 'EPCT 85.3 Sul, Brasília - DF',
    position: { lat: -15.8469, lon: -48.0281 },
    type: 'Parada'
  }
];

// ========== API SEMOB ==========
export const SEMOB_API = {
  STOPS: 'https://otp.mobilibus.com/FY7J-lwk85QGbn/otp/routers/default/index/stops',
  ROUTES: 'https://otp.mobilibus.com/FY7J-lwk85QGbn/otp/routers/default/index/stops'
};