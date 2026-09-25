import React, { useState, useEffect } from 'react';
import {
  WatchTelemetry,
  PacketLogEntry,
  AlarmEvent,
  ServerStats,
} from '../types.ts';
import { socketClient } from '../lib/socket.ts';
import { soundEffects } from '../lib/audio.ts';
import {
  Heart,
  Activity,
  Thermometer,
  Zap,
  Radio,
  MapPin,
  AlertTriangle,
  Send,
  MessageSquare,
  ShieldAlert,
  CheckCircle2,
  Bell,
  Clock,
  Settings,
  PhoneCall,
  RotateCcw,
  PowerOff,
  Crosshair,
  Sliders,
  Terminal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  buildRequestHeartRateCommand,
  buildSetAutoHrIntervalCommand,
  buildTextMessageCommand,
  buildLocateCommand,
  buildFallToggleCommand,
  buildSetSosCommand,
  generateJournalNumber,
} from '../../server/protocol.ts';

interface AdminDashboardProps {
  telemetry: WatchTelemetry;
  packetLogs: PacketLogEntry[];
  alarms: AlarmEvent[];
  stats: ServerStats | null;
  onSelectPacket?: (packet: PacketLogEntry) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  telemetry,
  packetLogs,
  alarms,
  stats,
  onSelectPacket,
}) => {
  // Command Center state
  const [customMsg, setCustomMsg] = useState<string>('Are you ok? Please check in.');
  const [hrIntervalMinutes, setHrIntervalMinutes] = useState<number>(720);
  const [autoHrEnabled, setAutoHrEnabled] = useState<boolean>(true);
  const [customRawCommand, setCustomRawCommand] = useState<string>('');
  const [sosContacts, setSosContacts] = useState<[string, string, string]>([
    '+1-800-555-0199',
    '+1-800-555-0144',
    '+1-800-555-0100',
  ]);
  const [soundMuted, setSoundMuted] = useState<boolean>(false);
  const [selectedTab, setSelectedTab] = useState<'vitals' | 'commands' | 'map' | 'alarms'>('vitals');

  // Check for any active unacknowledged alarm
  const activeUnackAlarm = alarms.find((a) => !a.acknowledged && (a.type === 'SOS' || a.type === 'FALL'));

  // Trigger siren sound when new alarm arrives
  useEffect(() => {
    if (activeUnackAlarm && !soundMuted) {
      soundEffects.playSosAlarm();
    }
  }, [activeUnackAlarm?.id, soundMuted]);

  // Dispatch Commands
  const sendRequestHeartRate = () => {
    const journal = generateJournalNumber();
    const cmd = buildRequestHeartRateCommand(telemetry.imei, journal);
    socketClient.sendServerCommand(cmd);
  };

  const sendSetAutoHrInterval = () => {
    const journal = generateJournalNumber();
    const cmd = buildSetAutoHrIntervalCommand(telemetry.imei, autoHrEnabled, hrIntervalMinutes, journal);
    socketClient.sendServerCommand(cmd);
  };

  const sendTextMessage = () => {
    if (!customMsg.trim()) return;
    const journal = generateJournalNumber();
    const cmd = buildTextMessageCommand(telemetry.imei, customMsg.trim(), journal);
    socketClient.sendServerCommand(cmd);
  };

  const sendLocateCommand = () => {
    const journal = generateJournalNumber();
    const cmd = buildLocateCommand(telemetry.imei, journal);
    socketClient.sendServerCommand(cmd);
  };

  const sendFallToggle = (enabled: boolean) => {
    const journal = generateJournalNumber();
    const cmd = buildFallToggleCommand(telemetry.imei, enabled, journal);
    socketClient.sendServerCommand(cmd);
  };

  const sendSetSosNumbers = () => {
    const journal = generateJournalNumber();
    const cmd = buildSetSosCommand(telemetry.imei, sosContacts[0], sosContacts[1], sosContacts[2], journal);
    socketClient.sendServerCommand(cmd);
  };

  const sendRawCustomCommand = () => {
    if (!customRawCommand.trim()) return;
    let payload = customRawCommand.trim();
    if (!payload.startsWith('IW')) payload = 'IW' + payload;
    if (!payload.endsWith('#')) payload = payload + '#';
    socketClient.sendServerCommand(payload);
    setCustomRawCommand('');
  };

  const acknowledgeCurrentAlarm = (alarmId: string) => {
    socketClient.acknowledgeAlarm(alarmId);
  };

  return (
    <div className="space-y-6">
      {/* High Priority Emergency Alarm HUD */}
      {activeUnackAlarm && (
        <div className="relative overflow-hidden bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white rounded-2xl p-5 shadow-2xl border-2 border-red-400 animate-pulse">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                <ShieldAlert className="w-8 h-8 text-white animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-white text-red-700 text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                    CRITICAL ALARM (AP10)
                  </span>
                  <span className="text-xs opacity-80 font-mono">
                    {new Date(activeUnackAlarm.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <h2 className="text-xl font-black tracking-tight mt-0.5">
                  {activeUnackAlarm.type === 'SOS'
                    ? 'EMERGENCY SOS TRIGGERED BY WEARER'
                    : 'HARD FALL DETECTED BY WATCH SENSORS'}
                </h2>
                <p className="text-xs text-red-100 mt-1 flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {activeUnackAlarm.latitude.toFixed(6)}°N, {activeUnackAlarm.longitude.toFixed(6)}°E
                  </span>
                  <span>|</span>
                  <span>IMEI: {activeUnackAlarm.imei}</span>
                  <span>|</span>
                  <span>HR: {activeUnackAlarm.heartRate} bpm</span>
                  <span>|</span>
                  <span>SpO2: {activeUnackAlarm.spo2}%</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-center">
              <button
                onClick={() => setSoundMuted(!soundMuted)}
                className="p-2.5 bg-black/20 hover:bg-black/30 text-white rounded-xl cursor-pointer"
                title={soundMuted ? 'Unmute Siren' : 'Mute Siren'}
              >
                {soundMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <button
                id="admin-ack-alarm-btn"
                onClick={() => acknowledgeCurrentAlarm(activeUnackAlarm.id)}
                className="px-5 py-2.5 bg-white text-red-700 hover:bg-red-50 rounded-xl font-bold text-sm shadow-md cursor-pointer flex items-center gap-2 active:scale-95 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ACKNOWLEDGE &amp; DISPATCH</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Info Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-950/60 rounded-xl text-blue-600 dark:text-blue-400">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Assistance Center Monitoring Console
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  telemetry.isAuthenticated
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                }`}
              >
                {telemetry.isAuthenticated ? 'LINK ACTIVE' : 'AWAITING LOGIN'}
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Terminal: IMEI <span className="font-mono font-semibold">{telemetry.imei}</span> | Model: GS-Watch Pro V1.1
            </p>
          </div>
        </div>

        {/* Server stats */}
        <div className="flex items-center gap-4 text-xs">
          <div className="text-right">
            <span className="text-zinc-400 block text-[10px] uppercase font-bold tracking-wider">Protocol TCP Port</span>
            <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">
              {stats?.tcpPort || 5088} (Active: {stats?.activeTcpClients || 0})
            </span>
          </div>
          <div className="text-right border-l border-zinc-200 dark:border-zinc-700 pl-4">
            <span className="text-zinc-400 block text-[10px] uppercase font-bold tracking-wider">Packets Processed</span>
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
              {stats?.totalPacketsProcessed || packetLogs.length}
            </span>
          </div>
          <div className="text-right border-l border-zinc-200 dark:border-zinc-700 pl-4">
            <span className="text-zinc-400 block text-[10px] uppercase font-bold tracking-wider">Last Heartbeat</span>
            <span className="font-mono text-zinc-700 dark:text-zinc-300">
              {telemetry.lastHeartbeat ? new Date(telemetry.lastHeartbeat).toLocaleTimeString() : 'Never'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setSelectedTab('vitals')}
          className={`px-4 py-2 font-medium text-sm border-b-2 cursor-pointer transition-colors ${
            selectedTab === 'vitals'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          Live Telemetry &amp; Vitals
        </button>
        <button
          onClick={() => setSelectedTab('commands')}
          className={`px-4 py-2 font-medium text-sm border-b-2 cursor-pointer transition-colors ${
            selectedTab === 'commands'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          Command Center (BP Commands)
        </button>
        <button
          onClick={() => setSelectedTab('map')}
          className={`px-4 py-2 font-medium text-sm border-b-2 cursor-pointer transition-colors ${
            selectedTab === 'map'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          GPS &amp; LBS Location Tracking
        </button>
        <button
          onClick={() => setSelectedTab('alarms')}
          className={`px-4 py-2 font-medium text-sm border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
            selectedTab === 'alarms'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <span>Alarm History</span>
          {alarms.length > 0 && (
            <span className="px-1.5 py-0.2 bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-full text-[10px] font-bold">
              {alarms.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Live Telemetry Grid */}
      {selectedTab === 'vitals' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Heart Rate */}
            <div className={`bg-white dark:bg-zinc-900 p-4 rounded-2xl border shadow-sm relative overflow-hidden transition-all ${
              telemetry.heartRate >= 120
                ? 'border-rose-500 ring-2 ring-rose-500/50 bg-rose-500/5 animate-pulse'
                : telemetry.heartRate <= 45 && telemetry.heartRate > 0
                  ? 'border-blue-500 ring-2 ring-blue-500/50 bg-blue-500/5'
                  : telemetry.heartRate > 100
                    ? 'border-amber-500/60'
                    : 'border-zinc-200 dark:border-zinc-800'
            }`}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Heart Rate</span>
                <Heart className={`w-4 h-4 ${
                  telemetry.heartRate >= 120
                    ? 'text-rose-600 animate-bounce'
                    : 'text-rose-500 animate-pulse'
                }`} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-3xl font-black font-mono ${
                  telemetry.heartRate >= 120
                    ? 'text-rose-600 dark:text-rose-400'
                    : telemetry.heartRate <= 45 && telemetry.heartRate > 0
                      ? 'text-blue-600 dark:text-blue-400'
                      : telemetry.heartRate > 100
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {telemetry.heartRate}
                </span>
                <span className="text-xs text-zinc-400">bpm</span>
              </div>
              <div className="mt-2 text-[11px] text-zinc-400 flex items-center justify-between">
                <span>Source: APHP/AP49</span>
                <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] uppercase ${
                  telemetry.heartRate >= 140
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 animate-pulse ring-1 ring-rose-500'
                    : telemetry.heartRate >= 120
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      : telemetry.heartRate > 100
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : telemetry.heartRate <= 45 && telemetry.heartRate > 0
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                }`}>
                  {telemetry.heartRate >= 140
                    ? '⚡ Severe Tachycardia'
                    : telemetry.heartRate >= 120
                      ? '⚠️ Tachycardia'
                      : telemetry.heartRate > 100
                        ? 'Elevated'
                        : telemetry.heartRate <= 45 && telemetry.heartRate > 0
                          ? '⚠️ Bradycardia'
                          : 'Normal'}
                </span>
              </div>
            </div>

            {/* Blood Pressure */}
            <div className={`bg-white dark:bg-zinc-900 p-4 rounded-2xl border shadow-sm transition-all ${
              telemetry.sbp >= 180 || telemetry.dbp >= 110
                ? 'border-rose-500 ring-2 ring-rose-500/50 bg-rose-500/5'
                : telemetry.sbp >= 140 || telemetry.dbp >= 90
                  ? 'border-amber-500/60'
                  : 'border-zinc-200 dark:border-zinc-800'
            }`}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Blood Pressure</span>
                <Activity className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-zinc-800 dark:text-zinc-100 font-mono">
                  {telemetry.sbp}/{telemetry.dbp}
                </span>
                <span className="text-[10px] text-zinc-400">mmHg</span>
              </div>
              <div className="mt-2 text-[11px] text-zinc-400 flex items-center justify-between">
                <span>SBP/DBP</span>
                <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] uppercase ${
                  telemetry.sbp >= 180 || telemetry.dbp >= 110
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 animate-pulse'
                    : telemetry.sbp >= 140 || telemetry.dbp >= 90
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : telemetry.sbp < 90 || telemetry.dbp < 60
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                }`}>
                  {telemetry.sbp >= 180 || telemetry.dbp >= 110
                    ? '⚠️ Crisis (≥180/110)'
                    : telemetry.sbp >= 140 || telemetry.dbp >= 90
                      ? 'Stage 2 High'
                      : telemetry.sbp >= 130 || telemetry.dbp >= 80
                        ? 'Pre-High'
                        : telemetry.sbp < 90 || telemetry.dbp < 60
                          ? 'Hypotension'
                          : 'Optimal'}
                </span>
              </div>
            </div>

            {/* SpO2 */}
            <div className={`bg-white dark:bg-zinc-900 p-4 rounded-2xl border shadow-sm transition-all ${
              telemetry.spo2 < 90 && telemetry.spo2 > 0
                ? 'border-rose-500 ring-2 ring-rose-500/50 bg-rose-500/5 animate-pulse'
                : telemetry.spo2 < 95 && telemetry.spo2 > 0
                  ? 'border-amber-500/60'
                  : 'border-zinc-200 dark:border-zinc-800'
            }`}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Blood Oxygen</span>
                <Activity className="w-4 h-4 text-cyan-500" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-3xl font-black font-mono ${
                  telemetry.spo2 < 90
                    ? 'text-rose-500'
                    : telemetry.spo2 < 95
                      ? 'text-amber-500'
                      : 'text-cyan-500'
                }`}>
                  {telemetry.spo2}
                </span>
                <span className="text-xs text-zinc-400">%</span>
              </div>
              <div className="mt-2 text-[11px] text-zinc-400 flex items-center justify-between">
                <span>SpO2 Level</span>
                <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] uppercase ${
                  telemetry.spo2 < 90
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 animate-pulse'
                    : telemetry.spo2 < 95
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                }`}>
                  {telemetry.spo2 < 90
                    ? '⚠️ Critical Hypoxia'
                    : telemetry.spo2 < 95
                      ? 'Low (<95%)'
                      : 'Healthy'}
                </span>
              </div>
            </div>

            {/* Temperature */}
            <div className={`bg-white dark:bg-zinc-900 p-4 rounded-2xl border shadow-sm transition-all ${
              telemetry.temperature >= 38.8 || (telemetry.temperature <= 35.0 && telemetry.temperature > 0)
                ? 'border-rose-500 ring-2 ring-rose-500/50 bg-rose-500/5'
                : telemetry.temperature >= 37.5
                  ? 'border-amber-500/60'
                  : 'border-zinc-200 dark:border-zinc-800'
            }`}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Body Temp</span>
                <Thermometer className={`w-4 h-4 ${
                  telemetry.temperature >= 38.8 ? 'text-rose-500' : 'text-emerald-500'
                }`} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-3xl font-black font-mono ${
                  telemetry.temperature >= 38.8
                    ? 'text-rose-500'
                    : telemetry.temperature >= 37.5
                      ? 'text-amber-500'
                      : 'text-emerald-500'
                }`}>
                  {telemetry.temperature.toFixed(1)}
                </span>
                <span className="text-xs text-zinc-400">°C</span>
              </div>
              <div className="mt-2 text-[11px] text-zinc-400 flex items-center justify-between">
                <span>Source: AP50/APHP</span>
                <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] uppercase ${
                  telemetry.temperature >= 38.8
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    : telemetry.temperature >= 37.5
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : telemetry.temperature <= 35.0 && telemetry.temperature > 0
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                }`}>
                  {telemetry.temperature >= 38.8
                    ? '⚠️ High Fever'
                    : telemetry.temperature >= 37.5
                      ? 'Elevated'
                      : telemetry.temperature <= 35.0 && telemetry.temperature > 0
                        ? 'Hypothermia'
                        : 'Normal'}
                </span>
              </div>
            </div>

            {/* Steps / Pedometry */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Step Count</span>
                <Activity className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                  {telemetry.steps.toLocaleString()}
                </span>
              </div>
              <div className="mt-2 text-[11px] text-zinc-400 flex items-center justify-between">
                <span>Rolls: {telemetry.rolls}</span>
                <span>Goal: 55%</span>
              </div>
            </div>

            {/* Device Battery */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Battery</span>
                <Zap className={`w-4 h-4 ${telemetry.battery <= 20 ? 'text-red-500 animate-pulse' : 'text-amber-500'}`} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-zinc-800 dark:text-zinc-100 font-mono">{telemetry.battery}</span>
                <span className="text-xs text-zinc-400">%</span>
              </div>
              <div className="mt-2 text-[11px] text-zinc-400 flex items-center justify-between">
                <span>GSM: {telemetry.gsmSignal}%</span>
                <span>Sats: {telemetry.satellites}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions Bar for Operator */}
          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Live Operator Quick Commands</h3>
              <p className="text-xs text-zinc-500">Trigger standard BP command packets directly down the TCP socket</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                id="admin-request-hr-btn"
                onClick={sendRequestHeartRate}
                className="px-3 py-2 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Heart className="w-3.5 h-3.5 text-rose-500" />
                <span>Request HR (BPXL)</span>
              </button>

              <button
                id="admin-locate-btn"
                onClick={sendLocateCommand}
                className="px-3 py-2 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Crosshair className="w-3.5 h-3.5 text-blue-500" />
                <span>Locate GPS (BP16)</span>
              </button>

              <button
                onClick={() => setSelectedTab('commands')}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Open Full Command Center</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Full Command Center */}
      {selectedTab === 'commands' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section A: Health Telemetry Requests & Interval Configuration */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <span>Telemetry Measurement Triggers</span>
            </h3>

            {/* Instant HR (BPXL) */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                  Instant Heart Rate Test (BPXL)
                </span>
                <span className="text-[11px] text-zinc-500">
                  Sends: <code className="font-mono text-zinc-700 dark:text-zinc-300">IWBPXL,{telemetry.imei},080835#</code>
                </span>
              </div>
              <button
                onClick={sendRequestHeartRate}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1"
              >
                <Send className="w-3 h-3" />
                <span>Send BPXL</span>
              </button>
            </div>

            {/* Set Auto-Test Interval (BP86) */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Set Auto-HR Measurement Interval (BP86)
                </span>
                <span className="text-[10px] font-mono text-indigo-500 font-bold">IWBP86#</span>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={hrIntervalMinutes}
                  onChange={(e) => setHrIntervalMinutes(parseInt(e.target.value))}
                  className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-xs rounded-lg px-2.5 py-1.5"
                >
                  <option value={15}>Every 15 minutes</option>
                  <option value={30}>Every 30 minutes</option>
                  <option value={60}>Every 60 minutes</option>
                  <option value={720}>Every 720 minutes (12 hours)</option>
                  <option value={1440}>Every 1440 minutes (24 hours)</option>
                </select>
                <button
                  onClick={() => setAutoHrEnabled(!autoHrEnabled)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    autoHrEnabled ? 'bg-emerald-600 text-white' : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-700'
                  }`}
                >
                  {autoHrEnabled ? 'Enabled (1)' : 'Disabled (0)'}
                </button>
                <button
                  id="admin-send-bp86-btn"
                  onClick={sendSetAutoHrInterval}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer ml-auto"
                >
                  Save BP86
                </button>
              </div>
            </div>

            {/* Fall Detection Toggle (BP76) */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                  Fall Detection Switch (BP76)
                </span>
                <span className="text-[11px] text-zinc-500">
                  Status: {telemetry.fallDetectionEnabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <button
                onClick={() => sendFallToggle(!telemetry.fallDetectionEnabled)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  telemetry.fallDetectionEnabled
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-zinc-600 hover:bg-zinc-500 text-white'
                }`}
              >
                Toggle {telemetry.fallDetectionEnabled ? 'OFF' : 'ON'}
              </button>
            </div>
          </div>

          {/* Section B: Messaging & Communication (BP40) */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <MessageSquare className="w-4 h-4 text-cyan-500" />
              <span>Send Text Message to Watch (BP40 Unicode)</span>
            </h3>

            <div className="space-y-2">
              <label className="text-xs text-zinc-500">Message content (auto-encoded to 4-hex Unicode):</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customMsg}
                  onChange={(e) => setCustomMsg(e.target.value)}
                  placeholder="Type message to display on watch..."
                  className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-800 dark:text-zinc-100"
                />
                <button
                  id="admin-send-bp40-btn"
                  onClick={sendTextMessage}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </div>
              <div className="flex gap-1.5 flex-wrap text-[10px]">
                <button
                  onClick={() => setCustomMsg('Are you ok?')}
                  className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded border text-zinc-600 dark:text-zinc-400 hover:text-white"
                >
                  "Are you ok?"
                </button>
                <button
                  onClick={() => setCustomMsg('Please take your medication.')}
                  className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded border text-zinc-600 dark:text-zinc-400 hover:text-white"
                >
                  "Please take medication"
                </button>
                <button
                  onClick={() => setCustomMsg('Assistance unit en route.')}
                  className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded border text-zinc-600 dark:text-zinc-400 hover:text-white"
                >
                  "Assistance unit en route"
                </button>
              </div>
            </div>

            {/* Raw String Terminal Box */}
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
                Custom Raw Protocol Packet Injector
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customRawCommand}
                  onChange={(e) => setCustomRawCommand(e.target.value)}
                  placeholder="e.g. IWBP18,353456789012345,080835#"
                  className="flex-1 font-mono text-xs bg-zinc-950 text-emerald-400 border border-zinc-800 rounded-xl px-3 py-2"
                />
                <button
                  onClick={sendRawCustomCommand}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Transmit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: GPS Tracking Map View */}
      {selectedTab === 'map' && (
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-500" />
                <span>Real-Time GPS &amp; LBS Geolocation Radar</span>
              </h3>
              <p className="text-xs text-zinc-500">
                Extracted from AP01 &amp; AP10 packets | Accuracy: {telemetry.satellites >= 6 ? '±3m (GPS 3D Fix)' : '±50m (LBS Base)'}
              </p>
            </div>
            <button
              onClick={sendLocateCommand}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Poll GPS Fix (BP16)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Visual Radar Map Grid */}
            <div className="md:col-span-2 relative h-72 bg-gradient-to-br from-slate-900 via-zinc-900 to-black rounded-2xl border border-zinc-700 overflow-hidden flex items-center justify-center shadow-inner">
              {/* Radar Grid Circles */}
              <div className="absolute w-64 h-64 rounded-full border border-emerald-500/20"></div>
              <div className="absolute w-44 h-44 rounded-full border border-emerald-500/30"></div>
              <div className="absolute w-24 h-24 rounded-full border border-emerald-500/40"></div>
              <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] opacity-15"></div>

              {/* Axis crosshairs */}
              <div className="absolute inset-x-0 top-1/2 h-[1px] bg-emerald-500/20"></div>
              <div className="absolute inset-y-0 left-1/2 w-[1px] bg-emerald-500/20"></div>

              {/* Device Pin on Map */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="relative flex items-center justify-center">
                  <span className="absolute w-10 h-10 bg-rose-500/30 rounded-full animate-ping"></span>
                  <div className="w-6 h-6 bg-rose-600 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
                    <MapPin className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
                <div className="mt-2 bg-black/80 backdrop-blur-md px-3 py-1 rounded-full border border-zinc-700 text-center">
                  <span className="font-mono text-xs font-bold text-white block">
                    {telemetry.latitude.toFixed(4)}°N, {telemetry.longitude.toFixed(4)}°E
                  </span>
                  <span className="text-[10px] text-emerald-400 font-medium">Wearer Active</span>
                </div>
              </div>

              {/* Map overlay tags */}
              <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-mono text-zinc-300 border border-zinc-800">
                Speed: {telemetry.speed} km/h | Heading: {telemetry.directionAngle}°
              </div>
              <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-mono text-zinc-300 border border-zinc-800">
                Sector: Civic District (Home WiFi Zone)
              </div>
            </div>

            {/* Geofence & Details Panel */}
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-1">
                <span className="font-bold text-zinc-700 dark:text-zinc-300 block">Resolved Address</span>
                <p className="text-zinc-600 dark:text-zinc-400 leading-snug">
                  Civic Square, High Street District, Unit 4B (Home Zone)
                </p>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-1">
                <span className="font-bold text-zinc-700 dark:text-zinc-300 block">Cell Tower / LBS Data</span>
                <p className="text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                  MCC: 460 | MNC: 0 | LAC: 9520 | CID: 3671
                </p>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-1">
                <span className="font-bold text-zinc-700 dark:text-zinc-300 block">Nearby WiFi MACs</span>
                <p className="text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                  HOME|74-DE-2B-44-88-8C|97dBm
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Alarm History */}
      {selectedTab === 'alarms' && (
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              <span>Alarm &amp; Incident Log (AP10 Packets)</span>
            </h3>
            {alarms.length > 0 && (
              <button
                onClick={() => socketClient.clearAlarms()}
                className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>

          {alarms.length === 0 ? (
            <div className="text-center py-10 text-zinc-500 text-xs">
              No alarms recorded yet. Press "TRIGGER SOS" on the Watch UI to test.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 font-semibold">
                    <th className="pb-2">Time</th>
                    <th className="pb-2">Alarm Type</th>
                    <th className="pb-2">Location Coordinates</th>
                    <th className="pb-2">Vitals at Trigger</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {alarms.map((alarm) => (
                    <tr key={alarm.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <td className="py-2.5 font-mono text-zinc-600 dark:text-zinc-400">
                        {new Date(alarm.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 font-bold">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] ${
                            alarm.type === 'SOS'
                              ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {alarm.type === 'SOS' ? 'SOS EMERGENCY' : 'FALL DOWN'}
                        </span>
                      </td>
                      <td className="py-2.5 font-mono text-zinc-600 dark:text-zinc-400">
                        {alarm.latitude.toFixed(4)}°N, {alarm.longitude.toFixed(4)}°E
                      </td>
                      <td className="py-2.5 font-mono text-zinc-600 dark:text-zinc-400">
                        HR: {alarm.heartRate} | SpO2: {alarm.spo2}%
                      </td>
                      <td className="py-2.5">
                        {alarm.acknowledged ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Acknowledged</span>
                          </span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400 font-bold animate-pulse">
                            ACTIVE EMERGENCY
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        {!alarm.acknowledged && (
                          <button
                            onClick={() => acknowledgeCurrentAlarm(alarm.id)}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[11px] font-semibold cursor-pointer"
                          >
                            Acknowledge
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
