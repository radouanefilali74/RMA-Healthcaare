export type PacketDirection = 'DEVICE->SERVER' | 'SERVER->DEVICE';

export interface PacketLogEntry {
  id: string;
  timestamp: string;
  raw: string;
  command: string;
  direction: PacketDirection;
  description: string;
  parsed: Record<string, any>;
  transport: 'TCP' | 'VIRTUAL_TCP';
}

export interface WatchTelemetry {
  imei: string;
  isOnline: boolean;
  isAuthenticated: boolean;
  lastHeartbeat: string | null;
  lastPacketTime: string | null;
  heartRate: number;
  sbp: number;
  dbp: number;
  spo2: number;
  bloodSugar: number;
  temperature: number;
  steps: number;
  rolls: number;
  battery: number;
  satellites: number;
  gsmSignal: number;
  latitude: number;
  longitude: number;
  speed: number;
  directionAngle: number;
  gpsValid: boolean;
  addressText: string;
  wifiSsid: string;
  alarmState: '00' | '01' | '03' | '05' | '06';
  alarmLabel: string;
  workingMode: number;
  autoHrInterval: number; // minutes
  autoHrEnabled: boolean;
  autoTempInterval: number;
  autoTempEnabled: boolean;
  fallDetectionEnabled: boolean;
  fallSensitivity: number;
  sosNumbers: [string, string, string];
  unreadMessages: Array<{
    id: string;
    timestamp: string;
    sender: string;
    text: string;
  }>;
  powerState: 'ON' | 'REBOOTING' | 'OFF';
}

export interface AlarmEvent {
  id: string;
  timestamp: string;
  type: 'SOS' | 'FALL' | 'NOT_WORN';
  imei: string;
  latitude: number;
  longitude: number;
  address: string;
  heartRate: number;
  sbp: number;
  dbp: number;
  spo2: number;
  temperature: number;
  acknowledged: boolean;
  acknowledgedAt?: string;
}

export interface ServerStats {
  tcpPort: number;
  activeTcpClients: number;
  totalPacketsProcessed: number;
  serverUtcTime: string;
  uptimeSeconds: number;
}
