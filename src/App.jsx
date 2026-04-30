import React, { useState, useEffect, useRef, useCallback, Component } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bus, Footprints, MapPin, Train, Clock, ArrowRight,
  ChevronDown, Circle, Navigation, Search, AlertCircle,
  Loader2, Sun, Moon, AlertTriangle
} from 'lucide-react';
import axios from 'axios';
import RouteResultRefatorado from './components/RouteResultRefatorado';
import SimpleMap from './components/SimpleMap';
import { findLocalDfPlaces, getSEMOBStops, getRoutesByStop } from './services/semobStops';

// ─── API CONFIG ────────────────────────────────
const TOMTOM_API_KEY = 'kVt12B5jgJTHfcvXLLDSPgcX6bz4f7R1';
const SEMOB_API_BASE = 'https://otp.mobilibus.com/FY7J-lwk85QGbn/otp/routers/default';
const API_URL = 'https://teste-6eye.onrender.com/api';

// Normaliza códigos para comparar SEMOB x GPS
const normalizeLineCode = (value) => String(value || '')
  .toLowerCase()
  .replace('linha', '')
  .replace(/[^0-9a-z.]/g, '')
  .replace(/^0+(?=\d)/, '')
  .trim();

const sameLine = (a, b) => {
  const x = normalizeLineCode(a);
  const y = normalizeLineCode(b);
  return !!x && !!y && (x === y || x.endsWith(y) || y.endsWith(x));
};

const getEtaMinutes = (eta) => {
  if (!eta) return null;
  const minutes = Math.round((new Date(eta).getTime() - Date.now()) / 60000);
  return Number.isFinite(minutes) ? Math.max(minutes, 0) : null;
};

// ─── XSS PREVENTION ────────────────────────────
const sanitizeInput = (value) => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/[<>"'`]/g, '')
    .slice(0, 300);
};

// ─── ERROR BOUNDARY ─────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e, i) { console.error('[ErrorBoundary]', e, i); }
  render() {
    if (this.state.hasError) return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center p-8 rounded-3xl bg-[var(--card-bg)] border border-[var(--border)] shadow-2xl max-w-sm mx-4">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2 tracking-tight">Algo deu errado</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-6">Um erro inesperado ocorreu. Recarregue a página.</p>
          <button onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-full bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity">
            Recarregar
          </button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

// ─── SPRING ─────────────────────────────────────
const spring = { type: 'spring', stiffness: 120, damping: 22 };

const carouselImages = [
  { src: 'https://wallpaperaccess.com/full/2073412.jpg', title: 'Catedral de Brasília' },
  { src: 'https://wallpaperaccess.com/full/2073407.jpg', title: 'Estádio Mané Garrincha' },
  { src: 'https://wallpaperaccess.com/full/2073416.jpg', title: 'Brasília à noite' },
];

// ─── ROUTE SEARCH HOOK ───────────────────────────
const useRouteSearch = () => {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [realtimeVehicles, setRealtimeVehicles] = useState([]);
  const isSearchingRef = useRef(false);
  const intervalRef = useRef(null);
  const abortControllerRef = useRef(null);

  const getRealtimeVehicles = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/realtime-vehicles`, { timeout: 65000 });
      if (response.data.success && response.data.vehicles) {
        setRealtimeVehicles(response.data.vehicles);
        return response.data.vehicles;
      }
      return [];
    } catch { return []; }
  }, []);

  const geocodeAddress = async (address, signal) => {
    const safe = sanitizeInput(address);
    const response = await axios.get(
      `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(safe)}.json`,
      { params: { key: TOMTOM_API_KEY, countrySet: 'BR', limit: 1 }, signal }
    );
    if (response.data.results?.[0]) {
      const loc = response.data.results[0].position;
      return { lat: loc.lat, lon: loc.lon, displayName: response.data.results[0].address.freeformAddress };
    }
    throw new Error('Endereço não encontrado');
  };

  const getSEMOBRoute = async (origin, destination, signal, mode = 'bus') => {
    try {
      const response = await axios.get(`${SEMOB_API_BASE}/plan`, {
        params: { 
          fromPlace: `${origin.lat},${origin.lon}`, 
          toPlace: `${destination.lat},${destination.lon}`,
          mode: mode === 'walk' ? 'WALK' : 'TRANSIT,WALK', 
          locale: 'pt_BR', 
          numItineraries: 3, 
          walkSpeed: 1.4, 
          wheelchair: false, 
          showIntermediateStops: true 
        },
        timeout: 60000, 
        signal
      });
      return response.data?.plan?.itineraries || [];
    } catch { return []; }
  };

  const calcDist = (p1, p2) => {
    const R = 6371, dLat = (p2.lat - p1.lat) * Math.PI / 180, dLon = (p2.lon - p1.lon) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(p1.lat*Math.PI/180)*Math.cos(p2.lat*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const getNearbyBuses = async (coords, signal) => {
    try {
      const r = await axios.get(`${SEMOB_API_BASE}/index/stops`, { 
        params: { lat: coords.lat, lon: coords.lon, radius: 1000 }, 
        timeout: 10000, 
        signal 
      });
      if (Array.isArray(r.data)) return r.data.filter(s => calcDist(coords, s) < 1).slice(0, 5)
        .map(s => ({ stopId: s.id, stopName: s.name, lat: s.lat, lon: s.lon, distanceKm: calcDist(coords, s) }));
    } catch {}
    return [{ stopId: '1', stopName: 'Parada Eixo Monumental', distanceKm: 0.3 },
      { stopId: '2', stopName: 'Parada W3 Sul', distanceKm: 0.5 }];
  };

  const combineRoutes = (itineraries, _stops, origin, destination) => {
    if (!itineraries?.length) return [];
    const out = [];
    itineraries.forEach((it, idx) => {
      const legs = it.legs || [];
      const transit = legs.filter(l => l.mode && l.mode !== 'WALK');
      const walkTime = legs.filter(l => l.mode === 'WALK').reduce((s, l) => s + (l.duration || 0), 0) / 60;
      const totalDur = (it.duration || 0) / 60;
      transit.forEach((leg, li) => {
        const routeId = leg.route || leg.routeId || leg.trip?.routeId || 'N/A';
        const shortName = leg.routeShortName || leg.trip?.routeShortName || routeId;
        out.push({
          id: `${routeId}_${idx}_${li}`, 
          line: shortName, 
          routeId,
          destination, 
          origin,
          time: Math.ceil(leg.duration / 60 || totalDur), 
          estimatedTime: totalDur,
          stops: leg.intermediateStops?.length || Math.floor(Math.random() * 15) + 3,
          distance: (leg.distance / 1000).toFixed(1),
          walkMinutes: Math.ceil(walkTime),
          fromStop: leg.from?.name || 'Ponto de embarque',
          toStop: leg.to?.name || 'Ponto de desembarque',
          mode: leg.mode,
          company: leg.routeShortName || leg.agencyName || '',
          agency: leg.agencyId || '',
          instruction: `Pegue a linha ${shortName} no ponto ${leg.from?.name || 'próximo'}`,
          tripId: leg.trip?.id
        });
      });
    });
    return out.slice(0, 5);
  };

  const searchRoute = async (originAddress, destinationAddress, mode) => {
    if (!originAddress || !destinationAddress || isSearchingRef.current) return;
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;
    isSearchingRef.current = true;
    setLoading(true); 
    setError(null);
    try {
      const [originCoords, destCoords] = await Promise.all([
        geocodeAddress(originAddress, signal),
        geocodeAddress(destinationAddress, signal)
      ]);
      const realtimeData = await getRealtimeVehicles();
      window.__lastOriginCoords = originCoords;
      const transitRoute = await getSEMOBRoute(originCoords, destCoords, signal, mode);
      const nearbyBuses = await getNearbyBuses(originCoords, signal);
      const combined = combineRoutes(transitRoute, nearbyBuses, originAddress, destinationAddress);
      setRoutes(combined.map(r => {
        const rv = realtimeData.find(v => sameLine(v.line, r.line) || sameLine(v.routeId, r.routeId));
        if (rv) {
          const etaMin = getEtaMinutes(rv.eta);
          return { 
            ...r, 
            time: etaMin ?? r.time, 
            realTimeGPS: { lat: rv.lat, lon: rv.lon, bearing: rv.bearing, speed: rv.speed, eta: rv.eta }, 
            isLive: true,
            company: rv.company || r.company || '',
            agency: rv.agency || r.agency || ''
          };
        }
        return { ...r, isLive: false };
      }));
    } catch (err) {
      if (!axios.isCancel(err) && err.name !== 'AbortError') setError(err.message || 'Erro ao buscar rotas');
    } finally {
      setLoading(false); 
      isSearchingRef.current = false;
    }
  };

  useEffect(() => {
    const refresh = async () => {
      if (window.__lastOriginCoords) {
        const nv = await getRealtimeVehicles();
        setRoutes(prev => prev.map(r => {
          const rv = nv.find(v => sameLine(v.line, r.line) || sameLine(v.routeId, r.routeId));
          if (rv) {
            const etaMin = getEtaMinutes(rv.eta);
            return { 
              ...r, 
              time: etaMin ?? r.time, 
              realTimeGPS: { lat: rv.lat, lon: rv.lon, bearing: rv.bearing, speed: rv.speed, eta: rv.eta }, 
              isLive: true,
              company: rv.company || r.company || '',
              agency: rv.agency || r.agency || ''
            };
          }
          return { ...r, isLive: false };
        }));
      }
    };
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(refresh, 60000);
    return () => { clearInterval(intervalRef.current); abortControllerRef.current?.abort(); };
  }, [getRealtimeVehicles]);

  return { routes, loading, error, searchRoute, realtimeVehicles };
};

// ─── LOCATION INPUT ──────────────────────────────
const LocationInput = ({ value, onChange, onPlaceSelect, placeholder, icon: Icon, onDetectLocation, detectingLocation }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sugLoading, setSugLoading] = useState(false);
  const inputRef = useRef(null);
  const debRef = useRef(null);
  const abortRef = useRef(null);

  const fetchSuggestions = async (q) => {
    const safe = sanitizeInput(q);
    if (!safe || safe.length < 3) { setSuggestions([]); return; }
    
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setSugLoading(true);
    
    try {
      // 1. Locais fixos do DF
      const localPlaces = findLocalDfPlaces(safe).map(place => ({
        ...place,
        displayName: place.name,
        position: place.position,
        type: 'terminal',
        source: 'DF'
      }));
      
      // 2. Paradas SEMOB
      let semobStops = [];
      try {
        const allStops = await getSEMOBStops();
        semobStops = allStops
          .filter(stop => 
            stop.name.toLowerCase().includes(safe.toLowerCase()) ||
            (stop.code && stop.code.toString().includes(safe))
          )
          .slice(0, 5)
          .map(stop => ({
            ...stop,
            displayName: `${stop.name} ${stop.code ? '• ' + stop.code : ''}`,
            position: { lat: stop.lat, lon: stop.lon },
            type: 'parada_semob',
            source: 'SEMOB',
            stopId: stop.id
          }));
      } catch (e) {
        console.log('SEMOB indisponível, continuando...');
      }
      
      // 3. TomTom
      let tomtomResults = [];
      try {
        const r = await axios.get(
          `https://api.tomtom.com/search/2/search/${encodeURIComponent(safe)}.json`,
          { 
            params: {
              key: TOMTOM_API_KEY,
              idxSet: 'POI,PAD,STR',
              countrySet: 'BR',
              lat: -15.7934,
              lon: -47.8823,
              radius: 50000,
              limit: 5,
              language: 'pt-BR'
            },
            signal: abortRef.current.signal 
          }
        );
        
        if (r.data?.results) {
          tomtomResults = r.data.results
            .filter(result => {
              const name = (result.address?.freeformAddress || '').toLowerCase();
              return !localPlaces.some(p => 
                p.name.toLowerCase().includes(name) || 
                name.includes(p.name.toLowerCase())
              );
            })
            .map(result => ({
              displayName: result.address.freeformAddress,
              position: result.position,
              type: 'endereco',
              source: 'TomTom',
              address: result.address
            }));
        }
      } catch (e) {
        if (!axios.isCancel(e)) {
          console.log('TomTom indisponível');
        }
      }
      
      const allSuggestions = [...localPlaces, ...semobStops, ...tomtomResults];
      setSuggestions(allSuggestions);
      setShowSuggestions(true);
      
    } catch (e) { 
      if (!axios.isCancel(e)) {
        console.error('Erro na busca:', e);
        const fallbackPlaces = findLocalDfPlaces(safe);
        if (fallbackPlaces.length > 0) {
          setSuggestions(fallbackPlaces.map(p => ({
            ...p,
            displayName: p.name,
            position: p.position
          })));
          setShowSuggestions(true);
        }
      }
    } finally { 
      setSugLoading(false); 
    }
  };

  const handleChange = (e) => {
    const safe = sanitizeInput(e.target.value);
    onChange(safe);
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => fetchSuggestions(safe), 500);
  };

  const handleSuggestionClick = (suggestion) => {
    onChange(suggestion.displayName || suggestion.name);
    if (onPlaceSelect) {
      onPlaceSelect({
        name: suggestion.displayName || suggestion.name,
        position: suggestion.position,
        type: suggestion.type || 'local',
        stopId: suggestion.stopId
      });
    }
    setShowSuggestions(false);
    setSuggestions([]);
  };

  useEffect(() => {
    const h = (e) => { if (inputRef.current && !inputRef.current.contains(e.target)) setShowSuggestions(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="relative" ref={inputRef}>
      <div className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 z-10">
        <div className="rounded-full bg-[var(--accent)]/10 p-1 md:p-1.5">
          <Icon className="h-3.5 w-3.5 md:h-4 md:w-4 text-[var(--accent)]" strokeWidth={1.5} />
        </div>
      </div>
      <input
        type="text" value={value} onChange={handleChange} placeholder={placeholder}
        autoComplete="off" spellCheck={false} maxLength={300}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        className="w-full rounded-xl md:rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] pl-10 md:pl-12 pr-20 md:pr-28 py-3 md:py-3.5 text-sm md:text-base text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all duration-200"
      />
      <div className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {sugLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent)]" />}
        {onDetectLocation && (
          <motion.button whileTap={{ scale: 0.92 }} onClick={onDetectLocation} disabled={detectingLocation}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] md:text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors duration-200">
            {detectingLocation ? <Loader2 className="h-3 w-3 animate-spin" /> : <Navigation className="h-3 w-3" />}
            <span className="hidden sm:inline">Usar local</span>
          </motion.button>
        )}
      </div>
      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.14 }}
            className="absolute z-20 w-full mt-1.5 bg-[var(--dropdown-bg)] backdrop-blur-xl rounded-xl shadow-xl border border-[var(--border)] max-h-56 overflow-y-auto">
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => handleSuggestionClick(s)}
                className="w-full text-left px-4 py-2.5 hover:bg-[var(--accent)]/8 transition-colors border-b border-[var(--border)] last:border-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{s.displayName || s.name}</p>
                <p className="text-xs text-[var(--text-tertiary)] truncate">{s.source || s.type}</p>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── THEME TOGGLE ────────────────────────────────
const ThemeToggle = ({ dark, onToggle }) => (
  <motion.button onClick={onToggle} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} aria-label="Alternar tema"
    className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/20 dark:bg-black/30 backdrop-blur-xl border border-white/30 dark:border-white/10 flex items-center justify-center shadow-lg">
    <AnimatePresence mode="wait">
      <motion.div key={dark ? 'sun' : 'moon'} initial={{ opacity: 0, rotate: -40, scale: 0.5 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: 40, scale: 0.5 }} transition={{ duration: 0.18 }}>
        {dark ? <Sun className="h-4 w-4 text-yellow-300" strokeWidth={1.8} /> : <Moon className="h-4 w-4 text-slate-800" strokeWidth={1.8} />}
      </motion.div>
    </AnimatePresence>
  </motion.button>
);

// ─── APP ─────────────────────────────────────────
function App() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originPlace, setOriginPlace] = useState(null);
  const [destinationPlace, setDestinationPlace] = useState(null);
  const [resolvedOriginCoords, setResolvedOriginCoords] = useState(null);
  const [resolvedDestinationCoords, setResolvedDestinationCoords] = useState(null);
  const [selectedMode, setSelectedMode] = useState('bus');
  const [hasSearched, setHasSearched] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [dark, setDark] = useState(() => { try { return localStorage.getItem('lb-theme') === 'dark'; } catch { return false; } });
  const { routes, loading, error, searchRoute } = useRouteSearch();
  const searchRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('lb-theme', dark ? 'dark' : 'light'); } catch {}
  }, [dark]);

  useEffect(() => {
    const id = setInterval(() => setActiveSlide(p => (p + 1) % carouselImages.length), 5000);
    return () => clearInterval(id);
  }, []);

  const detectLocation = async (setter) => {
    setLocationLoading(true);
    if (!navigator.geolocation) { setLocationLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await axios.get(`https://api.tomtom.com/search/2/reverseGeocode/${pos.coords.latitude},${pos.coords.longitude}.json`,
            { params: { key: TOMTOM_API_KEY, returnSpeedLimit: false, language: 'pt-BR' } });
          if (r.data.addresses?.[0]) setter(r.data.addresses[0].address.freeformAddress);
        } catch {} finally { setLocationLoading(false); }
      },
      () => setLocationLoading(false)
    );
  };

  const geocodeAddress = async (address) => {
    const safe = sanitizeInput(address);
    const response = await axios.get(
      `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(safe)}.json`,
      { params: { key: TOMTOM_API_KEY, countrySet: 'BR', limit: 1 } }
    );
    if (response.data.results?.[0]) {
      return response.data.results[0].position;
    }
    throw new Error('Endereço não encontrado');
  };

  const handleSearch = async () => {
    const safeO = sanitizeInput(origin);
    const safeD = sanitizeInput(destination);
    if (!safeO || !safeD) return;
    setHasSearched(true);
    
    // Resolver coordenadas para modo caminhada
    if (selectedMode === 'walk') {
      let originCoords = originPlace?.position;
      let destCoords = destinationPlace?.position;
      
      try {
        if (!originCoords) {
          const geocoded = await geocodeAddress(safeO);
          originCoords = { lat: geocoded.lat, lon: geocoded.lon };
        }
        if (!destCoords) {
          const geocoded = await geocodeAddress(safeD);
          destCoords = { lat: geocoded.lat, lon: geocoded.lon };
        }
        
        setResolvedOriginCoords(originCoords);
        setResolvedDestinationCoords(destCoords);
      } catch (err) {
        console.error('Erro ao resolver coordenadas:', err);
      }
    }
    
    await searchRoute(safeO, safeD, selectedMode);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] transition-colors duration-500 font-apple">
      <ThemeToggle dark={dark} onToggle={() => setDark(d => !d)} />

      {/* HERO */}
      <div className="relative h-screen flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div key={activeSlide} initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.2 }} className="absolute inset-0">
            <img src={carouselImages[activeSlide].src} alt={carouselImages[activeSlide].title} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/35 to-black/70" />
          </motion.div>
        </AnimatePresence>

        <div className="relative z-10 text-center px-4 sm:px-6 max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, ...spring }}>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-xl px-4 py-2 mb-6 border border-white/20">
              <Circle className="h-1.5 w-1.5 fill-green-400 text-green-400 animate-pulse" />
              <span className="text-[11px] md:text-xs font-medium text-white/90 tracking-wide">GPS REAL — Veículos monitorados ao vivo</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-[5.5rem] font-bold text-white mb-4 leading-[1.04] tracking-[-0.03em]">
              Mobilidade em<br className="hidden sm:block" /> Brasília
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-white/85 mb-8 md:mb-10 tracking-[-0.01em]">
              O monitoramento mais veloz da capital, a um toque de você.
            </p>
            <motion.button onClick={() => searchRef.current?.scrollIntoView({ behavior: 'smooth' })}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="bg-[var(--accent)] text-white rounded-full px-7 py-3.5 md:px-9 md:py-4 font-semibold text-sm md:text-base inline-flex items-center gap-2 shadow-2xl shadow-blue-600/25 hover:opacity-92 transition-opacity duration-200">
              Planejar minha viagem
              <ChevronDown className="h-4 w-4 md:h-5 md:w-5" />
            </motion.button>
          </motion.div>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {carouselImages.map((_, i) => (
            <button key={i} onClick={() => setActiveSlide(i)}
              className={`h-1 rounded-full transition-all duration-500 ${i === activeSlide ? 'w-7 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'}`} />
          ))}
        </div>
      </div>

      {/* SEARCH */}
      <div ref={searchRef} className="max-w-2xl mx-auto px-4 -mt-14 md:-mt-20 pb-24 relative z-10">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, ...spring }}
          className="bg-[var(--card-bg)] backdrop-blur-xl rounded-2xl md:rounded-3xl shadow-2xl border border-[var(--border)] overflow-hidden">
          <div className="px-6 md:px-8 py-4 md:py-5 border-b border-[var(--border)] bg-gradient-to-r from-[var(--accent)]/5 to-transparent">
            <h2 className="text-base md:text-lg font-semibold text-[var(--text-primary)] tracking-tight">Planeje sua rota</h2>
            <p className="text-xs md:text-sm text-[var(--text-secondary)] mt-0.5">Busque por ônibus ao vivo</p>
          </div>

          <div className="p-6 md:p-8">
            <div className="space-y-3">
              <LocationInput 
                value={origin} 
                onChange={setOrigin} 
                onPlaceSelect={setOriginPlace}
                placeholder="Ponto de partida" 
                icon={MapPin}
                onDetectLocation={() => detectLocation(setOrigin)} 
                detectingLocation={locationLoading} 
              />
              <LocationInput 
                value={destination} 
                onChange={setDestination} 
                onPlaceSelect={setDestinationPlace}
                placeholder="Para onde você vai?" 
                icon={Search}
                onDetectLocation={() => detectLocation(setDestination)} 
                detectingLocation={locationLoading} 
              />
            </div>

            <div className="mt-6">
              <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-widest mb-3">Tipo de transporte</p>
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                {[
                  { name: 'Ônibus', type: 'bus', icon: Bus, desc: 'GPS Real ao vivo' },
                  { name: 'Metrô', type: 'metro', icon: Train, desc: 'Metrô-DF' },
                  { name: 'Caminhada', type: 'walk', icon: Footprints, desc: 'Trajeto a pé' },
                ].map((m) => (
                  <motion.button key={m.type} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setSelectedMode(m.type)}
                    className={`rounded-xl md:rounded-2xl border p-3 md:p-4 text-center transition-all duration-200 ${selectedMode === m.type
                      ? 'border-[var(--accent)] bg-[var(--accent)]/8 shadow-sm'
                      : 'border-[var(--border)] bg-[var(--input-bg)] hover:border-[var(--accent)]/40'}`}>
                    <m.icon className={`h-5 w-5 mx-auto mb-1.5 ${selectedMode === m.type ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`} strokeWidth={1.6} />
                    <p className={`text-xs font-semibold tracking-tight ${selectedMode === m.type ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>{m.name}</p>
                    <p className="hidden md:block text-[10px] text-[var(--text-tertiary)] mt-0.5">{m.desc}</p>
                  </motion.button>
                ))}
              </div>
            </div>

            <motion.button whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.98 }}
              onClick={handleSearch} disabled={!origin || !destination || loading}
              className={`mt-6 w-full rounded-xl md:rounded-2xl py-3 md:py-3.5 font-semibold flex items-center justify-center gap-2 text-sm md:text-base tracking-tight transition-all duration-200 ${
                origin && destination && !loading
                  ? 'bg-[var(--accent)] text-white hover:opacity-92 shadow-lg shadow-[var(--accent)]/20'
                  : 'bg-[var(--disabled-bg)] text-[var(--disabled-text)] cursor-not-allowed'}`}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Buscando com GPS REAL…</> : 'Buscar rota agora'}
            </motion.button>

            {/* Mapa simples para modo caminhada */}
                        {/* Mapa simples para modo caminhada */}
            {selectedMode === 'walk' && resolvedOriginCoords && resolvedDestinationCoords && (
              <SimpleMap
                origin={resolvedOriginCoords}
                destination={resolvedDestinationCoords}
                originName={origin}
                destinationName={destination}
              />
            )}

            {(hasSearched || routes.length > 0) && (
              <RouteResultRefatorado 
                routes={routes} 
                origin={origin} 
                destination={destination} 
                loading={loading} 
              />
            )}

            {error && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="mt-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm flex items-center gap-2 border border-red-200 dark:border-red-800/50">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
              </motion.div>
            )}

            {!loading && hasSearched && !routes.length && !error && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="mt-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 p-3 rounded-xl text-sm text-center border border-amber-200 dark:border-amber-800/50">
                Nenhuma rota encontrada. Tente ajustar origem ou destino.
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function WrappedApp() {
  return <ErrorBoundary><App /></ErrorBoundary>;
}