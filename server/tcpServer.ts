import net from 'net';
import { EventEmitter } from 'events';
import {
  parseRawPacket,
  buildLoginResponse,
  buildHeartbeatResponse,
  buildHealthResponse,
  buildAlarmResponse,
  buildHealthDataPacket,
  buildAlarmPacket,
  generateJournalNumber,
  getServerTimestampUTC,
  encodeUnicodeHex,
} from './protocol.ts';
import { WatchTelemetry, PacketLogEntry, AlarmEvent } from '../src/types.ts';

export class TcpProtocolManager extends EventEmitter {
  private tcpServer: net.Server | null = null;
  private tcpPort: number = 5088;
  private activeSockets: Set<net.Socket> = new Set();
  private socketBuffers: Map<net.Socket, string> = new Map();

  private packetLogs: PacketLogEntry[] = [];
  private maxLogs: number = 250;
  private totalPacketsProcessed: number = 0;
  private startTime: number = Date.now();

  private telemetry: WatchTelemetry = {
    imei: '353456789012345',
    isOnline: false,
    isAuthenticated: false,
    lastHeartbeat: null,
    lastPacketTime: null,
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
  };

  private activeAlarms: AlarmEvent[] = [];

  constructor(port: number = 5088) {
    super();
    this.tcpPort = port;
  }

  public startTcpServer(): void {
    if (this.tcpServer) return;

    this.tcpServer = net.createServer((socket) => {
      this.activeSockets.add(socket);
      this.socketBuffers.set(socket, '');
      console.log(`[TCP Server] Client connected from ${socket.remoteAddress}:${socket.remotePort}`);

      socket.on('data', (chunk) => {
        let buffer = (this.socketBuffers.get(socket) || '') + chunk.toString('utf-8');

        // Extract packets delimited by '#'
        let endIndex: number;
        while ((endIndex = buffer.indexOf('#')) !== -1) {
          const rawPacket = buffer.substring(0, endIndex + 1).trim();
          buffer = buffer.substring(endIndex + 1);

          if (rawPacket.startsWith('IW') && rawPacket.endsWith('#')) {
            this.handleDevicePacket(rawPacket, 'TCP', socket);
          }
        }
        this.socketBuffers.set(socket, buffer);
      });

      socket.on('close', () => {
        this.activeSockets.delete(socket);
        this.socketBuffers.delete(socket);
        console.log(`[TCP Server] Client disconnected`);
      });

      socket.on('error', (err) => {
        console.error(`[TCP Server] Socket error: ${err.message}`);
        this.activeSockets.delete(socket);
        this.socketBuffers.delete(socket);
      });
    });

    this.tcpServer.on('error', (err: any) => {
      console.warn(`[TCP Server] Server error (port ${this.tcpPort}): ${err.message}`);
    });

    this.tcpServer.listen(this.tcpPort, '127.0.0.1', () => {
      console.log(`[TCP Server] Listening for GPS watch packets on 127.0.0.1:${this.tcpPort}`);
    });
  }

  public getTelemetry(): WatchTelemetry {
    return { ...this.telemetry };
  }

  public getPacketLogs(): PacketLogEntry[] {
    return [...this.packetLogs];
  }

  public getActiveAlarms(): AlarmEvent[] {
    return [...this.activeAlarms];
  }

  public getStats() {
    return {
      tcpPort: this.tcpPort,
      activeTcpClients: this.activeSockets.size,
      totalPacketsProcessed: this.totalPacketsProcessed,
      serverUtcTime: getServerTimestampUTC(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  public updateTelemetryMetric(updates: Partial<WatchTelemetry>): WatchTelemetry {
    this.telemetry = {
      ...this.telemetry,
      ...updates,
    };
    this.emit('telemetry', this.telemetry);
    return this.telemetry;
  }

  public logPacket(
    direction: 'DEVICE->SERVER' | 'SERVER->DEVICE',
    raw: string,
    command: string,
    description: string,
    parsed: Record<string, any> = {},
    transport: 'TCP' | 'VIRTUAL_TCP' = 'TCP'
  ): PacketLogEntry {
    this.totalPacketsProcessed++;
    const now = new Date();
    const entry: PacketLogEntry = {
      id: `pkt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: now.toISOString(),
      raw,
      command,
      direction,
      description,
      parsed,
      transport,
    };

    this.packetLogs.unshift(entry);
    if (this.packetLogs.length > this.maxLogs) {
      this.packetLogs.pop();
    }

    this.emit('packet', entry);
    return entry;
  }

  /**
   * Processes a packet coming from the Watch Device (APxx commands)
   */
  public handleDevicePacket(
    rawPacket: string,
    transport: 'TCP' | 'VIRTUAL_TCP' = 'TCP',
    originSocket?: net.Socket
  ): { reply?: string; parsed: any } {
    const parsed = parseRawPacket(rawPacket);
    if (!parsed) {
      console.warn(`[TCP Server] Invalid packet rejected: ${rawPacket}`);
      return { parsed: null };
    }

    // Log packet arrival
    this.logPacket(
      'DEVICE->SERVER',
      rawPacket,
      parsed.command,
      parsed.description,
      parsed.data,
      transport
    );

    this.telemetry.lastPacketTime = new Date().toISOString();
    let replyPayload: string | undefined;

    switch (parsed.command) {
      case 'AP00': {
        // Login package: IWAP00<IMEI>#
        const imei = parsed.imei || this.telemetry.imei;
        this.telemetry.imei = imei;
        this.telemetry.isOnline = true;
        this.telemetry.isAuthenticated = true;
        this.telemetry.lastHeartbeat = new Date().toISOString();
        replyPayload = buildLoginResponse(1); // Server responds with UTC and timezone 1
        break;
      }

      case 'AP03': {
        // Heartbeat package: IWAP03,06000908000102,5555,30#
        this.telemetry.isOnline = true;
        this.telemetry.lastHeartbeat = new Date().toISOString();
        if (parsed.data.battery !== undefined) this.telemetry.battery = parsed.data.battery;
        if (parsed.data.satellites !== undefined) this.telemetry.satellites = parsed.data.satellites;
        if (parsed.data.gsmSignal !== undefined) this.telemetry.gsmSignal = parsed.data.gsmSignal;
        if (parsed.data.steps !== undefined) this.telemetry.steps = parsed.data.steps;
        if (parsed.data.rolls !== undefined) this.telemetry.rolls = parsed.data.rolls;
        replyPayload = buildHeartbeatResponse();
        break;
      }

      case 'APHP': {
        // Health data: IWAPHP,60,130,85,95,90,36.5,,,,,,,#
        if (parsed.data.heartRate) this.telemetry.heartRate = parsed.data.heartRate;
        if (parsed.data.sbp) this.telemetry.sbp = parsed.data.sbp;
        if (parsed.data.dbp) this.telemetry.dbp = parsed.data.dbp;
        if (parsed.data.spo2) this.telemetry.spo2 = parsed.data.spo2;
        if (parsed.data.bloodSugar) this.telemetry.bloodSugar = parsed.data.bloodSugar;
        if (parsed.data.temperature) this.telemetry.temperature = parsed.data.temperature;
        replyPayload = buildHealthResponse();
        break;
      }

      case 'AP49': {
        // Heart rate single: IWAP49,68#
        if (parsed.data.heartRate) this.telemetry.heartRate = parsed.data.heartRate;
        replyPayload = 'IWBP49#';
        break;
      }

      case 'APHT': {
        // Heart rate & Blood pressure: IWAPHT,60,130,85#
        if (parsed.data.heartRate) this.telemetry.heartRate = parsed.data.heartRate;
        if (parsed.data.sbp) this.telemetry.sbp = parsed.data.sbp;
        if (parsed.data.dbp) this.telemetry.dbp = parsed.data.dbp;
        replyPayload = 'IWBPHT#';
        break;
      }

      case 'AP50': {
        // Body temperature & battery: IWAP50,36.7,90#
        if (parsed.data.temperature) this.telemetry.temperature = parsed.data.temperature;
        if (parsed.data.battery) this.telemetry.battery = parsed.data.battery;
        replyPayload = 'IWBP50#';
        break;
      }

      case 'AP10': {
        // Alarm and Return Address packet: IWAP10...#
        this.telemetry.isOnline = true;
        this.telemetry.latitude = parsed.data.latitude || this.telemetry.latitude;
        this.telemetry.longitude = parsed.data.longitude || this.telemetry.longitude;
        this.telemetry.battery = parsed.data.battery || this.telemetry.battery;
        this.telemetry.satellites = parsed.data.satellites || this.telemetry.satellites;
        this.telemetry.gsmSignal = parsed.data.gsmSignal || this.telemetry.gsmSignal;

        const alarmCode = parsed.data.alarmCode || '01';
        this.telemetry.alarmState = alarmCode as any;

        if (alarmCode === '01') {
          this.telemetry.alarmLabel = 'EMERGENCY SOS!';
          this.recordAlarm('SOS', this.telemetry.latitude, this.telemetry.longitude);
        } else if (alarmCode === '05' || alarmCode === '06') {
          this.telemetry.alarmLabel = 'FALL DETECTED!';
          this.recordAlarm('FALL', this.telemetry.latitude, this.telemetry.longitude);
        } else if (alarmCode === '03') {
          this.telemetry.alarmLabel = 'Not Worn Alert';
          this.recordAlarm('NOT_WORN', this.telemetry.latitude, this.telemetry.longitude);
        } else {
          this.telemetry.alarmLabel = 'Normal';
        }

        // Return address package in BP10
        replyPayload = buildAlarmResponse(
          'Central Emergency Dispatch, 22.549°N 114.082°E [Paramedic Unit Dispatched]'
        );
        break;
      }

      case 'APXL': {
        // Watch acknowledges instant HR test
        console.log(`[Watch] Acknowledged HR test journal ${parsed.journal}`);
        break;
      }

      case 'AP86': {
        // Watch acknowledges auto HR interval
        console.log(`[Watch] Acknowledged auto HR interval journal ${parsed.journal}`);
        break;
      }

      case 'APXY':
      case 'APXT':
      case 'APXZ':
      case 'AP16':
      case 'AP40':
      case 'AP76':
      case 'AP12':
      case 'AP18':
      case 'AP31': {
        // Acknowledgement received
        console.log(`[Watch] Acknowledged command ${parsed.command} with journal ${parsed.journal}`);
        break;
      }
    }

    // Broadcast updated telemetry to frontend
    this.emit('telemetry', this.telemetry);

    // If server generated a response, send it back
    if (replyPayload) {
      this.sendServerReply(replyPayload, transport, originSocket);
    }

    return { reply: replyPayload, parsed };
  }

  private recordAlarm(type: 'SOS' | 'FALL' | 'NOT_WORN', lat: number, lng: number): void {
    const alarm: AlarmEvent = {
      id: `alarm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      type,
      imei: this.telemetry.imei,
      latitude: lat,
      longitude: lng,
      address: '22°32.9806\'N 114°04.9355\'E (Sector 4 / Home WiFi Zone)',
      heartRate: this.telemetry.heartRate,
      sbp: this.telemetry.sbp,
      dbp: this.telemetry.dbp,
      spo2: this.telemetry.spo2,
      temperature: this.telemetry.temperature,
      acknowledged: false,
    };

    this.activeAlarms.unshift(alarm);
    if (this.activeAlarms.length > 50) this.activeAlarms.pop();

    this.emit('alarm', alarm);
  }

  public acknowledgeAlarm(alarmId: string): AlarmEvent | null {
    const found = this.activeAlarms.find((a) => a.id === alarmId);
    if (found) {
      found.acknowledged = true;
      found.acknowledgedAt = new Date().toISOString();
      this.emit('alarm_acknowledged', found);
      // Reset alarm state on telemetry if no more active unacknowledged SOS/FALL
      const hasUnack = this.activeAlarms.some((a) => !a.acknowledged && (a.type === 'SOS' || a.type === 'FALL'));
      if (!hasUnack) {
        this.telemetry.alarmState = '00';
        this.telemetry.alarmLabel = 'Normal';
        this.emit('telemetry', this.telemetry);
      }
      return found;
    }
    return null;
  }

  public clearAllAlarms(): void {
    this.activeAlarms.forEach((a) => (a.acknowledged = true));
    this.telemetry.alarmState = '00';
    this.telemetry.alarmLabel = 'Normal';
    this.emit('telemetry', this.telemetry);
    this.emit('alarms_cleared', {});
  }

  /**
   * Sends a server command (BPxx) down to the watch
   */
  public sendServerCommand(rawPayload: string): PacketLogEntry {
    const parsed = parseRawPacket(rawPayload);
    const cmd = parsed?.command || rawPayload.substring(2, 6);
    const desc = parsed?.description || `Server Command ${cmd}`;

    const log = this.logPacket(
      'SERVER->DEVICE',
      rawPayload,
      cmd,
      desc,
      parsed?.data || {},
      'TCP'
    );

    // Send down active TCP socket if any
    for (const socket of this.activeSockets) {
      try {
        socket.write(rawPayload);
      } catch (err: any) {
        console.warn(`[TCP Server] Failed writing to socket: ${err.message}`);
      }
    }

    // Broadcast to WebSocket clients so the Watch UI displays/reacts to it
    this.emit('server_command_to_watch', {
      raw: rawPayload,
      command: cmd,
      parsed: parsed?.data,
      timestamp: new Date().toISOString(),
    });

    // If command is BP40 (text message), store in watch unread messages
    if (cmd === 'BP40' && parsed?.data?.message) {
      this.telemetry.unreadMessages.push({
        id: `msg_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        sender: 'Assistance Center',
        text: parsed.data.message,
      });
      this.emit('telemetry', this.telemetry);
    }

    // If command is BP86 (auto HR interval), update telemetry setting
    if (cmd === 'BP86' && parsed?.data) {
      this.telemetry.autoHrEnabled = parsed.data.switch;
      this.telemetry.autoHrInterval = parsed.data.intervalMinutes;
      this.emit('telemetry', this.telemetry);
    }

    // If command is BP76 (fall toggle)
    if (cmd === 'BP76' && parsed?.data) {
      this.telemetry.fallDetectionEnabled = parsed.data.enabled;
      this.emit('telemetry', this.telemetry);
    }

    // If command is BP12 (SOS numbers)
    if (cmd === 'BP12' && parsed?.data) {
      this.telemetry.sosNumbers = [
        parsed.data.sos1 || this.telemetry.sosNumbers[0],
        parsed.data.sos2 || this.telemetry.sosNumbers[1],
        parsed.data.sos3 || this.telemetry.sosNumbers[2],
      ];
      this.emit('telemetry', this.telemetry);
    }

    // If command is BP18 (restart)
    if (cmd === 'BP18') {
      this.telemetry.powerState = 'REBOOTING';
      this.emit('telemetry', this.telemetry);
      setTimeout(() => {
        this.telemetry.powerState = 'ON';
        this.emit('telemetry', this.telemetry);
      }, 3000);
    }

    // If command is BP31 (power off)
    if (cmd === 'BP31') {
      this.telemetry.powerState = 'OFF';
      this.telemetry.isOnline = false;
      this.emit('telemetry', this.telemetry);
    }

    return log;
  }

  private sendServerReply(rawPayload: string, transport: 'TCP' | 'VIRTUAL_TCP', originSocket?: net.Socket): void {
    const parsed = parseRawPacket(rawPayload);
    const cmd = parsed?.command || rawPayload.substring(2, 6);
    const desc = parsed?.description || `Server Response ${cmd}`;

    this.logPacket(
      'SERVER->DEVICE',
      rawPayload,
      cmd,
      desc,
      parsed?.data || {},
      transport
    );

    if (originSocket) {
      try {
        originSocket.write(rawPayload);
      } catch (err: any) {
        console.warn(`[TCP Server] Failed writing reply to socket: ${err.message}`);
      }
    } else {
      // Send to all active TCP sockets
      for (const socket of this.activeSockets) {
        try {
          socket.write(rawPayload);
        } catch (err: any) {
          // ignore
        }
      }
    }

    // Also broadcast down WebSocket so frontend Watch UI updates
    this.emit('server_reply_to_watch', {
      raw: rawPayload,
      command: cmd,
      parsed: parsed?.data,
      timestamp: new Date().toISOString(),
    });
  }
}

// Global Singleton
export const tcpManager = new TcpProtocolManager(5088);
