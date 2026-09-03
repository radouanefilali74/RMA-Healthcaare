import { WatchTelemetry, PacketLogEntry, AlarmEvent, ServerStats } from '../types.ts';

type Listener<T> = (data: T) => void;

class SocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: any = null;
  private isConnected: boolean = false;
  private listeners: Map<string, Set<Listener<any>>> = new Map();

  constructor() {
    this.connect();
  }

  public connect(): void {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.emit('connection_change', true);
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit(data.type, data);
        } catch (e) {
          console.error('Error parsing WS message', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.emit('connection_change', false);
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.isConnected = false;
        this.emit('connection_change', false);
      };
    } catch (err) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }

  public on(event: string, listener: Listener<any>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  private emit(event: string, data: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((h) => {
        try {
          h(data);
        } catch (err) {
          console.error(`Error in WS listener for ${event}`, err);
        }
      });
    }
  }

  public send(type: string, payload: Record<string, any> = {}): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...payload }));
    } else {
      // Fallback to REST API if socket is briefly buffering
      if (type === 'DEVICE_PACKET') {
        fetch('/api/device/packet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw: payload.raw }),
        }).catch(() => {});
      } else if (type === 'SERVER_COMMAND') {
        fetch('/api/server/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: payload.raw }),
        }).catch(() => {});
      }
    }
  }

  public sendDevicePacket(raw: string): void {
    this.send('DEVICE_PACKET', { raw });
  }

  public sendServerCommand(raw: string): void {
    this.send('SERVER_COMMAND', { raw });
  }

  public updateTelemetry(data: Partial<WatchTelemetry>): void {
    this.send('UPDATE_TELEMETRY', { data });
  }

  public acknowledgeAlarm(alarmId: string): void {
    this.send('ACK_ALARM', { alarmId });
  }

  public clearAlarms(): void {
    this.send('CLEAR_ALARMS', {});
  }

  public getStatus(): boolean {
    return this.isConnected;
  }
}

export const socketClient = new SocketClient();
