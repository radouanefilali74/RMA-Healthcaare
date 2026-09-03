/**
 * Protocol Parser and Builder for GPS/Health Smartwatch (V1.1)
 * Protocol format: IW<COMMAND><PAYLOAD>#
 */

export function encodeUnicodeHex(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i).toString(16).padStart(4, '0');
    result += code;
  }
  return result;
}

export function decodeUnicodeHex(hex: string): string {
  let result = '';
  const cleanHex = hex.trim();
  for (let i = 0; i + 4 <= cleanHex.length; i += 4) {
    const code = parseInt(cleanHex.substring(i, i + 4), 16);
    if (!isNaN(code) && code > 0) {
      result += String.fromCharCode(code);
    }
  }
  return result;
}

export function generateJournalNumber(): string {
  const now = new Date();
  const h = String(now.getUTCHours()).padStart(2, '0');
  const m = String(now.getUTCMinutes()).padStart(2, '0');
  const s = String(now.getUTCSeconds()).padStart(2, '0');
  return `${h}${m}${s}`;
}

export function getServerTimestampUTC(): string {
  const d = new Date();
  const YYYY = d.getUTCFullYear();
  const MM = String(d.getUTCMonth() + 1).padStart(2, '0');
  const DD = String(d.getUTCDate()).padStart(2, '0');
  const HH = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${YYYY}${MM}${DD}${HH}${mm}${ss}`;
}

// Convert NMEA degree-minute format to decimal degrees (e.g. 2232.9806N -> 22.549676)
export function parseNmeaCoord(coordStr: string, dir: 'N' | 'S' | 'E' | 'W'): number {
  if (!coordStr || coordStr.startsWith('0000')) return 0;
  const dotIndex = coordStr.indexOf('.');
  if (dotIndex < 2) return 0;
  const degLength = dir === 'N' || dir === 'S' ? 2 : 3;
  const deg = parseFloat(coordStr.substring(0, degLength));
  const min = parseFloat(coordStr.substring(degLength));
  let dec = deg + min / 60;
  if (dir === 'S' || dir === 'W') dec = -dec;
  return Number(dec.toFixed(6));
}

export function formatNmeaLat(lat: number): string {
  const dir = lat >= 0 ? 'N' : 'S';
  const abs = Math.abs(lat);
  const deg = Math.floor(abs);
  const min = (abs - deg) * 60;
  return `${String(deg).padStart(2, '0')}${min.toFixed(4).padStart(7, '0')}${dir}`;
}

export function formatNmeaLng(lng: number): string {
  const dir = lng >= 0 ? 'E' : 'W';
  const abs = Math.abs(lng);
  const deg = Math.floor(abs);
  const min = (abs - deg) * 60;
  return `${String(deg).padStart(3, '0')}${min.toFixed(4).padStart(7, '0')}${dir}`;
}

export interface ParsedPacket {
  raw: string;
  command: string;
  isDeviceCommand: boolean;
  imei?: string;
  journal?: string;
  data: Record<string, any>;
  description: string;
}

export function parseRawPacket(packetStr: string): ParsedPacket | null {
  const trimmed = packetStr.trim();
  if (!trimmed.startsWith('IW') || !trimmed.endsWith('#')) {
    return null;
  }

  // Content without IW prefix and # suffix
  const body = trimmed.substring(2, trimmed.length - 1);
  if (body.length < 4) return null;

  const command = body.substring(0, 4);
  const rest = body.substring(4);
  const isDevice = command.startsWith('AP');

  const parsed: ParsedPacket = {
    raw: trimmed,
    command,
    isDeviceCommand: isDevice,
    data: {},
    description: '',
  };

  try {
    switch (command) {
      case 'AP00': {
        // IWAP00353456789012345# or IWAP00,353456789012345#
        const imei = rest.replace(/^,/, '').trim();
        parsed.imei = imei;
        parsed.data = { imei };
        parsed.description = `Login Package from IMEI ${imei}`;
        break;
      }
      case 'BP00': {
        // IWBP00,20260903125223,1#
        const parts = rest.split(',').filter(Boolean);
        parsed.data = {
          serverTime: parts[0] || '',
          timezone: parts[1] || '0',
        };
        parsed.description = `Login Response: Server Time ${parsed.data.serverTime}, Timezone ${parsed.data.timezone}`;
        break;
      }
      case 'AP03': {
        // IWAP03,06000908000102,5555,30#
        const parts = rest.split(',').map((s) => s.trim());
        const statusStr = parts[1] || '';
        const gsmSignal = parseInt(statusStr.substring(0, 3) || '0', 10);
        const satellites = parseInt(statusStr.substring(3, 6) || '0', 10);
        const battery = parseInt(statusStr.substring(6, 9) || '0', 10);
        const space = statusStr.substring(9, 10);
        const fortification = statusStr.substring(10, 12);
        const workingMode = statusStr.substring(12, 14);
        const steps = parseInt(parts[2] || '0', 10);
        const rolls = parseInt(parts[3] || '0', 10);

        parsed.data = {
          gsmSignal,
          satellites,
          battery,
          space,
          fortification,
          workingMode,
          steps,
          rolls,
        };
        parsed.description = `Heartbeat: Battery ${battery}%, Steps ${steps}, Satellites ${satellites}, GSM ${gsmSignal}%`;
        break;
      }
      case 'BP03': {
        parsed.description = `Heartbeat Acknowledged`;
        break;
      }
      case 'APHP': {
        // IWAPHP,60,130,85,95,90,36.5,,,,,,,#
        // Format: Heart Rate, SBP, DBP, SpO2, Blood Sugar, Temperature
        const parts = rest.split(',').map((s) => s.trim());
        const hr = parseFloat(parts[1] || '0');
        const sbp = parseFloat(parts[2] || '0');
        const dbp = parseFloat(parts[3] || '0');
        const spo2 = parseFloat(parts[4] || '0');
        const bloodSugar = parseFloat(parts[5] || '0');
        const temp = parseFloat(parts[6] || '0');

        parsed.data = {
          heartRate: hr,
          sbp,
          dbp,
          spo2,
          bloodSugar,
          temperature: temp,
        };
        parsed.description = `Health Telemetry: HR ${hr} bpm, BP ${sbp}/${dbp} mmHg, SpO2 ${spo2}%, Temp ${temp}°C, Sugar ${bloodSugar} mg/dL`;
        break;
      }
      case 'BPHP': {
        parsed.description = `Health Data Acknowledged`;
        break;
      }
      case 'AP49': {
        // IWAP49,68#
        const hr = parseFloat(rest.replace(/^,/, ''));
        parsed.data = { heartRate: hr };
        parsed.description = `Heart Rate Upload: ${hr} bpm`;
        break;
      }
      case 'BP49': {
        parsed.description = `Heart Rate Upload Acknowledged`;
        break;
      }
      case 'APHT': {
        // IWAPHT,60,130,85#
        const parts = rest.split(',').map((s) => s.trim());
        parsed.data = {
          heartRate: parseFloat(parts[1] || '0'),
          sbp: parseFloat(parts[2] || '0'),
          dbp: parseFloat(parts[3] || '0'),
        };
        parsed.description = `HR & BP Upload: ${parsed.data.heartRate} bpm, ${parsed.data.sbp}/${parsed.data.dbp} mmHg`;
        break;
      }
      case 'AP50': {
        // IWAP50,36.7,90#
        const parts = rest.split(',').map((s) => s.trim());
        parsed.data = {
          temperature: parseFloat(parts[1] || '0'),
          battery: parseFloat(parts[2] || '0'),
        };
        parsed.description = `Body Temperature Upload: ${parsed.data.temperature}°C, Battery ${parsed.data.battery}%`;
        break;
      }
      case 'AP10': {
        // IWAP10080524A2232.9806N11404.9355E000.1061830323.8706000908000502,460,0,9520,3671,00,zh-cn,00,HOME|74-DE-2B-44-88-8C|97#
        // Substring breakdown
        // 0..6: date (YYMMDD)
        const dateStr = rest.substring(0, 6);
        const valid = rest.substring(6, 7) === 'A';
        // Lat: e.g. 2232.9806N
        const latMatch = rest.substring(7).match(/^([0-9.]+)([NS])/);
        let latVal = 22.549676;
        let restAfterLat = rest.substring(7);
        if (latMatch) {
          latVal = parseNmeaCoord(latMatch[1], latMatch[2] as any);
          restAfterLat = restAfterLat.substring(latMatch[0].length);
        }

        const lngMatch = restAfterLat.match(/^([0-9.]+)([EW])/);
        let lngVal = 114.082258;
        let restAfterLng = restAfterLat;
        if (lngMatch) {
          lngVal = parseNmeaCoord(lngMatch[1], lngMatch[2] as any);
          restAfterLng = restAfterLng.substring(lngMatch[0].length);
        }

        const speed = parseFloat(restAfterLng.substring(0, 5) || '0');
        const timeStr = restAfterLng.substring(5, 11);
        const angle = parseFloat(restAfterLng.substring(11, 17) || '0');
        const statusPart = restAfterLng.substring(17).split(',')[0] || '';

        const gsm = parseInt(statusPart.substring(0, 3) || '60', 10);
        const sats = parseInt(statusPart.substring(3, 6) || '8', 10);
        const batt = parseInt(statusPart.substring(6, 9) || '85', 10);
        const space = statusPart.substring(9, 10);
        const alarmCode = statusPart.substring(10, 12); // 01: SOS, 05: Fall, 00: Normal, 03: Not wear
        const workMode = statusPart.substring(12, 14);

        const commaParts = restAfterLng.substring(17).split(',');
        const mcc = commaParts[1] || '460';
        const mnc = commaParts[2] || '0';
        const lac = commaParts[3] || '9520';
        const cid = commaParts[4] || '3671';
        const alarmField = commaParts[5] || alarmCode;
        const lang = commaParts[6] || 'zh-cn';
        const wifi = commaParts[8] || '';

        let alarmType = 'NORMAL';
        let alarmDesc = 'Normal Status';
        if (alarmCode === '01' || alarmField === '01') {
          alarmType = 'SOS';
          alarmDesc = 'EMERGENCY SOS BUTTON ACTIVATED!';
        } else if (alarmCode === '05' || alarmCode === '06' || alarmField === '05') {
          alarmType = 'FALL';
          alarmDesc = 'FALL DETECTION ALARM TRIGGERED!';
        } else if (alarmCode === '03') {
          alarmType = 'NOT_WORN';
          alarmDesc = 'Watch Not Worn Sensor Alert';
        }

        parsed.data = {
          dateStr,
          timeStr,
          gpsValid: valid,
          latitude: latVal,
          longitude: lngVal,
          speed,
          angle,
          gsmSignal: gsm,
          satellites: sats,
          battery: batt,
          space,
          alarmCode: alarmCode || alarmField,
          alarmType,
          workingMode: workMode,
          mcc,
          mnc,
          lac,
          cid,
          lang,
          wifi,
        };
        parsed.description = `Alarm & Location (AP10): [${alarmType}] Lat ${latVal}, Lng ${lngVal}, Batt ${batt}%, ${alarmDesc}`;
        break;
      }
      case 'BP10': {
        const addrHex = rest.replace(/^,/, '');
        const decoded = decodeUnicodeHex(addrHex);
        parsed.data = {
          rawAddressHex: addrHex,
          decodedAddress: decoded || 'Assistance Center Dispatch Base',
        };
        parsed.description = `Alarm Reply (BP10): Address '${decoded || addrHex.substring(0, 30)}...'`;
        break;
      }
      case 'BPXL': {
        // IWBPXL,353456789012345,080835#
        const parts = rest.split(',').map((s) => s.trim());
        parsed.imei = parts[1];
        parsed.journal = parts[2];
        parsed.data = { imei: parts[1], journal: parts[2] };
        parsed.description = `Server Request: Instant Heart Rate Test (Journal #${parts[2]})`;
        break;
      }
      case 'APXL': {
        // IWAPXL,080835#
        const parts = rest.split(',').map((s) => s.trim());
        parsed.journal = parts[1] || parts[0];
        parsed.data = { journal: parsed.journal };
        parsed.description = `Watch Ack: Heart Rate Test Started (Journal #${parsed.journal})`;
        break;
      }
      case 'BP86': {
        // IWBP86,353456789012345,080835,1,720#
        const parts = rest.split(',').map((s) => s.trim());
        parsed.imei = parts[1];
        parsed.journal = parts[2];
        parsed.data = {
          imei: parts[1],
          journal: parts[2],
          switch: parts[3] === '1',
          intervalMinutes: parseInt(parts[4] || '720', 10),
        };
        parsed.description = `Server Command: Set Auto-HR Test to ${parts[3] === '1' ? 'ON' : 'OFF'} (${parts[4]} mins) (Journal #${parts[2]})`;
        break;
      }
      case 'AP86': {
        const parts = rest.split(',').map((s) => s.trim());
        parsed.journal = parts[1] || parts[0];
        parsed.data = { journal: parsed.journal };
        parsed.description = `Watch Ack: Auto-HR Interval Updated (Journal #${parsed.journal})`;
        break;
      }
      case 'BPXY': {
        // Test blood pressure
        const parts = rest.split(',').map((s) => s.trim());
        parsed.imei = parts[1];
        parsed.journal = parts[2];
        parsed.data = { imei: parts[1], journal: parts[2] };
        parsed.description = `Server Request: Instant Blood Pressure Test (Journal #${parts[2]})`;
        break;
      }
      case 'APXY': {
        const parts = rest.split(',').map((s) => s.trim());
        parsed.journal = parts[1] || parts[0];
        parsed.description = `Watch Ack: Blood Pressure Test Started (Journal #${parsed.journal})`;
        break;
      }
      case 'BPXT': {
        // Test temperature
        const parts = rest.split(',').map((s) => s.trim());
        parsed.imei = parts[1];
        parsed.journal = parts[2];
        parsed.description = `Server Request: Instant Temperature Test (Journal #${parts[2]})`;
        break;
      }
      case 'APXT': {
        const parts = rest.split(',').map((s) => s.trim());
        parsed.journal = parts[1] || parts[0];
        parsed.description = `Watch Ack: Temperature Test Started (Journal #${parsed.journal})`;
        break;
      }
      case 'BPXZ': {
        // Test SpO2
        const parts = rest.split(',').map((s) => s.trim());
        parsed.imei = parts[1];
        parsed.journal = parts[2];
        parsed.description = `Server Request: Instant SpO2 Test (Journal #${parts[2]})`;
        break;
      }
      case 'APXZ': {
        const parts = rest.split(',').map((s) => s.trim());
        parsed.journal = parts[1] || parts[0];
        parsed.description = `Watch Ack: SpO2 Test Started (Journal #${parsed.journal})`;
        break;
      }
      case 'BP16': {
        // Real-time locating command
        const parts = rest.split(',').map((s) => s.trim());
        parsed.imei = parts[1];
        parsed.journal = parts[2];
        parsed.description = `Server Request: Instant GPS Location (Journal #${parts[2]})`;
        break;
      }
      case 'AP16': {
        const parts = rest.split(',').map((s) => s.trim());
        parsed.journal = parts[1] || parts[0];
        parsed.description = `Watch Ack: Real-Time Locate Acknowledged (Journal #${parsed.journal})`;
        break;
      }
      case 'BP40': {
        // IWBP40,353456789012345,080835,006100720065...#
        const parts = rest.split(',').map((s) => s.trim());
        parsed.imei = parts[1];
        parsed.journal = parts[2];
        const hexText = parts[3] || '';
        const decoded = decodeUnicodeHex(hexText);
        parsed.data = {
          imei: parts[1],
          journal: parts[2],
          hexText,
          message: decoded,
        };
        parsed.description = `Server Message: "${decoded}" (Journal #${parts[2]})`;
        break;
      }
      case 'AP40': {
        const parts = rest.split(',').map((s) => s.trim());
        parsed.journal = parts[1] || parts[0];
        parsed.description = `Watch Ack: Text Message Displayed (Journal #${parsed.journal})`;
        break;
      }
      case 'BP76': {
        // Fall down switch
        const parts = rest.split(',').map((s) => s.trim());
        parsed.imei = parts[1];
        parsed.journal = parts[2];
        const enabled = parts[3] === '1';
        parsed.data = { enabled, journal: parts[2] };
        parsed.description = `Server Command: Fall Detection ${enabled ? 'Enabled' : 'Disabled'} (Journal #${parts[2]})`;
        break;
      }
      case 'AP76': {
        const parts = rest.split(',').map((s) => s.trim());
        parsed.journal = parts[1] || parts[0];
        parsed.description = `Watch Ack: Fall Detection Switch Updated (Journal #${parsed.journal})`;
        break;
      }
      case 'BP12': {
        // Set SOS numbers
        const parts = rest.split(',').map((s) => s.trim());
        parsed.imei = parts[1];
        parsed.journal = parts[2];
        parsed.data = {
          sos1: parts[3] || '',
          sos2: parts[4] || '',
          sos3: parts[5] || '',
          journal: parts[2],
        };
        parsed.description = `Server Command: Set SOS Numbers: [${parts[3] || '-'}, ${parts[4] || '-'}, ${parts[5] || '-'}]`;
        break;
      }
      case 'AP12': {
        const parts = rest.split(',').map((s) => s.trim());
        parsed.journal = parts[1] || parts[0];
        parsed.description = `Watch Ack: SOS Numbers Saved (Journal #${parsed.journal})`;
        break;
      }
      case 'BP18': {
        const parts = rest.split(',').map((s) => s.trim());
        parsed.imei = parts[1];
        parsed.journal = parts[2];
        parsed.description = `Server Command: Restart Device (Journal #${parts[2]})`;
        break;
      }
      case 'AP18': {
        const parts = rest.split(',').map((s) => s.trim());
        parsed.journal = parts[1] || parts[0];
        parsed.description = `Watch Ack: Device Restarting... (Journal #${parsed.journal})`;
        break;
      }
      case 'BP31': {
        const parts = rest.split(',').map((s) => s.trim());
        parsed.imei = parts[1];
        parsed.journal = parts[2];
        parsed.description = `Server Command: Power Off Device (Journal #${parts[2]})`;
        break;
      }
      case 'AP31': {
        const parts = rest.split(',').map((s) => s.trim());
        parsed.journal = parts[1] || parts[0];
        parsed.description = `Watch Ack: Device Powering Off (Journal #${parsed.journal})`;
        break;
      }
      default: {
        parsed.description = `Custom Packet: Command ${command}`;
        break;
      }
    }
  } catch (err: any) {
    parsed.description = `Packet ${command} parsed with error: ${err.message}`;
  }

  return parsed;
}

// Packet Builders
export function buildLoginPacket(imei: string): string {
  return `IWAP00${imei}#`;
}

export function buildLoginResponse(timezone: number = 1): string {
  const utc = getServerTimestampUTC();
  return `IWBP00,${utc},${timezone}#`;
}

export function buildHeartbeatPacket(
  gsmSignal: number,
  satellites: number,
  battery: number,
  fortification: string = '01',
  workingMode: string = '02',
  steps: number = 5555,
  rolls: number = 30
): string {
  const gsmStr = String(gsmSignal).padStart(3, '0');
  const satStr = String(satellites).padStart(3, '0');
  const battStr = String(battery).padStart(3, '0');
  const statusStr = `${gsmStr}${satStr}${battStr}0${fortification}${workingMode}`;
  return `IWAP03,${statusStr},${steps},${rolls}#`;
}

export function buildHeartbeatResponse(): string {
  return `IWBP03#`;
}

export function buildHealthDataPacket(
  heartRate: number,
  sbp: number,
  dbp: number,
  spo2: number,
  bloodSugar: number,
  temperature: number
): string {
  return `IWAPHP,${Math.round(heartRate)},${Math.round(sbp)},${Math.round(dbp)},${Math.round(spo2)},${bloodSugar.toFixed(0)},${temperature.toFixed(1)},,,,,,,#`;
}

export function buildHealthResponse(): string {
  return `IWBPHP#`;
}

export function buildAlarmPacket(
  alarmType: '01' | '05' | '00' | '03', // 01: SOS, 05: Fall, 00: Normal, 03: Not wear
  lat: number = 22.549676,
  lng: number = 114.082258,
  battery: number = 85,
  gsm: number = 60,
  sats: number = 9
): string {
  const now = new Date();
  const YY = String(now.getUTCFullYear()).slice(-2);
  const MM = String(now.getUTCMonth() + 1).padStart(2, '0');
  const DD = String(now.getUTCDate()).padStart(2, '0');
  const dateStr = `${DD}${MM}${YY}`; // Format in protocol example: 080524
  const latNmea = formatNmeaLat(lat);
  const lngNmea = formatNmeaLng(lng);
  const speed = '000.1';
  const HH = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  const timeStr = `${HH}${mm}${ss}`;
  const angle = '323.87';
  const gsmStr = String(gsm).padStart(3, '0');
  const satsStr = String(sats).padStart(3, '0');
  const battStr = String(battery).padStart(3, '0');
  const statusStr = `${gsmStr}${satsStr}${battStr}00${alarmType}02`;

  return `IWAP10${dateStr}A${latNmea}${lngNmea}${speed}${timeStr}${angle}${statusStr},460,0,9520,3671,${alarmType},zh-cn,00,HOME|74-DE-2B-44-88-8C|97#`;
}

export function buildAlarmResponse(addressText: string = 'Medical Center Emergency Response, Sector 4'): string {
  const hex = encodeUnicodeHex(addressText);
  return `IWBP10${hex}#`;
}

export function buildRequestHeartRateCommand(imei: string, journal?: string): string {
  const j = journal || generateJournalNumber();
  return `IWBPXL,${imei},${j}#`;
}

export function buildHeartRateAck(journal: string): string {
  return `IWAPXL,${journal}#`;
}

export function buildSetAutoHrIntervalCommand(
  imei: string,
  switchOn: boolean,
  intervalMinutes: number,
  journal?: string
): string {
  const j = journal || generateJournalNumber();
  return `IWBP86,${imei},${j},${switchOn ? '1' : '0'},${intervalMinutes}#`;
}

export function buildAutoHrAck(journal: string): string {
  return `IWAP86,${journal}#`;
}

export function buildTextMessageCommand(imei: string, message: string, journal?: string): string {
  const j = journal || generateJournalNumber();
  const hex = encodeUnicodeHex(message);
  return `IWBP40,${imei},${j},${hex}#`;
}

export function buildTextMessageAck(journal: string): string {
  return `IWAP40,${journal}#`;
}

export function buildSetSosCommand(
  imei: string,
  sos1: string,
  sos2: string,
  sos3: string,
  journal?: string
): string {
  const j = journal || generateJournalNumber();
  return `IWBP12,${imei},${j},${sos1},${sos2},${sos3}#`;
}

export function buildSetSosAck(journal: string, sos1: string, sos2: string, sos3: string): string {
  return `IWAP12,${journal},${sos1},${sos2},${sos3}#`;
}

export function buildLocateCommand(imei: string, journal?: string): string {
  const j = journal || generateJournalNumber();
  return `IWBP16,${imei},${j}#`;
}

export function buildLocateAck(journal: string): string {
  return `IWAP16,${journal}#`;
}

export function buildFallToggleCommand(imei: string, enabled: boolean, journal?: string): string {
  const j = journal || generateJournalNumber();
  return `IWBP76,${imei},${j},${enabled ? '1' : '0'}#`;
}

export function buildFallToggleAck(journal: string): string {
  return `IWAP76,${journal}#`;
}
