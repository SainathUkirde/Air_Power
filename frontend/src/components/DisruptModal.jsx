// DISRUPT MODAL – compact disruption injection form
import { useState } from 'react'
import { useStore } from '../store/useStore'

const TYPES = [
  { value:'AIRCRAFT_UNSERVICEABLE', label:'Aircraft Unserviceable' },
  { value:'CREW_UNAVAILABLE',       label:'Crew Unavailable'       },
  { value:'WEATHER_CLOSING',        label:'Weather Closing'        },
  { value:'NEW_THREAT',             label:'New Threat Zone'        },
  { value:'COMMS_JAM',              label:'Comms Jam'              },
  { value:'PRIORITY_CHANGE',        label:'Priority Change'        },
]
const SEVS   = ['LOW','MEDIUM','HIGH','CRITICAL']
const ASSETS = ['AC01','AC02','AC03','AC04','AC05','AC06','AC07','AC08','AC09','AC10','AC11','AC12']
const CALLSIGNS = {
  AC01:'VIPER 11',AC02:'VIPER 12',AC03:'VIPER 13',
  AC04:'RAPTOR 21',AC05:'RAPTOR 22',AC06:'RAPTOR 23',
  AC07:'HAWK 31',AC08:'HAWK 32',AC09:'HAWK 33',AC10:'HAWK 34',
  AC11:'GHOST 41',AC12:'GHOST 42',
}

export default function DisruptModal() {
  const injectDisruption   = useStore(s => s.injectDisruption)
  const setShowDisruptModal = useStore(s => s.setShowDisruptModal)

  const [type,     setType]     = useState('AIRCRAFT_UNSERVICEABLE')
  const [targetId, setTargetId] = useState('AC02')
  const [severity, setSeverity] = useState('HIGH')
  const [detail,   setDetail]   = useState('')

  function submit(e) {
    e.preventDefault()
    injectDisruption({ type, target_id: targetId || null, severity, detail })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background:'rgba(0,0,0,0.7)' }}
      onClick={e => e.target === e.currentTarget && setShowDisruptModal(false)}
    >
      <div
        className="flex flex-col border"
        style={{ width:340, background:'#161b1f', borderColor:'#2a3238' }}
      >
        {/* Title */}
        <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor:'#2a3238', background:'#0f1316' }}>
          <span style={{ fontSize:11, color:'#e8a317', textTransform:'uppercase', letterSpacing:'0.12em' }}>
            INJECT DISRUPTION
          </span>
          <button onClick={() => setShowDisruptModal(false)} style={{ color:'#57606a', fontSize:14 }}>✕</button>
        </div>

        <form onSubmit={submit} className="p-3 flex flex-col gap-3">
          {/* Type */}
          <div>
            <label style={{ fontSize:9, color:'#57606a', display:'block', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>TYPE</label>
            <select
              value={type} onChange={e => setType(e.target.value)}
              className="w-full px-2 py-1 border text-[11px]"
              style={{ background:'#0f1316', color:'#c9d1d9', borderColor:'#2a3238', outline:'none' }}
            >
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Target */}
          {['AIRCRAFT_UNSERVICEABLE','CREW_UNAVAILABLE','PRIORITY_CHANGE'].includes(type) && (
            <div>
              <label style={{ fontSize:9, color:'#57606a', display:'block', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>TARGET ASSET</label>
              <select
                value={targetId} onChange={e => setTargetId(e.target.value)}
                className="w-full px-2 py-1 border text-[11px]"
                style={{ background:'#0f1316', color:'#c9d1d9', borderColor:'#2a3238', outline:'none' }}
              >
                {ASSETS.map(id => <option key={id} value={id}>{CALLSIGNS[id]} ({id})</option>)}
              </select>
            </div>
          )}

          {/* Severity */}
          <div>
            <label style={{ fontSize:9, color:'#57606a', display:'block', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>SEVERITY</label>
            <div className="flex gap-1">
              {SEVS.map(s => (
                <button
                  type="button" key={s}
                  onClick={() => setSeverity(s)}
                  className="flex-1 py-1 text-[9px] border transition-colors"
                  style={{
                    color:       severity === s ? '#e8a317' : '#57606a',
                    borderColor: severity === s ? '#e8a317' : '#2a3238',
                    background:  severity === s ? 'rgba(232,163,23,0.08)' : 'transparent',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Detail */}
          <div>
            <label style={{ fontSize:9, color:'#57606a', display:'block', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>DETAIL</label>
            <input
              type="text"
              value={detail}
              onChange={e => setDetail(e.target.value)}
              placeholder="optional detail / coords"
              className="w-full px-2 py-1 border text-[11px]"
              style={{ background:'#0f1316', color:'#c9d1d9', borderColor:'#2a3238', outline:'none' }}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowDisruptModal(false)}
              className="flex-1 py-1.5 text-[10px] tracking-widest uppercase border"
              style={{ color:'#57606a', borderColor:'#2a3238' }}
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="flex-1 py-1.5 text-[10px] tracking-widest uppercase border"
              style={{ color:'#e8a317', borderColor:'#e8a317', background:'rgba(232,163,23,0.08)' }}
            >
              INJECT
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
