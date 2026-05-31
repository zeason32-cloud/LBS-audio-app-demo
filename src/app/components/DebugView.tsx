import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActiveTrackDebug } from '../hooks/useSpatialAudio';

interface DebugViewProps {
  getDebugInfo: () => ActiveTrackDebug[];
  onClose: () => void;
}

function ChannelMeter({ label, rms, peak }: { label: string; rms: number; peak: number }) {
  const rmsPct = Math.min(rms * 300, 100);
  const peakPct = Math.min(peak * 300, 100);
  return (
    <div className="flex items-center gap-2 text-[11px] font-mono">
      <span className="w-4 text-[#8B949E] shrink-0">{label}</span>
      <div className="flex-1 h-3 rounded bg-[#1C2128] overflow-hidden relative">
        <div
          className="absolute inset-y-0 left-0 rounded bg-[#22C8A5]/40"
          style={{ width: `${rmsPct}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded bg-[#4C7DFF]"
          style={{ width: `${peakPct}%`, opacity: 0.6 }}
        />
        <div
          className="absolute inset-y-0 rounded"
          style={{ left: `${peakPct - 0.5}%`, width: '1.5px', backgroundColor: '#F59E0B' }}
        />
      </div>
      <span className="w-16 text-right text-[#8B949E]">{(rms * 1000).toFixed(1)}m</span>
    </div>
  );
}

function TrackCard({ track }: { track: ActiveTrackDebug }) {
  const roleColors: Record<string, string> = {
    main: '#4C7DFF',
    ambient: '#22C8A5',
    fading: '#F59E0B'
  };
  const roleLabels: Record<string, string> = {
    main: '主音源',
    ambient: '环境音',
    fading: '渐出'
  };

  return (
    <div className="rounded-xl bg-[#161B22] border border-[#30363D] p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: track.color }}
        />
        <span className="text-sm font-semibold text-[#E6EDF3] truncate flex-1">
          {track.title}
        </span>
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-bold"
          style={{
            backgroundColor: `${roleColors[track.role]}22`,
            color: roleColors[track.role],
            border: `1px solid ${roleColors[track.role]}44`
          }}
        >
          {roleLabels[track.role]}
        </span>
        <span className="text-[10px] text-[#8B949E] font-mono">
          {track.sourceType}
        </span>
      </div>

      <div className="text-[11px] text-[#8B949E] font-mono">
        {track.artist}
      </div>

      <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
        <div>
          <span className="text-[#8B949E]">Gain </span>
          <span className="text-[#E6EDF3]">{(track.gainValue * 100).toFixed(1)}%</span>
        </div>
        <div>
          <span className="text-[#8B949E]">Pan </span>
          <span style={{ color: track.panValue > 0.05 ? '#4C7DFF' : track.panValue < -0.05 ? '#22C8A5' : '#E6EDF3' }}>
            {track.panValue > 0.05 ? 'R' : track.panValue < -0.05 ? 'L' : 'C'} {track.panValue.toFixed(2)}
          </span>
        </div>
        <div>
          <span className="text-[#8B949E]">Vol </span>
          <span className="text-[#E6EDF3]">{(track.gainValue * (1 - Math.abs(track.panValue) * 0.3) * 100).toFixed(0)}%</span>
        </div>
      </div>

      <div className="space-y-1">
        <ChannelMeter label="L" rms={track.leftRms} peak={track.leftPeak} />
        <ChannelMeter label="R" rms={track.rightRms} peak={track.rightPeak} />
      </div>
    </div>
  );
}

export default function DebugView({ getDebugInfo, onClose }: DebugViewProps) {
  const [tracks, setTracks] = useState<ActiveTrackDebug[]>([]);
  const [fps, setFps] = useState(0);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());

  const update = useCallback(() => {
    setTracks(getDebugInfo());
    frameCountRef.current += 1;
    const now = performance.now();
    if (now - lastFpsTimeRef.current >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      lastFpsTimeRef.current = now;
    }
  }, [getDebugInfo]);

  useEffect(() => {
    const id = setInterval(update, 80);
    return () => clearInterval(id);
  }, [update]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'z' || e.key === 'Z' || e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#0D1117]/95 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 pt-12 pb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-[#E6EDF3]">Audio Debug</h1>
            <p className="text-xs text-[#8B949E]">按 Z / Esc 关闭 · 按 M 切换纯净地图 · {fps} fps · {tracks.length} 轨道</p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-[#21262D] text-[#8B949E] text-sm hover:bg-[#30363D]"
          >
            关闭
          </button>
        </div>

        {tracks.length === 0 ? (
          <div className="text-center py-12 text-[#8B949E]">
            <p className="text-sm">当前没有播放中的音频</p>
            <p className="text-xs mt-1">开始播放后此处会显示实时音频数据</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tracks.map((track) => (
              <TrackCard key={`${track.songId}-${track.role}`} track={track} />
            ))}
          </div>
        )}

        {tracks.length > 0 && (
          <div className="mt-4 p-3 rounded-xl bg-[#161B22] border border-[#30363D]">
            <p className="text-[11px] text-[#8B949E] font-mono mb-2">混音总览</p>
            <div className="flex items-end gap-1 h-16">
              {tracks.map((track, i) => {
                const maxRms = Math.max(track.leftRms, track.rightRms) * 300;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${Math.min(maxRms, 100)}%`,
                        backgroundColor: track.color,
                        opacity: track.role === 'fading' ? 0.4 : 0.8,
                        minHeight: '2px'
                      }}
                    />
                    <span className="text-[9px] text-[#8B949E] truncate max-w-full">
                      {track.title.slice(0, 3)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
