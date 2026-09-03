import React, { useState } from 'react';
import { BookOpen, X, Code, CheckCircle, ArrowRight } from 'lucide-react';

interface ProtocolDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProtocolDocsModal: React.FC<ProtocolDocsModalProps> = ({ isOpen, onClose }) => {
  const [activeCategory, setActiveCategory] = useState<'device' | 'server' | 'format'>('device');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-3xl rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-500" />
            <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
              GPS Watch Protocol V1.1 Specification Reference
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-4 pt-2 bg-zinc-50 dark:bg-zinc-950 text-xs">
          <button
            onClick={() => setActiveCategory('format')}
            className={`px-3 py-2 font-semibold border-b-2 cursor-pointer ${
              activeCategory === 'format'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-zinc-500'
            }`}
          >
            Protocol Frame Syntax
          </button>
          <button
            onClick={() => setActiveCategory('device')}
            className={`px-3 py-2 font-semibold border-b-2 cursor-pointer ${
              activeCategory === 'device'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-zinc-500'
            }`}
          >
            Device → Server (AP Packets)
          </button>
          <button
            onClick={() => setActiveCategory('server')}
            className={`px-3 py-2 font-semibold border-b-2 cursor-pointer ${
              activeCategory === 'server'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-zinc-500'
            }`}
          >
            Server → Device (BP Packets)
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {activeCategory === 'format' && (
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900/60">
                <span className="font-bold text-blue-900 dark:text-blue-200 block mb-1">Standard Frame Structure</span>
                <code className="font-mono text-sm bg-white dark:bg-zinc-900 px-2 py-1 rounded border border-blue-200 dark:border-blue-800 text-indigo-600 dark:text-indigo-400 font-bold block mb-2">
                  IW + &lt;COMMAND: 4 chars&gt; + &lt;PAYLOAD: comma-separated&gt; + #
                </code>
                <ul className="list-disc pl-4 space-y-1 text-zinc-700 dark:text-zinc-300">
                  <li><strong>IW</strong>: Fixed 2-byte protocol identifier prefix.</li>
                  <li><strong>Command</strong>: 4-character opcode (e.g. <code>AP00</code>, <code>AP03</code>, <code>APHP</code>, <code>AP10</code>, <code>BPXL</code>, <code>BP86</code>).</li>
                  <li><strong>Payload</strong>: Parameter values separated by commas.</li>
                  <li><strong>#</strong>: Mandatory message frame terminator.</li>
                </ul>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-1">
                <span className="font-bold text-zinc-800 dark:text-zinc-200 block">Unicode Text Encoding</span>
                <p className="text-zinc-600 dark:text-zinc-400">
                  All human text (addresses, names, messages in BP40/AP40) is encoded as 4-character UTF-16 Big-Endian hexadecimal strings. Example: <code>"Are you ok?"</code> converts to <code>00410072006500200079006f00750020006f006b003f</code>.
                </p>
              </div>
            </div>
          )}

          {activeCategory === 'device' && (
            <div className="space-y-3">
              {/* AP00 */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-1">
                <div className="flex justify-between font-bold text-zinc-900 dark:text-zinc-100">
                  <span>AP00: Login Package</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">Replies: BP00</span>
                </div>
                <code className="font-mono text-[11px] bg-zinc-900 text-emerald-400 p-1.5 rounded block">
                  IWAP00353456789012345#
                </code>
                <p className="text-zinc-600 dark:text-zinc-400 text-[11px]">
                  Sent every time device establishes TCP socket connection. Contains 15-digit IMEI.
                </p>
              </div>

              {/* AP03 */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-1">
                <div className="flex justify-between font-bold text-zinc-900 dark:text-zinc-100">
                  <span>AP03: Heartbeat Package</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">Replies: BP03</span>
                </div>
                <code className="font-mono text-[11px] bg-zinc-900 text-emerald-400 p-1.5 rounded block">
                  IWAP03,06000908000102,5555,30#
                </code>
                <p className="text-zinc-600 dark:text-zinc-400 text-[11px]">
                  Fields: GSM (060), Satellites (009), Battery% (080), Space (0), Fortification (01), Working Mode (02), Steps (5555), Rolls (30).
                </p>
              </div>

              {/* APHP */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-1">
                <div className="flex justify-between font-bold text-zinc-900 dark:text-zinc-100">
                  <span>APHP: Health Telemetry Package</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">Replies: BPHP</span>
                </div>
                <code className="font-mono text-[11px] bg-zinc-900 text-emerald-400 p-1.5 rounded block">
                  IWAPHP,60,130,85,95,90,36.5,,,,,,,#
                </code>
                <p className="text-zinc-600 dark:text-zinc-400 text-[11px]">
                  Fields: Heart Rate (60), SBP (130), DBP (85), SpO2 (95), Blood Sugar (90), Temperature (36.5).
                </p>
              </div>

              {/* AP10 */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-1">
                <div className="flex justify-between font-bold text-zinc-900 dark:text-zinc-100">
                  <span>AP10: Alarm &amp; Return Address Package</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">Replies: BP10</span>
                </div>
                <code className="font-mono text-[11px] bg-zinc-900 text-emerald-400 p-1.5 rounded block break-all">
                  IWAP10080524A2232.9806N11404.9355E000.1061830323.8706000908000502,460,0,9520,3671,00,zh-cn,00,HOME|74-DE-2B-44-88-8C|97#
                </code>
                <p className="text-zinc-600 dark:text-zinc-400 text-[11px]">
                  Alarm codes: 01 = SOS Emergency, 05/06 = Fall down alert, 03 = Not wear, 00 = Normal.
                </p>
              </div>
            </div>
          )}

          {activeCategory === 'server' && (
            <div className="space-y-3">
              {/* BP00 */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-1">
                <div className="flex justify-between font-bold text-zinc-900 dark:text-zinc-100">
                  <span>BP00: Login Response</span>
                </div>
                <code className="font-mono text-[11px] bg-zinc-900 text-blue-400 p-1.5 rounded block">
                  IWBP00,20260903125223,1#
                </code>
                <p className="text-zinc-600 dark:text-zinc-400 text-[11px]">
                  Format: UTC Server Timestamp (YYYYMMDDHHmmss) and Timezone.
                </p>
              </div>

              {/* BPXL */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-1">
                <div className="flex justify-between font-bold text-zinc-900 dark:text-zinc-100">
                  <span>BPXL: Instant Heart Rate Test Request</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">Watch Acks: APXL</span>
                </div>
                <code className="font-mono text-[11px] bg-zinc-900 text-blue-400 p-1.5 rounded block">
                  IWBPXL,353456789012345,080835#
                </code>
                <p className="text-zinc-600 dark:text-zinc-400 text-[11px]">
                  Requests device to activate optical heart rate monitor. Device replies with <code>IWAPXL,080835#</code>, then uploads <code>IWAP49</code> or <code>IWAPHP</code>.
                </p>
              </div>

              {/* BP86 */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-1">
                <div className="flex justify-between font-bold text-zinc-900 dark:text-zinc-100">
                  <span>BP86: Set Auto-HR Test Interval</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">Watch Acks: AP86</span>
                </div>
                <code className="font-mono text-[11px] bg-zinc-900 text-blue-400 p-1.5 rounded block">
                  IWBP86,353456789012345,080835,1,720#
                </code>
                <p className="text-zinc-600 dark:text-zinc-400 text-[11px]">
                  Parameters: 1 = Turn on auto measurement (0 = close), 720 = Interval in minutes.
                </p>
              </div>

              {/* BP40 */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-1">
                <div className="flex justify-between font-bold text-zinc-900 dark:text-zinc-100">
                  <span>BP40: Send Text Message</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">Watch Acks: AP40</span>
                </div>
                <code className="font-mono text-[11px] bg-zinc-900 text-blue-400 p-1.5 rounded block break-all">
                  IWBP40,353456789012345,080835,00610072006500200079006f00750020006f006b003f#
                </code>
                <p className="text-zinc-600 dark:text-zinc-400 text-[11px]">
                  Displays text on the watch screen. Message is encoded in 4-digit Unicode hex.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            Close Reference
          </button>
        </div>
      </div>
    </div>
  );
};
