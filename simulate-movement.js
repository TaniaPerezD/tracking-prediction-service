// Simulador de movimiento GPS — La Paz, Bolivia
// Ejecutar: node simulate-movement.js

const BASE = 'http://localhost:3001/tracking/location';

// Rutas como secuencia de waypoints reales en La Paz
const ROUTES = [
  {
    vehicleId: 'BUS-101',
    vehicleType: 'bus',
    routeId: 'El Prado (Av. 16 de Julio)',
    speed: 30,
    waypoints: [
      { lat: -16.4963, lng: -68.1334 }, // Plaza Murillo
      { lat: -16.4980, lng: -68.1320 }, // Av. Mariscal Santa Cruz
      { lat: -16.5000, lng: -68.1300 }, // Plaza del Estudiante
      { lat: -16.5020, lng: -68.1280 }, // Prado Norte
      { lat: -16.5040, lng: -68.1260 }, // Av. 16 de Julio Norte
      { lat: -16.5020, lng: -68.1280 }, // regresa
      { lat: -16.5000, lng: -68.1300 },
      { lat: -16.4980, lng: -68.1320 },
    ],
  },
  {
    vehicleId: 'BUS-102',
    vehicleType: 'bus',
    routeId: 'Av. Camacho',
    speed: 25,
    waypoints: [
      { lat: -16.5010, lng: -68.1300 }, // Mercado Negro
      { lat: -16.5030, lng: -68.1310 }, // Camacho Centro
      { lat: -16.5050, lng: -68.1320 }, // Camacho Sur
      { lat: -16.5070, lng: -68.1330 }, // Pérez Velasco
      { lat: -16.5050, lng: -68.1320 },
      { lat: -16.5030, lng: -68.1310 },
    ],
  },
  {
    vehicleId: 'BUS-103',
    vehicleType: 'bus',
    routeId: 'Av. Arce',
    speed: 28,
    waypoints: [
      { lat: -16.5080, lng: -68.1200 }, // Sopocachi
      { lat: -16.5060, lng: -68.1180 }, // Arce Centro
      { lat: -16.5040, lng: -68.1160 }, // Miraflores
      { lat: -16.5020, lng: -68.1140 }, // Arce Norte
      { lat: -16.5040, lng: -68.1160 },
      { lat: -16.5060, lng: -68.1180 },
    ],
  },
  {
    vehicleId: 'BUS-104',
    vehicleType: 'bus',
    routeId: 'Av. Villazón',
    speed: 12, // lento — retrasado
    delayed: true,
    waypoints: [
      { lat: -16.5023, lng: -68.1272 }, // Plaza del Estudiante
      { lat: -16.5035, lng: -68.1255 }, // UMSA
      { lat: -16.5050, lng: -68.1240 }, // Villazón Norte
      { lat: -16.5035, lng: -68.1255 },
    ],
  },
  {
    vehicleId: 'METRO-01',
    vehicleType: 'metro',
    routeId: 'Av. Busch',
    speed: 50,
    waypoints: [
      { lat: -16.5200, lng: -68.1400 }, // Estación Central
      { lat: -16.5150, lng: -68.1380 }, // Estación Intermedia
      { lat: -16.5100, lng: -68.1360 }, // El Alto Sur
      { lat: -16.5050, lng: -68.1340 }, // El Alto Norte
      { lat: -16.5100, lng: -68.1360 },
      { lat: -16.5150, lng: -68.1380 },
    ],
  },
];

// Estado de cada vehículo
const state = ROUTES.map(r => ({ ...r, waypointIdx: 0, progress: 0 }));

function lerp(a, b, t) {
  return a + (b - a) * t;
}

async function sendUpdate(vehicle, lat, lng) {
  const body = {
    vehicleId: vehicle.vehicleId,
    vehicleType: vehicle.vehicleType,
    lat,
    lng,
    speed: vehicle.speed,
    routeId: vehicle.routeId,
  };

  if (vehicle.delayed) {
    const scheduledArrival = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    body.scheduledArrival = scheduledArrival;
  }

  try {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    console.log(`[${vehicle.vehicleId}] lat:${lat.toFixed(4)} lng:${lng.toFixed(4)} → ${data.status}${data.delayMinutes > 0 ? ` (+${data.delayMinutes} min)` : ''}`);
  } catch {
    console.error(`[${vehicle.vehicleId}] Error al enviar`);
  }
}

function tick() {
  state.forEach(vehicle => {
    const waypoints = vehicle.waypoints;
    const current = waypoints[vehicle.waypointIdx];
    const next = waypoints[(vehicle.waypointIdx + 1) % waypoints.length];

    const lat = lerp(current.lat, next.lat, vehicle.progress);
    const lng = lerp(current.lng, next.lng, vehicle.progress);

    sendUpdate(vehicle, lat, lng);

    vehicle.progress += 0.2;
    if (vehicle.progress >= 1) {
      vehicle.progress = 0;
      vehicle.waypointIdx = (vehicle.waypointIdx + 1) % waypoints.length;
    }
  });
}

console.log('Simulador de movimiento GPS iniciado — La Paz, Bolivia');
console.log('Actualizando posiciones cada 4 segundos...');
console.log('Ctrl+C para detener\n');

tick();
setInterval(tick, 4000);
