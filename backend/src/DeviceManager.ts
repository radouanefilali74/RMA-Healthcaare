import { Socket } from 'net';
import { WebSocket } from 'ws';
import { SeniorBindingManager, SeniorDeviceBinding } from './SeniorBindingManager';
import { AlertEngine, AlarmEvent } from './AlertEngine';

export interface DeviceState {
  imei: string;
  socket: Socket;
  lastSeen: Date;
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
}

export class DeviceManager {
  private devices: Map<string, DeviceState> = new Map();
  private adminClients: Set<WebSocket> = new Set();
  public bindingManager: SeniorBindingManager = new SeniorBindingManager();
  public alertEngine: AlertEngine = new AlertEngine();

  addDevice(imei: string, socket: Socket) {
    // 1. If this socket was previously associated with another IMEI, remove stale mapping
    for (const [existingImei, dev] of this.devices.entries()) {
      if (dev.socket === socket && existingImei !== imei) {
        console.log(`[DeviceManager] Re-associating socket: removed stale IMEI ${existingImei}`);
        this.devices.delete(existingImei);
      }
    }

    // 2. If this IMEI had a previous socket that is no longer this socket, destroy it
    const existing = this.devices.get(imei);
    if (existing && existing.socket !== socket) {
      console.log(`[DeviceManager] Replacing previous socket connection for IMEI ${imei}`);
      try {
        existing.socket.destroy();
      } catch (e) {}
    }

    this.devices.set(imei, {
      imei,
      socket,
      lastSeen: new Date(),
    });
    // Ensure binding exists for CNDP senior reference
    this.bindingManager.getOrCreateBinding(imei);

    this.notifyAdmins({ type: 'DEVICE_CONNECTED', imei });
    this.broadcastState();
  }

  updateDeviceActivity(imei: string) {
    const device = this.devices.get(imei);
    if (device) {
      device.lastSeen = new Date();
      this.broadcastState();
    }
  }

  updateHealthData(imei: string, hr?: number, sys?: number, dia?: number, spo2?: number, temp?: number) {
    const device = this.devices.get(imei);
    if (device) {
      if (hr !== undefined) device.hr = hr;
      if (sys !== undefined) device.bp_sys = sys;
      if (dia !== undefined) device.bp_dia = dia;
      if (spo2 !== undefined) device.spo2 = spo2;
      if (temp !== undefined) device.temp = temp;

      // 1. Evaluate against CNDP personalized thresholds
      const binding = this.bindingManager.getOrCreateBinding(imei);
      const triggeredAlarms = this.alertEngine.evaluateTelemetry(binding, {
        hr: device.hr,
        bp_sys: device.bp_sys,
        bp_dia: device.bp_dia,
        spo2: device.spo2,
        temp: device.temp,
      });

      if (triggeredAlarms.length > 0) {
        this.notifyAdmins({
          type: 'ALERT_TRIGGERED',
          alarms: triggeredAlarms,
          binding,
        });
        this.broadcastAlarms();
      }

      this.notifyAdmins({ type: 'HEALTH_UPDATE', imei, device: this.getSanitizedDevice(device) });
      this.broadcastState();
    }
  }

  updateHeartbeat(imei: string, steps?: number, rolls?: number, battery?: number, gsm?: number, satellites?: number) {
    const device = this.devices.get(imei);
    if (device) {
      if (steps !== undefined) device.steps = steps;
      if (rolls !== undefined) device.rolls = rolls;
      if (battery !== undefined) device.battery = battery;
      if (gsm !== undefined) device.gsm = gsm;
      if (satellites !== undefined) device.satellites = satellites;
      this.notifyAdmins({ type: 'STATUS_UPDATE', imei, device: this.getSanitizedDevice(device) });
      this.broadcastState();
    }
  }

  triggerSOS(imei: string, raw: string) {
    const binding = this.bindingManager.getOrCreateBinding(imei);
    const alarm = this.alertEngine.triggerSOS(binding, raw);
    this.notifyAdmins({ type: 'SOS_ALERT', imei, raw, alarm, binding });
    this.broadcastAlarms();
  }
  
  sendCommand(imei: string, cmdString: string): boolean {
    const device = this.devices.get(imei);
    if (device && !device.socket.destroyed) {
       device.socket.write(cmdString);
       console.log(`[TCP TX to ${device.imei}] ${cmdString}`);
       return true;
    }
    console.warn(`[TCP TX FAILED] Device ${imei} not found or socket disconnected. Connected devices:`, Array.from(this.devices.keys()));
    return false;
  }

  getAllDevices() {
     return Array.from(this.devices.values()).map(d => this.getSanitizedDevice(d));
  }

  removeDeviceBySocket(socket: Socket) {
    for (const [imei, device] of this.devices.entries()) {
      if (device.socket === socket) {
        this.devices.delete(imei);
        this.notifyAdmins({ type: 'DEVICE_DISCONNECTED', imei });
        this.broadcastState();
        break;
      }
    }
  }

  addAdminClient(ws: WebSocket) {
    this.adminClients.add(ws);
    ws.send(
      JSON.stringify({
        type: 'INITIAL_STATE',
        devices: this.getAllDevices(),
        bindings: this.bindingManager.getAllBindings(),
        alarms: this.alertEngine.getAllAlarms(),
      })
    );
  }

  removeAdminClient(ws: WebSocket) {
    this.adminClients.delete(ws);
  }

  broadcastRawPacket(direction: 'TX' | 'RX', data: string, imei: string | null) {
      this.notifyAdmins({
          type: 'RAW_PACKET',
          direction,
          data,
          imei,
          timestamp: new Date().toISOString()
      });
  }

  broadcastAlarms() {
    this.notifyAdmins({
      type: 'ALARMS_UPDATE',
      alarms: this.alertEngine.getAllAlarms(),
    });
  }

  broadcastBindings() {
    this.notifyAdmins({
      type: 'BINDINGS_UPDATE',
      bindings: this.bindingManager.getAllBindings(),
    });
  }

  private broadcastState() {
      this.notifyAdmins({ type: 'STATE_UPDATE', devices: this.getAllDevices() });
  }

  public notifyAdmins(data: any) {
    const msg = JSON.stringify(data);
    for (const client of this.adminClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }
  
  private getSanitizedDevice(device: DeviceState) {
      return {
          imei: device.imei,
          lastSeen: device.lastSeen,
          hr: device.hr,
          bp_sys: device.bp_sys,
          bp_dia: device.bp_dia,
          spo2: device.spo2,
          temp: device.temp,
          status: device.status,
          steps: device.steps,
          rolls: device.rolls,
          battery: device.battery,
          gsm: device.gsm,
          satellites: device.satellites,
          binding: this.bindingManager.getBinding(device.imei)
      };
  }
}
