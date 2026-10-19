// Leaflet tactical map – OSM base (states/cities/towns) + dark overlay, routes, threat circles, markers
import { useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polyline, Polygon,
         Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import { useStore } from '../store/useStore'
import { missionColor, ROLE_COLOR } from '../utils/format'
import ContestedOverlay from './ContestedOverlay'

// ── shared font ───────────────────────────────────────────────────────────────
const FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif"

// ── Icon helpers ──────────────────────────────────────────────────────────────

// Aircraft: triangle + callsign label
function acIcon(callsign, role, active = true) {
  const color      = active ? (ROLE_COLOR[role] || '#c9d1d9') : '#3a4248'
  const labelColor = active ? color : '#3a4248'
  return L.divIcon({
    className: '',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.95))">
        <div style="
          width:0;height:0;
          border-left:6px solid transparent;
          border-right:6px solid transparent;
          border-bottom:11px solid ${color};
          opacity:${active ? 1 : 0.45};
        "></div>
        <div style="
          color:${labelColor};
          font-family:${FONT};
          font-size:11px;font-weight:700;
          white-space:nowrap;
          text-shadow:0 1px 4px #000,0 0 10px rgba(0,0,0,0.95),0 0 2px #000;
          margin-top:2px;
          letter-spacing:0.02em;
          background:rgba(0,0,0,0.45);
          padding:0 3px;
        ">${callsign}</div>
      </div>`,
    iconSize: [80, 34],
    iconAnchor: [40, 6],
  })
}

// Airbase: square with cross-hair + ICAO label
function baseIcon(icao, name) {
  return L.divIcon({
    className: '',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none">
        <div style="position:relative;width:12px;height:12px;background:#0f1316;border:2px solid #e8a317;">
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:4px;height:4px;background:#e8a317;border-radius:50%;"></div>
        </div>
        <div style="
          color:#e8a317;
          font-family:${FONT};
          font-size:10px;font-weight:700;
          white-space:nowrap;
          text-shadow:0 1px 4px #000,0 0 8px rgba(0,0,0,0.9);
          margin-top:2px;
          background:rgba(0,0,0,0.5);
          padding:0 4px;
          letter-spacing:0.04em;
          text-transform:uppercase;
        ">${icao}</div>
      </div>`,
    iconSize: [56, 32],
    iconAnchor: [6, 6],
  })
}

// Target: diamond + label, colour by assigned state
function targetIcon(name, assigned) {
  const color = assigned ? '#e8a317' : '#d64545'
  return L.divIcon({
    className: '',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none">
        <div style="width:10px;height:10px;background:${color};transform:rotate(45deg);flex-shrink:0;"></div>
        <div style="
          color:${color};
          font-family:${FONT};
          font-size:10px;font-weight:700;
          white-space:nowrap;
          text-shadow:0 1px 4px #000,0 0 8px rgba(0,0,0,0.9);
          margin-top:4px;
          background:rgba(0,0,0,0.5);
          padding:0 4px;
          letter-spacing:0.02em;
          text-transform:uppercase;
        ">${name}</div>
      </div>`,
    iconSize: [80, 32],
    iconAnchor: [5, 5],
  })
}

// Threat circle colours
function threatStyle(severity) {
  if (severity === 'CRITICAL') return { stroke: '#d64545', glow: 'rgba(214,69,69,0.12)' }
  if (severity === 'HIGH')     return { stroke: '#e8a317', glow: 'rgba(232,163,23,0.09)' }
  return { stroke: '#7eb8d4', glow: 'rgba(126,184,212,0.07)' }
}

const KM = 1000

// ── Component ─────────────────────────────────────────────────────────────────

export default function TacticalMap() {
  const scenario        = useStore(s => s.scenario)
  const plan            = useStore(s => s.plan)
  const activePlanLabel = useStore(s => s.activePlanLabel)
  const contested       = useStore(s => s.contested)
  const jammedPolygon   = useStore(s => s.jammedPolygon)

  const airbases    = scenario?.airbases     ?? []
  const aircraft    = scenario?.aircraft     ?? []
  const missions    = scenario?.missions     ?? []
  const threatZones = scenario?.threat_zones ?? []

  const activeOption = plan?.options?.find(o => o.label === activePlanLabel)
  const assignments  = activeOption?.assignments ?? []

  const routes = useMemo(() => assignments.map(a => {
    const ac      = aircraft.find(x => x.id === a.aircraft_id)
    const mission = missions.find(m => m.id === a.mission_id)
    return {
      key:       a.mission_id,
      positions: a.route?.map(p => [p.lat, p.lon]) ?? [],
      color:     missionColor(mission?.type),
      ac,
      mission,
    }
  }), [assignments, missions, aircraft])

  const acPositions = useMemo(() => assignments.map(a => {
    const ac   = aircraft.find(x => x.id === a.aircraft_id)
    const base = airbases.find(b => b.id === ac?.base)
    return { ac, base, assignment: a }
  }).filter(x => x.ac && x.base), [assignments, aircraft, airbases])

  const assignedIds = new Set(assignments.map(a => a.aircraft_id))
  const unassigned  = aircraft.filter(a => !assignedIds.has(a.id))

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ContestedOverlay />
      <MapContainer
        center={[20.5, 77.5]}
        zoom={6}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        attributionControl={true}
      >
        {/*
          LAYER 1 — Stadia Alidade Smooth Dark
          Free, no key required for development/low traffic.
          Shows India states, cities, roads, rivers, terrain labels.
          Falls back to OSM standard if unavailable.
        */}
        <TileLayer
          url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a>, &copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          maxZoom={20}
          crossOrigin="anonymous"
          errorTileUrl="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/*
          LAYER 2 — Stamen Toner Lines (political borders + labels only, transparent bg)
          Adds crisp state borders and city names on top of the dark base.
          Attribution inherited from base.
        */}
        <TileLayer
          url="https://tiles.stadiamaps.com/tiles/stamen_toner_lines/{z}/{x}/{y}{r}.png"
          attribution=""
          maxZoom={20}
          opacity={0.35}
          crossOrigin="anonymous"
        />
        <TileLayer
          url="https://tiles.stadiamaps.com/tiles/stamen_toner_labels/{z}/{x}/{y}{r}.png"
          attribution=""
          maxZoom={20}
          opacity={0.6}
          crossOrigin="anonymous"
        />

        {/* ── SAM / threat rings ── */}
        {threatZones.filter(t => t.active).map(t => {
          const s = threatStyle(t.severity)
          return (
            <Circle
              key={t.id}
              center={[t.lat, t.lon]}
              radius={t.radius_km * KM}
              pathOptions={{
                color:       s.stroke,
                fillColor:   s.stroke,
                fillOpacity: 0.08,
                weight:      1.5,
                dashArray:   '7 5',
                opacity:     0.9,
              }}
            >
              <Popup>
                <div style={{ fontFamily: FONT }}>
                  <div style={{ color: s.stroke, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{t.name}</div>
                  <div style={{ color: '#57606a', fontSize: 11 }}>TYPE <span style={{ color: '#c9d1d9' }}>{t.type}</span></div>
                  <div style={{ color: '#57606a', fontSize: 11 }}>SEV  <span style={{ color: s.stroke, fontWeight: 600 }}>{t.severity}</span></div>
                  <div style={{ color: '#57606a', fontSize: 11 }}>R    <span style={{ color: '#c9d1d9' }}>{t.radius_km} km</span></div>
                </div>
              </Popup>
            </Circle>
          )
        })}

        {/* SAM centre dots */}
        {threatZones.filter(t => t.active).map(t => (
          <CircleMarker
            key={`ctr-${t.id}`}
            center={[t.lat, t.lon]}
            radius={4}
            pathOptions={{
              color:       threatStyle(t.severity).stroke,
              fillColor:   threatStyle(t.severity).stroke,
              fillOpacity: 1,
              weight:      1,
            }}
          />
        ))}

        {/* Jammed area polygon (contested mode) */}
        {contested && jammedPolygon.length > 0 && (
          <Polygon
            positions={jammedPolygon.map(p => [p.lat, p.lon])}
            pathOptions={{
              color:       '#e8a317',
              fillColor:   '#e8a317',
              fillOpacity: 0.05,
              weight:      1.5,
              dashArray:   '5 7',
              opacity:     0.75,
            }}
          />
        )}

        {/* ── Flight routes ── */}
        {routes.map(r => r.positions.length > 1 && (
          <Polyline
            key={r.key}
            positions={r.positions}
            pathOptions={{
              color:     r.color,
              weight:    2.5,
              opacity:   0.92,
              dashArray: r.ac?.status === 'AIRBORNE' ? undefined : '7 6',
            }}
          >
            <Popup>
              <div style={{ fontFamily: FONT }}>
                <div style={{ color: r.color, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{r.ac?.callsign}</div>
                <div style={{ color: '#c9d1d9', fontSize: 12 }}>{r.mission?.name}</div>
                <div style={{ color: '#57606a', fontSize: 11 }}>TYPE <span style={{ color: '#c9d1d9' }}>{r.mission?.type}</span></div>
              </div>
            </Popup>
          </Polyline>
        ))}

        {/* ── Mission targets ── */}
        {missions.map(m => {
          const isAssigned = assignments.some(a => a.mission_id === m.id)
          const assignedAc = aircraft.find(a => a.id === assignments.find(x => x.mission_id === m.id)?.aircraft_id)
          return (
            <Marker key={m.id} position={[m.target_lat, m.target_lon]} icon={targetIcon(m.name, isAssigned)}>
              <Popup>
                <div style={{ fontFamily: FONT }}>
                  <div style={{ color: isAssigned ? '#e8a317' : '#d64545', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{m.name}</div>
                  <div style={{ color: '#57606a', fontSize: 11 }}>PRIORITY <span style={{ color: '#c9d1d9', fontWeight: 600 }}>P{m.priority}</span></div>
                  <div style={{ color: '#57606a', fontSize: 11 }}>TYPE     <span style={{ color: '#c9d1d9' }}>{m.type}</span></div>
                  <div style={{ color: '#57606a', fontSize: 11, marginTop: 3 }}>
                    {isAssigned
                      ? <span style={{ color: '#8fb56e', fontWeight: 600 }}>✓ {assignedAc?.callsign}</span>
                      : <span style={{ color: '#d64545', fontWeight: 600 }}>UNASSIGNED</span>}
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}

        {/* ── Assigned aircraft at base ── */}
        {acPositions.map(({ ac, base }) => (
          <Marker
            key={ac.id}
            position={[base.lat + 0.07, base.lon + 0.07]}
            icon={acIcon(ac.callsign, ac.role, ac.status === 'READY')}
          >
            <Popup>
              <div style={{ fontFamily: FONT }}>
                <div style={{ color: ROLE_COLOR[ac.role] || '#c9d1d9', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{ac.callsign}</div>
                <div style={{ color: '#57606a', fontSize: 11 }}>ROLE   <span style={{ color: '#c9d1d9' }}>{ac.role}</span></div>
                <div style={{ color: '#57606a', fontSize: 11 }}>STATUS <span style={{ color: ac.status === 'READY' ? '#8fb56e' : '#d64545', fontWeight: 600 }}>{ac.status}</span></div>
                <div style={{ color: '#57606a', fontSize: 11 }}>ENG HRS <span style={{ color: '#c9d1d9' }}>{ac.engine_hours} h</span></div>
                <div style={{ color: '#57606a', fontSize: 11 }}>FAIL P  <span style={{ color: ac.fail_probability > 0.4 ? '#d64545' : '#8fb56e', fontWeight: 600 }}>{(ac.fail_probability * 100).toFixed(0)}%</span></div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* ── Unassigned aircraft ── */}
        {unassigned.map(ac => {
          const base = airbases.find(b => b.id === ac.base)
          if (!base) return null
          return (
            <Marker
              key={ac.id}
              position={[base.lat - 0.07, base.lon - 0.07]}
              icon={acIcon(ac.callsign, ac.role, false)}
            >
              <Popup>
                <div style={{ fontFamily: FONT }}>
                  <div style={{ color: '#57606a', fontWeight: 700, fontSize: 13 }}>{ac.callsign}</div>
                  <div style={{ color: '#57606a', fontSize: 11 }}>{ac.role} — <span style={{ color: '#d64545', fontWeight: 600 }}>UNASSIGNED</span></div>
                  <div style={{ color: '#57606a', fontSize: 11 }}>STATUS <span style={{ color: '#c9d1d9' }}>{ac.status}</span></div>
                </div>
              </Popup>
            </Marker>
          )
        })}

        {/* ── Airbases ── */}
        {airbases.map(b => (
          <Marker key={b.id} position={[b.lat, b.lon]} icon={baseIcon(b.icao, b.name)}>
            <Popup>
              <div style={{ fontFamily: FONT }}>
                <div style={{ color: '#e8a317', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{b.name}</div>
                <div style={{ color: '#57606a', fontSize: 11 }}>ICAO  <span style={{ color: '#c9d1d9', fontWeight: 600 }}>{b.icao}</span></div>
                <div style={{ color: '#57606a', fontSize: 11 }}>ELEV  <span style={{ color: '#c9d1d9' }}>{b.elevation_ft} ft</span></div>
                <div style={{ color: '#57606a', fontSize: 11 }}>CAP   <span style={{ color: '#c9d1d9' }}>{b.capacity} AC</span></div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
