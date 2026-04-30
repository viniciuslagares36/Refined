// src/components/RouteResultRefatorado.jsx
import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bus, Train, Clock, MapPin, Footprints, ArrowRight } from 'lucide-react';
import BadgeTempo from './BadgeTempo';
import { identificarBaciaPorEmpresa, calcularDistancia, calcularTempoCaminhada } from '../config/busConfig';

const spring = { type: 'spring', stiffness: 120, damping: 22 };

const RouteResultRefatorado = ({ routes, origin, destination, loading, userLocation }) => {
  const processedRoutes = useMemo(() => {
    if (!routes?.length) return [];
    
    return routes.map(route => {
      const bacia = identificarBaciaPorEmpresa(
        route.company,
        route.agency,
        route.line
      );
      
      const baciaInfo = bacia || {
        cor: route.isLive ? '#22c55e' : '#6b7280',
        nome: route.company || route.agency || 'Ônibus',
        nomeExibicao: route.company || route.agency || 'Ônibus',
        corTexto: 'text-gray-600 dark:text-gray-400',
        corBg: 'bg-gray-100 dark:bg-gray-800',
        corBorda: 'border-gray-200 dark:border-gray-700',
        corIcone: route.isLive ? 'text-green-600' : 'text-gray-500',
        tipo: 'onibus'
      };
      
      let caminhadaInfo = null;
      if (userLocation && route.fromStop) {
        const distancia = calcularDistancia(
          userLocation.lat,
          userLocation.lon,
          route.lat || -15.7934,
          route.lon || -47.8823
        );
        const tempoCaminhada = calcularTempoCaminhada(distancia);
        
        caminhadaInfo = {
          distancia: distancia.toFixed(1),
          tempo: Math.ceil(tempoCaminhada)
        };
      }
      
      return {
        ...route,
        bacia: baciaInfo,
        caminhadaInfo,
        badgeEstado: {
          gps_active: route.isLive || false,
          time: route.time || 0,
          modo: baciaInfo?.tipo || 'onibus'
        }
      };
    });
  }, [routes, userLocation]);

  const hasLiveRoutes = useMemo(() =>
    processedRoutes.some(r => r.isLive), [processedRoutes]
  );

  if (loading) {
    return (
      <div className="mt-6 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-2xl animate-pulse bg-[var(--skeleton-bg)]" />
        ))}
      </div>
    );
  }

  if (!processedRoutes?.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="mt-7 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-widest mb-1">
            Rotas SEMOB / DFTrans
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate max-w-[140px]">
              {origin}
            </p>
            <ArrowRight className="h-3 w-3 text-[var(--text-tertiary)] flex-shrink-0" />
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate max-w-[140px]">
              {destination}
            </p>
          </div>
        </div>
        <span className="text-xs font-medium text-[var(--text-tertiary)] flex-shrink-0 mt-1">
          {processedRoutes.length} {processedRoutes.length === 1 ? 'opção' : 'opções'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className={`h-1.5 w-1.5 rounded-full animate-pulse ${
          hasLiveRoutes ? 'bg-green-500' : 'bg-gray-400'
        }`} />
        <span className={`text-[10px] font-semibold ${
          hasLiveRoutes
            ? 'text-green-600 dark:text-green-400'
            : 'text-[var(--text-tertiary)]'
        }`}>
          {hasLiveRoutes
            ? '🚀 GPS REAL — Veículos ao vivo'
            : 'Dados de horários — SEMOB/DFTrans'}
        </span>
      </div>

      <div className="space-y-2.5">
        <AnimatePresence>
          {processedRoutes.map((route, idx) => (
            <motion.div
              key={route.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ delay: idx * 0.06, ...spring }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.99 }}
              className={`rounded-2xl border p-4 cursor-pointer transition-all duration-200 ${
                route.isLive
                  ? 'border-green-300/60 bg-green-50/40 dark:border-green-800/50 dark:bg-green-900/10 hover:shadow-lg'
                  : 'border-[var(--border)] bg-[var(--card-inner)] hover:shadow-md'
              }`}
              style={route.bacia.cor && !route.isLive ? {
                borderColor: `${route.bacia.cor}40`
              } : {}}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="rounded-full p-2 flex-shrink-0"
                    style={{
                      backgroundColor: `${route.bacia.cor}20`,
                      border: `2px solid ${route.bacia.cor}40`
                    }}
                  >
                    {route.bacia.tipo === 'metro' ? (
                      <Train className="h-5 w-5" style={{ color: route.bacia.cor }} strokeWidth={2} />
                    ) : (
                      <Bus className="h-5 w-5" style={{ color: route.bacia.cor }} strokeWidth={2} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span
                        className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                        style={{ backgroundColor: route.bacia.cor }}
                      >
                        {route.bacia.nomeExibicao}
                      </span>
                      <span className="font-semibold text-sm text-[var(--text-primary)] tracking-tight">
                        {route.line}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-[var(--text-tertiary)]" strokeWidth={1.5} />
                        <span className="text-xs font-semibold text-[var(--accent)]">
                          {route.time} min
                        </span>
                      </div>

                      {route.stops && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-[var(--text-tertiary)]" strokeWidth={1.5} />
                          <span className="text-xs text-[var(--text-secondary)]">
                            {route.stops} paradas
                          </span>
                        </div>
                      )}

                      {route.caminhadaInfo && (
                        <div className="flex items-center gap-1">
                          <Footprints className="h-3 w-3 text-[var(--text-tertiary)]" strokeWidth={1.5} />
                          <span className="text-xs text-[var(--text-secondary)]">
                            {route.caminhadaInfo.distancia}km • {route.caminhadaInfo.tempo}min
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      {route.fromStop && (
                        <p className="text-[10px] text-[var(--text-tertiary)] truncate">
                          Embarque: {route.fromStop}
                        </p>
                      )}
                      {route.company && (
                        <span
                          className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `${route.bacia.cor}15`,
                            color: route.bacia.cor
                          }}
                        >
                          {route.company}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <BadgeTempo
                    gps_active={route.badgeEstado.gps_active}
                    time={route.badgeEstado.time}
                    modo={route.badgeEstado.modo}
                  />

                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 ${
                      route.isLive ? 'bg-green-600' : 'bg-[var(--accent)]'
                    }`}
                  >
                    {route.isLive ? 'Ver mapa' : 'Detalhes'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default React.memo(RouteResultRefatorado);