"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { format } from "date-fns";
import { 
  Activity, Heart, Thermometer, Droplet, 
  AlertTriangle, Send, Radio, Terminal, 
  Search, Pause, Download, Trash2, Info, ChevronRight, MapPin, Zap, ActivitySquare, Play, LocateFixed, ArrowDown,
  ShieldCheck, ShieldAlert, Sliders, CheckCircle, Clock, Volume2, UserCheck, Stethoscope, PhoneCall, Siren, X, AlertCircle, RefreshCw, Users,
  LayoutGrid, List, Filter, ChevronLeft, ArrowUpDown, ChevronDown, Check, Battery, Eye
} from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { LanguageSelector } from "../components/LanguageSelector";
import { getMockDemographics, getRegisteredFleetRoster, MockSeniorDemographics, ENABLE_DEMOGRAPHIC_MOCK } from "../services/mockDemographicService";

export interface SafetyThresholds {
  hrMin: number;
  hrMax: number;
  bpSysMax: number;
  bpDiaMax: number;
  spo2Min: number;
  tempMin: number;
  tempMax: number;
}

export interface SeniorDeviceBinding {
  imei: string;
  seniorRefId: string;
  telemetryFrequencySeconds: number;
  safetyThresholds: SafetyThresholds;
  profileCategory: 'GENERAL' | 'CARDIO' | 'RESPIRATORY' | 'CUSTOM';
  clinicalRiskNotes?: string;
  lastUpdated: string;
}

export interface ActionAudit {
  action: string;
  operator: string;
  timestamp: string;
  notes?: string;
}

export interface AlarmEvent {
  id: string;
  imei: string;
  seniorRefId: string;
  timestamp: string;
  type: 'HR_TACHYCARDIA' | 'HR_BRADYCARDIA' | 'HYPERTENSION' | 'HYPOXIA' | 'HYPOTHERMIA' | 'FEVER' | 'SOS_PANIC';
  severity: 'CRITICAL' | 'WARNING';
  vitalType: '{t.cardHeartRate}' | '{t.cardBloodPressure}' | '{t.cardBloodOxygen}' | '{t.cardBodyTemp}' | 'SOS';
  currentValue: string;
  thresholdRule: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  actionsTaken: ActionAudit[];
}

interface Device {
  imei: string;
  lastSeen: string;
  hr?: number;
  bp_sys?: number;
  bp_dia?: number;
  spo2?: number;
  temp?: number;
  status?: string;
  steps?: number;
  rolls?: number;
  battery?: number;
  gsm?: number;
  satellites?: number;
  binding?: SeniorDeviceBinding;
}

interface LogEntry {
  id: string;
  time: string;
  direction: "RX" | "TX";
  data: string;
  imei: string | null;
}

function playAlarmChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    // ignore audio block
  }
}

export default function AdminDashboard() {
  const { t, language } = useLanguage();
  const [devices, setDevices] = useState<Device[]>([]);
  const [bindings, setBindings] = useState<SeniorDeviceBinding[]>([]);
  const [alarms, setAlarms] = useState<AlarmEvent[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [sosActive, setSosActive] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'Telemetry' | 'Commands' | 'Location' | 'Alarms'>('Telemetry');
  
  // Modals & Inspection
  const [selectedImei, setSelectedImei] = useState<string>('353456789012345');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedAlarmForAudit, setSelectedAlarmForAudit] = useState<AlarmEvent | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [actionSuccessToast, setActionSuccessToast] = useState<string | null>(null);

  // Scalable Enterprise Fleet Management & Filter State
  const [fleetSearchTerm, setFleetSearchTerm] = useState("");
  const [fleetCategoryFilter, setFleetCategoryFilter] = useState<'ALL' | 'ONLINE' | 'ALERTING' | 'CARDIO' | 'RESPIRATORY' | 'GENERAL'>('ALL');
  const [fleetSortBy, setFleetSortBy] = useState<'ALERTS_FIRST' | 'ONLINE_FIRST' | 'NAME' | 'ROOM'>('ALERTS_FIRST');
  const [isFleetDrawerOpen, setIsFleetDrawerOpen] = useState(false);
  const [fleetViewMode, setFleetViewMode] = useState<'GRID' | 'TABLE'>('GRID');
  const fleetCarouselRef = useRef<HTMLDivElement>(null);

  const scrollFleetCarousel = (direction: 'left' | 'right') => {
    if (fleetCarouselRef.current) {
      const scrollAmount = direction === 'left' ? -350 : 350;
      fleetCarouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Alarms filtering state
  const [alarmFilterStatus, setAlarmFilterStatus] = useState<'ALL' | 'ACTIVE' | 'RESOLVED'>('ALL');
  const [alarmSearchTerm, setAlarmSearchTerm] = useState('');

  // Sniffer state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDirection, setFilterDirection] = useState<"ALL" | "RX" | "TX">("ALL");
  const [isPaused, setIsPaused] = useState(false);
  const [selectedPacket, setSelectedPacket] = useState<LogEntry | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Toast timer
  useEffect(() => {
    if (actionSuccessToast) {
      const timer = setTimeout(() => setActionSuccessToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [actionSuccessToast]);

  // WebSocket Connection
  useEffect(() => {
    const socket = new WebSocket("ws://localhost:3001");
    
    socket.onopen = () => {
      console.log("Connected to backend WS");
      setWs(socket);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case "INITIAL_STATE":
          setDevices(data.devices || []);
          if (data.bindings) setBindings(data.bindings);
          if (data.alarms) setAlarms(data.alarms);
          break;
        case "STATE_UPDATE":
          setDevices(data.devices);
          break;
        case "BINDINGS_UPDATE":
          if (data.bindings) setBindings(data.bindings);
          break;
        case "ALARMS_UPDATE":
          if (data.alarms) setAlarms(data.alarms);
          break;
        case "ALERT_TRIGGERED":
          playAlarmChime();
          if (data.alarms) {
            setAlarms(prev => {
              const incoming: AlarmEvent[] = data.alarms;
              const merged = [...incoming, ...prev.filter(p => !incoming.some(a => a.id === p.id))];
              return merged;
            });
          }
          break;
        case "RAW_PACKET":
          setLogs(prev => {
              if (isPaused) return prev;
              const newLogs = [{ id: Math.random().toString(36).substr(2, 9), time: data.timestamp, direction: data.direction, data: data.data, imei: data.imei }, ...prev];
              return newLogs.slice(0, 500);
          });
          break;
        case "SOS_ALERT":
          playAlarmChime();
          setSosActive(data.imei);
          setTimeout(() => setSosActive(null), 15000);
          break;
      }
    };

    socket.onclose = () => setWs(null);
    return () => socket.close();
  }, [isPaused]);

  // Command & Action helpers
  const sendCommand = (imei: string, command: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "SEND_COMMAND", imei, command }));
    }
  };

  const requestHRUpdate = (imei: string) => {
    const journal = format(new Date(), "HHmmss");
    sendCommand(imei, `IWBPXL,${imei},${journal}#`);
  };

  const locateGPS = (imei: string) => {
    const journal = format(new Date(), "HHmmss");
    sendCommand(imei, `IWBP16,${imei},${journal}#`);
  };

  const sendWatchAlertMessage = (imei: string, text: string, alarmId?: string) => {
    const hex = Array.from(text).map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
    const journal = format(new Date(), "HHmmss");
    const cmd = `IWBP40,${imei},${journal},${hex}#`;
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "RAPID_INTERVENTION",
        imei,
        command: cmd,
        alarmId,
        action: `Sent Direct Warning to Smartwatch: "${text}"`,
        operator: 'Command Center Operator'
      }));
      setActionSuccessToast(`Warning message dispatched to watch terminal ${imei}`);
    }
  };

  const acknowledgeAlarm = (alarmId: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "ACKNOWLEDGE_ALARM",
        alarmId,
        operator: 'Duty Care Specialist'
      }));
      setActionSuccessToast(`Alert acknowledged & silenced`);
    }
  };

  const resolveAlarm = (alarmId: string, note?: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "RESOLVE_ALARM",
        alarmId,
        actionNote: note || 'Resolved & stabilized by care team',
        operator: 'Duty Care Specialist'
      }));
      setSelectedAlarmForAudit(null);
      setResolutionNote("");
      setActionSuccessToast(`Incident resolved and recorded in clinical audit`);
    }
  };

  const dispatchEmergencyCare = (alarm: AlarmEvent) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const alarmDemo = getMockDemographics(alarm.seniorRefId);
      ws.send(JSON.stringify({
        type: "RAPID_INTERVENTION",
        alarmId: alarm.id,
        action: `Emergency Medical Support Unit dispatched to senior station (${alarmDemo?.careStation || 'Room Assigned'})`,
        operator: 'Emergency Dispatcher'
      }));
      setActionSuccessToast(`Emergency response dispatched for ${alarm.seniorRefId}`);
    }
  };

  const updateBindingThresholds = (updated: SeniorDeviceBinding) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "UPDATE_BINDING",
        binding: updated
      }));
      setIsConfigModalOpen(false);
      setActionSuccessToast(`Safety thresholds updated for ${updated.seniorRefId}`);
    }
  };

  // Compile Complete Monitored Fleet (combining registry, dynamic bindings, and connected sockets)
  const allFleetSeniors = useMemo(() => {
    const list: MockSeniorDemographics[] = [...getRegisteredFleetRoster()];
    
    // Add any dynamically connected device or binding not in static registry
    bindings.forEach(b => {
      if (!list.some(s => s.seniorRefId === b.seniorRefId || s.imei === b.imei)) {
        const demo = getMockDemographics(b.seniorRefId);
        if (demo) {
          list.push({
            ...demo,
            imei: b.imei,
            category: b.profileCategory || 'GENERAL',
            icon: b.profileCategory === 'CARDIO' ? '❤️' : b.profileCategory === 'RESPIRATORY' ? '🫁' : '🏥'
          });
        }
      }
    });

    devices.forEach(d => {
      if (!list.some(s => s.imei === d.imei)) {
        const refId = d.binding?.seniorRefId || `SNR-${d.imei.slice(-5)}-X`;
        const demo = getMockDemographics(refId);
        if (demo) {
          list.push({
            ...demo,
            imei: d.imei,
            category: d.binding?.profileCategory || 'GENERAL',
            icon: '🏥'
          });
        }
      }
    });

    return list;
  }, [bindings, devices]);

  // Active Device and Senior Binding (Multi-Senior Fleet Support)
  const activeDevice = devices.find(d => d.imei === selectedImei) || (devices.length > 0 ? devices[0] : null);
  const currentImei = selectedImei || activeDevice?.imei || (allFleetSeniors[0]?.imei ?? '353456789012345');
  const isConnected = devices.some(d => d.imei === currentImei);

  const selectedSeniorDemo = allFleetSeniors.find(s => s.imei === currentImei) || allFleetSeniors[0];

  const currentBinding: SeniorDeviceBinding = bindings.find(b => b.imei === currentImei) || {
    imei: currentImei,
    seniorRefId: selectedSeniorDemo?.seniorRefId || `SNR-${currentImei.slice(-5)}-X`,
    telemetryFrequencySeconds: 15,
    profileCategory: selectedSeniorDemo?.category || 'GENERAL',
    clinicalRiskNotes: selectedSeniorDemo?.clinicalRiskGroup || 'Standard Geriatric Protocol',
    safetyThresholds: selectedSeniorDemo?.category === 'RESPIRATORY' ? {
      hrMin: 55, hrMax: 115, bpSysMax: 145, bpDiaMax: 92, spo2Min: 90, tempMin: 35.5, tempMax: 38.0
    } : {
      hrMin: 50, hrMax: 110, bpSysMax: 140, bpDiaMax: 90, spo2Min: 92, tempMin: 35.5, tempMax: 37.8
    },
    lastUpdated: new Date().toISOString()
  };

  // Mock Demographics for Demo/Display (Fully decoupled)
  const mockDemographics = selectedSeniorDemo || getMockDemographics(currentBinding.seniorRefId);

  // Filtered & Sorted Fleet
  const filteredFleet = useMemo(() => {
    return allFleetSeniors.filter(snr => {
      const dev = devices.find(d => d.imei === snr.imei);
      const isOnline = !!dev;
      const isAlerting = alarms.some(a => (a.imei === snr.imei || a.seniorRefId === snr.seniorRefId) && a.status === 'ACTIVE');

      // Category / Status filter
      if (fleetCategoryFilter === 'ONLINE' && !isOnline) return false;
      if (fleetCategoryFilter === 'ALERTING' && !isAlerting) return false;
      if (fleetCategoryFilter === 'CARDIO' && snr.category !== 'CARDIO') return false;
      if (fleetCategoryFilter === 'RESPIRATORY' && snr.category !== 'RESPIRATORY') return false;
      if (fleetCategoryFilter === 'GENERAL' && snr.category !== 'GENERAL') return false;

      // Text search
      if (fleetSearchTerm.trim()) {
        const q = fleetSearchTerm.toLowerCase().trim();
        const matchName = snr.displayAlias.toLowerCase().includes(q);
        const matchId = snr.seniorRefId.toLowerCase().includes(q);
        const matchStation = snr.careStation.toLowerCase().includes(q);
        const matchImei = snr.imei.toLowerCase().includes(q);
        const matchPhysician = snr.primaryPhysician.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchStation && !matchImei && !matchPhysician) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      const aDev = devices.find(d => d.imei === a.imei);
      const bDev = devices.find(d => d.imei === b.imei);
      const aAlert = alarms.some(al => (al.imei === a.imei || al.seniorRefId === a.seniorRefId) && al.status === 'ACTIVE');
      const bAlert = alarms.some(al => (al.imei === b.imei || al.seniorRefId === b.seniorRefId) && al.status === 'ACTIVE');

      if (fleetSortBy === 'ALERTS_FIRST') {
        if (aAlert && !bAlert) return -1;
        if (!aAlert && bAlert) return 1;
        if (aDev && !bDev) return -1;
        if (!aDev && bDev) return 1;
      } else if (fleetSortBy === 'ONLINE_FIRST') {
        if (aDev && !bDev) return -1;
        if (!aDev && bDev) return 1;
        if (aAlert && !bAlert) return -1;
        if (!aAlert && bAlert) return 1;
      } else if (fleetSortBy === 'ROOM') {
        return a.careStation.localeCompare(b.careStation);
      }
      return a.displayAlias.localeCompare(b.displayAlias);
    });
  }, [allFleetSeniors, devices, alarms, fleetCategoryFilter, fleetSearchTerm, fleetSortBy]);

  // Fleet Statistics
  const totalFleetCount = allFleetSeniors.length;
  const onlineFleetCount = allFleetSeniors.filter(s => devices.some(d => d.imei === s.imei)).length;
  const alertingFleetCount = allFleetSeniors.filter(s => alarms.some(a => (a.imei === s.imei || a.seniorRefId === s.seniorRefId) && a.status === 'ACTIVE')).length;
  const offlineFleetCount = totalFleetCount - onlineFleetCount;

  // Threshold Evaluation Helpers for Live Vitals
  const thresholds = currentBinding.safetyThresholds;
  const hrBreach = activeDevice?.hr ? (activeDevice.hr > thresholds.hrMax ? 'TACHYCARDIA' : activeDevice.hr < thresholds.hrMin ? 'BRADYCARDIA' : null) : null;
  const bpBreach = (activeDevice?.bp_sys && activeDevice?.bp_dia) ? (activeDevice.bp_sys > thresholds.bpSysMax || activeDevice.bp_dia > thresholds.bpDiaMax ? 'HYPERTENSION' : null) : null;
  const spo2Breach = activeDevice?.spo2 ? (activeDevice.spo2 < thresholds.spo2Min ? 'HYPOXIA' : null) : null;
  const tempBreach = activeDevice?.temp ? (activeDevice.temp > thresholds.tempMax ? 'FEVER' : activeDevice.temp < thresholds.tempMin ? 'HYPOTHERMIA' : null) : null;

  // Active critical alarms
  const activeCriticalAlarms = alarms.filter(a => a.status === 'ACTIVE' || a.status === 'ACKNOWLEDGED');
  const highestPriorityAlarm = activeCriticalAlarms.find(a => a.status === 'ACTIVE') || activeCriticalAlarms[0];

  const filteredLogs = logs.filter(log => {
    if (filterDirection !== "ALL" && log.direction !== filterDirection) return false;
    if (searchTerm && !log.data.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#002b36] text-zinc-300 font-sans flex flex-col">
      {/* TOP NOTIFICATION TOAST */}
      {actionSuccessToast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-4">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          {actionSuccessToast}
        </div>
      )}

      {/* STICKY TOP CONSOLE HEADER & MONITORED FLEET CONTROLS */}
      <div className="sticky top-0 z-30 shadow-2xl backdrop-blur-md">
        {/* TOP HEADER */}
        <header className="bg-[#073642] border-b border-zinc-800 p-4">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
              <Radio className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-zinc-100">{t.appTitle}</h1>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border ${isConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}>
                  {isConnected ? t.liveFeedActive : t.serverOffline}
                </span>
                <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> {t.cndpCompliant}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {t.activeTerminal}: <span className="text-zinc-400 font-mono">{currentImei}</span> | {t.mappedSeniorRef}: <span className="text-blue-400 font-mono font-bold">{currentBinding.seniorRefId}</span>
              </p>
            </div>
          </div>

          <div className="flex gap-6 text-right items-center">
            <LanguageSelector />
            <div>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">{t.tcpPortLabel}</p>
              <p className="text-sm font-mono text-zinc-300">5088 <span className="text-zinc-500">(Active: {devices.length})</span></p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">{t.streamCadenceLabel}</p>
              <p className="text-sm font-mono text-emerald-400">{currentBinding.telemetryFrequencySeconds}s Interval</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">{t.activeAlarmsLabel}</p>
              <p className={`text-sm font-mono font-bold ${activeCriticalAlarms.length > 0 ? 'text-rose-400 animate-pulse' : 'text-zinc-400'}`}>
                {activeCriticalAlarms.length} {t.activeSuffix}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* SCALABLE ENTERPRISE SENIORS FLEET MANAGEMENT BAR */}
      <div className="bg-[#052831] border-b border-[#0e4c5b] px-6 py-3 shadow-md">
        <div className="max-w-[1600px] mx-auto space-y-2.5">
          
          {/* Row 1: Fleet Metrics, Search Bar, Category Filters, and Action Buttons */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            
            {/* Left: Title & Quick Fleet Health KPI Pills */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
                  {t.fleetTitle}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-950/60 text-blue-300 border border-blue-800/60 font-semibold">
                  {totalFleetCount} {t.totalCountBadge}
                </span>
              </div>

              {/* Status breakdown pills */}
              <div className="flex items-center gap-1.5 text-[10px] font-mono">
                <button
                  onClick={() => setFleetCategoryFilter(fleetCategoryFilter === 'ONLINE' ? 'ALL' : 'ONLINE')}
                  className={`px-2 py-0.5 rounded-md border flex items-center gap-1 transition-all ${
                    fleetCategoryFilter === 'ONLINE'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold shadow-sm'
                      : 'bg-zinc-900/60 text-emerald-400 border-emerald-800/40 hover:bg-emerald-950/30'
                  }`}
                  title="Filter to Online Watches only"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{onlineFleetCount} {t.colStatus === "État Clinique" ? "En Ligne" : "Online"}</span>
                </button>

                {alertingFleetCount > 0 && (
                  <button
                    onClick={() => setFleetCategoryFilter(fleetCategoryFilter === 'ALERTING' ? 'ALL' : 'ALERTING')}
                    className={`px-2 py-0.5 rounded-md border flex items-center gap-1 transition-all ${
                      fleetCategoryFilter === 'ALERTING'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold shadow-sm'
                        : 'bg-rose-950/40 text-rose-400 border-rose-800/50 hover:bg-rose-900/40 animate-pulse'
                    }`}
                    title="Filter to Alerting Seniors"
                  >
                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                    <span>{alertingFleetCount} {t.inAlertBadge}</span>
                  </button>
                )}

                <span className="text-zinc-600">|</span>
                <span className="text-zinc-400 text-[10px]">{devices.length} {t.activeSocketsLabel}</span>
              </div>
            </div>

            {/* Center: Search & Filter Toolbar */}
            <div className="flex items-center gap-2 flex-1 max-w-xl min-w-[280px]">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search 100+ seniors by name, room (e.g. 304), ID, or IMEI..."
                  value={fleetSearchTerm}
                  onChange={(e) => setFleetSearchTerm(e.target.value)}
                  className="w-full bg-[#00212b] border border-[#0e4c5b] rounded-lg pl-8 pr-7 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 font-mono transition-colors"
                />
                {fleetSearchTerm && (
                  <button
                    onClick={() => setFleetSearchTerm("")}
                    className="absolute right-2.5 top-2 text-zinc-400 hover:text-white text-xs font-bold"
                  >
                    &times;
                  </button>
                )}
              </div>

              {/* Protocol Filters */}
              <div className="flex items-center bg-[#00212b] p-0.5 rounded-lg border border-[#0e4c5b] text-[10px] font-semibold shrink-0">
                <button
                  onClick={() => setFleetCategoryFilter('ALL')}
                  className={`px-2 py-1 rounded transition-all ${fleetCategoryFilter === 'ALL' ? 'bg-[#073642] text-cyan-300 font-bold shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  {t.allFilter} ({totalFleetCount})
                </button>
                <button
                  onClick={() => setFleetCategoryFilter('CARDIO')}
                  className={`px-2 py-1 rounded transition-all flex items-center gap-1 ${fleetCategoryFilter === 'CARDIO' ? 'bg-rose-950/60 text-rose-300 border border-rose-800/40 font-bold' : 'text-zinc-400 hover:text-rose-300'}`}
                >
                  <span>❤️</span> Cardio
                </button>
                <button
                  onClick={() => setFleetCategoryFilter('RESPIRATORY')}
                  className={`px-2 py-1 rounded transition-all flex items-center gap-1 ${fleetCategoryFilter === 'RESPIRATORY' ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/40 font-bold' : 'text-zinc-400 hover:text-cyan-300'}`}
                >
                  <span>🫁</span> Resp
                </button>
                <button
                  onClick={() => setFleetCategoryFilter('GENERAL')}
                  className={`px-2 py-1 rounded transition-all flex items-center gap-1 ${fleetCategoryFilter === 'GENERAL' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 font-bold' : 'text-zinc-400 hover:text-emerald-300'}`}
                >
                  <span>🏥</span> General
                </button>
              </div>
            </div>

            {/* Right: Quick Sort, Active Combobox, and Open Full Matrix Button */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Sort Selector */}
              <div className="flex items-center gap-1 bg-[#00212b] px-2 py-1 rounded-lg border border-[#0e4c5b] text-[11px] text-zinc-400">
                <ArrowUpDown className="w-3 h-3 text-zinc-500" />
                <select
                  value={fleetSortBy}
                  onChange={(e) => setFleetSortBy(e.target.value as any)}
                  className="bg-transparent text-zinc-300 text-[10px] focus:outline-none cursor-pointer"
                >
                  <option value="ALERTS_FIRST" className="bg-[#073642]">{t.sortAlertsFirst}</option>
                  <option value="ONLINE_FIRST" className="bg-[#073642]">{t.sortOnlineFirst}</option>
                  <option value="NAME" className="bg-[#073642]">{t.sortName} (A-Z)</option>
                  <option value="ROOM" className="bg-[#073642]">{t.sortRoom} / Station</option>
                </select>
              </div>

              {/* Full Fleet Directory Button */}
              <button
                onClick={() => setIsFleetDrawerOpen(true)}
                className="bg-[#073642] hover:bg-[#0e4c5b] text-cyan-300 border border-cyan-700/40 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                title="Open Complete Fleet Directory & Matrix with Card Grid and Table Views"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t.browseFleetButton} ({totalFleetCount})</span>
              </button>
            </div>

          </div>

          {/* Row 2: Smooth Horizontal Scrollable Senior Carousel Chips */}
          <div className="relative flex items-center gap-1 pt-0.5">
            {/* Scroll Left Button */}
            <button
              onClick={() => scrollFleetCarousel('left')}
              className="p-1 rounded-lg bg-[#00212b] hover:bg-[#073642] text-zinc-400 hover:text-white border border-[#0e4c5b] transition-colors shrink-0 shadow-sm"
              title="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Scrollable Container */}
            <div
              ref={fleetCarouselRef}
              className="flex-1 flex gap-2 overflow-x-auto py-1 scroll-smooth"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {filteredFleet.length === 0 ? (
                <div className="py-2 px-4 text-xs text-zinc-500 italic bg-[#00212b]/60 rounded-xl border border-dashed border-[#0e4c5b] flex items-center gap-2">
                  <Info className="w-3.5 h-3.5" /> No seniors match &quot;{fleetSearchTerm || fleetCategoryFilter}&quot;.
                  <button onClick={() => { setFleetSearchTerm(""); setFleetCategoryFilter("ALL"); }} className="text-cyan-400 underline ml-2 font-semibold">
                    Reset filters
                  </button>
                </div>
              ) : (
                filteredFleet.map((snr) => {
                  const dev = devices.find(d => d.imei === snr.imei);
                  const isSelected = currentImei === snr.imei;
                  const isDevOnline = !!dev;
                  const activeAlarm = alarms.find(a => (a.imei === snr.imei || a.seniorRefId === snr.seniorRefId) && a.status === 'ACTIVE');

                  return (
                    <button
                      key={snr.imei}
                      onClick={() => setSelectedImei(snr.imei)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 shrink-0 border text-left ${
                        isSelected
                          ? 'bg-[#073642] text-cyan-200 border-cyan-400 shadow-md ring-1 ring-cyan-400/40'
                          : activeAlarm
                          ? 'bg-rose-950/40 text-rose-200 border-rose-600/70 hover:bg-rose-900/50 animate-pulse'
                          : 'bg-[#00212b] hover:bg-[#073642]/80 text-zinc-300 border-[#0e4c5b]'
                      }`}
                    >
                      <span className="text-sm">{snr.icon}</span>
                      
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-zinc-100 truncate max-w-[130px]">{snr.displayAlias}</span>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isDevOnline ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} title={isDevOnline ? 'Connected Watch' : 'Standby / Offline'} />
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-400">
                          <span>{snr.careStation.split(' - ')[1] || snr.careStation}</span>
                          <span>&bull;</span>
                          <span className="opacity-75">{snr.seniorRefId}</span>
                        </div>
                      </div>

                      {/* Live vitals or alert pill */}
                      {activeAlarm ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white animate-bounce shrink-0">
                          {activeAlarm.vitalType} ALERT
                        </span>
                      ) : dev ? (
                        <div className="text-[10px] font-mono bg-black/40 px-1.5 py-0.5 rounded text-cyan-300 border border-cyan-800/40 shrink-0">
                          {dev.hr ? `${dev.hr} bpm` : ''} {dev.spo2 ? `| ${dev.spo2}%` : ''}
                        </div>
                      ) : (
                        <span className="text-[9px] font-mono text-zinc-500 bg-black/20 px-1.5 py-0.5 rounded shrink-0">
                          {t.standbyBadge}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Scroll Right Button */}
            <button
              onClick={() => scrollFleetCarousel('right')}
              className="p-1 rounded-lg bg-[#00212b] hover:bg-[#073642] text-zinc-400 hover:text-white border border-[#0e4c5b] transition-colors shrink-0 shadow-sm"
              title="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
      </div>

      {/* CRITICAL RAPID INTERVENTION BANNER */}
      {highestPriorityAlarm && (
        <div className={`border-b p-3 px-6 shadow-2xl transition-all ${highestPriorityAlarm.status === 'ACTIVE' ? 'bg-gradient-to-r from-red-950 via-rose-900 to-red-950 border-red-500 text-white animate-pulse' : 'bg-zinc-900 border-amber-500/40 text-amber-200'}`}>
          <div className="max-w-[1600px] mx-auto flex justify-between items-center flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-600 rounded-lg text-white">
                <Siren className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xs uppercase tracking-wider bg-black/40 px-2 py-0.5 rounded text-red-200">
                    {highestPriorityAlarm.severity} {highestPriorityAlarm.vitalType} ALERT
                  </span>
                  <span className="text-xs font-mono text-zinc-300">
                    Senior ID: <strong className="text-white">{highestPriorityAlarm.seniorRefId}</strong>
                  </span>
                  {(() => {
                    const alarmDemo = getMockDemographics(highestPriorityAlarm.seniorRefId);
                    return alarmDemo ? (
                      <span className="text-xs bg-red-900/60 px-2 py-0.5 rounded text-red-200 border border-red-700/50">
                        {alarmDemo.displayAlias} ({alarmDemo.careStation})
                      </span>
                    ) : null;
                  })()}
                </div>
                <p className="text-xs mt-0.5 text-zinc-100">
                  Breach: <strong className="text-amber-300 font-mono text-sm">{highestPriorityAlarm.currentValue}</strong> &mdash; {highestPriorityAlarm.thresholdRule}
                </p>
              </div>
            </div>

            {/* RAPID INTERVENTION BUTTONS */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => sendWatchAlertMessage(highestPriorityAlarm.imei, "ALERT: High vitals detected. Please sit down and rest.", highestPriorityAlarm.id)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-all active:scale-95"
                title="Transmits immediate Unicode warning to the senior's watch screen"
              >
                <Send className="w-3.5 h-3.5" /> Send Warning (BP40)
              </button>

              <button 
                onClick={() => dispatchEmergencyCare(highestPriorityAlarm)}
                className="px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-all active:scale-95"
                title="Logs emergency response dispatch and notifies caregiver station"
              >
                <Siren className="w-3.5 h-3.5" /> Dispatch Care Unit
              </button>

              {highestPriorityAlarm.status === 'ACTIVE' ? (
                <button 
                  onClick={() => acknowledgeAlarm(highestPriorityAlarm.id)}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" /> Acknowledge (Silence)
                </button>
              ) : (
                <button 
                  onClick={() => resolveAlarm(highestPriorityAlarm.id, "Stabilized by care staff")}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Mark Resolved
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SOS FLASH BANNER */}
      {sosActive && (
        <div className="bg-red-600 text-white p-3 flex justify-center items-center gap-3 font-bold tracking-wider z-50 animate-pulse">
          <AlertTriangle className="w-5 h-5" />
          PHYSICAL SOS PANIC BUTTON ACTIVATED BY SMARTWATCH {sosActive}
        </div>
      )}

      <div className="flex-1 max-w-[1600px] w-full mx-auto p-6 flex flex-col gap-6">
        
        {/* NAVIGATION TABS */}
        <div className="flex gap-8 border-b border-zinc-800">
          <button className={`pb-3 text-sm font-bold transition-colors ${activeTab === 'Telemetry' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`} onClick={() => setActiveTab('Telemetry')}>
            {t.tabTelemetry}
          </button>
          <button className={`pb-3 text-sm font-bold transition-colors flex items-center gap-2 ${activeTab === 'Alarms' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`} onClick={() => setActiveTab('Alarms')}>
            {t.tabAlarms}
            {activeCriticalAlarms.length > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                {activeCriticalAlarms.length}
              </span>
            )}
          </button>
          <button className={`pb-3 text-sm font-bold transition-colors ${activeTab === 'Commands' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`} onClick={() => setActiveTab('Commands')}>
            {t.tabCommands}
          </button>
          <button className={`pb-3 text-sm font-bold transition-colors ${activeTab === 'Location' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`} onClick={() => setActiveTab('Location')}>
            {t.tabLocation}
          </button>
        </div>

        {/* TAB 1: TELEMETRY & CLINICAL MONITORING */}
        {activeTab === 'Telemetry' && (
          <div className="flex flex-col gap-6">
            {/* CNDP SENIOR PROFILE & THRESHOLDS BANNER */}
            <div className="bg-[#073642] border border-zinc-800 rounded-xl p-5 flex justify-between items-center flex-wrap gap-4 shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-900/40 to-zinc-900 border border-blue-500/30 rounded-2xl flex items-center justify-center text-blue-400 shadow-inner">
                  <UserCheck className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Pinned Senior Ref ID:</span>
                    <span className="text-base font-extrabold font-mono text-zinc-100 bg-zinc-900 px-2.5 py-0.5 rounded-lg border border-zinc-800">
                      {currentBinding.seniorRefId}
                    </span>
                    <span className="bg-blue-500/10 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-500/20">
                      {currentBinding.clinicalRiskNotes || 'Cardio Protocol'}
                    </span>
                  </div>

                  {/* Decoupled Mock Display (Visual Demo Only - CNDP Decoupled) */}
                  {mockDemographics ? (
                    <div className="flex items-center gap-4 mt-2 text-xs text-zinc-400">
                      <span className="flex items-center gap-1.5 text-zinc-300">
                        <Stethoscope className="w-3.5 h-3.5 text-cyan-400" /> {mockDemographics.displayAlias}
                      </span>
                      <span className="text-zinc-600">|</span>
                      <span className="flex items-center gap-1 text-zinc-400">
                        <MapPin className="w-3.5 h-3.5 text-amber-400" /> {mockDemographics.careStation}
                      </span>
                      <span className="text-zinc-600">|</span>
                      <span className="text-zinc-400 font-mono text-[11px]">
                        📞 {mockDemographics.emergencyChannel}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500 mt-1">
                      Identity metadata isolated in external accredited demographic server (CNDP Privacy Protected).
                    </p>
                  )}
                </div>
              </div>

              {/* Action: Open Thresholds Modal */}
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase">{t.configuredCadenceLabel}</p>
                  <p className="text-xs font-mono font-bold text-emerald-400">{currentBinding.telemetryFrequencySeconds}s Ingestion</p>
                </div>
                <button 
                  onClick={() => setIsConfigModalOpen(true)}
                  className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-blue-500/50 text-zinc-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow"
                >
                  <Sliders className="w-4 h-4 text-blue-400" /> {t.configureThresholdsBtn}
                </button>
              </div>
            </div>

            {/* VITALS GRID WITH DYNAMIC PERSONALIZED THRESHOLDS */}
            <div className="grid grid-cols-6 gap-4">
              {/* {t.cardHeartRate} */}
              <div className={`bg-[#073642] border rounded-xl p-4 flex flex-col justify-between transition-all ${hrBreach ? 'border-rose-500/80 shadow-[0_0_15px_rgba(244,63,94,0.25)]' : 'border-zinc-800'}`}>
                <div className="flex justify-between text-zinc-500 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider">{t.cardHeartRate}</span>
                  <Heart className={`w-4 h-4 ${hrBreach ? 'text-rose-500 animate-pulse' : 'text-rose-500'}`} />
                </div>
                <div className="mb-2">
                  <span className={`text-3xl font-bold ${hrBreach ? 'text-rose-400' : 'text-rose-500'}`}>{activeDevice?.hr || '--'}</span>
                  <span className="text-xs text-zinc-500 ml-1">bpm</span>
                </div>
                <div className="flex justify-between text-[10px] border-t border-zinc-900 pt-2">
                  <span className="text-zinc-500 font-mono">Safe: {thresholds.hrMin}&ndash;{thresholds.hrMax} bpm</span>
                  <span className={`font-bold ${hrBreach ? 'text-rose-400 uppercase animate-pulse' : 'text-emerald-500'}`}>
                    {hrBreach ? `BREACH: ${hrBreach}` : '{t.statusInTarget}'}
                  </span>
                </div>
              </div>

              {/* {t.cardBloodPressure} */}
              <div className={`bg-[#073642] border rounded-xl p-4 flex flex-col justify-between transition-all ${bpBreach ? 'border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.25)]' : 'border-zinc-800'}`}>
                <div className="flex justify-between text-zinc-500 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider">{t.cardBloodPressure}</span>
                  <Activity className="w-4 h-4 text-amber-500" />
                </div>
                <div className="mb-2">
                  <span className={`text-3xl font-bold ${bpBreach ? 'text-amber-400' : 'text-zinc-100'}`}>
                    {activeDevice?.bp_sys || '--'}/{activeDevice?.bp_dia || '--'}
                  </span>
                  <span className="text-[10px] text-zinc-500 ml-1">mmHg</span>
                </div>
                <div className="flex justify-between text-[10px] border-t border-zinc-900 pt-2">
                  <span className="text-zinc-500 font-mono">Limit: &lt;{thresholds.bpSysMax}/{thresholds.bpDiaMax}</span>
                  <span className={`font-bold ${bpBreach ? 'text-amber-400 uppercase animate-pulse' : 'text-emerald-500'}`}>
                    {bpBreach ? 'BREACH: HIGH BP' : '{t.statusOptimal}'}
                  </span>
                </div>
              </div>

              {/* {t.cardBloodOxygen} */}
              <div className={`bg-[#073642] border rounded-xl p-4 flex flex-col justify-between transition-all ${spo2Breach ? 'border-cyan-500/80 shadow-[0_0_15px_rgba(6,182,212,0.25)]' : 'border-zinc-800'}`}>
                <div className="flex justify-between text-zinc-500 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider">{t.cardBloodOxygen}</span>
                  <ActivitySquare className="w-4 h-4 text-cyan-500" />
                </div>
                <div className="mb-2">
                  <span className={`text-3xl font-bold ${spo2Breach ? 'text-cyan-300' : 'text-cyan-400'}`}>{activeDevice?.spo2 || '--'}</span>
                  <span className="text-[10px] text-zinc-500 ml-1">%</span>
                </div>
                <div className="flex justify-between text-[10px] border-t border-zinc-900 pt-2">
                  <span className="text-zinc-500 font-mono">Limit: &ge;{thresholds.spo2Min}%</span>
                  <span className={`font-bold ${spo2Breach ? 'text-rose-400 uppercase animate-pulse' : 'text-emerald-500'}`}>
                    {spo2Breach ? 'BREACH: HYPOXIA' : '{t.statusHealthy}'}
                  </span>
                </div>
              </div>

              {/* {t.cardBodyTemp} */}
              <div className={`bg-[#073642] border rounded-xl p-4 flex flex-col justify-between transition-all ${tempBreach ? 'border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.25)]' : 'border-zinc-800'}`}>
                <div className="flex justify-between text-zinc-500 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider">{t.cardBodyTemp}</span>
                  <Thermometer className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="mb-2">
                  <span className={`text-3xl font-bold ${tempBreach ? 'text-amber-400' : 'text-emerald-400'}`}>{activeDevice?.temp || '--'}</span>
                  <span className="text-[10px] text-zinc-500 ml-1">°C</span>
                </div>
                <div className="flex justify-between text-[10px] border-t border-zinc-900 pt-2">
                  <span className="text-zinc-500 font-mono">Safe: {thresholds.tempMin}&ndash;{thresholds.tempMax}°C</span>
                  <span className={`font-bold ${tempBreach ? 'text-amber-400 uppercase animate-pulse' : 'text-emerald-500'}`}>
                    {tempBreach ? `BREACH: ${tempBreach}` : 'Normal'}
                  </span>
                </div>
              </div>

              {/* {t.cardStepCount} */}
              <div className="bg-[#073642] border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex justify-between text-zinc-500 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider">{t.cardStepCount}</span>
                  <Activity className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="mb-2">
                  <span className="text-3xl font-bold text-indigo-300">
                    {activeDevice?.steps !== undefined ? activeDevice.steps.toLocaleString() : '--'}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] border-t border-zinc-900 pt-2">
                  <span className="text-zinc-600">{t.rollsLabel} {activeDevice?.rolls !== undefined ? activeDevice.rolls : '--'}</span>
                  <span className="text-zinc-500">
                    {activeDevice?.steps !== undefined ? `{t.goalLabel} ${Math.min(100, Math.round((activeDevice.steps / 10000) * 100))}%` : '{t.goalLabel} --'}
                  </span>
                </div>
              </div>

              {/* {t.cardBattery} */}
              <div className="bg-[#073642] border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex justify-between text-zinc-500 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider">{t.cardBattery}</span>
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <div className="mb-2">
                  <span className="text-3xl font-bold text-zinc-100">
                    {activeDevice?.battery !== undefined ? activeDevice.battery : '--'}
                  </span>
                  <span className="text-xs text-zinc-500 ml-1">%</span>
                </div>
                <div className="flex justify-between text-[10px] border-t border-zinc-900 pt-2">
                  <span className="text-zinc-600">{t.gsmLabel} {activeDevice?.gsm !== undefined ? `${activeDevice.gsm}%` : '--'}</span>
                  <span className="text-zinc-500">{t.satsLabel} {activeDevice?.satellites !== undefined ? activeDevice.satellites : '--'}</span>
                </div>
              </div>
            </div>

            {/* QUICK OPERATOR ACTIONS */}
            <div className="bg-[#073642] border border-zinc-800 rounded-xl p-4 flex justify-between items-center flex-wrap gap-4">
              <div>
                <h2 className="text-sm font-bold text-zinc-100">{t.operatorControlsTitle}</h2>
                <p className="text-xs text-zinc-500 mt-0.5">{t.operatorControlsSubtitle}</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => activeDevice && requestHRUpdate(activeDevice.imei)}
                  disabled={!isConnected}
                  className="px-4 py-2 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-200 rounded-lg text-xs font-bold text-zinc-400 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Heart className="w-3.5 h-3.5 text-rose-500" /> {t.pollVitalsBtn}
                </button>
                <button 
                  onClick={() => activeDevice && locateGPS(activeDevice.imei)}
                  disabled={!isConnected}
                  className="px-4 py-2 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-200 rounded-lg text-xs font-bold text-zinc-400 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <LocateFixed className="w-3.5 h-3.5 text-blue-500" /> {t.locateGpsBtn}
                </button>
                <button 
                  onClick={() => setActiveTab('Commands')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold text-white transition-colors flex items-center gap-2"
                >
                  <ChevronRight className="w-3.5 h-3.5" /> {t.fullCommandCenterBtn}
                </button>
              </div>
            </div>

            {/* RAW TCP SNIFFER IN MEDIUM SCROLLABLE CONSOLE FRAME */}
            <div className="flex flex-col bg-[#073642] border border-zinc-800 rounded-xl overflow-hidden h-[450px] shadow-2xl shrink-0">
              {/* Header */}
              <div className="p-3.5 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/40">
                <div className="flex items-center gap-3">
                  <Terminal className="w-5 h-5 text-emerald-500" />
                  <div>
                    <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                      {t.rawSnifferTitle} 
                      <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-mono">{logs.length} Packets</span>
                    </h2>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{t.rawSnifferSubtitle}</p>
                  </div>
                </div>
                
                <div className="flex gap-2 items-center">
                  <button 
                    onClick={() => setAutoScroll(!autoScroll)}
                    className={`px-3 py-1.5 border rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${autoScroll ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}
                    title="Auto-scroll to latest incoming packets"
                  >
                    <ArrowDown className={`w-3.5 h-3.5 transition-transform ${autoScroll ? 'translate-y-0.5' : ''}`} />
                    Auto-scroll
                  </button>
                  <button 
                    onClick={() => setIsPaused(!isPaused)}
                    className={`px-3 py-1.5 border rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${isPaused ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}
                  >
                    {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button onClick={() => setLogs([])} className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-red-400 rounded-lg text-xs transition-colors" title="Clear packet log">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="p-2.5 border-b border-zinc-800 flex gap-4 bg-zinc-900/50">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input 
                    type="text" 
                    placeholder="Search payload string, IMEI, or command..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-9 pr-4 py-1.5 text-xs font-mono text-zinc-300 focus:outline-none focus:border-zinc-500"
                  />
                </div>
                <div className="flex rounded-lg border border-zinc-700 overflow-hidden bg-zinc-950">
                  <button onClick={() => setFilterDirection("ALL")} className={`px-4 py-1.5 text-xs font-bold ${filterDirection === 'ALL' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:bg-zinc-800'}`}>All</button>
                  <button onClick={() => setFilterDirection("RX")} className={`px-4 py-1.5 text-xs font-bold border-l border-zinc-700 flex items-center gap-1 ${filterDirection === 'RX' ? 'bg-zinc-700 text-emerald-400' : 'text-zinc-500 hover:bg-zinc-800'}`}><ChevronRight className="w-3 h-3 -rotate-45" /> Watch (AP)</button>
                  <button onClick={() => setFilterDirection("TX")} className={`px-4 py-1.5 text-xs font-bold border-l border-zinc-700 flex items-center gap-1 ${filterDirection === 'TX' ? 'bg-zinc-700 text-blue-400' : 'text-zinc-500 hover:bg-zinc-800'}`}><ChevronRight className="w-3 h-3 rotate-[135deg]" /> Server (BP)</button>
                </div>
              </div>

              {/* Split View Content */}
              <div className="flex-1 flex overflow-hidden min-h-0">
                {/* Log List */}
                <div 
                  ref={logContainerRef}
                  className="flex-1 overflow-y-auto border-r border-zinc-800 p-2 font-mono text-[11px] space-y-1 min-h-0 select-text"
                >
                  {filteredLogs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-600">
                      <Terminal className="w-8 h-8 mb-2 opacity-50" />
                      <p>{t.noPacketsMatch}</p>
                    </div>
                  ) : (
                    filteredLogs.map(log => (
                      <div 
                        key={log.id} 
                        onClick={() => setSelectedPacket(log)}
                        className={`flex items-start gap-3 p-2 rounded cursor-pointer transition-colors ${selectedPacket?.id === log.id ? 'bg-blue-900/30 border border-blue-500/30' : 'hover:bg-zinc-800/50 border border-transparent'}`}
                      >
                        <span className="text-zinc-600 shrink-0 select-none">{format(new Date(log.time), "HH:mm:ss.SSS")}</span>
                        <span className={`shrink-0 font-bold select-none ${log.direction === 'RX' ? 'text-emerald-500' : 'text-blue-500'}`}>
                          {log.direction === 'RX' ? 'IN ←' : 'OUT →'}
                        </span>
                        <span className="text-zinc-300 break-all">{log.data}</span>
                      </div>
                    ))
                  )}
                </div>

                {/* {t.packetDissectorTitle} */}
                <div className="w-[420px] bg-zinc-950 p-4 flex flex-col overflow-y-auto min-h-0">
                  <h3 className="text-xs font-bold flex items-center gap-2 text-zinc-300 mb-4 pb-2 border-b border-zinc-800">
                    <Info className="w-4 h-4 text-blue-400" /> {t.packetDissectorTitle}
                  </h3>
                  
                  {!selectedPacket ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 text-xs text-center px-8">
                      <ChevronRight className="w-8 h-8 mb-2 opacity-50" />
                      <p>{t.packetDissectorHint}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Raw Frame</p>
                        <div className="bg-[#00212b] border border-zinc-800 rounded-lg p-3 font-mono text-xs text-zinc-300 break-all">
                          {selectedPacket.data}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Direction</p>
                          <p className={`text-xs font-mono font-bold ${selectedPacket.direction === 'RX' ? 'text-emerald-400' : 'text-blue-400'}`}>
                             {selectedPacket.direction === 'RX' ? 'Device to Server' : 'Server to Device'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Protocol Ident</p>
                          <p className="text-xs font-mono text-zinc-300">IW (Framed)</p>
                        </div>
                      </div>

                      <div>
                         <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Opcode / Command</p>
                         <div className="flex items-center gap-2">
                           <span className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 px-3 text-xs font-mono text-amber-400 font-bold">
                              {selectedPacket.data.substring(2, 6)}
                           </span>
                           <span className="text-xs text-zinc-400 font-semibold">
                             {selectedPacket.data.startsWith('IWAP03') && 'Heartbeat & Link Status'}
                             {selectedPacket.data.startsWith('IWBP03') && 'Heartbeat Acknowledged'}
                             {selectedPacket.data.startsWith('IWAPHP') && 'Comprehensive Health Telemetry'}
                             {selectedPacket.data.startsWith('IWBPHP') && 'Health Telemetry Acknowledged'}
                             {selectedPacket.data.startsWith('IWAP00') && 'Device Login (AP00)'}
                             {selectedPacket.data.startsWith('IWBP00') && 'Login Acknowledged (Time Sync)'}
                             {selectedPacket.data.startsWith('IWAP10') && 'SOS Emergency Packet'}
                             {selectedPacket.data.startsWith('IWBPXL') && 'Trigger HR Measurement'}
                             {selectedPacket.data.startsWith('IWBP40') && 'Unicode Text Warning'}
                           </span>
                         </div>
                      </div>

                      {selectedPacket.data.startsWith('IWAP03') && (() => {
                        let payload = selectedPacket.data.substring(6, selectedPacket.data.length - 1);
                        if (payload.startsWith(',')) payload = payload.substring(1);
                        const parts = payload.split(',');
                        const statusStr = parts[0] || '';
                        const gsm = parseInt(statusStr.substring(0, 3) || '0', 10);
                        const sats = parseInt(statusStr.substring(3, 6) || '0', 10);
                        const batt = parseInt(statusStr.substring(6, 9) || '0', 10);
                        const steps = parts[1] || '0';
                        const rolls = parts[2] || '0';
                        return (
                          <div className="bg-[#00212b] border border-amber-500/20 rounded-lg p-3 text-xs space-y-2">
                            <p className="text-[11px] font-bold text-amber-400">AP03 Dissection Breakdown:</p>
                            <div className="grid grid-cols-2 gap-2 text-zinc-300 font-mono text-[11px]">
                              <div><span className="text-zinc-500">GSM Signal:</span> {gsm}%</div>
                              <div><span className="text-zinc-500">Satellites:</span> {sats}</div>
                              <div><span className="text-zinc-500">{t.cardBattery}:</span> {batt}%</div>
                              <div><span className="text-zinc-500">Steps:</span> {steps}</div>
                              <div><span className="text-zinc-500">{t.rollsLabel}</span> {rolls}</div>
                            </div>
                            <p className="text-[10px] text-zinc-500 pt-1 border-t border-zinc-800">
                              💡 <strong>Note:</strong> AP03 only transmits heartbeat, status, and pedometer steps. Health vitals (HR, BP, SpO2, Temp) are transmitted in <strong>APHP</strong> packets!
                            </p>
                          </div>
                        );
                      })()}

                      <div>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Raw Payload Fields</p>
                        <div className="bg-[#00212b] border border-zinc-800 rounded-lg p-3 font-mono text-xs text-zinc-400 space-y-1.5 overflow-y-auto max-h-[140px]">
                          {(() => {
                            let payload = selectedPacket.data.substring(6, selectedPacket.data.length - 1);
                            if (payload.startsWith(',')) payload = payload.substring(1);
                            return payload.split(',').map((field, i) => (
                              <div key={i} className="flex gap-2">
                                 <span className="text-zinc-600">[{i}]</span>
                                 <span className="text-zinc-200">{field || '<empty>'}</span>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ALARM HISTORY & CLINICAL AUDIT TRAIL */}
        {activeTab === 'Alarms' && (() => {
          const filteredAlarms = alarms.filter(a => {
            if (alarmFilterStatus === 'ACTIVE' && a.status === 'RESOLVED') return false;
            if (alarmFilterStatus === 'RESOLVED' && a.status !== 'RESOLVED') return false;
            if (alarmSearchTerm) {
              const term = alarmSearchTerm.toLowerCase();
              return (
                a.seniorRefId.toLowerCase().includes(term) ||
                a.vitalType.toLowerCase().includes(term) ||
                a.currentValue.toLowerCase().includes(term) ||
                a.thresholdRule.toLowerCase().includes(term)
              );
            }
            return true;
          });

          return (
            <div className="flex flex-col gap-4">
              {/* Header & Filter Controls */}
              <div className="bg-[#073642] border border-zinc-800 rounded-xl p-4 flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-500" /> Clinical Alert & Alarm Audit Trail
                  </h2>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Immutable chronological record of vital breaches, panic activations, and operator interventions
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <input 
                      type="text"
                      placeholder="Search alarms or rules..."
                      value={alarmSearchTerm}
                      onChange={(e) => setAlarmSearchTerm(e.target.value)}
                      className="bg-zinc-950 border border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500 font-mono w-48"
                    />
                  </div>

                  {/* Status Filter Toggle */}
                  <div className="flex rounded-lg border border-zinc-700 overflow-hidden bg-zinc-950 text-xs">
                    <button 
                      onClick={() => setAlarmFilterStatus('ALL')}
                      className={`px-3 py-1.5 font-bold transition-colors ${alarmFilterStatus === 'ALL' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}
                    >
                      All ({alarms.length})
                    </button>
                    <button 
                      onClick={() => setAlarmFilterStatus('ACTIVE')}
                      className={`px-3 py-1.5 font-bold border-l border-zinc-700 transition-colors ${alarmFilterStatus === 'ACTIVE' ? 'bg-zinc-700 text-rose-400' : 'text-zinc-400 hover:bg-zinc-800'}`}
                    >
                      Active ({activeCriticalAlarms.length})
                    </button>
                    <button 
                      onClick={() => setAlarmFilterStatus('RESOLVED')}
                      className={`px-3 py-1.5 font-bold border-l border-zinc-700 transition-colors ${alarmFilterStatus === 'RESOLVED' ? 'bg-zinc-700 text-emerald-400' : 'text-zinc-400 hover:bg-zinc-800'}`}
                    >
                      Resolved ({alarms.filter(a => a.status === 'RESOLVED').length})
                    </button>
                  </div>
                </div>
              </div>

              {/* ALARMS TABLE IN MEDIUM SCROLLABLE FRAME (H-[480PX]) */}
              <div className="bg-[#073642] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[480px]">
                <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 select-text">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800 text-zinc-400 font-mono text-[10px] uppercase z-10 shadow-sm">
                      <tr>
                        <th className="p-3.5 bg-zinc-900">Timestamp</th>
                        <th className="p-3.5 bg-zinc-900">Senior Ref ID</th>
                        <th className="p-3.5 bg-zinc-900">Severity</th>
                        <th className="p-3.5 bg-zinc-900">Indicator / Vital</th>
                        <th className="p-3.5 bg-zinc-900">Breached Value</th>
                        <th className="p-3.5 bg-zinc-900">Safety Rule</th>
                        <th className="p-3.5 bg-zinc-900">Status</th>
                        <th className="p-3.5 bg-zinc-900">Audit Trail</th>
                        <th className="p-3.5 bg-zinc-900 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-mono">
                      {filteredAlarms.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-16 text-center text-zinc-600 text-xs italic">
                            <CheckCircle className="w-8 h-8 text-emerald-500/40 mx-auto mb-2" />
                            {alarms.length === 0 
                              ? "No threshold breaches or alarms recorded yet. Vitals are strictly within personalized clinical targets."
                              : "No alarms match the current search or status filter."
                            }
                          </td>
                        </tr>
                      ) : (
                        filteredAlarms.map((alarm) => (
                          <tr key={alarm.id} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="p-3.5 text-zinc-400 whitespace-nowrap">
                              {format(new Date(alarm.timestamp), "yyyy-MM-dd HH:mm:ss")}
                            </td>
                            <td className="p-3.5 font-bold text-blue-400 whitespace-nowrap">
                              {alarm.seniorRefId}
                            </td>
                            <td className="p-3.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${alarm.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                                {alarm.severity}
                              </span>
                            </td>
                            <td className="p-3.5 text-zinc-200 font-sans font-bold">
                              {alarm.vitalType}
                            </td>
                            <td className="p-3.5 text-amber-300 font-bold">
                              {alarm.currentValue}
                            </td>
                            <td className="p-3.5 text-zinc-400 font-sans max-w-xs truncate">
                              {alarm.thresholdRule}
                            </td>
                            <td className="p-3.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${alarm.status === 'ACTIVE' ? 'bg-red-500/20 text-red-400 animate-pulse' : alarm.status === 'ACKNOWLEDGED' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                {alarm.status}
                              </span>
                            </td>
                            <td className="p-3.5 text-zinc-400">
                              <button 
                                onClick={() => setSelectedAlarmForAudit(alarm)}
                                className="text-blue-400 hover:text-blue-300 underline font-sans text-xs flex items-center gap-1"
                              >
                                <Clock className="w-3.5 h-3.5" /> {alarm.actionsTaken.length} event(s)
                              </button>
                            </td>
                            <td className="p-3.5 text-right whitespace-nowrap">
                              <div className="flex justify-end gap-2">
                                {alarm.status !== 'RESOLVED' && (
                                  <button 
                                    onClick={() => setSelectedAlarmForAudit(alarm)}
                                    className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-300 rounded font-sans text-xs font-bold transition-colors"
                                  >
                                    Resolve
                                  </button>
                                )}
                                <button 
                                  onClick={() => sendWatchAlertMessage(alarm.imei, "ALERT: Checking in from assistance center.", alarm.id)}
                                  className="px-2.5 py-1 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-300 rounded font-sans text-xs font-bold transition-colors"
                                  title="Send watch text"
                                >
                                  Ping Watch
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* TAB 3: COMMAND CENTER */}
        {activeTab === 'Commands' && (
          <div className="flex gap-6">
            {/* Command Buttons */}
            <div className="flex-1 bg-[#073642] border border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
              <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-500" /> Smartwatch Protocol Commands (BP &rarr; Watch)
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => activeDevice && requestHRUpdate(activeDevice.imei)} disabled={!isConnected} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 flex justify-between items-center disabled:opacity-50">
                  <div className="text-left"><p className="text-xs font-bold text-zinc-200">Start {t.cardHeartRate}</p><p className="text-[10px] text-zinc-500">Trigger optical sensor</p></div>
                  <span className="font-mono text-xs text-blue-400 font-bold">IWBPXL#</span>
                </button>
                <button onClick={() => activeDevice && locateGPS(activeDevice.imei)} disabled={!isConnected} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 flex justify-between items-center disabled:opacity-50">
                  <div className="text-left"><p className="text-xs font-bold text-zinc-200">Request GPS Position</p><p className="text-[10px] text-zinc-500">Poll live coordinates</p></div>
                  <span className="font-mono text-xs text-blue-400 font-bold">IWBP16#</span>
                </button>
                <button onClick={() => activeDevice && sendCommand(activeDevice.imei, `IWBP03#`)} disabled={!isConnected} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 flex justify-between items-center disabled:opacity-50">
                  <div className="text-left"><p className="text-xs font-bold text-zinc-200">Heartbeat ACK</p><p className="text-[10px] text-zinc-500">Keep-alive confirmation</p></div>
                  <span className="font-mono text-xs text-blue-400 font-bold">IWBP03#</span>
                </button>
                <button onClick={() => activeDevice && sendCommand(activeDevice.imei, `IWBP10#`)} disabled={!isConnected} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 flex justify-between items-center disabled:opacity-50">
                  <div className="text-left"><p className="text-xs font-bold text-zinc-200">Acknowledge SOS</p><p className="text-[10px] text-zinc-500">Silence watch siren</p></div>
                  <span className="font-mono text-xs text-blue-400 font-bold">IWBP10#</span>
                </button>
              </div>
            </div>

            {/* BP40 Text Messaging */}
            <div className="flex-1 bg-[#073642] border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2 mb-3">
                  <Send className="w-4 h-4 text-cyan-500" /> Send Warning / Notice to Watch (BP40 Unicode)
                </h2>
                <p className="text-xs text-zinc-500 mb-3">Transmits direct text notification to the senior screen:</p>
                <div className="flex gap-2 mb-3">
                  <input id="bp40-quick-input" type="text" defaultValue="ALERT: High heart rate detected. Please rest." className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500" />
                  <button onClick={() => {
                    const el = document.getElementById("bp40-quick-input") as HTMLInputElement;
                    sendWatchAlertMessage(currentImei, el.value || "Please check in with assistance center.");
                  }} className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold">
                    Transmit
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: LOCATION */}
        {activeTab === 'Location' && (
          <div className="flex-1 bg-[#073642] border border-zinc-800 rounded-xl p-8 flex flex-col items-center justify-center text-zinc-500 min-h-[400px]">
            <MapPin className="w-12 h-12 mb-4 opacity-50 text-blue-500" />
            <h2 className="text-lg font-bold text-zinc-300 mb-2">GPS & LBS Geofence Surveillance</h2>
            <p className="text-xs">Location coordinates: Lat: 22.549676° N, Lng: 114.082258° E (Fixed Cell Beacon)</p>
          </div>
        )}

      </div>

      {/* MODAL 1: SAFETY THRESHOLDS & CADENCE CONFIGURATION */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#073642] border border-zinc-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-100">Personalized Safety Thresholds</h3>
                  <p className="text-xs text-zinc-500">
                    CNDP Mapping: <strong className="text-blue-400">{currentBinding.seniorRefId}</strong> (IMEI: {currentBinding.imei})
                  </p>
                </div>
              </div>
              <button onClick={() => setIsConfigModalOpen(false)} className="text-zinc-500 hover:text-zinc-300 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const updated: SeniorDeviceBinding = {
                ...currentBinding,
                telemetryFrequencySeconds: parseInt((form.elements.namedItem('cadence') as HTMLInputElement).value) || 15,
                clinicalRiskNotes: (form.elements.namedItem('riskCategory') as HTMLInputElement).value,
                safetyThresholds: {
                  hrMin: parseInt((form.elements.namedItem('hrMin') as HTMLInputElement).value) || 50,
                  hrMax: parseInt((form.elements.namedItem('hrMax') as HTMLInputElement).value) || 110,
                  bpSysMax: parseInt((form.elements.namedItem('bpSysMax') as HTMLInputElement).value) || 140,
                  bpDiaMax: parseInt((form.elements.namedItem('bpDiaMax') as HTMLInputElement).value) || 90,
                  spo2Min: parseInt((form.elements.namedItem('spo2Min') as HTMLInputElement).value) || 92,
                  tempMin: parseFloat((form.elements.namedItem('tempMin') as HTMLInputElement).value) || 35.5,
                  tempMax: parseFloat((form.elements.namedItem('tempMax') as HTMLInputElement).value) || 37.8,
                }
              };
              updateBindingThresholds(updated);
            }} className="mt-4 space-y-4 text-xs">
              
              {/* Presets */}
              <div>
                <label className="font-bold text-zinc-400 uppercase text-[10px] block mb-1.5">Apply Clinical Protocol Preset:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => {
                    const f = document.querySelector('form') as HTMLFormElement;
                    if (f) {
                      (f.elements.namedItem('hrMin') as HTMLInputElement).value = '55';
                      (f.elements.namedItem('hrMax') as HTMLInputElement).value = '105';
                      (f.elements.namedItem('bpSysMax') as HTMLInputElement).value = '140';
                      (f.elements.namedItem('bpDiaMax') as HTMLInputElement).value = '90';
                      (f.elements.namedItem('spo2Min') as HTMLInputElement).value = '93';
                      (f.elements.namedItem('riskCategory') as HTMLInputElement).value = 'General Geriatric Baseline';
                    }
                  }} className="p-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg text-left text-zinc-300">
                    <p className="font-bold text-blue-400 text-[11px]">General Baseline</p>
                    <p className="text-[9px] text-zinc-500">HR 55-105 | SpO2 &gt;93%</p>
                  </button>
                  <button type="button" onClick={() => {
                    const f = document.querySelector('form') as HTMLFormElement;
                    if (f) {
                      (f.elements.namedItem('hrMin') as HTMLInputElement).value = '50';
                      (f.elements.namedItem('hrMax') as HTMLInputElement).value = '110';
                      (f.elements.namedItem('bpSysMax') as HTMLInputElement).value = '135';
                      (f.elements.namedItem('bpDiaMax') as HTMLInputElement).value = '85';
                      (f.elements.namedItem('spo2Min') as HTMLInputElement).value = '92';
                      (f.elements.namedItem('riskCategory') as HTMLInputElement).value = 'Cardiovascular / Hypertension Focus';
                    }
                  }} className="p-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg text-left text-zinc-300">
                    <p className="font-bold text-rose-400 text-[11px]">Cardio / HTN</p>
                    <p className="text-[9px] text-zinc-500">BP &lt;135/85 | HR 50-110</p>
                  </button>
                  <button type="button" onClick={() => {
                    const f = document.querySelector('form') as HTMLFormElement;
                    if (f) {
                      (f.elements.namedItem('hrMin') as HTMLInputElement).value = '55';
                      (f.elements.namedItem('hrMax') as HTMLInputElement).value = '115';
                      (f.elements.namedItem('spo2Min') as HTMLInputElement).value = '89';
                      (f.elements.namedItem('riskCategory') as HTMLInputElement).value = 'Respiratory / COPD Monitoring';
                    }
                  }} className="p-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg text-left text-zinc-300">
                    <p className="font-bold text-cyan-400 text-[11px]">COPD / Respiratory</p>
                    <p className="text-[9px] text-zinc-500">SpO2 &gt;89% (COPD tier)</p>
                  </button>
                </div>
              </div>

              {/* Threshold Fields */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">{t.cardHeartRate} Minimum (bpm)</label>
                  <input name="hrMin" type="number" defaultValue={thresholds.hrMin} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200" />
                </div>
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">{t.cardHeartRate} Maximum (bpm)</label>
                  <input name="hrMax" type="number" defaultValue={thresholds.hrMax} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200" />
                </div>
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">Systolic BP Max (mmHg)</label>
                  <input name="bpSysMax" type="number" defaultValue={thresholds.bpSysMax} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200" />
                </div>
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">Diastolic BP Max (mmHg)</label>
                  <input name="bpDiaMax" type="number" defaultValue={thresholds.bpDiaMax} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200" />
                </div>
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">SpO2 Minimum (%)</label>
                  <input name="spo2Min" type="number" defaultValue={thresholds.spo2Min} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200" />
                </div>
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">Telemetry Cadence (Seconds)</label>
                  <input name="cadence" type="number" defaultValue={currentBinding.telemetryFrequencySeconds} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200" />
                </div>
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">{t.cardBodyTemp} Min (°C)</label>
                  <input name="tempMin" type="number" step="0.1" defaultValue={thresholds.tempMin} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200" />
                </div>
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">{t.cardBodyTemp} Max (°C)</label>
                  <input name="tempMax" type="number" step="0.1" defaultValue={thresholds.tempMax} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200" />
                </div>
              </div>

              <div>
                <label className="text-zinc-400 font-bold block mb-1">Clinical Protocol Category Tag</label>
                <input name="riskCategory" type="text" defaultValue={currentBinding.clinicalRiskNotes || 'Cardio Protocol'} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200" />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <button type="button" onClick={() => setIsConfigModalOpen(false)} className="px-4 py-2 bg-zinc-900 text-zinc-400 hover:text-zinc-200 rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow">
                  Save Thresholds & Cadence
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ALARM AUDIT TRAIL & INCIDENT RESOLUTION */}
      {selectedAlarmForAudit && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#073642] border border-zinc-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-4 border-b border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" /> Alert Incident Audit Log
                </h3>
                <p className="text-xs text-zinc-500">Alarm ID: <span className="font-mono text-zinc-300">{selectedAlarmForAudit.id}</span></p>
              </div>
              <button onClick={() => setSelectedAlarmForAudit(null)} className="text-zinc-500 hover:text-zinc-300 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 space-y-3">
              <div className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800 text-xs flex justify-between items-center">
                <div>
                  <p className="text-zinc-500 text-[10px] uppercase font-bold">Breached Metric</p>
                  <p className="text-sm font-bold text-amber-300">{selectedAlarmForAudit.vitalType}: {selectedAlarmForAudit.currentValue}</p>
                </div>
                <span className={`px-2.5 py-1 rounded text-xs font-bold ${selectedAlarmForAudit.status === 'ACTIVE' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                  {selectedAlarmForAudit.status}
                </span>
              </div>

              <div>
                <p className="text-[10px] uppercase font-bold text-zinc-500 mb-2">Intervention Audit Trail:</p>
                <div className="bg-black/60 border border-zinc-800 rounded-xl p-3 space-y-2.5 max-h-48 overflow-y-auto font-mono text-xs">
                  {selectedAlarmForAudit.actionsTaken.map((action, i) => (
                    <div key={i} className="border-b border-zinc-900 pb-2 last:border-none last:pb-0">
                      <div className="flex justify-between text-[10px] text-zinc-500 mb-0.5">
                        <span className="text-blue-400 font-bold">{action.operator}</span>
                        <span>{format(new Date(action.timestamp), "HH:mm:ss")}</span>
                      </div>
                      <p className="text-zinc-200">{action.action}</p>
                      {action.notes && <p className="text-[10px] text-zinc-500 break-all mt-0.5">{action.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {selectedAlarmForAudit.status !== 'RESOLVED' && (
                <div className="pt-2">
                  <label className="text-zinc-400 text-xs font-bold block mb-1">Add Clinical Resolution Notes:</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Senior took prescribed medication, vitals re-stabilized."
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800 text-xs">
              <button onClick={() => setSelectedAlarmForAudit(null)} className="px-4 py-2 bg-zinc-900 text-zinc-400 rounded-lg">
                Close
              </button>
              {selectedAlarmForAudit.status !== 'RESOLVED' && (
                <button 
                  onClick={() => resolveAlarm(selectedAlarmForAudit.id, resolutionNote || "Vitals stabilized by clinical care team")}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-1.5 shadow"
                >
                  <CheckCircle className="w-4 h-4" /> Resolve Incident & Archive
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ENTERPRISE FLEET MATRIX & DIRECTORY MODAL */}
      {isFleetDrawerOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#073642] border border-[#0e4c5b] rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-[#0e4c5b] bg-[#052831] flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold text-zinc-100">{t.fleetDrawerTitle}</h2>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 font-semibold">
                      {totalFleetCount} Registered Residents
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 font-semibold">
                      {onlineFleetCount} Live Connected
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Real-time clinical monitoring, smartwatch allocation, and protocol management
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* View Mode Switcher: Grid vs Table */}
                <div className="bg-[#00212b] p-0.5 rounded-lg border border-[#0e4c5b] flex items-center text-xs">
                  <button
                    onClick={() => setFleetViewMode('GRID')}
                    className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors ${
                      fleetViewMode === 'GRID' ? 'bg-[#073642] text-cyan-300 font-bold shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Card Grid</span>
                  </button>
                  <button
                    onClick={() => setFleetViewMode('TABLE')}
                    className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors ${
                      fleetViewMode === 'TABLE' ? 'bg-[#073642] text-cyan-300 font-bold shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>Data Table</span>
                  </button>
                </div>

                <button
                  onClick={() => setIsFleetDrawerOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter and Search Sub-bar */}
            <div className="p-3.5 px-5 bg-[#00212b] border-b border-[#0e4c5b] flex justify-between items-center flex-wrap gap-3 shrink-0">
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Filter by resident name, room, ref ID, or IMEI..."
                  value={fleetSearchTerm}
                  onChange={(e) => setFleetSearchTerm(e.target.value)}
                  className="w-full bg-[#052831] border border-[#0e4c5b] rounded-lg pl-8 pr-7 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
                {fleetSearchTerm && (
                  <button onClick={() => setFleetSearchTerm("")} className="absolute right-2.5 top-2 text-zinc-400 hover:text-white text-xs font-bold">
                    &times;
                  </button>
                )}
              </div>

              {/* Protocol Filters */}
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  onClick={() => setFleetCategoryFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${fleetCategoryFilter === 'ALL' ? 'bg-blue-600 text-white font-bold' : 'bg-[#073642] text-zinc-300 hover:bg-[#0e4c5b]'}`}
                >
                  {t.allFilter} ({totalFleetCount})
                </button>
                <button
                  onClick={() => setFleetCategoryFilter('ONLINE')}
                  className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5 ${fleetCategoryFilter === 'ONLINE' ? 'bg-emerald-600 text-white font-bold' : 'bg-[#073642] text-emerald-400 hover:bg-[#0e4c5b]'}`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Online ({onlineFleetCount})</span>
                </button>
                {alertingFleetCount > 0 && (
                  <button
                    onClick={() => setFleetCategoryFilter('ALERTING')}
                    className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5 ${fleetCategoryFilter === 'ALERTING' ? 'bg-rose-600 text-white font-bold' : 'bg-[#073642] text-rose-400 hover:bg-[#0e4c5b]'}`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>In Alert ({alertingFleetCount})</span>
                  </button>
                )}
                <button
                  onClick={() => setFleetCategoryFilter('CARDIO')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${fleetCategoryFilter === 'CARDIO' ? 'bg-rose-900 text-rose-200 font-bold border border-rose-600' : 'bg-[#073642] text-zinc-300 hover:bg-[#0e4c5b]'}`}
                >
                  ❤️ Cardio
                </button>
                <button
                  onClick={() => setFleetCategoryFilter('RESPIRATORY')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${fleetCategoryFilter === 'RESPIRATORY' ? 'bg-cyan-900 text-cyan-200 font-bold border border-cyan-600' : 'bg-[#073642] text-zinc-300 hover:bg-[#0e4c5b]'}`}
                >
                  🫁 Respiratory
                </button>
                <button
                  onClick={() => setFleetCategoryFilter('GENERAL')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${fleetCategoryFilter === 'GENERAL' ? 'bg-emerald-900 text-emerald-200 font-bold border border-emerald-600' : 'bg-[#073642] text-zinc-300 hover:bg-[#0e4c5b]'}`}
                >
                  🏥 General Care
                </button>
              </div>
            </div>

            {/* Modal Body: Card Grid or Data Table */}
            <div className="flex-1 overflow-y-auto p-5 min-h-0 bg-[#002b36]">
              {filteredFleet.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-zinc-500 text-sm">
                  <Users className="w-12 h-12 opacity-30 mb-2" />
                  <p className="font-semibold">No seniors found</p>
                  <p className="text-xs text-zinc-600 mt-1">Try adjusting your search criteria or category filter.</p>
                </div>
              ) : fleetViewMode === 'GRID' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredFleet.map((snr) => {
                    const dev = devices.find(d => d.imei === snr.imei);
                    const isSelected = currentImei === snr.imei;
                    const isDevOnline = !!dev;
                    const activeAlarm = alarms.find(a => (a.imei === snr.imei || a.seniorRefId === snr.seniorRefId) && a.status === 'ACTIVE');

                    return (
                      <div
                        key={snr.imei}
                        className={`rounded-xl border p-4 transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[#073642] border-cyan-400 shadow-lg ring-1 ring-cyan-400/50'
                            : activeAlarm
                            ? 'bg-rose-950/30 border-rose-600/70 hover:border-rose-500 shadow-md'
                            : 'bg-[#073642]/60 hover:bg-[#073642] border-[#0e4c5b]'
                        }`}
                      >
                        <div>
                          {/* Top: Identity & Status */}
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{snr.icon}</span>
                              <div>
                                <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-1.5">
                                  {snr.displayAlias}
                                  {isSelected && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.2 bg-cyan-900/60 text-cyan-300 border border-cyan-700/60 rounded font-bold">
                                      ACTIVE
                                    </span>
                                  )}
                                </h3>
                                <p className="text-[10px] font-mono text-zinc-400">{snr.seniorRefId}</p>
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                              isDevOnline
                                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                                : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isDevOnline ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
                              {isDevOnline ? 'ONLINE' : '{t.standbyBadge}'}
                            </span>
                          </div>

                          {/* Room & Physician */}
                          <div className="space-y-1 my-2.5 text-xs text-zinc-300 bg-[#00212b] p-2 rounded-lg border border-[#0e4c5b]">
                            <div className="flex justify-between">
                              <span className="text-zinc-500 text-[10px]">Care Station:</span>
                              <span className="font-semibold text-zinc-200 text-[11px]">{snr.careStation}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500 text-[10px]">Attending:</span>
                              <span className="text-[10px] text-zinc-300">{snr.primaryPhysician.split(',')[0]}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500 text-[10px]">Assigned Watch:</span>
                              <span className="font-mono text-[10px] text-cyan-300">{snr.imei}</span>
                            </div>
                          </div>

                          {/* Clinical Risk Summary */}
                          <div className="mb-3">
                            <span className="text-[10px] font-bold text-zinc-400 block mb-1 uppercase tracking-wider">
                              Risk Classification:
                            </span>
                            <span className="text-xs font-semibold text-cyan-200">
                              {snr.clinicalRiskGroup}
                            </span>
                          </div>

                          {/* Live Vitals Preview (if online) */}
                          {dev && (
                            <div className="grid grid-cols-4 gap-1.5 mb-3 text-center">
                              <div className="bg-[#00212b] p-1.5 rounded border border-[#0e4c5b]">
                                <span className="text-[9px] text-zinc-500 block">HR</span>
                                <span className="text-xs font-bold font-mono text-emerald-400">{dev.hr || '--'}</span>
                              </div>
                              <div className="bg-[#00212b] p-1.5 rounded border border-[#0e4c5b]">
                                <span className="text-[9px] text-zinc-500 block">BP</span>
                                <span className="text-xs font-bold font-mono text-amber-400">{dev.bp_sys ? `${dev.bp_sys}/${dev.bp_dia}` : '--'}</span>
                              </div>
                              <div className="bg-[#00212b] p-1.5 rounded border border-[#0e4c5b]">
                                <span className="text-[9px] text-zinc-500 block">SpO2</span>
                                <span className="text-xs font-bold font-mono text-cyan-400">{dev.spo2 ? `${dev.spo2}%` : '--'}</span>
                              </div>
                              <div className="bg-[#00212b] p-1.5 rounded border border-[#0e4c5b]">
                                <span className="text-[9px] text-zinc-500 block">Temp</span>
                                <span className="text-xs font-bold font-mono text-zinc-300">{dev.temp ? `${dev.temp}°` : '--'}</span>
                              </div>
                            </div>
                          )}

                          {activeAlarm && (
                            <div className="p-2 mb-3 rounded-lg bg-rose-900/40 border border-rose-600/60 text-rose-200 text-xs flex items-center justify-between animate-pulse">
                              <span className="font-bold flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                                {activeAlarm.severity} {activeAlarm.vitalType} Alert
                              </span>
                              <span className="font-mono text-[10px] font-bold bg-black/40 px-1.5 py-0.5 rounded">{activeAlarm.currentValue}</span>
                            </div>
                          )}
                        </div>

                        {/* Focus / Select Action */}
                        <button
                          onClick={() => {
                            setSelectedImei(snr.imei);
                            setIsFleetDrawerOpen(false);
                            setActionSuccessToast(`Active monitoring focused on ${snr.displayAlias}`);
                          }}
                          className={`w-full py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            isSelected
                              ? 'bg-cyan-600 text-white hover:bg-cyan-500 shadow'
                              : 'bg-[#00212b] hover:bg-[#0e4c5b] text-cyan-300 border border-[#0e4c5b]'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isSelected ? '{t.btnCurrentlyMonitored}' : '{t.btnSelectPatient}'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Data Table View */
                <div className="overflow-x-auto rounded-xl border border-[#0e4c5b] bg-[#073642]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#052831] border-b border-[#0e4c5b] text-zinc-400 font-bold uppercase text-[10px]">
                        <th className="p-3">Status</th>
                        <th className="p-3">Resident Alias</th>
                        <th className="p-3">CNDP Ref ID</th>
                        <th className="p-3">Care Station</th>
                        <th className="p-3">Clinical Risk Category</th>
                        <th className="p-3">Watch IMEI</th>
                        <th className="p-3">Live Telemetry</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#0e4c5b]">
                      {filteredFleet.map((snr) => {
                        const dev = devices.find(d => d.imei === snr.imei);
                        const isSelected = currentImei === snr.imei;
                        const isDevOnline = !!dev;
                        const activeAlarm = alarms.find(a => (a.imei === snr.imei || a.seniorRefId === snr.seniorRefId) && a.status === 'ACTIVE');

                        return (
                          <tr
                            key={snr.imei}
                            className={`hover:bg-[#052831]/60 transition-colors ${isSelected ? 'bg-[#00212b]/60' : ''}`}
                          >
                            <td className="p-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                isDevOnline ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isDevOnline ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
                                {isDevOnline ? 'ONLINE' : '{t.standbyBadge}'}
                              </span>
                            </td>
                            <td className="p-3 font-bold text-zinc-100 flex items-center gap-2">
                              <span>{snr.icon}</span>
                              <span>{snr.displayAlias}</span>
                            </td>
                            <td className="p-3 font-mono text-zinc-400 text-[11px]">{snr.seniorRefId}</td>
                            <td className="p-3 text-zinc-300">{snr.careStation}</td>
                            <td className="p-3">
                              <span className="text-[11px] text-cyan-300 font-semibold">{snr.clinicalRiskGroup}</span>
                            </td>
                            <td className="p-3 font-mono text-zinc-400 text-[10px]">{snr.imei}</td>
                            <td className="p-3 font-mono">
                              {activeAlarm ? (
                                <span className="text-rose-400 font-bold animate-pulse">{activeAlarm.vitalType} ALERT ({activeAlarm.currentValue})</span>
                              ) : dev ? (
                                <span className="text-emerald-400">{dev.hr ? `${dev.hr} bpm` : ''} {dev.spo2 ? `| ${dev.spo2}%` : ''}</span>
                              ) : (
                                <span className="text-zinc-600">--</span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => {
                                  setSelectedImei(snr.imei);
                                  setIsFleetDrawerOpen(false);
                                  setActionSuccessToast(`Focused on ${snr.displayAlias}`);
                                }}
                                className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors ${
                                  isSelected ? 'bg-cyan-600 text-white' : 'bg-[#00212b] hover:bg-[#0e4c5b] text-cyan-300 border border-[#0e4c5b]'
                                }`}
                              >
                                {isSelected ? 'Monitored' : 'Select'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 px-6 bg-[#052831] border-t border-[#0e4c5b] flex justify-between items-center text-xs text-zinc-400">
              <span className="font-mono text-[11px]">
                Displaying {filteredFleet.length} of {totalFleetCount} registered smartwatches across fleet
              </span>
              <button
                onClick={() => setIsFleetDrawerOpen(false)}
                className="px-4 py-1.5 bg-[#00212b] hover:bg-[#073642] text-zinc-300 rounded-lg font-semibold transition-colors border border-[#0e4c5b]"
              >
                Close Directory
              </button>
            </div>

          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="bg-black border-t border-zinc-900 p-2 flex justify-between items-center px-6 text-[9px] text-zinc-600 font-mono">
        <p>GPS & Health Smartwatch Protocol V1.1 &bull; CNDP Compliant Real-time Telemetry Gateway</p>
        <p>Zero PII Stored &bull; Internal Port 5088 &bull; WS Port 3001</p>
      </footer>
    </div>
  );
}
