import React, { useState, useEffect } from 'react';
import { WatchTelemetry, PacketLogEntry, AlarmEvent, ServerStats } from './types.ts';
import { socketClient } from './lib/socket.ts';
import { WatchUI } from './components/WatchUI.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { PacketSniffer } from './components/PacketSniffer.tsx';
import { ProtocolDocsModal } from './components/ProtocolDocsModal.tsx';
import {
  Watch,
  LayoutDashboard,
  Columns2,
  Terminal,
  BookOpen,
  Wifi,
  Radio,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';

export default function App() {
  const [viewMode, setViewMode] = useState<'split' | 'watch' | 'admin' | 'sniffer'>('split');
  const [showDocsModal, setShowDocsModal] = useState<boolean>(false);
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);

  const [telemetry, setTelemetry] = useState<WatchTelemetry>({
    imei: '353456789012345',
    isOnline: true,
    isAuthenticated: true,
    lastHeartbeat: new Date().toISOString(),
    lastPacketTime: new Date().toISOString(),
    heartRate: 72,
    sbp: 120,
    dbp: 80,
    spo2: 98,
    bloodSugar: 92,
    temperature: 36.6,
    steps: 5555,
    rolls: 30,
    battery: 88,
    satellites: 9,
    gsmSignal: 65,
    latitude: 22.549676,
    longitude: 114.082258,
    speed: 0.1,
    directionAngle: 323.87,
    gpsValid: true,
    addressText: 'Assistance Center Sector 4, Civic Plaza',
    wifiSsid: 'HOME_SECURE_WIFI',
    alarmState: '00',
    alarmLabel: 'Normal',
    workingMode: 2,
    autoHrInterval: 720,
    autoHrEnabled: true,
    autoTempInterval: 720,
    autoTempEnabled: false,
    fallDetectionEnabled: true,
    fallSensitivity: 2,
    sosNumbers: ['+1-800-555-0199', '+1-800-555-0144', '+1-800-555-0100'],
    unreadMessages: [],
    powerState: 'ON',
  });

  const [packetLogs, setPacketLogs] = useState<PacketLogEntry[]>([
    {
      id: 'init_1',
      timestamp: new Date().toISOString(),
      raw: 'IWAP00353456789012345#',
      command: 'AP00',
      direction: 'DEVICE->SERVER',
      description: 'Login Package from IMEI 353456789012345',
      parsed: { imei: '353456789012345' },
      transport: 'TCP',
    },
    {
      id: 'init_2',
      timestamp: new Date().toISOString(),
      raw: 'IWBP00,20260903125223,1#',
      command: 'BP00',
      direction: 'SERVER->DEVICE',
      description: 'Login Response: UTC Time 20260903125223, Timezone 1',
      parsed: { serverTime: '20260903125223', timezone: '1' },
      transport: 'TCP',
    },
    {
      id: 'init_3',
      timestamp: new Date().toISOString(),
      raw: 'IWAP03,06000908000102,5555,30#',
      command: 'AP03',
      direction: 'DEVICE->SERVER',
      description: 'Heartbeat: Battery 80%, Steps 5555, Satellites 9, GSM 60%',
      parsed: { battery: 80, steps: 5555, satellites: 9, gsmSignal: 60 },
      transport: 'TCP',
    },
    {
      id: 'init_4',
      timestamp: new Date().toISOString(),
      raw: 'IWBP03#',
      command: 'BP03',
      direction: 'SERVER->DEVICE',
      description: 'Heartbeat Acknowledged',
      parsed: {},
      transport: 'TCP',
    },
  ]);

  const [alarms, setAlarms] = useState<AlarmEvent[]>([]);
  const [stats, setStats] = useState<ServerStats | null>(null);

  // Hydrate initial data via REST API
  useEffect(() => {
    fetch('/api/telemetry')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.imei) setTelemetry(data);
      })
      .catch(() => {});

    fetch('/api/packets')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setPacketLogs(data);
      })
      .catch(() => {});

    fetch('/api/alarms')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setAlarms(data);
      })
      .catch(() => {});

    fetch('/api/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data) setStats(data);
      })
      .catch(() => {});
  }, []);

  // Listen to WebSocket events
  useEffect(() => {
    setIsWsConnected(socketClient.getStatus());

    const unsubConn = socketClient.on('connection_change', (connected: boolean) => {
      setIsWsConnected(connected);
    });

    const unsubInit = socketClient.on('INIT', (data: any) => {
      if (data.telemetry) setTelemetry(data.telemetry);
      if (data.packets) setPacketLogs(data.packets);
      if (data.alarms) setAlarms(data.alarms);
      if (data.stats) setStats(data.stats);
    });

    const unsubPacket = socketClient.on('PACKET_LOG', (data: any) => {
      if (data.packet) {
        setPacketLogs((prev) => [data.packet, ...prev.slice(0, 250)]);
      }
    });

    const unsubTelemetry = socketClient.on('TELEMETRY_UPDATE', (data: any) => {
      if (data.telemetry) {
        setTelemetry(data.telemetry);
      }
    });

    const unsubAlarm = socketClient.on('ALARM_EVENT', (data: any) => {
      if (data.alarm) {
        setAlarms((prev) => [data.alarm, ...prev]);
      }
    });

    const unsubAlarmAck = socketClient.on('ALARM_ACK', (data: any) => {
      if (data.alarm) {
        setAlarms((prev) =>
          prev.map((a) => (a.id === data.alarm.id ? { ...a, acknowledged: true } : a))
        );
      }
    });

    const unsubAlarmsCleared = socketClient.on('ALARMS_CLEARED', () => {
      setAlarms((prev) => prev.map((a) => ({ ...a, acknowledged: true })));
    });

    return () => {
      unsubConn();
      unsubInit();
      unsubPacket();
      unsubTelemetry();
      unsubAlarm();
      unsubAlarmAck();
      unsubAlarmsCleared();
    };
  }, []);

  const activeAlarmCount = alarms.filter((a) => !a.acknowledged && (a.type === 'SOS' || a.type === 'FALL')).length;

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col antialiased">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Watch className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-zinc-900 dark:text-white">
                  GPS &amp; Health Smartwatch Protocol
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
                  V1.1
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">
                Full-Stack TCP/IP String Protocol &amp; Real-Time Socket Simulator
              </p>
            </div>
          </div>

          {/* View Switcher Tabs */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs">
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 cursor-pointer transition-all ${
                viewMode === 'split'
                  ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Split Simulation</span>
            </button>

            <button
              onClick={() => setViewMode('watch')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 cursor-pointer transition-all ${
                viewMode === 'watch'
                  ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <Watch className="w-3.5 h-3.5" />
              <span>Watch UI</span>
            </button>

            <button
              onClick={() => setViewMode('admin')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 cursor-pointer transition-all ${
                viewMode === 'admin'
                  ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Assistance Center</span>
              {activeAlarmCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              )}
            </button>

            <button
              onClick={() => setViewMode('sniffer')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 cursor-pointer transition-all ${
                viewMode === 'sniffer'
                  ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span className="hidden md:inline">TCP Sniffer</span>
            </button>
          </div>

          {/* Right Status & Docs Actions */}
          <div className="flex items-center gap-2">
            {/* Realtime WebSocket pill */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                isWsConnected
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
              }`}
              title="Port 3000 WebSockets"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isWsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="text-[11px]">{isWsConnected ? 'Socket Live' : 'Connecting'}</span>
            </div>

            {/* Protocol reference doc button */}
            <button
              onClick={() => setShowDocsModal(true)}
              className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl cursor-pointer border border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5 text-xs font-semibold"
              title="Open Protocol Specification Sheet"
            >
              <BookOpen className="w-4 h-4 text-blue-500" />
              <span className="hidden lg:inline">Protocol V1.1 Spec</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Split View: Watch Left, Admin Right, Sniffer Bottom */}
        {viewMode === 'split' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Watch UI Column (xl: 5 cols) */}
              <div className="xl:col-span-5">
                <div className="sticky top-20">
                  <WatchUI telemetry={telemetry} packetLogs={packetLogs} />
                </div>
              </div>

              {/* Admin Dashboard Column (xl: 7 cols) */}
              <div className="xl:col-span-7">
                <AdminDashboard
                  telemetry={telemetry}
                  packetLogs={packetLogs}
                  alarms={alarms}
                  stats={stats}
                />
              </div>
            </div>

            {/* Full-width Packet Sniffer Feed */}
            <div className="mt-8">
              <PacketSniffer
                packetLogs={packetLogs}
                onClearLogs={() => setPacketLogs([])}
              />
            </div>
          </div>
        )}

        {/* Watch Only View */}
        {viewMode === 'watch' && (
          <div className="py-4">
            <WatchUI telemetry={telemetry} packetLogs={packetLogs} />
          </div>
        )}

        {/* Admin Dashboard Only View */}
        {viewMode === 'admin' && (
          <div className="space-y-6">
            <AdminDashboard
              telemetry={telemetry}
              packetLogs={packetLogs}
              alarms={alarms}
              stats={stats}
            />
            <PacketSniffer
              packetLogs={packetLogs}
              onClearLogs={() => setPacketLogs([])}
            />
          </div>
        )}

        {/* Sniffer Only View */}
        {viewMode === 'sniffer' && (
          <div className="py-2">
            <PacketSniffer
              packetLogs={packetLogs}
              onClearLogs={() => setPacketLogs([])}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-4 px-6 text-center text-xs text-zinc-500 bg-white dark:bg-zinc-900">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>GPS &amp; Health Smartwatch Protocol V1.1 Simulator &amp; TCP Sniffer</span>
          <span className="font-mono text-[11px] text-zinc-400">
            TCP/IP String Protocol: IW[CMD][PAYLOAD]# | Internal Port 5088 | WebSockets Port 3000
          </span>
        </div>
      </footer>

      {/* Protocol Spec Documentation Modal */}
      <ProtocolDocsModal
        isOpen={showDocsModal}
        onClose={() => setShowDocsModal(false)}
      />
    </div>
  );
}
