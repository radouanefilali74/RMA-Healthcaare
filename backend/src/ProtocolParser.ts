export interface ParsedCommand {
  command: string;
  payload: string[];
  raw: string;
}

export class ProtocolParser {
  static parse(data: string): ParsedCommand | null {
    const raw = data.trim();
    if (!raw.startsWith('IW') || !raw.endsWith('#')) {
      return null;
    }
    
    const command = raw.substring(2, 6); 
    let payloadStr = raw.substring(6, raw.length - 1);
    if (payloadStr.startsWith(',')) {
      payloadStr = payloadStr.substring(1);
    }

    let payload: string[] = [];
    if (command === 'AP00' || command === 'BP00') {
       if (payloadStr.includes(',')) {
           payload = payloadStr.split(',');
       } else {
           payload = [payloadStr]; 
       }
    } else {
       payload = payloadStr.split(',');
    }

    return {
      command,
      payload,
      raw
    };
  }
}
