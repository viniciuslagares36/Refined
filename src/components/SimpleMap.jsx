// src/components/SimpleMap.jsx
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { calcularDistancia, calcularTempoCaminhada } from '../config/busConfig';

const SimpleMap = ({ origin, destination, originName, destinationName }) => {
  const caminhadaInfo = useMemo(() => {
    if (!origin || !destination) return null;
    
    const distancia = calcularDistancia(
      origin.lat, origin.lon,
      destination.lat, destination.lon
    );
    const tempo = calcularTempoCaminhada(distancia);
    
    return {
      distancia: distancia.toFixed(1),
      tempo: Math.ceil(tempo)
    };
  }, [origin, destination]);

  if (!origin || !destination) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700"
    >
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        🚶 Trajeto a Pé
      </h3>
      
      <div className="relative w-full h-48 bg-gray-100 dark:bg-gray-700 rounded-xl mb-4 overflow-hidden">
        <svg className="w-full h-full" viewBox="0 0 400 200">
          <rect width="400" height="200" fill="none" />
          
          <line
            x1="50" y1="100"
            x2="350" y2="100"
            stroke="#3B82F6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="8,4"
            className="dark:stroke-blue-400"
          />
          
          <circle cx="50" cy="100" r="8" fill="#10B981" stroke="white" strokeWidth="2" />
          <text x="50" y="80" textAnchor="middle" className="text-xs font-semibold fill-gray-700 dark:fill-gray-300">
            Origem
          </text>
          
          <circle cx="350" cy="100" r="8" fill="#EF4444" stroke="white" strokeWidth="2" />
          <text x="350" y="80" textAnchor="middle" className="text-xs font-semibold fill-gray-700 dark:fill-gray-300">
            Destino
          </text>
        </svg>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {originName}
          </span>
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
            →
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {destinationName}
          </span>
        </div>
        
        {caminhadaInfo && (
          <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Distância total
            </span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {caminhadaInfo.distancia} km
            </span>
          </div>
        )}
        
        {caminhadaInfo && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Tempo estimado
            </span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {caminhadaInfo.tempo} min
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default React.memo(SimpleMap);