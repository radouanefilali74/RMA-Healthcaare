import * as net from 'net';
import { WebSocketServer } from 'ws';
import express from 'express';
import * as http from 'http';
import { ProtocolParser } from './ProtocolParser';
import { DeviceManager } from './DeviceManager';
import { format } from 'date-fns';

const PORT_TCP = 5088;
const PORT_HTTP = 3001;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const deviceManager = new DeviceManager();

// TCP SERVER
const tcpServer = net.createServer((socket) => {
  console.log(`[TCP] Connection established from ${socket.remoteAddress}:${socket.remotePort}`);
  let currentImei: string | null = null;

  socket.on('data', (data) => {
    const rawData = data.toString();
    console.log(`[TCP RX] ${rawData}`);
    
    // Broadcast raw TCP payload to admins for the packet sniffer
    deviceManager.broadcastRawPacket('RX', rawData, currentImei);

    const parsed = ProtocolParser.parse(rawData);
    if (!parsed) {
        console.error('[TCP] Failed to parse:', rawData);
        return;
    }

    if (parsed.command === 'AP00') {
      // Login
      const imei = parsed.payload[0];
      currentImei = imei;
      deviceManager.addDevice(imei, socket);
      
      // Reply BP00
      // format: IWBP00,yyyyMMddHHmmss,tz#
      const timestamp = format(new Date(), "yyyyMMddHHmmss"); 
      const reply = `IWBP00,${timestamp},1#`;
      socket.write(reply);
      console.log(`[TCP TX] ${reply}`);
      deviceManager.broadcastRawPacket('TX', reply, currentImei);

      // Downlink Senior Safety Thresholds & Cadence to the connected watch
      const binding = deviceManager.bindingManager.getBinding(imei);
      if (binding) {
        const journal = format(new Date(), "HHmmss");
        const t = binding.safetyThresholds;
        const configPacket = `IWBPCF,${imei},${journal},${binding.telemetryFrequencySeconds},${t.hrMin},${t.hrMax},${t.bpSysMax},${t.bpDiaMax},${t.spo2Min},${t.tempMin},${t.tempMax}#`;
        socket.write(configPacket);
        console.log(`[TCP TX Config on Login to ${imei}] ${configPacket}`);
        deviceManager.broadcastRawPacket('TX', configPacket, currentImei);
      }
    } 
    else if (currentImei) {
       deviceManager.updateDeviceActivity(currentImei);

       if (parsed.command === 'AP03') {
           // Heartbeat: IWAP03,06000908000102,5555,30#
           // payload[0] = 06000908000102 (status: GSM 3 chars, Sats 3 chars, Batt 3 chars, reserve 1, fortify 2, workmode 2)
           // payload[1] = steps
           // payload[2] = rolls
           const statusStr = parsed.payload[0] || '';
           const gsm = parseInt(statusStr.substring(0, 3) || '0', 10);
           const satellites = parseInt(statusStr.substring(3, 6) || '0', 10);
           const battery = parseInt(statusStr.substring(6, 9) || '0', 10);
           const steps = parseInt(parsed.payload[1] || '0', 10);
           const rolls = parseInt(parsed.payload[2] || '0', 10);

           deviceManager.updateHeartbeat(currentImei, steps, rolls, battery, gsm, satellites);

           const reply = `IWBP03#`;
           socket.write(reply);
           console.log(`[TCP TX] ${reply}`);
           deviceManager.broadcastRawPacket('TX', reply, currentImei);
       }
       else if (parsed.command === 'APHP') {
           // Health: HR, SBP, DBP, SpO2, Blood Sugar, Temperature
           const hr = parseInt(parsed.payload[0]) || undefined;
           const sys = parseInt(parsed.payload[1]) || undefined;
           const dia = parseInt(parsed.payload[2]) || undefined;
           const spo2 = parseInt(parsed.payload[3]) || undefined;
           const temp = parseFloat(parsed.payload[5]) || undefined;
           deviceManager.updateHealthData(currentImei, hr, sys, dia, spo2, temp);
           
           const reply = `IWBPHP#`;
           socket.write(reply);
           console.log(`[TCP TX] ${reply}`);
           deviceManager.broadcastRawPacket('TX', reply, currentImei);
       }
       else if (parsed.command === 'AP49') {
           // Single Heart Rate
           const hr = parseInt(parsed.payload[0]) || undefined;
           deviceManager.updateHealthData(currentImei, hr);
           const reply = `IWBP49#`;
           socket.write(reply);
           console.log(`[TCP TX] ${reply}`);
           deviceManager.broadcastRawPacket('TX', reply, currentImei);
       }
       else if (parsed.command === 'AP50') {
           // Temp and battery: IWAP50,36.7,90#
           const temp = parseFloat(parsed.payload[0]) || undefined;
           const battery = parseInt(parsed.payload[1]) || undefined;
           deviceManager.updateHealthData(currentImei, undefined, undefined, undefined, undefined, temp);
           if (battery !== undefined) {
             deviceManager.updateHeartbeat(currentImei, undefined, undefined, battery);
           }
           const reply = `IWBP50#`;
           socket.write(reply);
           console.log(`[TCP TX] ${reply}`);
           deviceManager.broadcastRawPacket('TX', reply, currentImei);
       }
       else if (parsed.command === 'AP10') {
           // SOS / Alarm
           deviceManager.triggerSOS(currentImei, rawData);
           const reply = `IWBP10#`; 
           socket.write(reply);
           console.log(`[TCP TX] ${reply}`);
           deviceManager.broadcastRawPacket('TX', reply, currentImei);
       }
       else if (parsed.command === 'APCF' || parsed.command === 'AP05') {
           console.log(`[TCP RX Config ACK from ${currentImei}] ${rawData}`);
           deviceManager.broadcastRawPacket('RX', rawData, currentImei);
       }
    }
  });

  socket.on('close', () => {
    console.log(`[TCP] Connection closed ${socket.remoteAddress}`);
    if (currentImei) {
        deviceManager.removeDeviceBySocket(socket);
    }
  });
  
  socket.on('error', (err) => {
     console.error('[TCP] Error:', err);
  });
});

tcpServer.listen(PORT_TCP, () => {
  console.log(`[TCP] Server listening on port ${PORT_TCP}`);
});

// WEBSOCKET SERVER (Admin Dashboard)
wss.on('connection', (ws) => {
  console.log('[WS] Admin client connected');
  deviceManager.addAdminClient(ws);

  ws.on('message', (message) => {
     try {
         const data = JSON.parse(message.toString());
         console.log('[WS RX]', data);
         
         if (data.type === 'SEND_COMMAND' && data.imei && data.command) {
             // e.g. IWBPXL,353456789012345,080835#
             deviceManager.sendCommand(data.imei, data.command);
             deviceManager.broadcastRawPacket('TX', data.command, data.imei);
         }
         else if (data.type === 'UPDATE_BINDING' && data.binding) {
             deviceManager.bindingManager.updateBinding(data.binding);
             deviceManager.broadcastBindings();
             console.log(`[CNDP] Updated thresholds for senior ${data.binding.seniorRefId}`);

             // Downlink updated configuration & cadence directly to the target watch over TCP
             const b = data.binding;
             const journal = format(new Date(), "HHmmss");
             const t = b.safetyThresholds;
             const configPacket = `IWBPCF,${b.imei},${journal},${b.telemetryFrequencySeconds},${t.hrMin},${t.hrMax},${t.bpSysMax},${t.bpDiaMax},${t.spo2Min},${t.tempMin},${t.tempMax}#`;
             const sent = deviceManager.sendCommand(b.imei, configPacket);
             if (sent) {
               deviceManager.broadcastRawPacket('TX', configPacket, b.imei);
               console.log(`[TCP TX Config Push to ${b.imei}] ${configPacket}`);
             } else {
               console.log(`[TCP TX Config Deferred] Device ${b.imei} not currently connected. Config stored in binding.`);
             }
         }
         else if (data.type === 'ACKNOWLEDGE_ALARM' && data.alarmId) {
             deviceManager.alertEngine.acknowledgeAlarm(data.alarmId, data.operator || 'Care Operator');
             deviceManager.broadcastAlarms();
         }
         else if (data.type === 'RESOLVE_ALARM' && data.alarmId) {
             deviceManager.alertEngine.resolveAlarm(data.alarmId, data.actionNote || 'Resolved by Care Team', data.operator || 'Care Operator');
             deviceManager.broadcastAlarms();
         }
         else if (data.type === 'RAPID_INTERVENTION') {
              console.log('[RAPID_INTERVENTION] Received intervention for imei:', data.imei, 'command:', data.command);
              // Send command if provided (e.g. BP40 text warning)
              if (data.imei && data.command) {
                const sent = deviceManager.sendCommand(data.imei, data.command);
                if (sent) {
                  deviceManager.broadcastRawPacket('TX', data.command, data.imei);
                }
              }
              if (data.alarmId && data.action) {
                deviceManager.alertEngine.recordIntervention(data.alarmId, data.action, data.operator || 'Rapid Response Operator');
                deviceManager.broadcastAlarms();
              }
         }
     } catch(e) {
         console.error('WS parse error', e);
     }
  });

  ws.on('close', () => {
    console.log('[WS] Admin client disconnected');
    deviceManager.removeAdminClient(ws);
  });
});

server.listen(PORT_HTTP, () => {
   console.log(`[HTTP/WS] Server listening on port ${PORT_HTTP}`);
});
