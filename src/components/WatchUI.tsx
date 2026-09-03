import React, { useState, useEffect } from 'react';
import {
  WatchTelemetry,
  PacketLogEntry,
} from '../types.ts';
import { socketClient } from '../lib/socket.ts';
import { soundEffects } from '../lib/audio.ts';
import {
  Heart,
  Activity,
  Thermometer,
  Zap,
  Radio,
  Wifi,
  MapPin,
  AlertTriangle,
  RotateCw,
  Send,
  MessageSquare,
  Sliders,
  CheckCircle2,
  XCircle,
  Copy,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import {
  buildLoginPacket,
  buildHeartbeatPacket,
  buildHealthDataPacket,
  buildAlarmPacket,
  buildHeartRateAck,
  buildAutoHrAck,
  buildTextMessageAck,
  buildLocateAck,
  buildFallToggleAck,
} from '../../server/protocol.ts';

interface WatchUIProps {
  telemetry: WatchTelemetry;
  packetLogs: PacketLogEntry[];
}

export const WatchUI: React.FC<WatchUIProps> = ({ telemetry, packetLogs }) => {
  const [activeScreen, setActiveScreen] = useState<'watchface' | 'sensors' | 'log' | 'messages'>('watchface');
  const [autoHeartbeat, setAutoHeartbeat] = useState<boolean>(true);
  const [heartbeatIntervalSec, setHeartbeatIntervalSec] = useState<number>(20);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [hrMeasuring, setHrMeasuring] = useState<boolean>(false);
  const [activeNotification, setActiveNotification] = useState<{
    type: 'MESSAGE' | 'COMMAND';
    title: string;
    text: string;
    raw?: string;
  } | null>(null);

  // Local sensor adjustment controls
  const [localHr, setLocalHr] = useState<number>(telemetry.heartRate || 72);
  const [localSbp, setLocalSbp] = useState<number>(telemetry.sbp || 120);
  const [localDbp, setLocalDbp] = useState<number>(telemetry.dbp || 80);
  const [localSpo2, setLocalSpo2] = useState<number>(telemetry.spo2 || 98);
  const [localTemp, setLocalTemp] = useState<number>(telemetry.temperature || 36.6);
  const [localSugar, setLocalSugar] = useState<number>(telemetry.bloodSugar || 92);
  const [localBattery, setLocalBattery] = useState<number>(telemetry.battery || 88);
  const [localImei, setLocalImei] = useState<string>(telemetry.imei || '353456789012345');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Update clock every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync state if telemetry updates from server
  useEffect(() => {
    setLocalHr(telemetry.heartRate);
    setLocalSbp(telemetry.sbp);
    setLocalDbp(telemetry.dbp);
    setLocalSpo2(telemetry.spo2);
    setLocalTemp(telemetry.temperature);
    setLocalSugar(telemetry.bloodSugar);
    setLocalBattery(telemetry.battery);
  }, [telemetry.heartRate, telemetry.sbp, telemetry.dbp, telemetry.spo2, telemetry.temperature, telemetry.bloodSugar, telemetry.battery]);

  // Listen for incoming server commands directed to the watch
  useEffect(() => {
    const unsubCmd = socketClient.on('SERVER_COMMAND_TO_WATCH', (data: any) => {
      soundEffects.playWatchNotification();
      const cmd = data.command;

      if (cmd === 'BPXL') {
        // Request Instant Heart Rate
        setActiveNotification({
          type: 'COMMAND',
          title: 'Remote HR Test Request',
          text: `Command BPXL received (Journal #${data.parsed?.journal || 'N/A'}). Acknowledging and testing...`,
          raw: data.raw,
        });
        // Send APXL ack
        const j = data.parsed?.journal || '080835';
        const ack = buildHeartRateAck(j);
        socketClient.sendDevicePacket(ack);

        // Simulate sensor measurement animation then send AP49 or APHP
        setHrMeasuring(true);
        setTimeout(() => {
          setHrMeasuring(false);
          const measuredHr = Math.floor(65 + Math.random() * 25);
          setLocalHr(measuredHr);
          // Send APHP health reading packet
          const healthPkt = buildHealthDataPacket(measuredHr, localSbp, localDbp, localSpo2, localSugar, localTemp);
          socketClient.sendDevicePacket(healthPkt);
        }, 2200);
      } else if (cmd === 'BP40') {
        // Text message
        const msg = data.parsed?.message || 'New Message from Assistance Center';
        setActiveNotification({
          type: 'MESSAGE',
          title: 'Incoming Message',
          text: msg,
          raw: data.raw,
        });
        // Acknowledge AP40
        const j = data.parsed?.journal || '080835';
        socketClient.sendDevicePacket(buildTextMessageAck(j));
      } else if (cmd === 'BP86') {
        // Auto HR interval set
        setActiveNotification({
          type: 'COMMAND',
          title: 'Auto-HR Interval Configured',
          text: `Auto testing set to ${data.parsed?.switch ? 'ON' : 'OFF'} every ${data.parsed?.intervalMinutes} mins.`,
          raw: data.raw,
        });
        const j = data.parsed?.journal || '080835';
        socketClient.sendDevicePacket(buildAutoHrAck(j));
      } else if (cmd === 'BP16') {
        // Locate command
        setActiveNotification({
          type: 'COMMAND',
          title: 'Locate Request',
          text: 'Operator requested real-time GPS fix.',
          raw: data.raw,
        });
        const j = data.parsed?.journal || '080835';
        socketClient.sendDevicePacket(buildLocateAck(j));
        // Send AP10 with normal state to report location
        setTimeout(() => {
          sendAlarm('00');
        }, 800);
      } else if (cmd === 'BP76') {
        const j = data.parsed?.journal || '080835';
        socketClient.sendDevicePacket(buildFallToggleAck(j));
      }
    });

    return () => {
      unsubCmd();
    };
  }, [localSbp, localDbp, localSpo2, localSugar, localTemp]);

  // Periodic Heartbeat timer
  useEffect(() => {
    if (!autoHeartbeat || !telemetry.isAuthenticated) return;
    const interval = setInterval(() => {
      sendHeartbeat();
    }, heartbeatIntervalSec * 1000);
    return () => clearInterval(interval);
  }, [autoHeartbeat, heartbeatIntervalSec, telemetry.isAuthenticated, localBattery]);

  // Protocol Actions
  const sendLogin = () => {
    const pkt = buildLoginPacket(localImei);
    socketClient.sendDevicePacket(pkt);
  };

  const sendHeartbeat = () => {
    const pkt = buildHeartbeatPacket(
      telemetry.gsmSignal,
      telemetry.satellites,
      localBattery,
      '01',
      '02',
      telemetry.steps + Math.floor(Math.random() * 12),
      telemetry.rolls
    );
    socketClient.sendDevicePacket(pkt);
  };

  const sendHealthReading = () => {
    const pkt = buildHealthDataPacket(localHr, localSbp, localDbp, localSpo2, localSugar, localTemp);
    socketClient.sendDevicePacket(pkt);
  };

  const sendAlarm = (alarmType: '01' | '05' | '00' | '03') => {
    if (alarmType === '01' || alarmType === '05') {
      soundEffects.playSosAlarm();
    }
    const pkt = buildAlarmPacket(
      alarmType,
      telemetry.latitude,
      telemetry.longitude,
      localBattery,
      telemetry.gsmSignal,
      telemetry.satellites
    );
    socketClient.sendDevicePacket(pkt);
  };

  const applySensorChanges = () => {
    socketClient.updateTelemetry({
      heartRate: localHr,
      sbp: localSbp,
      dbp: localDbp,
      spo2: localSpo2,
      temperature: localTemp,
      bloodSugar: localSugar,
      battery: localBattery,
      imei: localImei,
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Filter logs relevant to this watch
  const watchLogs = packetLogs.slice(0, 40);

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">
      {/* Smartwatch Physical Body Mockup */}
      <div className="flex flex-col items-center">
        {/* Watch Top Strap */}
        <div className="w-40 h-8 bg-gradient-to-b from-stone-800 to-stone-900 rounded-t-xl border-t border-x border-stone-700/60 shadow-inner">
          <div className="w-full h-full flex items-center justify-around px-4 opacity-40">
            <div className="w-2 h-1 bg-stone-600 rounded"></div>
            <div className="w-2 h-1 bg-stone-600 rounded"></div>
            <div className="w-2 h-1 bg-stone-600 rounded"></div>
          </div>
        </div>

        {/* Watch Chassis */}
        <div className="relative p-4 rounded-[48px] bg-gradient-to-br from-zinc-700 via-zinc-900 to-black shadow-2xl border-4 border-zinc-600/80">
          {/* Physical Side Crown Button */}
          <button
            onClick={() => {
              setActiveScreen('watchface');
              setActiveNotification(null);
            }}
            title="Press Digital Crown (Home)"
            className="absolute -right-3 top-24 w-3.5 h-12 bg-gradient-to-r from-zinc-400 to-zinc-700 rounded-r-md border border-zinc-500 shadow-md active:scale-95 transition-transform cursor-pointer"
          />

          {/* Physical Action Button */}
          <button
            onClick={() => sendAlarm('01')}
            title="Emergency SOS Quick Key"
            className="absolute -right-3 top-42 w-3.5 h-10 bg-red-600 hover:bg-red-500 rounded-r-md border border-red-700 shadow-md active:scale-95 transition-transform cursor-pointer"
          />

          {/* OLED Screen Area (340x400) */}
          <div className="w-[320px] h-[390px] rounded-[36px] bg-black text-white p-4 overflow-hidden relative flex flex-col justify-between border-2 border-zinc-800/80 shadow-inner">
            {/* Gloss reflection overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none rounded-[36px]"></div>

            {/* Watch Top Status Bar */}
            <div className="flex items-center justify-between text-xs text-zinc-400 z-10 pt-1 px-1">
              <span className="font-mono font-bold text-white tracking-wider">{currentTime || '12:00:00'}</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5" title={`GSM Signal: ${telemetry.gsmSignal}%`}>
                  <Radio className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] font-mono">{telemetry.gsmSignal}%</span>
                </div>
                <div className="flex items-center gap-0.5" title={`GPS: ${telemetry.satellites} satellites`}>
                  <MapPin className={`w-3 h-3 ${telemetry.gpsValid ? 'text-blue-400' : 'text-zinc-500'}`} />
                  <span className="text-[10px] font-mono">{telemetry.satellites}s</span>
                </div>
                <div className="flex items-center gap-1">
                  <Zap className={`w-3 h-3 ${localBattery <= 20 ? 'text-red-400 animate-pulse' : 'text-amber-400'}`} />
                  <span className="text-[10px] font-mono">{localBattery}%</span>
                </div>
              </div>
            </div>

            {/* Active Notification Modal Overlay on Watch */}
            {activeNotification && (
              <div className="absolute inset-x-3 inset-y-8 bg-zinc-900/95 backdrop-blur-md rounded-2xl p-4 z-30 border border-zinc-700 flex flex-col justify-between shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs uppercase tracking-wider">
                    <MessageSquare className="w-4 h-4" />
                    <span>{activeNotification.title}</span>
                  </div>
                  <button
                    onClick={() => setActiveNotification(null)}
                    className="text-zinc-400 hover:text-white text-xs px-1"
                  >
                    ✕
                  </button>
                </div>
                <div className="my-auto py-2">
                  <p className="text-sm font-medium text-white leading-snug">{activeNotification.text}</p>
                  {activeNotification.raw && (
                    <div className="mt-2 bg-black/70 p-1.5 rounded font-mono text-[10px] text-emerald-400 break-all border border-zinc-800">
                      {activeNotification.raw}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setActiveNotification(null)}
                  className="w-full py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Heart Rate Measurement Animation Overlay */}
            {hrMeasuring && (
              <div className="absolute inset-0 bg-black/90 z-20 flex flex-col items-center justify-center p-4">
                <Heart className="w-12 h-12 text-rose-500 animate-ping mb-3" />
                <span className="text-sm font-semibold text-rose-400">Measuring Heart Rate...</span>
                <span className="text-[11px] text-zinc-400 mt-1 font-mono">Sensors active: PPG photodiode</span>
              </div>
            )}

            {/* Main Watch Screen Content */}
            {activeScreen === 'watchface' && (
              <div className="flex-1 flex flex-col justify-between py-2 z-10">
                {/* Connection Status Pill */}
                <div className="flex items-center justify-between px-1">
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                      telemetry.isAuthenticated
                        ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                        : telemetry.isOnline
                        ? 'bg-amber-950/70 border-amber-500/50 text-amber-300'
                        : 'bg-zinc-800/80 border-zinc-700 text-zinc-400'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        telemetry.isAuthenticated
                          ? 'bg-emerald-400 animate-pulse'
                          : telemetry.isOnline
                          ? 'bg-amber-400'
                          : 'bg-zinc-500'
                      }`}
                    />
                    {telemetry.isAuthenticated ? 'AUTHENTICATED' : telemetry.isOnline ? 'ONLINE' : 'OFFLINE'}
                  </div>

                  {telemetry.unreadMessages.length > 0 && (
                    <button
                      onClick={() => setActiveScreen('messages')}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-900/60 border border-blue-500/40 text-blue-300 rounded-full text-[10px]"
                    >
                      <MessageSquare className="w-2.5 h-2.5" />
                      <span>{telemetry.unreadMessages.length} New</span>
                    </button>
                  )}
                </div>

                {/* Real-time Health Metrics Cards */}
                <div className="grid grid-cols-2 gap-2 my-1">
                  {/* Heart Rate */}
                  <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Heart Rate</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black text-rose-400 font-mono">{localHr}</span>
                        <span className="text-[9px] text-zinc-500">bpm</span>
                      </div>
                    </div>
                    <Heart className="w-5 h-5 text-rose-500 animate-pulse" />
                  </div>

                  {/* Blood Oxygen */}
                  <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">SpO2 Oxygen</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black text-cyan-400 font-mono">{localSpo2}</span>
                        <span className="text-[9px] text-zinc-500">%</span>
                      </div>
                    </div>
                    <Activity className="w-5 h-5 text-cyan-400" />
                  </div>

                  {/* Blood Pressure */}
                  <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Blood Press.</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold text-amber-300 font-mono">
                          {localSbp}/{localDbp}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">mmHg</span>
                  </div>

                  {/* Temperature */}
                  <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Temp</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black text-emerald-400 font-mono">{localTemp.toFixed(1)}</span>
                        <span className="text-[9px] text-zinc-500">°C</span>
                      </div>
                    </div>
                    <Thermometer className="w-5 h-5 text-emerald-400" />
                  </div>
                </div>

                {/* Steps & Activity bar */}
                <div className="bg-zinc-900/70 border border-zinc-800/60 rounded-lg px-2.5 py-1.5 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-zinc-400">Activity Steps</span>
                  <span className="font-mono text-indigo-300 font-bold">{telemetry.steps.toLocaleString()} / 10,000</span>
                </div>

                {/* Primary Action Buttons */}
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    id="watch-trigger-sos-btn"
                    onClick={() => sendAlarm('01')}
                    className="py-2.5 px-2 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-red-950/50 active:scale-95 transition-all cursor-pointer"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>TRIGGER SOS</span>
                  </button>

                  <button
                    id="watch-send-health-btn"
                    onClick={sendHealthReading}
                    className="py-2.5 px-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/50 active:scale-95 transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>SEND HEALTH</span>
                  </button>
                </div>
              </div>
            )}

            {/* Screen 2: Sensor Calibration / Manual Adjustments */}
            {activeScreen === 'sensors' && (
              <div className="flex-1 flex flex-col justify-between py-1 z-10 text-xs overflow-y-auto pr-1">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-1 mb-1">
                  <span className="font-bold text-white uppercase text-[11px]">Hardware Tuning</span>
                  <button
                    onClick={applySensorChanges}
                    className="text-[10px] bg-emerald-700 hover:bg-emerald-600 text-white px-2 py-0.5 rounded cursor-pointer font-semibold"
                  >
                    Apply
                  </button>
                </div>

                <div className="space-y-2">
                  {/* Heart Rate Slider */}
                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-300">
                      <span>Heart Rate</span>
                      <span className="font-mono text-rose-400 font-bold">{localHr} bpm</span>
                    </div>
                    <input
                      type="range"
                      min="45"
                      max="180"
                      value={localHr}
                      onChange={(e) => setLocalHr(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                    />
                  </div>

                  {/* SpO2 Slider */}
                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-300">
                      <span>Blood Oxygen (SpO2)</span>
                      <span className="font-mono text-cyan-400 font-bold">{localSpo2}%</span>
                    </div>
                    <input
                      type="range"
                      min="82"
                      max="100"
                      value={localSpo2}
                      onChange={(e) => setLocalSpo2(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>

                  {/* Body Temperature */}
                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-300">
                      <span>Body Temperature</span>
                      <span className="font-mono text-emerald-400 font-bold">{localTemp.toFixed(1)}°C</span>
                    </div>
                    <input
                      type="range"
                      min="35.0"
                      max="41.0"
                      step="0.1"
                      value={localTemp}
                      onChange={(e) => setLocalTemp(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>

                  {/* Blood Pressure (SBP) */}
                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-300">
                      <span>Blood Pressure (SBP/DBP)</span>
                      <span className="font-mono text-amber-300 font-bold">
                        {localSbp} / {localDbp}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="range"
                        min="90"
                        max="180"
                        value={localSbp}
                        onChange={(e) => setLocalSbp(parseInt(e.target.value))}
                        className="w-1/2 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                      <input
                        type="range"
                        min="55"
                        max="115"
                        value={localDbp}
                        onChange={(e) => setLocalDbp(parseInt(e.target.value))}
                        className="w-1/2 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                      />
                    </div>
                  </div>

                  {/* Battery */}
                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-300">
                      <span>Battery Level</span>
                      <span className="font-mono text-indigo-400 font-bold">{localBattery}%</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      value={localBattery}
                      onChange={(e) => setLocalBattery(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex gap-1.5 pt-1">
                  <button
                    onClick={() => sendAlarm('05')}
                    className="flex-1 py-1 bg-amber-800/80 hover:bg-amber-700 text-amber-100 rounded text-[10px] font-semibold cursor-pointer flex items-center justify-center gap-1"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>Trigger Fall</span>
                  </button>
                  <button
                    onClick={() => sendAlarm('00')}
                    className="flex-1 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-[10px] font-semibold cursor-pointer"
                  >
                    Clear Alarm
                  </button>
                </div>
              </div>
            )}

            {/* Screen 3: Watch Received Messages */}
            {activeScreen === 'messages' && (
              <div className="flex-1 flex flex-col justify-between py-1 z-10 text-xs overflow-y-auto">
                <div className="border-b border-zinc-800 pb-1 mb-1 font-bold text-white uppercase text-[11px] flex justify-between items-center">
                  <span>Inbox (BP40 Texts)</span>
                  <span className="text-[10px] text-zinc-500">{telemetry.unreadMessages.length} total</span>
                </div>

                <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
                  {telemetry.unreadMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-500 py-6 text-center">
                      <MessageSquare className="w-8 h-8 stroke-1 mb-1 opacity-40" />
                      <p className="text-[11px]">No operator messages yet.</p>
                      <p className="text-[10px] text-zinc-600 mt-1">Send a BP40 text from Admin Command Center</p>
                    </div>
                  ) : (
                    telemetry.unreadMessages.map((msg) => (
                      <div key={msg.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-[11px]">
                        <div className="flex justify-between text-zinc-400 text-[9px] mb-0.5">
                          <span className="font-semibold text-cyan-400">{msg.sender}</span>
                          <span>{msg.timestamp}</span>
                        </div>
                        <p className="text-zinc-100">{msg.text}</p>
                      </div>
                    ))
                  )}
                </div>

                <button
                  onClick={() => setActiveScreen('watchface')}
                  className="w-full mt-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-semibold cursor-pointer"
                >
                  Back to Clock
                </button>
              </div>
            )}

            {/* Screen 4: Device Raw Logs */}
            {activeScreen === 'log' && (
              <div className="flex-1 flex flex-col justify-between py-1 z-10 text-xs overflow-hidden">
                <div className="border-b border-zinc-800 pb-1 mb-1 font-bold text-white uppercase text-[11px] flex justify-between items-center">
                  <span>Device Stream</span>
                  <span className="text-[10px] text-zinc-500">{watchLogs.length} pkts</span>
                </div>

                <div className="flex-1 space-y-1 overflow-y-auto font-mono text-[9px] pr-1">
                  {watchLogs.length === 0 ? (
                    <p className="text-zinc-500 text-center py-6">No packet traffic yet.</p>
                  ) : (
                    watchLogs.map((log) => (
                      <div
                        key={log.id}
                        className={`p-1.5 rounded border leading-tight ${
                          log.direction === 'DEVICE->SERVER'
                            ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300'
                            : 'bg-blue-950/40 border-blue-800/40 text-blue-300'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-0.5 text-[8px] opacity-75">
                          <span>{log.direction === 'DEVICE->SERVER' ? 'TX ▲' : 'RX ▼'} {log.command}</span>
                          <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="break-all">{log.raw}</div>
                      </div>
                    ))
                  )}
                </div>

                <button
                  onClick={() => setActiveScreen('watchface')}
                  className="w-full mt-1.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-semibold cursor-pointer"
                >
                  Back to Clock
                </button>
              </div>
            )}

            {/* Watch Bottom Navigation Dock */}
            <div className="flex items-center justify-around pt-1 border-t border-zinc-800/80 z-10 text-[10px]">
              <button
                onClick={() => setActiveScreen('watchface')}
                className={`flex flex-col items-center py-0.5 px-2 rounded-lg cursor-pointer transition-colors ${
                  activeScreen === 'watchface' ? 'text-cyan-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span className="text-[9px]">Face</span>
              </button>
              <button
                onClick={() => setActiveScreen('sensors')}
                className={`flex flex-col items-center py-0.5 px-2 rounded-lg cursor-pointer transition-colors ${
                  activeScreen === 'sensors' ? 'text-cyan-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span className="text-[9px]">Sensors</span>
              </button>
              <button
                onClick={() => setActiveScreen('messages')}
                className={`flex flex-col items-center py-0.5 px-2 rounded-lg cursor-pointer transition-colors ${
                  activeScreen === 'messages' ? 'text-cyan-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="text-[9px]">Inbox</span>
              </button>
              <button
                onClick={() => setActiveScreen('log')}
                className={`flex flex-col items-center py-0.5 px-2 rounded-lg cursor-pointer transition-colors ${
                  activeScreen === 'log' ? 'text-cyan-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span className="text-[9px]">Stream</span>
              </button>
            </div>
          </div>
        </div>

        {/* Watch Bottom Strap */}
        <div className="w-40 h-8 bg-gradient-to-t from-stone-800 to-stone-900 rounded-b-xl border-b border-x border-stone-700/60 shadow-inner">
          <div className="w-full h-full flex items-center justify-around px-4 opacity-40">
            <div className="w-2 h-1 bg-stone-600 rounded"></div>
            <div className="w-2 h-1 bg-stone-600 rounded"></div>
            <div className="w-2 h-1 bg-stone-600 rounded"></div>
          </div>
        </div>
      </div>

      {/* Watch Protocol Companion & Quick Control Panel */}
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">Watch Device Controller</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Mock TCP Client over Protocol V1.1</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-400">IMEI:</span>
            <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
              {localImei}
            </span>
          </div>
        </div>

        {/* Protocol Flows / Quick Trigger Section */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
            1. Protocol Commands (Device → Server)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={sendLogin}
              className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-semibold flex items-center justify-between border border-zinc-300 dark:border-zinc-700 cursor-pointer"
            >
              <span>Login (AP00)</span>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">IWAP00#</span>
            </button>

            <button
              onClick={sendHeartbeat}
              className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-semibold flex items-center justify-between border border-zinc-300 dark:border-zinc-700 cursor-pointer"
            >
              <span>Heartbeat (AP03)</span>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">IWAP03#</span>
            </button>

            <button
              onClick={sendHealthReading}
              className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-semibold flex items-center justify-between border border-emerald-200 dark:border-emerald-800 cursor-pointer"
            >
              <span>Health Data (APHP)</span>
              <span className="text-[10px] font-mono font-bold">IWAPHP#</span>
            </button>

            <button
              onClick={() => sendAlarm('01')}
              className="px-3 py-2 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-800 dark:text-red-300 rounded-lg text-xs font-semibold flex items-center justify-between border border-red-200 dark:border-red-800 cursor-pointer"
            >
              <span>SOS Alarm (AP10)</span>
              <span className="text-[10px] font-mono font-bold">IWAP10#</span>
            </button>
          </div>
        </div>

        {/* Auto-Heartbeat Configuration */}
        <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-xl p-3 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between text-xs">
          <div>
            <span className="font-semibold text-zinc-800 dark:text-zinc-200 block">Automatic Background Heartbeat</span>
            <span className="text-zinc-500 text-[11px]">Sends AP03 packet every {heartbeatIntervalSec}s</span>
          </div>
          <button
            onClick={() => setAutoHeartbeat(!autoHeartbeat)}
            className={`px-3 py-1 rounded-full font-semibold text-xs cursor-pointer transition-colors ${
              autoHeartbeat
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            {autoHeartbeat ? 'ACTIVE' : 'PAUSED'}
          </button>
        </div>

        {/* Real-time Watch Outgoing / Incoming String Inspector */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              Recent Watch Payloads
            </span>
            <span className="text-[11px] text-zinc-500">Live Socket Feed</span>
          </div>

          <div className="bg-zinc-950 text-zinc-200 rounded-xl p-3 font-mono text-[11px] h-44 overflow-y-auto space-y-1.5 border border-zinc-800">
            {watchLogs.slice(0, 10).map((log) => (
              <div
                key={log.id}
                className="group flex items-start justify-between gap-2 p-1 rounded hover:bg-zinc-900 transition-colors"
              >
                <div className="flex items-start gap-1.5 flex-1 min-w-0">
                  <span
                    className={`text-[9px] px-1 py-0.5 rounded font-bold shrink-0 ${
                      log.direction === 'DEVICE->SERVER'
                        ? 'bg-emerald-900/60 text-emerald-400'
                        : 'bg-blue-900/60 text-blue-400'
                    }`}
                  >
                    {log.direction === 'DEVICE->SERVER' ? 'SENT' : 'RCVD'}
                  </span>
                  <span className="break-all text-zinc-300">{log.raw}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(log.raw, log.id)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-white p-0.5 cursor-pointer"
                  title="Copy raw string"
                >
                  {copiedId === log.id ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
