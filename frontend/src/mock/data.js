// Mock data mirroring Phase 1 seed_scenario.json + plan response.
// Used when VITE_API_URL is missing or the backend is unreachable.

export const SCENARIO = {
  scenario_id: 'INDO_EXERCISE_ALPHA_01',
  name: 'EXERCISE IRON MONSOON',
  classification: 'EXERCISE – UNCLASSIFIED',
  zulu_start: '2024-10-14T06:00:00Z',
  duration_hours: 8,

  airbases: [
    { id:'AB01', icao:'VAPO', name:'Poona Air Base',         lat:18.5793, lon:73.9089, elevation_ft:1942 },
    { id:'AB02', icao:'VABB', name:'Lohegaon Forward Strip', lat:18.6000, lon:74.1500, elevation_ft:1900 },
    { id:'AB03', icao:'VANP', name:'Nagpur Ops Base',        lat:21.0922, lon:79.0472, elevation_ft:1017 },
    { id:'AB04', icao:'VOHY', name:'Hyderabad Strike Ramp',  lat:17.4531, lon:78.4675, elevation_ft:1742 },
  ],

  aircraft: [
    { id:'AC01', callsign:'VIPER 11', role:'STRIKE', base:'AB01', engine_hours:1820, max_engine_hours:3000, status:'READY',        fail_probability:0.06 },
    { id:'AC02', callsign:'VIPER 12', role:'STRIKE', base:'AB01', engine_hours:2750, max_engine_hours:3000, status:'READY',        fail_probability:0.52 },
    { id:'AC03', callsign:'VIPER 13', role:'STRIKE', base:'AB01', engine_hours:900,  max_engine_hours:3000, status:'READY',        fail_probability:0.03 },
    { id:'AC04', callsign:'RAPTOR 21',role:'SEAD',   base:'AB02', engine_hours:2100, max_engine_hours:3000, status:'READY',        fail_probability:0.18 },
    { id:'AC05', callsign:'RAPTOR 22',role:'SEAD',   base:'AB02', engine_hours:2300, max_engine_hours:3000, status:'READY',        fail_probability:0.25 },
    { id:'AC06', callsign:'RAPTOR 23',role:'SEAD',   base:'AB03', engine_hours:1100, max_engine_hours:3000, status:'READY',        fail_probability:0.04 },
    { id:'AC07', callsign:'HAWK 31',  role:'CAS',    base:'AB03', engine_hours:1500, max_engine_hours:3000, status:'READY',        fail_probability:0.05 },
    { id:'AC08', callsign:'HAWK 32',  role:'CAS',    base:'AB03', engine_hours:1650, max_engine_hours:3000, status:'READY',        fail_probability:0.06 },
    { id:'AC09', callsign:'HAWK 33',  role:'CAS',    base:'AB04', engine_hours:700,  max_engine_hours:3000, status:'READY',        fail_probability:0.02 },
    { id:'AC10', callsign:'HAWK 34',  role:'CAS',    base:'AB04', engine_hours:800,  max_engine_hours:3000, status:'READY',        fail_probability:0.03 },
    { id:'AC11', callsign:'GHOST 41', role:'ISR',    base:'AB04', engine_hours:2600, max_engine_hours:3000, status:'READY',        fail_probability:0.44 },
    { id:'AC12', callsign:'GHOST 42', role:'ISR',    base:'AB01', engine_hours:400,  max_engine_hours:3000, status:'READY',        fail_probability:0.01 },
  ],

  crews: [
    { id:'CR01', name:'Sqn Ldr Arora',  qualifications:['STRIKE','ISR'],   flight_hrs_today:0,   max_duty_hrs:10, available:true },
    { id:'CR02', name:'Flt Lt Sharma',  qualifications:['STRIKE'],         flight_hrs_today:1.5, max_duty_hrs:10, available:true },
    { id:'CR03', name:'Sqn Ldr Mehta',  qualifications:['SEAD','STRIKE'],  flight_hrs_today:0,   max_duty_hrs:10, available:true },
    { id:'CR04', name:'Flt Lt Nair',    qualifications:['SEAD'],           flight_hrs_today:2,   max_duty_hrs:10, available:true },
    { id:'CR05', name:'Sqn Ldr Patel',  qualifications:['CAS','STRIKE'],   flight_hrs_today:0,   max_duty_hrs:10, available:true },
    { id:'CR06', name:'Flt Lt Kapoor',  qualifications:['CAS'],            flight_hrs_today:3,   max_duty_hrs:10, available:true },
    { id:'CR07', name:'Wg Cdr Verma',   qualifications:['ISR','CAS'],      flight_hrs_today:0,   max_duty_hrs:12, available:true },
    { id:'CR08', name:'Flt Lt Desai',   qualifications:['STRIKE','SEAD'],  flight_hrs_today:1,   max_duty_hrs:10, available:true },
    { id:'CR09', name:'Sqn Ldr Iyer',   qualifications:['CAS','ISR'],      flight_hrs_today:0,   max_duty_hrs:10, available:true },
    { id:'CR10', name:'Flt Lt Bose',    qualifications:['SEAD','CAS'],     flight_hrs_today:0.5, max_duty_hrs:10, available:true },
  ],

  weapons: [
    { id:'WP01', type:'PGM',        count:8,  compatible_roles:['STRIKE'],        base:'AB01' },
    { id:'WP02', type:'HARM',       count:6,  compatible_roles:['SEAD'],          base:'AB02' },
    { id:'WP03', type:'JDAM',       count:10, compatible_roles:['STRIKE','CAS'],  base:'AB01' },
    { id:'WP04', type:'ROCKET_POD', count:12, compatible_roles:['CAS'],           base:'AB03' },
    { id:'WP05', type:'HARM',       count:4,  compatible_roles:['SEAD'],          base:'AB03' },
    { id:'WP06', type:'RECCE_POD',  count:4,  compatible_roles:['ISR'],           base:'AB04' },
  ],

  missions: [
    { id:'M01', name:'STRIKE ALPHA',  priority:1, type:'STRIKE', target_lat:20.50, target_lon:76.20, time_window_start:'2024-10-14T07:00:00Z', time_window_end:'2024-10-14T09:00:00Z', duration_hrs:1.5, required_role:'STRIKE', required_weapon:'PGM'  },
    { id:'M02', name:'SEAD BRAVO',    priority:1, type:'SEAD',   target_lat:19.80, target_lon:77.50, time_window_start:'2024-10-14T06:30:00Z', time_window_end:'2024-10-14T08:00:00Z', duration_hrs:1.0, required_role:'SEAD',   required_weapon:'HARM' },
    { id:'M03', name:'CAS CHARLIE',   priority:2, type:'CAS',    target_lat:20.10, target_lon:78.30, time_window_start:'2024-10-14T08:00:00Z', time_window_end:'2024-10-14T11:00:00Z', duration_hrs:2.0, required_role:'CAS',    required_weapon:'ROCKET_POD' },
    { id:'M04', name:'ISR DELTA',     priority:2, type:'ISR',    target_lat:21.20, target_lon:77.80, time_window_start:'2024-10-14T06:00:00Z', time_window_end:'2024-10-14T12:00:00Z', duration_hrs:3.0, required_role:'ISR',    required_weapon:'RECCE_POD'  },
    { id:'M05', name:'STRIKE ECHO',   priority:2, type:'STRIKE', target_lat:19.20, target_lon:75.80, time_window_start:'2024-10-14T09:00:00Z', time_window_end:'2024-10-14T12:00:00Z', duration_hrs:1.5, required_role:'STRIKE', required_weapon:'JDAM' },
    { id:'M06', name:'SEAD FOXTROT',  priority:3, type:'SEAD',   target_lat:20.80, target_lon:76.90, time_window_start:'2024-10-14T10:00:00Z', time_window_end:'2024-10-14T13:00:00Z', duration_hrs:1.0, required_role:'SEAD',   required_weapon:'HARM' },
    { id:'M07', name:'CAS GOLF',      priority:3, type:'CAS',    target_lat:17.90, target_lon:79.10, time_window_start:'2024-10-14T07:30:00Z', time_window_end:'2024-10-14T11:00:00Z', duration_hrs:1.5, required_role:'CAS',    required_weapon:'JDAM' },
    { id:'M08', name:'STRIKE HOTEL',  priority:3, type:'STRIKE', target_lat:18.80, target_lon:80.20, time_window_start:'2024-10-14T11:00:00Z', time_window_end:'2024-10-14T14:00:00Z', duration_hrs:2.0, required_role:'STRIKE', required_weapon:'JDAM' },
  ],

  threat_zones: [
    { id:'TZ01', name:'SAM RING ALPHA',  lat:20.40, lon:76.30, radius_km:80, type:'SAM', severity:'HIGH',     active:true },
    { id:'TZ02', name:'SAM RING BRAVO',  lat:19.70, lon:77.60, radius_km:60, type:'SAM', severity:'CRITICAL', active:true },
    { id:'TZ03', name:'AAA BELT CHARLIE',lat:21.00, lon:78.00, radius_km:30, type:'AAA', severity:'MEDIUM',   active:true },
    { id:'TZ04', name:'SAM RING DELTA',  lat:18.50, lon:80.00, radius_km:70, type:'SAM', severity:'HIGH',     active:true },
  ],
}

export const MOCK_PLAN = {
  plan_id: 'a1b2c3d4',
  scenario_id: 'INDO_EXERCISE_ALPHA_01',
  generated_at: '2024-10-14T06:01:12Z',
  best_option: 'A',
  planning_time_s: 0.23,
  priority_weight: 0.5,
  risk_weight: 0.5,
  options: [
    {
      label: 'A',
      missions_covered: 6,
      utilisation_pct: 75.0,
      risk_score: 0.12,
      robustness_score: 87,
      robustness_histogram: [0,0,0.01,0.02,0.03,0.05,0.07,0.09,0.11,0.12,0.14,0.12,0.09,0.07,0.05,0.02,0.01,0,0,0],
      top_failure_causes: ['aircraft_failure','weather_shift','crew_delay'],
      weakest_mission: 'M02',
      notes: 'Priority weight 0.50 / Risk weight 0.50',
      assignments: [
        { mission_id:'M01', aircraft_id:'AC01', crew_id:'CR01', weapon_id:'WP01', start_zulu:'2024-10-14T07:00:00Z', end_zulu:'2024-10-14T08:30:00Z', route:[{lat:18.58,lon:73.91},{lat:19.54,lon:75.06},{lat:20.50,lon:76.20}], reason:'VIPER 11: range fit (279km one-way, cap 600km), weapon match (PGM), crew Sqn Ldr Arora within duty limit (1.5/10h)', confidence:1.0, low_conf:false },
        { mission_id:'M02', aircraft_id:'AC04', crew_id:'CR03', weapon_id:'WP02', start_zulu:'2024-10-14T06:30:00Z', end_zulu:'2024-10-14T07:30:00Z', route:[{lat:18.60,lon:74.15},{lat:19.20,lon:75.83},{lat:19.80,lon:77.50}], reason:'RAPTOR 21: range fit (362km one-way, cap 500km), weapon match (HARM), crew Sqn Ldr Mehta within duty limit (1.0/10h)', confidence:1.0, low_conf:false },
        { mission_id:'M03', aircraft_id:'AC07', crew_id:'CR05', weapon_id:'WP04', start_zulu:'2024-10-14T08:00:00Z', end_zulu:'2024-10-14T10:00:00Z', route:[{lat:21.09,lon:79.05},{lat:20.60,lon:78.68},{lat:20.10,lon:78.30}], reason:'HAWK 31: range fit (107km one-way, cap 400km), weapon match (ROCKET_POD), crew Sqn Ldr Patel within duty limit (2.0/10h)', confidence:1.0, low_conf:false },
        { mission_id:'M04', aircraft_id:'AC12', crew_id:'CR07', weapon_id:'WP06', start_zulu:'2024-10-14T06:00:00Z', end_zulu:'2024-10-14T09:00:00Z', route:[{lat:18.58,lon:73.91},{lat:19.89,lon:75.86},{lat:21.20,lon:77.80}], reason:'GHOST 42: range fit (424km one-way, cap 1000km), weapon match (RECCE_POD), crew Wg Cdr Verma within duty limit (3.0/12h)', confidence:1.0, low_conf:false },
        { mission_id:'M05', aircraft_id:'AC03', crew_id:'CR08', weapon_id:'WP03', start_zulu:'2024-10-14T09:00:00Z', end_zulu:'2024-10-14T10:30:00Z', route:[{lat:18.58,lon:73.91},{lat:18.89,lon:74.86},{lat:19.20,lon:75.80}], reason:'VIPER 13: range fit (192km one-way, cap 600km), weapon match (JDAM), crew Flt Lt Desai within duty limit (2.5/10h)', confidence:1.0, low_conf:false },
        { mission_id:'M07', aircraft_id:'AC09', crew_id:'CR09', weapon_id:'WP03', start_zulu:'2024-10-14T07:30:00Z', end_zulu:'2024-10-14T09:00:00Z', route:[{lat:17.45,lon:78.47},{lat:17.68,lon:78.79},{lat:17.90,lon:79.10}], reason:'HAWK 33: range fit (78km one-way, cap 400km), weapon match (JDAM), crew Sqn Ldr Iyer within duty limit (1.5/10h)', confidence:1.0, low_conf:false },
      ],
    },
    {
      label: 'B',
      missions_covered: 5,
      utilisation_pct: 62.5,
      risk_score: 0.08,
      robustness_score: 61,
      robustness_histogram: [0,0,0.01,0.03,0.06,0.09,0.12,0.13,0.14,0.13,0.11,0.09,0.06,0.02,0.01,0,0,0,0,0],
      top_failure_causes: ['weather_shift','aircraft_failure','threat_expansion'],
      weakest_mission: 'M01',
      notes: 'Priority weight 0.25 / Risk weight 0.75',
      assignments: [
        { mission_id:'M01', aircraft_id:'AC03', crew_id:'CR01', weapon_id:'WP01', start_zulu:'2024-10-14T07:00:00Z', end_zulu:'2024-10-14T08:30:00Z', route:[{lat:18.58,lon:73.91},{lat:19.54,lon:75.06},{lat:20.50,lon:76.20}], reason:'VIPER 13: low risk (0.03), weapon match (PGM)', confidence:1.0, low_conf:false },
        { mission_id:'M02', aircraft_id:'AC06', crew_id:'CR03', weapon_id:'WP05', start_zulu:'2024-10-14T06:30:00Z', end_zulu:'2024-10-14T07:30:00Z', route:[{lat:21.09,lon:79.05},{lat:20.45,lon:78.28},{lat:19.80,lon:77.50}], reason:'RAPTOR 23: low risk (0.04), weapon match (HARM)', confidence:1.0, low_conf:false },
        { mission_id:'M03', aircraft_id:'AC08', crew_id:'CR06', weapon_id:'WP04', start_zulu:'2024-10-14T08:00:00Z', end_zulu:'2024-10-14T10:00:00Z', route:[{lat:21.09,lon:79.05},{lat:20.60,lon:78.68},{lat:20.10,lon:78.30}], reason:'HAWK 32: low risk (0.06), weapon match (ROCKET_POD)', confidence:1.0, low_conf:false },
        { mission_id:'M04', aircraft_id:'AC12', crew_id:'CR07', weapon_id:'WP06', start_zulu:'2024-10-14T06:00:00Z', end_zulu:'2024-10-14T09:00:00Z', route:[{lat:18.58,lon:73.91},{lat:19.89,lon:75.86},{lat:21.20,lon:77.80}], reason:'GHOST 42: low risk (0.01), weapon match (RECCE_POD)', confidence:1.0, low_conf:false },
        { mission_id:'M07', aircraft_id:'AC10', crew_id:'CR09', weapon_id:'WP03', start_zulu:'2024-10-14T07:30:00Z', end_zulu:'2024-10-14T09:00:00Z', route:[{lat:17.45,lon:78.47},{lat:17.68,lon:78.79},{lat:17.90,lon:79.10}], reason:'HAWK 34: low risk (0.03), weapon match (JDAM)', confidence:1.0, low_conf:false },
      ],
    },
    {
      label: 'C',
      missions_covered: 6,
      utilisation_pct: 75.0,
      risk_score: 0.22,
      robustness_score: 74,
      robustness_histogram: [0,0,0.01,0.02,0.04,0.06,0.09,0.11,0.13,0.13,0.12,0.10,0.08,0.05,0.03,0.02,0.01,0,0,0],
      top_failure_causes: ['aircraft_failure','crew_delay','threat_expansion'],
      weakest_mission: 'M06',
      notes: 'Priority weight 0.75 / Risk weight 0.25',
      assignments: [
        { mission_id:'M01', aircraft_id:'AC01', crew_id:'CR01', weapon_id:'WP01', start_zulu:'2024-10-14T07:00:00Z', end_zulu:'2024-10-14T08:30:00Z', route:[{lat:18.58,lon:73.91},{lat:19.54,lon:75.06},{lat:20.50,lon:76.20}], reason:'VIPER 11: highest priority match', confidence:1.0, low_conf:false },
        { mission_id:'M02', aircraft_id:'AC04', crew_id:'CR03', weapon_id:'WP02', start_zulu:'2024-10-14T06:30:00Z', end_zulu:'2024-10-14T07:30:00Z', route:[{lat:18.60,lon:74.15},{lat:19.20,lon:75.83},{lat:19.80,lon:77.50}], reason:'RAPTOR 21: priority 1 mission', confidence:1.0, low_conf:false },
        { mission_id:'M03', aircraft_id:'AC07', crew_id:'CR05', weapon_id:'WP04', start_zulu:'2024-10-14T08:00:00Z', end_zulu:'2024-10-14T10:00:00Z', route:[{lat:21.09,lon:79.05},{lat:20.60,lon:78.68},{lat:20.10,lon:78.30}], reason:'HAWK 31: best range fit for CAS CHARLIE', confidence:1.0, low_conf:false },
        { mission_id:'M04', aircraft_id:'AC12', crew_id:'CR07', weapon_id:'WP06', start_zulu:'2024-10-14T06:00:00Z', end_zulu:'2024-10-14T09:00:00Z', route:[{lat:18.58,lon:73.91},{lat:19.89,lon:75.86},{lat:21.20,lon:77.80}], reason:'GHOST 42: ISR DELTA optimal coverage', confidence:1.0, low_conf:false },
        { mission_id:'M06', aircraft_id:'AC05', crew_id:'CR04', weapon_id:'WP02', start_zulu:'2024-10-14T10:00:00Z', end_zulu:'2024-10-14T11:00:00Z', route:[{lat:18.60,lon:74.15},{lat:19.70,lon:75.75},{lat:20.80,lon:76.90}], reason:'RAPTOR 22: SEAD FOXTROT coverage added', confidence:0.85, low_conf:false },
        { mission_id:'M07', aircraft_id:'AC09', crew_id:'CR09', weapon_id:'WP03', start_zulu:'2024-10-14T07:30:00Z', end_zulu:'2024-10-14T09:00:00Z', route:[{lat:17.45,lon:78.47},{lat:17.68,lon:78.79},{lat:17.90,lon:79.10}], reason:'HAWK 33: CAS GOLF in-range', confidence:1.0, low_conf:false },
      ],
    },
  ],
}

export const MOCK_DISRUPTIONS = [
  { id:1, zulu:'141806Z OCT 24', type:'AIRCRAFT_UNSERVICEABLE', severity:'HIGH',    text:'VIPER 12 hydraulics failure – removed from tasking' },
  { id:2, zulu:'141752Z OCT 24', type:'WEATHER_CLOSING',        severity:'MEDIUM',  text:'Wx deterioration at Nagpur – cloud base 800ft' },
  { id:3, zulu:'141741Z OCT 24', type:'NEW_THREAT',             severity:'CRITICAL', text:'SAM acquisition radar active near 20.1N 78.3E' },
  { id:4, zulu:'141730Z OCT 24', type:'COMMS_JAM',              severity:'HIGH',    text:'HF band jamming detected on freq 12.450 MHz' },
  { id:5, zulu:'141715Z OCT 24', type:'PRIORITY_CHANGE',        severity:'LOW',     text:'STRIKE ALPHA priority elevated to P1 by JOC' },
]

export const MOCK_ADVISORIES = [
  { id:'ADV1', text:'VIPER 12 maint risk 52% in 1.5 hrs. Backup plan ready.', level:'HIGH'    },
  { id:'ADV2', text:'GHOST 41 RUL 400hrs – schedule inspection before next cycle.', level:'MEDIUM' },
  { id:'ADV3', text:'SAM RING ALPHA expanding – reroute STRIKE ALPHA recommended.', level:'HIGH'    },
  { id:'ADV4', text:'Weather impact 38% on M02 window 0630–0800Z.', level:'LOW'     },
]

export const MOCK_DIFF = {
  plan_before_id: 'a1b2c3d4',
  plan_after_id:  'e5f6a7b8',
  disruption_summary: 'AIRCRAFT_UNSERVICEABLE: AC02 at 141806Z',
  diffs: [
    { mission_id:'M01', before:'AC:AC02 CR:CR02', after:'AC:AC01 CR:CR01', reason:'VIPER 11: range fit (279km), weapon match (PGM), crew within duty limit', confidence:1.0,  low_conf:false },
    { mission_id:'M05', before:'AC:AC01 CR:CR01', after:'AC:AC03 CR:CR08', reason:'VIPER 13: substituted – lower risk (0.03 vs 0.06)', confidence:0.95, low_conf:false },
    { mission_id:'M08', before:'UNASSIGNED',       after:'UNASSIGNED',      reason:'No suitable STRIKE asset with JDAM at AB04 range', confidence:0.0,  low_conf:true  },
  ],
}

export const MOCK_PREDICTIONS = {
  aircraft: [
    { aircraft_id:'AC02', callsign:'VIPER 12', fail_probability:0.52, rul_hrs:250, risk_level:'HIGH',     advisory:'VIPER 12 maint risk 52% in 250 hrs. Backup plan ready.' },
    { aircraft_id:'AC11', callsign:'GHOST 41', fail_probability:0.44, rul_hrs:400, risk_level:'HIGH',     advisory:'GHOST 41 maint risk 44% in 400 hrs. Backup plan ready.' },
    { aircraft_id:'AC05', callsign:'RAPTOR 22',fail_probability:0.25, rul_hrs:700, risk_level:'MEDIUM',   advisory:'' },
    { aircraft_id:'AC04', callsign:'RAPTOR 21',fail_probability:0.18, rul_hrs:900, risk_level:'MEDIUM',   advisory:'' },
    { aircraft_id:'AC01', callsign:'VIPER 11', fail_probability:0.06, rul_hrs:1180,risk_level:'LOW',      advisory:'' },
  ],
  missions: [
    { mission_id:'M01', mission_name:'STRIKE ALPHA', weather_impact:0.22, threat_approach:0.28, at_risk:true,  reason:'threat approach probability 28%' },
    { mission_id:'M02', mission_name:'SEAD BRAVO',   weather_impact:0.38, threat_approach:0.15, at_risk:false, reason:'weather impact 38%' },
    { mission_id:'M03', mission_name:'CAS CHARLIE',  weather_impact:0.12, threat_approach:0.08, at_risk:false, reason:'nominal' },
    { mission_id:'M04', mission_name:'ISR DELTA',    weather_impact:0.08, threat_approach:0.05, at_risk:false, reason:'nominal' },
  ],
}

export const MOCK_NEG_LOG = [
  { agent:'AIRCRAFT_AGENT', action:'BID',     mission_id:'M01', reason:'VIPER 11: range 279km, fail_prob 0.06', score:0.88, zulu:'141801Z OCT 24' },
  { agent:'AIRCRAFT_AGENT', action:'BID',     mission_id:'M01', reason:'VIPER 12: range 279km, fail_prob 0.52', score:0.42, zulu:'141801Z OCT 24' },
  { agent:'CREW_AGENT',     action:'BID',     mission_id:'M01', reason:'Sqn Ldr Arora: 10.0h duty remaining, qualified', score:1.0, zulu:'141801Z OCT 24' },
  { agent:'WEAPONS_AGENT',  action:'BID',     mission_id:'M01', reason:'PGM x8 available at AB01', score:1.0,  zulu:'141801Z OCT 24' },
  { agent:'WEATHER_AGENT',  action:'BID',     mission_id:'M01', reason:'weather severity 22% – acceptable',    score:0.78, zulu:'141801Z OCT 24' },
  { agent:'COORDINATOR',    action:'AWARD',   mission_id:'M01', reason:'Awarded VIPER 11/Sqn Ldr Arora/PGM score=2.66', score:2.66, zulu:'141801Z OCT 24' },
  { agent:'AIRCRAFT_AGENT', action:'BID',     mission_id:'M02', reason:'RAPTOR 21: range 362km, fail_prob 0.18', score:0.72, zulu:'141801Z OCT 24' },
  { agent:'WEATHER_AGENT',  action:'BID',     mission_id:'M02', reason:'weather severity 38% – acceptable',    score:0.62, zulu:'141801Z OCT 24' },
  { agent:'COORDINATOR',    action:'AWARD',   mission_id:'M02', reason:'Awarded RAPTOR 21/Sqn Ldr Mehta/HARM score=2.34', score:2.34, zulu:'141801Z OCT 24' },
  { agent:'WEATHER_AGENT',  action:'VETO',    mission_id:'M06', reason:'weather severity 72% – VETO',           score:0.72, zulu:'141802Z OCT 24' },
  { agent:'COORDINATOR',    action:'RESOLVE', mission_id:'M06', reason:'Mission SEAD FOXTROT blocked by weather veto (72%)', score:0.0, zulu:'141802Z OCT 24' },
]

export const MOCK_CONTESTED_SOURCES = [
  { source:'radar',   confidence:0.0,  age_minutes:45,  status:'LOST'     },
  { source:'iff',     confidence:0.0,  age_minutes:52,  status:'LOST'     },
  { source:'weather', confidence:0.45, age_minutes:12,  status:'DEGRADED' },
  { source:'comms',   confidence:0.0,  age_minutes:60,  status:'LOST'     },
  { source:'intel',   confidence:0.55, age_minutes:8,   status:'DEGRADED' },
  { source:'gps',     confidence:1.0,  age_minutes:0,   status:'LIVE'     },
]

export const MOCK_JAMMED_POLYGON = [
  { lat:19.5, lon:76.0 },
  { lat:21.0, lon:76.5 },
  { lat:21.0, lon:79.0 },
  { lat:19.5, lon:79.0 },
]

