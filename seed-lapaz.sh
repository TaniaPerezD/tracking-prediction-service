#!/bin/bash
# Seed de buses en La Paz, Bolivia — coordenadas reales
BASE="http://localhost:3001/tracking/location"

echo "Registrando buses en La Paz, Bolivia..."

# BUS-101 — El Prado, a tiempo
curl -s -X POST $BASE -H "Content-Type: application/json" -d '{
  "vehicleId": "BUS-101",
  "vehicleType": "bus",
  "lat": -16.4963,
  "lng": -68.1334,
  "speed": 32,
  "routeId": "El Prado (Av. 16 de Julio)",
  "currentStop": "Plaza Murillo",
  "nextStop": "Plaza del Estudiante"
}' | jq -r '"BUS-101: " + .status'

# BUS-102 — Av. Camacho, a tiempo
curl -s -X POST $BASE -H "Content-Type: application/json" -d '{
  "vehicleId": "BUS-102",
  "vehicleType": "bus",
  "lat": -16.5010,
  "lng": -68.1300,
  "speed": 28,
  "routeId": "Av. Camacho",
  "currentStop": "Mercado Negro",
  "nextStop": "Av. Montes"
}' | jq -r '"BUS-102: " + .status'

# BUS-103 — Av. Arce, a tiempo
curl -s -X POST $BASE -H "Content-Type: application/json" -d '{
  "vehicleId": "BUS-103",
  "vehicleType": "bus",
  "lat": -16.5080,
  "lng": -68.1200,
  "speed": 25,
  "routeId": "Av. Arce",
  "currentStop": "Sopocachi",
  "nextStop": "Miraflores"
}' | jq -r '"BUS-103: " + .status'

# BUS-104 — Av. Villazón, retrasado 15 min
DELAYED_TIME=$(date -u -v-15M +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u --date='15 minutes ago' +%Y-%m-%dT%H:%M:%SZ)
curl -s -X POST $BASE -H "Content-Type: application/json" -d "{
  \"vehicleId\": \"BUS-104\",
  \"vehicleType\": \"bus\",
  \"lat\": -16.5023,
  \"lng\": -68.1272,
  \"speed\": 8,
  \"routeId\": \"Av. Villazón\",
  \"currentStop\": \"Plaza del Estudiante\",
  \"nextStop\": \"UMSA\",
  \"scheduledArrival\": \"$DELAYED_TIME\"
}" | jq -r '"BUS-104: " + .status + " (retrasado)"'

# METRO-01 — Teleférico Rojo, a tiempo
curl -s -X POST $BASE -H "Content-Type: application/json" -d '{
  "vehicleId": "METRO-01",
  "vehicleType": "metro",
  "lat": -16.5200,
  "lng": -68.1400,
  "speed": 45,
  "routeId": "Av. Busch",
  "currentStop": "Estación Central",
  "nextStop": "El Alto"
}' | jq -r '"METRO-01: " + .status'

echo ""
echo "Verifica el mapa:"
echo "  curl http://localhost:3001/tracking/map | jq '.vehicles[] | {id: .vehicle_id, lat, lng, status}'"
