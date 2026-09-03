import React, { useState, useMemo } from 'react';
import { PacketLogEntry } from '../types.ts';
import {
  Terminal,
  Filter,
  Search,
  Pause,
  Play,
  Trash2,
  Download,
  Copy,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
  Info,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface PacketSnifferProps {
  packetLogs: PacketLogEntry[];
  onClearLogs?: () => void;
}

export const PacketSniffer: React.FC<PacketSnifferProps> = ({ packetLogs, onClearLogs }) => {
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'DEVICE->SERVER' | 'SERVER->DEVICE'>('ALL');
  const [commandFilter, setCommandFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [selectedPacket, setSelectedPacket] = useState<PacketLogEntry | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Available commands in the logs
  const availableCommands = useMemo(() => {
    const set = new Set<string>();
    packetLogs.forEach((p) => set.add(p.command));
    return ['ALL', ...Array.from(set)];
  }, [packetLogs]);

  // Filtered list
  const filteredPackets = useMemo(() => {
    return packetLogs.filter((pkt) => {
      if (directionFilter !== 'ALL' && pkt.direction !== directionFilter) return false;
      if (commandFilter !== 'ALL' && pkt.command !== commandFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchRaw = pkt.raw.toLowerCase().includes(query);
        const matchCmd = pkt.command.toLowerCase().includes(query);
        const matchDesc = pkt.description.toLowerCase().includes(query);
        if (!matchRaw && !matchCmd && !matchDesc) return false;
      }
      return true;
    });
  }, [packetLogs, directionFilter, commandFilter, searchQuery]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const exportLogs = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(packetLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `gps_watch_tcp_packets_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col">
      {/* Sniffer Top Bar */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 bg-zinc-50/70 dark:bg-zinc-950/40">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-zinc-900 text-emerald-400 rounded-lg">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>Raw TCP Stream Sniffer</span>
              <span className="text-[11px] font-mono px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 rounded-full">
                {filteredPackets.length} Packets
              </span>
            </h2>
            <p className="text-[11px] text-zinc-500">Live TCP port 5088 protocol framing (IW...#)</p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
              isPaused
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300'
            }`}
          >
            {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          <button
            onClick={exportLogs}
            className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium flex items-center gap-1 cursor-pointer"
            title="Export to JSON"
          >
            <Download className="w-3 h-3" />
            <span>Export</span>
          </button>

          {onClearLogs && (
            <button
              onClick={onClearLogs}
              className="px-2.5 py-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-red-100 dark:hover:bg-red-950 hover:text-red-600 text-zinc-600 dark:text-zinc-400 rounded-lg cursor-pointer"
              title="Clear Log"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-wrap items-center gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search payload string, IMEI, or command..."
            className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs"
          />
        </div>

        {/* Direction Filter */}
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg">
          <button
            onClick={() => setDirectionFilter('ALL')}
            className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
              directionFilter === 'ALL'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setDirectionFilter('DEVICE->SERVER')}
            className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer flex items-center gap-1 ${
              directionFilter === 'DEVICE->SERVER'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <ArrowUpRight className="w-3 h-3" />
            <span>Watch (AP)</span>
          </button>
          <button
            onClick={() => setDirectionFilter('SERVER->DEVICE')}
            className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer flex items-center gap-1 ${
              directionFilter === 'SERVER->DEVICE'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <ArrowDownLeft className="w-3 h-3" />
            <span>Server (BP)</span>
          </button>
        </div>

        {/* Command Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-400">Opcode:</span>
          <select
            value={commandFilter}
            onChange={(e) => setCommandFilter(e.target.value)}
            className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs font-mono font-semibold"
          >
            {availableCommands.map((cmd) => (
              <option key={cmd} value={cmd}>
                {cmd}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Area: Packet Table + Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 dark:divide-zinc-800">
        {/* Packets Log Feed (col-span-2) */}
        <div className="lg:col-span-2 h-96 overflow-y-auto font-mono text-xs">
          {filteredPackets.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 p-8 text-center">
              <Terminal className="w-8 h-8 stroke-1 mb-2 opacity-40" />
              <p className="font-sans text-sm">No packets match the current filter.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-500 uppercase tracking-wider z-10">
                <tr>
                  <th className="py-2 px-3">Time</th>
                  <th className="py-2 px-3">Direction</th>
                  <th className="py-2 px-3">Cmd</th>
                  <th className="py-2 px-3">Raw String Payload</th>
                  <th className="py-2 px-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {filteredPackets.map((pkt) => {
                  const isDevice = pkt.direction === 'DEVICE->SERVER';
                  const isSelected = selectedPacket?.id === pkt.id;

                  return (
                    <tr
                      key={pkt.id}
                      onClick={() => setSelectedPacket(pkt)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/40'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                      }`}
                    >
                      <td className="py-2 px-3 text-[10px] text-zinc-500 whitespace-nowrap">
                        {new Date(pkt.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isDevice
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                          }`}
                        >
                          {isDevice ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                          <span>{isDevice ? 'AP (WATCH)' : 'BP (SERVER)'}</span>
                        </span>
                      </td>
                      <td className="py-2 px-3 font-bold text-zinc-900 dark:text-zinc-100">{pkt.command}</td>
                      <td className="py-2 px-3 text-zinc-700 dark:text-zinc-300 max-w-xs truncate font-mono text-[11px]">
                        <span title={pkt.raw}>{pkt.raw}</span>
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(pkt.raw, pkt.id);
                          }}
                          className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1 cursor-pointer"
                          title="Copy raw string"
                        >
                          {copiedId === pkt.id ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Packet Inspector Drawer (col-span-1) */}
        <div className="p-4 h-96 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-950/30 text-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 text-sm">
              <Info className="w-4 h-4 text-blue-500" />
              <span>Packet Dissector</span>
            </h3>
            {selectedPacket && (
              <span className="font-mono text-[11px] text-zinc-500">
                {selectedPacket.command} ({selectedPacket.direction === 'DEVICE->SERVER' ? 'TX' : 'RX'})
              </span>
            )}
          </div>

          {!selectedPacket ? (
            <div className="h-48 flex flex-col items-center justify-center text-zinc-400 text-center">
              <Terminal className="w-6 h-6 mb-2 opacity-50" />
              <p className="font-medium text-xs">Select any packet from the table to inspect its frame structure.</p>
            </div>
          ) : (
            <div className="space-y-3 font-sans">
              {/* Raw Frame */}
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block mb-1">
                  Raw TCP Frame
                </span>
                <div className="bg-zinc-900 text-emerald-400 font-mono text-[11px] p-2.5 rounded-xl break-all border border-zinc-800 select-all">
                  {selectedPacket.raw}
                </div>
              </div>

              {/* Protocol Spec Breakdown */}
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block mb-1">
                  Protocol Dissection
                </span>
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-2.5 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Header ID:</span>
                    <span className="font-bold text-indigo-500">IW (Watch Protocol)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Command:</span>
                    <span className="font-bold text-amber-500">{selectedPacket.command}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Terminator:</span>
                    <span className="font-bold text-rose-500"># (End of Packet)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Transport:</span>
                    <span className="text-zinc-300">{selectedPacket.transport}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Timestamp:</span>
                    <span className="text-zinc-300">
                      {new Date(selectedPacket.timestamp).toISOString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Summary Description */}
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block mb-1">
                  Semantic Description
                </span>
                <p className="text-zinc-800 dark:text-zinc-200 bg-blue-50 dark:bg-blue-950/40 p-2.5 rounded-xl border border-blue-200 dark:border-blue-900/60 leading-relaxed font-medium">
                  {selectedPacket.description}
                </p>
              </div>

              {/* Parsed JSON fields */}
              {selectedPacket.parsed && Object.keys(selectedPacket.parsed).length > 0 && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block mb-1">
                    Decoded Key-Values
                  </span>
                  <div className="bg-zinc-900 text-zinc-200 font-mono text-[10px] p-2.5 rounded-xl overflow-x-auto border border-zinc-800">
                    <pre>{JSON.stringify(selectedPacket.parsed, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
