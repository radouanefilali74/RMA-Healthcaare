import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Heart, Activity, Thermometer, ShieldAlert, Send, Clock, LocateFixed, Signal, Battery, ActivitySquare, Mail, Layers, Bell, Trash2, CheckCircle2, RefreshCw } from "lucide-react";
import "./App.css";

interface WatchMessage {
  id: number;
  sender: string;
  text: string;
  time: string;
  unread: boolean;
}

interface SeniorPreset {
  id: 'senior1' | 'senior2';
  name: string;
  seniorRefId: string;
  imei: string;
  category: 'CARDIO' | 'RESPIRATORY';
  label: string;
  description: string;
  baseline: {
    hr: number;
    sys: number;
    dia: number;
    spo2: number;
    temp: number;
    steps: number;
  };
}

const SENIOR_PRESETS: Record<'senior1' | 'senior2', SeniorPreset> = {
  senior1: {
    id: 'senior1',
    name: 'Eleanor V. (Demo)',
    seniorRefId: 'SNR-84920-X',
    imei: '353456789012345',
    category: 'CARDIO',
    label: 'Senior 1: Eleanor V. (Cardio)',
    description: 'Hypertension & Arrhythmia Protocol Tier 2',
    baseline: { hr: 72, sys: 120, dia: 80, spo2: 98, temp: 36.6, steps: 5555 },
  },
  senior2: {
    id: 'senior2',
    name: 'Arthur M. (Demo)',
    seniorRefId: 'SNR-92104-Y',
    imei: '867530901234567',
    category: 'RESPIRATORY',
    label: 'Senior 2: Arthur M. (Respiratory)',
    description: 'Severe COPD & Hypoxemia Risk Protocol Tier 1',
    baseline: { hr: 78, sys: 128, dia: 82, spo2: 94, temp: 36.5, steps: 3240 },
  },
};

function decodeUnicodeHex(hex: string): string {
  let result = '';
  const cleanHex = hex.replace(/#/g, '').trim();
  if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
    return cleanHex;
  }
  for (let i = 0; i + 4 <= cleanHex.length; i += 4) {
    const code = parseInt(cleanHex.substring(i, i + 4), 16);
    if (!isNaN(code) && code > 0) {
      result += String.fromCharCode(code);
    }
  }
  return result || cleanHex;
}

function playWatchBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1050, ctx.currentTime);
    osc.frequency.setValueAtTime(1450, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {}
}

function App() {
  // Check URL query parameters or window context for preset initialization
  const getInitialPresetKey = (): 'senior1' | 'senior2' => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('profile') === 'senior2' || params.get('imei') === '867530901234567') {
        return 'senior2';
      }
    }
    return 'senior1';
  };

  const initialKey = getInitialPresetKey();
  const [selectedPreset, setSelectedPreset] = useState<'senior1' | 'senior2' | 'custom'>(initialKey);
  const [imei, setImei] = useState(SENIOR_PRESETS[initialKey].imei);
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<{ dir: "TX" | "RX"; data: string }[]>([]);
  
  // Health Data
  const [hr, setHr] = useState(SENIOR_PRESETS[initialKey].baseline.hr);
  const [sys, setSys] = useState(SENIOR_PRESETS[initialKey].baseline.sys);
  const [dia, setDia] = useState(SENIOR_PRESETS[initialKey].baseline.dia);
  const [spo2, setSpo2] = useState(SENIOR_PRESETS[initialKey].baseline.spo2);
  const [temp, setTemp] = useState(SENIOR_PRESETS[initialKey].baseline.temp);
  const [steps, setSteps] = useState(SENIOR_PRESETS[initialKey].baseline.steps);

  const [time, setTime] = useState(new Date().toLocaleTimeString('en-US', { hour12: false }));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [inboxMessages, setInboxMessages] = useState<WatchMessage[]>([
    {
      id: 1,
      sender: "Assistance Center",
      text: "System initialized. Emergency & vitals monitoring active.",
      time: "09:00:00",
      unread: false,
    }
  ]);
  const [incomingAlert, setIncomingAlert] = useState<{ text: string; time: string } | null>(null);
  const [isMeasuringHR, setIsMeasuringHR] = useState(false);
  const [profileReady, setProfileReady] = useState(false);

  // Health Stream Cadence & Safety Thresholds (Configurable Remotely via Protocol Downlink)
  const [autoHeartbeat, setAutoHeartbeat] = useState(true);
  const [autoHealth, setAutoHealth] = useState(true);
  const [healthCadenceSec, setHealthCadenceSec] = useState(15);
  const [safetyThresholds, setSafetyThresholds] = useState({
    hrMin: 50,
    hrMax: 110,
    bpSysMax: 140,
    bpDiaMax: 90,
    spo2Min: 92,
    tempMin: 35.5,
    tempMax: 37.8,
  });
  const [configSyncToast, setConfigSyncToast] = useState<string | null>(null);
  const [lastConfigSyncTime, setLastConfigSyncTime] = useState<string | null>(null);

  // Auto-connect and auto-reconnect when disconnected (gated on profile initialization)
  useEffect(() => {
    let reconnectTimer: number;
    if (!connected && profileReady) {
      const tryConnect = () => {
        invoke("connect_tcp", { ip: "127.0.0.1", port: 5088 })
          .then(() => {
            setConnected(true);
            setLogs((prev) => [...prev, { dir: "TX", data: `[SYSTEM] Connected to TCP (IMEI: ${imei})` }]);
            sendPacket(`IWAP00${imei}#`);
          })
          .catch((err) => {
            console.log("TCP connect attempt deferred:", err);
          });
      };
      tryConnect();
      reconnectTimer = window.setInterval(tryConnect, 3500);
    }
    return () => clearInterval(reconnectTimer);
  }, [connected, imei, profileReady]);

  useEffect(() => {
    const unlistenRx = listen<string>("tcp-rx", (event) => {
      const raw = event.payload;
      setLogs((prev) => [...prev, { dir: "RX", data: raw }]);

      // Check BP40 (Text message / Ping from Assistance Center)
      if (raw.includes("BP40")) {
        // Validate target IMEI if provided in protocol: IWBP40,imei,journal,hex#
        const match = raw.match(/(?:IW)?BP40,([^,]+),([^,]+),([^#]+)#?/);
        if (match && match[1]) {
          const targetImei = match[1].trim();
          if (targetImei && targetImei !== imei) {
            console.warn(`[WATCH ${imei}] Ignored BP40 packet targeted to ${targetImei}`);
            return;
          }
        }

        let decodedText = "Assistance Center Ping Alert";
        try {
          if (match && match[3]) {
            decodedText = decodeUnicodeHex(match[3]) || match[3];
          } else {
            const clean = raw.replace(/#/g, '').trim();
            const parts = clean.split(',');
            const candidate = parts[parts.length - 1];
            decodedText = decodeUnicodeHex(candidate) || "Assistance Center Ping Alert";
          }
        } catch (e) {
          decodedText = "Assistance Center Ping Alert";
        }
        
        playWatchBeep();
        setTimeout(() => playWatchBeep(), 180);

        const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false });
        setIncomingAlert({ text: decodedText, time: currentTime });
        setInboxMessages((prev) => [
          {
            id: Date.now(),
            sender: "Assistance Center",
            text: decodedText,
            time: currentTime,
            unread: true
          },
          ...prev
        ]);
        // Send ACK back to server
        invoke("send_tcp", { data: "IWAP40#" }).catch(() => {});
      }
      else if (raw.includes("BPXL")) {
        const match = raw.match(/(?:IW)?BPXL,([^,]+),/);
        if (match && match[1] && match[1].trim() !== imei) {
          return;
        }
        playWatchBeep();
        setIsMeasuringHR(true);
        invoke("send_tcp", { data: "IWAPXL,080835#" }).catch(() => {});
        setTimeout(() => {
          setIsMeasuringHR(false);
          invoke("send_tcp", { data: `IWAPHP,${hr},${sys},${dia},${spo2},90,${temp},,,,,,,#` }).catch(() => {});
        }, 2000);
      }
      else if (raw.includes("BP16")) {
        const match = raw.match(/(?:IW)?BP16,([^,]+),/);
        if (match && match[1] && match[1].trim() !== imei) {
          return;
        }
        invoke("send_tcp", { data: "IWAP16#" }).catch(() => {});
      }
      // Check BPCF (Full Configuration Downlink: IWBPCF,imei,journal,cadence,hrMin,hrMax,bpSysMax,bpDiaMax,spo2Min,tempMin,tempMax#)
      else if (raw.includes("BPCF")) {
        const clean = raw.replace(/#/g, '').trim();
        const parts = clean.split(',');
        if (parts.length >= 11) {
          const targetImei = parts[1].trim();
          if (targetImei && targetImei !== imei) {
            console.warn(`[WATCH ${imei}] Ignored BPCF packet targeted to ${targetImei}`);
            return;
          }
          const newCadence = parseInt(parts[3], 10);
          const hrMin = parseInt(parts[4], 10);
          const hrMax = parseInt(parts[5], 10);
          const bpSysMax = parseInt(parts[6], 10);
          const bpDiaMax = parseInt(parts[7], 10);
          const spo2Min = parseInt(parts[8], 10);
          const tempMin = parseFloat(parts[9]);
          const tempMax = parseFloat(parts[10]);

          if (!isNaN(newCadence) && newCadence > 0) {
            setHealthCadenceSec(newCadence);
          }
          setSafetyThresholds({
            hrMin: isNaN(hrMin) ? 50 : hrMin,
            hrMax: isNaN(hrMax) ? 110 : hrMax,
            bpSysMax: isNaN(bpSysMax) ? 140 : bpSysMax,
            bpDiaMax: isNaN(bpDiaMax) ? 90 : bpDiaMax,
            spo2Min: isNaN(spo2Min) ? 92 : spo2Min,
            tempMin: isNaN(tempMin) ? 35.5 : tempMin,
            tempMax: isNaN(tempMax) ? 37.8 : tempMax,
          });

          const syncTime = new Date().toLocaleTimeString('en-US', { hour12: false });
          setLastConfigSyncTime(syncTime);
          playWatchBeep();
          setConfigSyncToast(`Config Synced (${newCadence}s Telemetry Cadence | Safe HR: ${hrMin}-${hrMax} bpm)`);
          setTimeout(() => setConfigSyncToast(null), 6500);

          // Reply ACK: IWAPCF#
          invoke("send_tcp", { data: "IWAPCF#" }).catch(() => {});
          setLogs((prev) => [...prev, { dir: "TX", data: "IWAPCF#" }]);
        }
      }
      // Check BP05 (Cadence Only Downlink: IWBP05,imei,journal,cadence#)
      else if (raw.includes("BP05")) {
        const clean = raw.replace(/#/g, '').trim();
        const parts = clean.split(',');
        if (parts.length >= 4) {
          const targetImei = parts[1].trim();
          if (targetImei && targetImei !== imei) {
            return;
          }
          const newCadence = parseInt(parts[3], 10);
          if (!isNaN(newCadence) && newCadence > 0) {
            setHealthCadenceSec(newCadence);
            const syncTime = new Date().toLocaleTimeString('en-US', { hour12: false });
            setLastConfigSyncTime(syncTime);
            playWatchBeep();
            setConfigSyncToast(`Cadence Synced (${newCadence}s Telemetry Cadence)`);
            setTimeout(() => setConfigSyncToast(null), 6500);

            // Reply ACK: IWAP05#
            invoke("send_tcp", { data: "IWAP05#" }).catch(() => {});
            setLogs((prev) => [...prev, { dir: "TX", data: "IWAP05#" }]);
          }
        }
      }
    });

    const unlistenDisconnect = listen("tcp-disconnected", () => {
      setConnected(false);
      setLogs((prev) => [...prev, { dir: "RX", data: "[SYSTEM] Disconnected" }]);
    });
    const unlistenError = listen<string>("tcp-error", (event) => {
      setConnected(false);
      setLogs((prev) => [...prev, { dir: "RX", data: `[ERROR] ${event.payload}` }]);
    });

    return () => {
      unlistenRx.then((f) => f());
      unlistenDisconnect.then((f) => f());
      unlistenError.then((f) => f());
    };
  }, [hr, sys, dia, spo2, temp, imei]);

  useEffect(() => {
    let interval: number;
    if (autoHeartbeat && connected) {
      interval = window.setInterval(() => {
        sendHeartbeat();
      }, 20000);
    }
    return () => clearInterval(interval);
  }, [autoHeartbeat, connected]);

  useEffect(() => {
    let interval: number;
    if (autoHealth && connected) {
      interval = window.setInterval(() => {
        sendPacket(`IWAPHP,${hr},${sys},${dia},${spo2},90,${temp},,,,,,,#`);
      }, healthCadenceSec * 1000);
    }
    return () => clearInterval(interval);
  }, [autoHealth, connected, healthCadenceSec, hr, sys, dia, spo2, temp]);

  const selectSeniorPreset = (presetKey: 'senior1' | 'senior2') => {
    const preset = SENIOR_PRESETS[presetKey];
    setSelectedPreset(presetKey);
    setImei(preset.imei);
    setHr(preset.baseline.hr);
    setSys(preset.baseline.sys);
    setDia(preset.baseline.dia);
    setSpo2(preset.baseline.spo2);
    setTemp(preset.baseline.temp);
    setSteps(preset.baseline.steps);
    // If connected, re-login with new IMEI
    if (connected) {
      sendPacket(`IWAP00${preset.imei}#`);
    }
  };

  // Sync window title and document title with the dedicated profile
  useEffect(() => {
    const title = selectedPreset === 'senior2'
      ? 'Watch Simulator - Senior 2: Arthur M. (Respiratory Protocol)'
      : 'Watch Simulator - Senior 1: Eleanor V. (Cardio Protocol)';
    document.title = title;
    invoke("set_window_title", { title }).catch(() => {});
  }, [selectedPreset]);

  // On launch, detect if assigned profile is passed via CLI (--profile senior2) or ENV
  useEffect(() => {
    invoke<string>("get_profile")
      .then((profile) => {
        if (profile === 'senior2') {
          selectSeniorPreset('senior2');
        } else if (profile === 'senior1') {
          selectSeniorPreset('senior1');
        }
        setProfileReady(true);
      })
      .catch(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('profile') === 'senior2' || params.get('imei') === '867530901234567') {
          selectSeniorPreset('senior2');
        }
        setProfileReady(true);
      });
  }, []);

  const handleConnect = async () => {
    try {
      await invoke("connect_tcp", { ip: "127.0.0.1", port: 5088 });
      setConnected(true);
      setLogs((prev) => [...prev, { dir: "TX", data: "[SYSTEM] Connected" }]);
      // Send Login
      sendLogin();
    } catch (e) {
      alert(`Failed to connect: ${e}`);
    }
  };

  const sendPacket = async (data: string) => {
    try {
      await invoke("send_tcp", { data });
      setLogs((prev) => [...prev, { dir: "TX", data }]);
    } catch (e) {
      setLogs((prev) => [...prev, { dir: "TX", data: `[ERROR] ${e}` }]);
    }
  };

  const sendLogin = () => sendPacket(`IWAP00${imei}#`);
  const sendHeartbeat = () => sendPacket(`IWAP03,06000908000102,${steps},30#`);
  const sendHealth = () => sendPacket(`IWAPHP,${hr},${sys},${dia},${spo2},90,${temp},,,,,,,#`);
  const sendSOS = () => sendPacket(`IWAP10080524A2232.9806N11404.9355E000.1061830323.8706000908000102,460,0,9520,3671,01,zh-cn,00,HOME|74-DE-2B-44-88-8C|97#`);

  const [activeTab, setActiveTab] = useState<'Face' | 'Sensors' | 'Inbox' | 'Stream'>('Face');

  const unreadCount = inboxMessages.filter(m => m.unread).length;
  const isSenior2 = selectedPreset === 'senior2';

  return (
    <div className="min-h-screen bg-[#002b36] p-6 lg:p-8 flex items-center justify-center gap-8 lg:gap-12 font-sans text-zinc-100 selection:bg-cyan-500/30 overflow-y-auto">
      
      {/* LEFT: THE WATCH UI */}
      <div className="relative shrink-0">
        {/* Watch Band Top */}
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-48 h-12 bg-zinc-800 rounded-t-lg -z-10 shadow-inner">
           <div className="w-full h-full opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white to-transparent" />
        </div>
        
        {/* Watch Band Bottom */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-48 h-12 bg-zinc-800 rounded-b-lg -z-10 shadow-inner">
           <div className="w-full h-full opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white to-transparent" />
        </div>

        {/* Physical Buttons on Right Side */}
        <div className="absolute top-24 -right-2 w-3 h-16 bg-zinc-500 rounded-r-md border-r border-y border-zinc-400 shadow-sm z-0"></div>
        <div className="absolute top-48 -right-2 w-3 h-10 bg-red-600 rounded-r-md border-r border-y border-red-500 shadow-sm z-0 cursor-pointer hover:bg-red-500 active:bg-red-700 transition" onClick={() => { if(connected) sendSOS(); }}></div>

        {/* Watch Body (Hardware Frame) */}
        <div className={`relative w-[360px] h-[520px] bg-zinc-900 rounded-[3rem] p-3 border-4 ${isSenior2 ? 'border-cyan-900/60' : 'border-zinc-700'} shadow-2xl shadow-black z-10 transition-colors duration-300`}>
          
          {/* Inner Screen Bezel */}
          <div className="w-full h-full bg-black rounded-[2.5rem] p-4 flex flex-col relative overflow-hidden border-2 border-zinc-800/50">
            
            {/* Screen Content */}
            <div className="flex-1 flex flex-col z-10 overflow-hidden relative">
              
              {/* INCOMING PING / ASSISTANCE OVERLAY */}
              {incomingAlert && (
                <div className="absolute inset-0 bg-black/95 z-50 p-4 flex flex-col justify-between items-center text-center rounded-[2rem] border border-red-500/40 animate-in fade-in zoom-in-95 duration-200">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center text-red-400 mt-2 animate-bounce">
                    <Bell className="w-6 h-6" />
                  </div>
                  <div className="my-auto px-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-950/80 border border-red-800 text-[9px] font-bold text-red-400 uppercase tracking-wider mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping"></span>
                      Assistance Center Ping
                    </div>
                    <p className="text-xs font-semibold text-zinc-100 leading-snug">
                      {incomingAlert.text}
                    </p>
                    <span className="text-[10px] text-zinc-500 font-mono mt-2 block">
                      Received at {incomingAlert.time}
                    </span>
                  </div>
                  <div className="w-full flex flex-col gap-2 mb-1">
                    <button
                      onClick={() => {
                        setIncomingAlert(null);
                        setActiveTab('Inbox');
                      }}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-900/30 active:scale-[0.98]"
                    >
                      View in Inbox
                    </button>
                    <button
                      onClick={() => setIncomingAlert(null)}
                      className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-[11px] font-semibold transition-all active:scale-[0.98]"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* REMOTE HR MEASUREMENT OVERLAY */}
              {isMeasuringHR && (
                <div className="absolute inset-0 bg-black/95 z-50 p-4 flex flex-col justify-center items-center text-center rounded-[2rem] border border-emerald-500/40 animate-in fade-in duration-150">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 mb-3 animate-pulse">
                    <Heart className="w-7 h-7 animate-ping" />
                  </div>
                  <p className="text-sm font-bold text-emerald-400">Clinical Sensor Active</p>
                  <p className="text-[11px] text-zinc-400 mt-1">Assistance center measuring vitals...</p>
                  <div className="mt-4 flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"></span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                </div>
              )}

              {/* CONFIGURATION SYNC NOTIFICATION BANNER */}
              {configSyncToast && (
                <div className="absolute top-2 left-2 right-2 z-40 bg-[#002b36]/95 border border-cyan-500/70 text-cyan-200 px-3 py-2 rounded-xl shadow-lg flex items-center justify-between text-[11px] animate-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                    <div>
                      <p className="font-bold text-[9px] text-cyan-300 uppercase tracking-wider">Remote Configuration Synced</p>
                      <p className="text-[10px] text-zinc-200 leading-tight">{configSyncToast}</p>
                    </div>
                  </div>
                  <button onClick={() => setConfigSyncToast(null)} className="text-zinc-400 hover:text-white text-xs ml-2 font-bold">&times;</button>
                </div>
              )}

              {/* Status Bar */}
              <div className="flex justify-between items-center mb-2.5 text-xs font-mono px-1 shrink-0">
                <span className="font-bold tracking-wider">{time}</span>
                <div className="flex items-center gap-2 text-zinc-400">
                  <Signal className="w-3 h-3 text-emerald-400" />
                  <LocateFixed className="w-3 h-3 text-blue-400" />
                  <Battery className="w-3 h-3 text-amber-400" />
                  <span>88%</span>
                </div>
              </div>

              {/* Senior Identification & Online Badge */}
              <div className="flex items-center justify-between px-1 mb-3 shrink-0">
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${
                  isSenior2
                    ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
                    : 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                }`}>
                  <span>{isSenior2 ? '🫁' : '❤️'}</span>
                  <span>{isSenior2 ? 'SNR-92104-Y' : 'SNR-84920-X'}</span>
                </div>
                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-bold ${
                  connected ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-zinc-700 bg-zinc-800 text-zinc-400'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                  {connected ? 'ONLINE' : 'OFFLINE'}
                </div>
              </div>

              {activeTab === 'Face' ? (
                <>
                  {/* Health Grid */}
                  <div className="grid grid-cols-2 gap-2.5 mb-3 shrink-0">
                    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-2.5 flex flex-col justify-between cursor-pointer hover:bg-zinc-800 transition">
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">Heart Rate</p>
                      <div className="flex justify-between items-end">
                        <p className={`text-xl font-bold ${isSenior2 ? 'text-cyan-400' : 'text-rose-500'}`}>{hr} <span className="text-[9px] text-zinc-500 font-normal">bpm</span></p>
                        <Heart className={`w-4 h-4 ${isSenior2 ? 'text-cyan-400/50' : 'text-rose-500/50'}`} />
                      </div>
                    </div>

                    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-2.5 flex flex-col justify-between cursor-pointer hover:bg-zinc-800 transition">
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">SpO2 Oxygen</p>
                      <div className="flex justify-between items-end">
                        <p className="text-xl font-bold text-cyan-400">{spo2} <span className="text-[9px] text-zinc-500 font-normal">%</span></p>
                        <Activity className="w-4 h-4 text-cyan-400/50" />
                      </div>
                    </div>

                    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-2.5 flex flex-col justify-between cursor-pointer hover:bg-zinc-800 transition">
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">Blood Press.</p>
                      <div className="flex justify-between items-end">
                        <p className="text-lg font-bold text-amber-400">{sys}<span className="text-xs">/{dia}</span> <span className="text-[8px] text-zinc-500 font-normal block leading-none mt-0.5">mmHg</span></p>
                      </div>
                    </div>

                    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-2.5 flex flex-col justify-between cursor-pointer hover:bg-zinc-800 transition">
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">Temp</p>
                      <div className="flex justify-between items-end">
                        <p className="text-xl font-bold text-emerald-400">{temp} <span className="text-[9px] text-zinc-500 font-normal">°C</span></p>
                        <Thermometer className="w-4 h-4 text-emerald-400/50" />
                      </div>
                    </div>
                  </div>

                  {/* Activity Progress */}
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-2.5 mb-3 shrink-0">
                    <div className="flex justify-between text-[10px] text-zinc-400 mb-1.5">
                      <span>Activity Steps</span>
                      <span className="font-bold text-zinc-200">{steps.toLocaleString()} / 10,000</span>
                    </div>
                    <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div className={`h-full ${isSenior2 ? 'bg-cyan-500' : 'bg-blue-500'} rounded-full`} style={{ width: `${Math.min((steps/10000)*100, 100)}%` }}></div>
                    </div>
                  </div>
                </>
              ) : activeTab === 'Sensors' ? (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 scrollbar-hide">
                  <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800">
                    <label className="flex justify-between text-xs text-zinc-400 mb-1">
                      <span>Heart Rate</span> <span className="text-rose-400 font-bold">{hr} bpm</span>
                    </label>
                    <input type="range" min="40" max="200" value={hr} onChange={(e) => setHr(parseInt(e.target.value))} className="w-full accent-rose-500" />
                  </div>
                  <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800">
                    <label className="flex justify-between text-xs text-zinc-400 mb-1">
                      <span>SpO2 Oxygen</span> <span className="text-cyan-400 font-bold">{spo2} %</span>
                    </label>
                    <input type="range" min="70" max="100" value={spo2} onChange={(e) => setSpo2(parseInt(e.target.value))} className="w-full accent-cyan-500" />
                  </div>
                  <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800 flex gap-2">
                    <div className="flex-1">
                      <label className="flex justify-between text-[10px] text-zinc-400 mb-1">
                        <span>SYS</span> <span className="text-amber-400 font-bold">{sys}</span>
                      </label>
                      <input type="range" min="80" max="190" value={sys} onChange={(e) => setSys(parseInt(e.target.value))} className="w-full accent-amber-500" />
                    </div>
                    <div className="flex-1">
                      <label className="flex justify-between text-[10px] text-zinc-400 mb-1">
                        <span>DIA</span> <span className="text-amber-400 font-bold">{dia}</span>
                      </label>
                      <input type="range" min="50" max="120" value={dia} onChange={(e) => setDia(parseInt(e.target.value))} className="w-full accent-amber-500" />
                    </div>
                  </div>
                  <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800">
                    <label className="flex justify-between text-xs text-zinc-400 mb-1">
                      <span>Temperature</span> <span className="text-emerald-400 font-bold">{temp} °C</span>
                    </label>
                    <input type="range" min="35" max="42" step="0.1" value={temp} onChange={(e) => setTemp(parseFloat(e.target.value))} className="w-full accent-emerald-500" />
                  </div>
                  <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800">
                    <label className="flex justify-between text-xs text-zinc-400 mb-1">
                      <span>Steps</span> <span className="text-blue-400 font-bold">{steps}</span>
                    </label>
                    <input type="range" min="0" max="20000" step="100" value={steps} onChange={(e) => setSteps(parseInt(e.target.value))} className="w-full accent-blue-500" />
                  </div>
                </div>
              ) : activeTab === 'Inbox' ? (
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="flex justify-between items-center mb-2 px-1 shrink-0">
                    <span className="text-[11px] font-bold tracking-wider text-zinc-300 uppercase">
                      Inbox ({inboxMessages.length})
                    </span>
                    {inboxMessages.length > 0 && (
                      <button
                        onClick={() => setInboxMessages([])}
                        className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Clear
                      </button>
                    )}
                  </div>
                  
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
                    {inboxMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4 text-zinc-600">
                        <Mail className="w-8 h-8 mb-2 opacity-30" />
                        <p className="text-xs font-semibold">No Messages</p>
                        <p className="text-[10px] text-zinc-600 mt-1">
                          Incoming pings and care alerts will appear here.
                        </p>
                      </div>
                    ) : (
                      inboxMessages.map((msg) => (
                        <div
                          key={msg.id}
                          onClick={() => {
                            setInboxMessages((prev) =>
                              prev.map((m) => (m.id === msg.id ? { ...m, unread: false } : m))
                            );
                          }}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                            msg.unread
                              ? 'bg-blue-950/40 border-blue-600/60 shadow-sm'
                              : 'bg-zinc-900/70 border-zinc-800/80 hover:bg-zinc-850'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-1.5">
                              {msg.unread && (
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                              )}
                              <span className="text-[10px] font-bold text-blue-300 truncate max-w-[130px]">
                                {msg.sender}
                              </span>
                            </div>
                            <span className="text-[9px] font-mono text-zinc-500">{msg.time}</span>
                          </div>
                          <p className="text-[11px] text-zinc-200 leading-snug break-words">
                            {msg.text}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col justify-between py-2 text-xs">
                  <div className="space-y-2">
                    <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-[10px] text-zinc-400 font-bold uppercase">Transmission Cadence</p>
                        <span className="text-[8px] font-mono px-1.5 py-0.5 bg-cyan-950/60 text-cyan-300 border border-cyan-700/60 rounded font-bold">
                          REMOTE SYNCED
                        </span>
                      </div>
                      <p className="text-base font-mono font-bold text-cyan-400">Every {healthCadenceSec}s (APHP)</p>
                      <p className="text-[9px] text-zinc-500 mt-0.5">Live background telemetry interval</p>
                    </div>
                    <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800">
                      <p className="text-[10px] text-zinc-400 font-bold uppercase mb-1">Safety Thresholds</p>
                      <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-zinc-300">
                        <span>HR: {safetyThresholds.hrMin}-{safetyThresholds.hrMax} bpm</span>
                        <span>SpO2: &ge; {safetyThresholds.spo2Min}%</span>
                        <span>BP: &le; {safetyThresholds.bpSysMax}/{safetyThresholds.bpDiaMax}</span>
                        <span>Temp: {safetyThresholds.tempMin}-{safetyThresholds.tempMax}°C</span>
                      </div>
                    </div>
                    <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800">
                      <p className="text-[10px] text-zinc-400 font-bold uppercase mb-1">Senior Bound Identifier</p>
                      <p className="text-xs font-mono text-zinc-300">{isSenior2 ? 'SNR-92104-Y' : 'SNR-84920-X'}</p>
                    </div>
                  </div>
                  <div className="text-[9px] text-zinc-500 font-mono text-center flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>Protocol V1.1 &bull; {lastConfigSyncTime ? `Synced at ${lastConfigSyncTime}` : 'Synced on connect'}</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 mt-auto pt-2 pb-3 shrink-0">
                <button onClick={sendSOS} className="bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors">
                  <ShieldAlert className="w-3.5 h-3.5" /> TRIGGER SOS
                </button>
                <button onClick={sendHealth} className="bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors">
                  <Send className="w-3.5 h-3.5" /> SEND HEALTH
                </button>
              </div>

              {/* Bottom Nav Bar */}
              <div className="flex justify-between border-t border-zinc-800 pt-2.5 px-2 text-[10px] font-medium text-zinc-500 pb-1 shrink-0">
                <div onClick={() => setActiveTab('Face')} className={`flex flex-col items-center gap-1 cursor-pointer transition ${activeTab === 'Face' ? 'text-cyan-400' : 'hover:text-zinc-300'}`}><Clock className="w-4 h-4"/>Face</div>
                <div onClick={() => setActiveTab('Sensors')} className={`flex flex-col items-center gap-1 cursor-pointer transition ${activeTab === 'Sensors' ? 'text-cyan-400' : 'hover:text-zinc-300'}`}><ActivitySquare className="w-4 h-4"/>Sensors</div>
                <div onClick={() => setActiveTab('Inbox')} className={`flex flex-col items-center gap-1 cursor-pointer relative transition ${activeTab === 'Inbox' ? 'text-cyan-400' : 'hover:text-zinc-300'}`}>
                  <div className="relative">
                    <Mail className="w-4 h-4"/>
                    {unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 min-w-[12px] h-3 px-1 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center animate-pulse">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  Inbox
                </div>
                <div onClick={() => setActiveTab('Stream')} className={`flex flex-col items-center gap-1 cursor-pointer transition ${activeTab === 'Stream' ? 'text-cyan-400' : 'hover:text-zinc-300'}`}><Layers className="w-4 h-4"/>Stream</div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: DEVICE CONTROLLER */}
      <div className="w-[720px] min-h-[760px] h-full max-h-[92vh] bg-[#073642] border border-[#0e4c5b] rounded-3xl p-6 flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="flex justify-between items-end mb-4 border-b border-zinc-800 pb-4 shrink-0">
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Watch Device Controller</h1>
            <p className="text-zinc-500 text-xs mt-0.5 font-medium">Multi-Senior TCP Client over Protocol V1.1</p>
          </div>
          
          <div className="flex items-center gap-2">
             <span className="text-xs text-zinc-500 font-bold tracking-wider">IMEI:</span>
             <input 
                type="text" 
                value={imei}
                onChange={(e) => setImei(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-300 focus:outline-none focus:border-zinc-500 w-36 text-center"
                disabled={connected}
              />
          </div>
        </div>

        {/* DEDICATED SENIOR PROFILE (ONE PROFILE PER WATCH SIMULATOR) */}
        {selectedPreset === 'senior2' ? (
          <div className="bg-cyan-950/20 border border-cyan-800/40 rounded-2xl p-3 mb-4 flex items-center justify-between shrink-0 shadow-inner">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-lg">
                🫁
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-cyan-200">Arthur M. (Demo)</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-300 border border-cyan-700/40 font-semibold">
                    SNR-92104-Y
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    WATCH #2
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Severe COPD Protocol &bull; Target IMEI: <span className="font-mono text-zinc-300 font-semibold">{imei}</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => selectSeniorPreset('senior1')}
              className="text-[11px] text-zinc-500 hover:text-cyan-300 transition-colors px-2 py-1"
              title="Reassign this simulator window to Senior 1"
            >
              Switch to Senior 1 &rarr;
            </button>
          </div>
        ) : (
          <div className="bg-rose-950/20 border border-rose-800/40 rounded-2xl p-3 mb-4 flex items-center justify-between shrink-0 shadow-inner">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold text-lg">
                ❤️
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-rose-200">Eleanor V. (Demo)</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-900/40 text-rose-300 border border-rose-700/40 font-semibold">
                    SNR-84920-X
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    WATCH #1
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Cardio Arrhythmia Protocol &bull; Target IMEI: <span className="font-mono text-zinc-300 font-semibold">{imei}</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => selectSeniorPreset('senior2')}
              className="text-[11px] text-zinc-500 hover:text-rose-300 transition-colors px-2 py-1"
              title="Reassign this simulator window to Senior 2"
            >
              Switch to Senior 2 &rarr;
            </button>
          </div>
        )}

        {/* SYNCHRONIZED CONFIGURATION STATUS */}
        <div className="bg-[#002b36] border border-[#0e4c5b] rounded-xl px-3 py-2 mb-3 flex items-center justify-between shrink-0 text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="font-bold text-zinc-200 text-[11px]">Telemetry Cadence:</span>
            <span className="font-mono font-bold text-cyan-300 text-[11px]">{healthCadenceSec}s Ingestion</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
            <span>HR {safetyThresholds.hrMin}-{safetyThresholds.hrMax} bpm</span>
            <span>&bull;</span>
            <span>SpO2 &ge; {safetyThresholds.spo2Min}%</span>
            {lastConfigSyncTime ? (
              <span className="text-[9px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60 font-semibold ml-1">
                Synced {lastConfigSyncTime}
              </span>
            ) : (
              <span className="text-[9px] text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 ml-1">
                Ready
              </span>
            )}
          </div>
        </div>

        {!connected && (
          <button onClick={handleConnect} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl mb-4 shadow-lg shadow-blue-900/20 transition-all active:scale-[0.99] shrink-0 text-xs">
            ESTABLISH TCP CONNECTION TO SERVER
          </button>
        )}

        {/* Commands Area */}
        <div className={`flex-1 min-h-0 flex flex-col transition-opacity ${connected ? 'opacity-100 pointer-events-auto' : 'opacity-40 pointer-events-none'}`}>
          <h2 className="text-[11px] font-bold text-zinc-400 tracking-wider mb-2.5 shrink-0">1. PROTOCOL COMMANDS (DEVICE → SERVER)</h2>
          
          <div className="grid grid-cols-2 gap-2.5 mb-3 shrink-0">
            <button onClick={sendLogin} className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl p-2.5 flex justify-between items-center transition-colors">
              <span className="font-semibold text-xs text-zinc-300">Login (AP00)</span>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">IWAP00#</span>
            </button>
            <button onClick={sendHeartbeat} className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl p-2.5 flex justify-between items-center transition-colors">
              <span className="font-semibold text-xs text-zinc-300">Heartbeat (AP03)</span>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">IWAP03#</span>
            </button>
            <button onClick={sendHealth} className="bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/60 rounded-xl p-2.5 flex justify-between items-center transition-colors">
              <span className="font-semibold text-xs text-emerald-100">Health Data (APHP)</span>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">IWAPHP#</span>
            </button>
            <button onClick={sendSOS} className="bg-red-950/40 hover:bg-red-900/50 border border-red-800/60 rounded-xl p-2.5 flex justify-between items-center transition-colors">
              <span className="font-semibold text-xs text-red-200">SOS Alarm (AP10)</span>
              <span className="text-[11px] font-mono text-red-400 font-bold">IWAP10#</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5 mb-3 shrink-0">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-zinc-200 text-xs">Auto Heartbeat (AP03)</h3>
                <p className="text-[9px] text-zinc-500">Every 20s</p>
              </div>
              <button 
                onClick={() => setAutoHeartbeat(!autoHeartbeat)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[10px] transition-colors ${autoHeartbeat ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}
              >
                {autoHeartbeat ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-zinc-200 text-xs">Auto Health Stream</h3>
                <p className="text-[9px] text-cyan-400 font-mono">Cadence: every {healthCadenceSec}s (Remote Synced)</p>
              </div>
              <button 
                onClick={() => setAutoHealth(!autoHealth)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[10px] transition-colors ${autoHealth ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}
              >
                {autoHealth ? 'ACTIVE' : 'OFF'}
              </button>
            </div>
          </div>

          {/* Quick Clinical Breach Presets Tailored to Senior */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-2.5 mb-3 shrink-0">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>{isSenior2 ? 'Senior 2 (Respiratory) Clinical Triggers' : 'Senior 1 (Cardio) Clinical Triggers'}</span>
              <span className="text-[9px] text-amber-500/90 font-mono">1-Click Test Triggers</span>
            </p>
            
            {isSenior2 ? (
              // Senior 2 (Respiratory / COPD Profile)
              <div className="grid grid-cols-4 gap-2">
                <button 
                  onClick={() => {
                    setHr(78); setSys(128); setDia(82); setSpo2(94); setTemp(36.5);
                    sendPacket(`IWAPHP,78,128,82,94,90,36.5,,,,,,,#`);
                  }}
                  className="bg-zinc-950 border border-zinc-800 hover:border-emerald-600/50 p-2 rounded-lg text-left transition-colors group"
                >
                  <p className="text-[10px] font-bold text-emerald-400">COPD Baseline</p>
                  <p className="text-[8px] text-zinc-500">78 bpm, 94% SpO2</p>
                </button>

                <button 
                  onClick={() => {
                    setSpo2(85);
                    sendPacket(`IWAPHP,${hr},${sys},${dia},85,90,${temp},,,,,,,#`);
                  }}
                  className="bg-zinc-950 border border-zinc-800 hover:border-cyan-600/50 p-2 rounded-lg text-left transition-colors group"
                >
                  <p className="text-[10px] font-bold text-cyan-400">Hypoxemia</p>
                  <p className="text-[8px] text-zinc-500">SpO2: 85% (&lt;90% limit)</p>
                </button>

                <button 
                  onClick={() => {
                    setSpo2(78); setHr(118);
                    sendPacket(`IWAPHP,118,${sys},${dia},78,90,${temp},,,,,,,#`);
                  }}
                  className="bg-zinc-950 border border-zinc-800 hover:border-rose-600/50 p-2 rounded-lg text-left transition-colors group"
                >
                  <p className="text-[10px] font-bold text-rose-400">Severe Hypoxia</p>
                  <p className="text-[8px] text-zinc-500">SpO2: 78%, HR: 118</p>
                </button>

                <button 
                  onClick={() => {
                    setTemp(38.8); setHr(122);
                    sendPacket(`IWAPHP,122,${sys},${dia},${spo2},90,38.8,,,,,,,#`);
                  }}
                  className="bg-zinc-950 border border-zinc-800 hover:border-amber-600/50 p-2 rounded-lg text-left transition-colors group"
                >
                  <p className="text-[10px] font-bold text-amber-400">Infection Fever</p>
                  <p className="text-[8px] text-zinc-500">38.8 °C (&gt;38.0 limit)</p>
                </button>
              </div>
            ) : (
              // Senior 1 (Cardio Profile)
              <div className="grid grid-cols-4 gap-2">
                <button 
                  onClick={() => {
                    setHr(72); setSys(118); setDia(78); setSpo2(98); setTemp(36.6);
                    sendPacket(`IWAPHP,72,118,78,98,90,36.6,,,,,,,#`);
                  }}
                  className="bg-zinc-950 border border-zinc-800 hover:border-emerald-600/50 p-2 rounded-lg text-left transition-colors group"
                >
                  <p className="text-[10px] font-bold text-emerald-400">Normal Baseline</p>
                  <p className="text-[8px] text-zinc-500">72 bpm, 118/78, 98%</p>
                </button>

                <button 
                  onClick={() => {
                    setHr(135);
                    sendPacket(`IWAPHP,135,${sys},${dia},${spo2},90,${temp},,,,,,,#`);
                  }}
                  className="bg-zinc-950 border border-zinc-800 hover:border-rose-600/50 p-2 rounded-lg text-left transition-colors group"
                >
                  <p className="text-[10px] font-bold text-rose-400">Tachycardia</p>
                  <p className="text-[8px] text-zinc-500">HR: 135 bpm (&gt;110)</p>
                </button>

                <button 
                  onClick={() => {
                    setSys(172); setDia(104);
                    sendPacket(`IWAPHP,${hr},172,104,${spo2},90,${temp},,,,,,,#`);
                  }}
                  className="bg-zinc-950 border border-zinc-800 hover:border-amber-600/50 p-2 rounded-lg text-left transition-colors group"
                >
                  <p className="text-[10px] font-bold text-amber-400">Hypertension</p>
                  <p className="text-[8px] text-zinc-500">172/104 mmHg (&gt;140)</p>
                </button>

                <button 
                  onClick={() => {
                    setHr(44);
                    sendPacket(`IWAPHP,44,${sys},${dia},${spo2},90,${temp},,,,,,,#`);
                  }}
                  className="bg-zinc-950 border border-zinc-800 hover:border-blue-600/50 p-2 rounded-lg text-left transition-colors group"
                >
                  <p className="text-[10px] font-bold text-blue-400">Bradycardia</p>
                  <p className="text-[8px] text-zinc-500">HR: 44 bpm (&lt;50 limit)</p>
                </button>
              </div>
            )}

            {/* Test Ping */}
            <button 
              onClick={() => {
                const testText = `ALERT: Checking in with ${isSenior2 ? 'Senior 2 (Arthur M.)' : 'Senior 1 (Eleanor V.)'} from assistance center.`;
                playWatchBeep();
                setTimeout(() => playWatchBeep(), 180);
                const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false });
                setIncomingAlert({ text: testText, time: currentTime });
                setInboxMessages((prev) => [
                  {
                    id: Date.now(),
                    sender: "Assistance Center",
                    text: testText,
                    time: currentTime,
                    unread: true
                  },
                  ...prev
                ]);
              }}
              className="w-full mt-2 bg-blue-950/40 border border-blue-800/80 hover:border-blue-500 p-1.5 rounded-lg flex items-center justify-between transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] font-bold text-blue-300">Simulate Assistance Ping (BP40) on this Watch</span>
              </div>
              <span className="text-[8px] text-zinc-500 font-mono">Test Watch Popup & Sound</span>
            </button>
          </div>

          {/* Logs */}
          <div className="flex justify-between items-end mb-1.5 shrink-0 mt-3">
            <div className="flex items-center gap-2">
              <h2 className="text-[11px] font-bold text-zinc-300 tracking-wider">RECENT WATCH PAYLOADS</h2>
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/70 px-1.5 py-0.5 rounded border border-cyan-800/70 font-semibold">{logs.length} logged</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[9px] text-zinc-400 font-medium">Live Socket Feed</span>
              {logs.length > 0 && (
                <button
                  onClick={() => setLogs([])}
                  className="text-[9px] text-zinc-400 hover:text-red-400 flex items-center gap-1 transition-colors"
                  title="Clear payload log"
                >
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-[160px] bg-[#00212b] border border-[#0e4c5b] rounded-xl p-3 overflow-y-auto font-mono text-xs shadow-inner">
             {logs.length === 0 ? (
               <p className="text-zinc-600 italic text-[11px]">No payloads transmitted yet.</p>
             ) : (
               logs.map((log, i) => (
                <div key={i} className="mb-1.5 flex gap-2 text-[11px] leading-relaxed">
                  <span className={`shrink-0 font-bold font-mono ${log.dir === 'TX' ? 'text-cyan-400' : 'text-emerald-400'}`}>[{log.dir}]</span>
                  <span className="text-zinc-200 break-all">{log.data}</span>
                </div>
              ))
             )}
          </div>

        </div>

      </div>

    </div>
  );
}

export default App;
