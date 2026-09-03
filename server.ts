import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { tcpManager } from './server/tcpServer.ts';
import {
  buildLoginPacket,
  buildHeartbeatPacket,
  buildHealthDataPacket,
  buildAlarmPacket,
  buildRequestHeartRateCommand,
  buildSetAutoHrIntervalCommand,
  buildTextMessageCommand,
  buildLocateCommand,
  buildFallToggleCommand,
  buildSetSosCommand,
  parseRawPacket,
} from './server/protocol.ts';

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // Start internal TCP server on port 5088
  tcpManager.startTcpServer();

  // REST API Routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'GPS & Health Smartwatch Protocol Server',
      stats: tcpManager.getStats(),
    });
  });

  app.get('/api/telemetry', (req, res) => {
    res.json(tcpManager.getTelemetry());
  });

  app.get('/api/packets', (req, res) => {
    res.json(tcpManager.getPacketLogs());
  });

  app.get('/api/alarms', (req, res) => {
    res.json(tcpManager.getActiveAlarms());
  });

  app.get('/api/stats', (req, res) => {
    res.json(tcpManager.getStats());
  });

  // Watch sends raw TCP packet to server
  app.post('/api/device/packet', (req, res) => {
    const { raw, transport = 'TCP' } = req.body;
    if (!raw || typeof raw !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "raw" packet payload' });
      return;
    }
    const result = tcpManager.handleDevicePacket(raw, transport);
    res.json({
      success: true,
      processed: raw,
      reply: result.reply,
      parsed: result.parsed,
    });
  });

  // Admin sends raw BP command down to device
  app.post('/api/server/command', (req, res) => {
    const { command } = req.body;
    if (!command || typeof command !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "command" payload' });
      return;
    }
    const log = tcpManager.sendServerCommand(command);
    res.json({
      success: true,
      command,
      log,
    });
  });

  // Telemetry manual adjustments (from watch sliders)
  app.post('/api/telemetry/update', (req, res) => {
    const updated = tcpManager.updateTelemetryMetric(req.body);
    res.json({ success: true, telemetry: updated });
  });

  // Alarm acknowledgment
  app.post('/api/alarms/acknowledge', (req, res) => {
    const { alarmId } = req.body;
    const acked = tcpManager.acknowledgeAlarm(alarmId);
    if (!acked) {
      res.status(404).json({ error: 'Alarm not found' });
      return;
    }
    res.json({ success: true, alarm: acked });
  });

  app.post('/api/alarms/clear', (req, res) => {
    tcpManager.clearAllAlarms();
    res.json({ success: true });
  });

  // Quick Action triggers matching standard protocol packages
  app.post('/api/device/quick-action', (req, res) => {
    const { action, params = {} } = req.body;
    const current = tcpManager.getTelemetry();
    let packet = '';

    switch (action) {
      case 'login': {
        const imei = params.imei || current.imei || '353456789012345';
        packet = buildLoginPacket(imei);
        break;
      }
      case 'heartbeat': {
        packet = buildHeartbeatPacket(
          params.gsmSignal ?? current.gsmSignal,
          params.satellites ?? current.satellites,
          params.battery ?? current.battery,
          '01',
          '02',
          params.steps ?? current.steps,
          params.rolls ?? current.rolls
        );
        break;
      }
      case 'health': {
        packet = buildHealthDataPacket(
          params.heartRate ?? current.heartRate,
          params.sbp ?? current.sbp,
          params.dbp ?? current.dbp,
          params.spo2 ?? current.spo2,
          params.bloodSugar ?? current.bloodSugar,
          params.temperature ?? current.temperature
        );
        break;
      }
      case 'sos': {
        packet = buildAlarmPacket(
          '01',
          params.latitude ?? current.latitude,
          params.longitude ?? current.longitude,
          params.battery ?? current.battery,
          params.gsmSignal ?? current.gsmSignal,
          params.satellites ?? current.satellites
        );
        break;
      }
      case 'fall': {
        packet = buildAlarmPacket(
          '05',
          params.latitude ?? current.latitude,
          params.longitude ?? current.longitude,
          params.battery ?? current.battery,
          params.gsmSignal ?? current.gsmSignal,
          params.satellites ?? current.satellites
        );
        break;
      }
      default: {
        res.status(400).json({ error: `Unknown quick-action "${action}"` });
        return;
      }
    }

    const result = tcpManager.handleDevicePacket(packet, 'VIRTUAL_TCP');
    res.json({
      success: true,
      action,
      packet,
      reply: result.reply,
      parsed: result.parsed,
    });
  });

  // Create HTTP Server & WebSocket Server
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  const clients = new Set<WebSocket>();

  function broadcast(payload: any) {
    const msg = JSON.stringify(payload);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  }

  // Subscribe to TCP Manager events
  tcpManager.on('packet', (packet) => {
    broadcast({ type: 'PACKET_LOG', packet });
  });

  tcpManager.on('telemetry', (telemetry) => {
    broadcast({ type: 'TELEMETRY_UPDATE', telemetry });
  });

  tcpManager.on('alarm', (alarm) => {
    broadcast({ type: 'ALARM_EVENT', alarm });
  });

  tcpManager.on('alarm_acknowledged', (alarm) => {
    broadcast({ type: 'ALARM_ACK', alarm });
  });

  tcpManager.on('alarms_cleared', () => {
    broadcast({ type: 'ALARMS_CLEARED' });
  });

  tcpManager.on('server_command_to_watch', (data) => {
    broadcast({ type: 'SERVER_COMMAND_TO_WATCH', ...data });
  });

  tcpManager.on('server_reply_to_watch', (data) => {
    broadcast({ type: 'SERVER_REPLY_TO_WATCH', ...data });
  });

  wss.on('connection', (ws) => {
    clients.add(ws);

    // Initial state dump
    ws.send(
      JSON.stringify({
        type: 'INIT',
        telemetry: tcpManager.getTelemetry(),
        packets: tcpManager.getPacketLogs(),
        alarms: tcpManager.getActiveAlarms(),
        stats: tcpManager.getStats(),
      })
    );

    ws.on('message', (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        switch (message.type) {
          case 'DEVICE_PACKET': {
            if (message.raw) {
              tcpManager.handleDevicePacket(message.raw, 'VIRTUAL_TCP');
            }
            break;
          }
          case 'SERVER_COMMAND': {
            if (message.raw) {
              tcpManager.sendServerCommand(message.raw);
            }
            break;
          }
          case 'UPDATE_TELEMETRY': {
            if (message.data) {
              tcpManager.updateTelemetryMetric(message.data);
            }
            break;
          }
          case 'ACK_ALARM': {
            if (message.alarmId) {
              tcpManager.acknowledgeAlarm(message.alarmId);
            }
            break;
          }
          case 'CLEAR_ALARMS': {
            tcpManager.clearAllAlarms();
            break;
          }
        }
      } catch (err: any) {
        console.error('[WebSocket] Failed to handle message:', err.message);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.warn('[WebSocket] Client error:', err.message);
      clients.delete(ws);
    });
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Smartwatch Simulator] Full-Stack server running on http://localhost:${PORT}`);
    console.log(`[Smartwatch Simulator] TCP Sniffer ready on port 5088 & WebSocket on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Smartwatch Simulator] Server start error:', err);
  process.exit(1);
});
