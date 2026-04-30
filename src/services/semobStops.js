// src/services/semobStops.js
import axios from 'axios';
import { DF_FAVORITE_PLACES, calcularDistancia } from '../config/busConfig';

const SEMOB_STOPS_URL = 'https://otp.mobilibus.com/FY7J-lwk85QGbn/otp/routers/default/index/stops';
let stopsCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 3600000;

export const getSEMOBStops = async () => {
  const now = Date.now();
  if (stopsCache && now - cacheTimestamp < CACHE_DURATION) {
    return stopsCache;
  }

  try {
    const response = await axios.get(SEMOB_STOPS_URL, {
      params: {
        lat: -15.7934,
        lon: -47.8823,
        radius: 50000
      },
      timeout: 10000
    });

    if (Array.isArray(response.data)) {
      stopsCache = response.data.map(stop => ({
        id: stop.id,
        name: stop.name,
        lat: stop.lat,
        lon: stop.lon,
        code: stop.code || stop.id,
        type: 'Parada SEMOB'
      }));
      cacheTimestamp = now;
      return stopsCache;
    }
    return [];
  } catch (error) {
    console.error('Erro ao buscar paradas SEMOB:', error);
    return stopsCache || [];
  }
};

export const getRoutesByStop = async (stopId) => {
  try {
    const response = await axios.get(
      `https://otp.mobilibus.com/FY7J-lwk85QGbn/otp/routers/default/index/stops/${stopId}/routes`,
      { timeout: 10000 }
    );
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error('Erro ao buscar rotas da parada:', error);
    return [];
  }
};

export const findNearbyStops = (stops, lat, lon, maxDistance = 5) => {
  if (!stops?.length || !lat || !lon) return [];
  
  return stops
    .map(stop => {
      const distance = calcularDistancia(lat, lon, stop.lat, stop.lon);
      return { ...stop, distance };
    })
    .filter(stop => stop.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10);
};

export const findLocalDfPlaces = (query) => {
  if (!query || query.length < 2) return [];
  const safe = query.toLowerCase();
  return DF_FAVORITE_PLACES.filter(place => 
    place.name.toLowerCase().includes(safe) || 
    place.address.toLowerCase().includes(safe)
  );
};