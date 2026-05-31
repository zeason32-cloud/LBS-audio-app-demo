import { ChevronDown, Crosshair, LocateFixed, Maximize2, Minimize2, Music2, Pause, Play, Route, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import type { GeoPoint, Position2D, Song } from '../data/audioDemo';
import { Card, Cover, StatTrio } from './ui/kit';

interface SpatialMetrics {
  distance: number;
  gain: number;
  pan: number;
}

interface MapViewProps {
  songs: Song[];
  listener: Position2D;
  currentSongId: string;
  isPlaying: boolean;
  spatialMetrics: SpatialMetrics;
  gpsMode: 'simulated' | 'device';
  gpsStatus: string;
  userLocation: GeoPoint | null;
  heading: number | null;
  compassStatus: 'idle' | 'active' | 'denied' | 'unsupported';
  minimal?: boolean;
  onBack: () => void;
  onSongSelect: (song: Song) => void;
  onMoveListener: (position: Position2D) => void;
  onUseDeviceGps: () => void;
  onUseSimulatedGps: () => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const TILE_SIZE = 256;
const TILE_ZOOM = 17;

function latLngToPixel(lat: number, lng: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale
  };
}

function getMapTiles(center: GeoPoint) {
  const centerPx = latLngToPixel(center.lat, center.lng, TILE_ZOOM);
  const centerTileX = Math.floor(centerPx.x / TILE_SIZE);
  const centerTileY = Math.floor(centerPx.y / TILE_SIZE);
  const tiles = [];

  for (let dx = -3; dx <= 3; dx += 1) {
    for (let dy = -3; dy <= 3; dy += 1) {
      const x = centerTileX + dx;
      const y = centerTileY + dy;
      tiles.push({
        key: `${x}-${y}`,
        url: `https://tile.openstreetmap.org/${TILE_ZOOM}/${x}/${y}.png`,
        left: x * TILE_SIZE - centerPx.x,
        top: y * TILE_SIZE - centerPx.y
      });
    }
  }

  return tiles;
}

export default function MapView({
  songs,
  listener,
  currentSongId,
  isPlaying,
  spatialMetrics,
  gpsMode,
  gpsStatus,
  userLocation,
  heading,
  compassStatus,
  minimal = false,
  onBack,
  onSongSelect,
  onMoveListener,
  onUseDeviceGps,
  onUseSimulatedGps
}: MapViewProps) {
  const [selectedId, setSelectedId] = useState(currentSongId);
  const [panelOpen, setPanelOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const dragging = useRef(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const selectedSong = songs.find((s) => s.id === selectedId) ?? songs[0];
  const activeSong = songs.find((s) => s.id === currentSongId);
  const mapTiles = userLocation ? getMapTiles(userLocation) : [];
  const compassText = compassStatus === 'active' && heading !== null
    ? `罗盘 ${Math.round(heading)}°`
    : compassStatus === 'denied'
      ? '罗盘未授权'
      : compassStatus === 'unsupported'
        ? '不支持罗盘'
        : '罗盘待授权';

  const positionFromEvent = useCallback((clientX: number, clientY: number) => {
    if (!mapRef.current) return null;
    const rect = mapRef.current.getBoundingClientRect();
    return {
      x: clamp(((clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((clientY - rect.top) / rect.height) * 100, 0, 100)
    };
  }, []);

  const isControl = (t: EventTarget | null) =>
    (t as HTMLElement)?.closest?.('button') || (t as HTMLElement)?.closest?.('[data-listener]') || (t as HTMLElement)?.closest?.('[data-sheet]');

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (isControl(e.target)) return;
    const pos = positionFromEvent(e.clientX, e.clientY);
    if (pos) onMoveListener(pos);
  }, [onMoveListener, positionFromEvent]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (isControl(e.target)) return;
    setFullscreen((f) => !f);
  }, []);

  const handleListenerPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleListenerPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const pos = positionFromEvent(e.clientX, e.clientY);
    if (pos) onMoveListener(pos);
  }, [onMoveListener, positionFromEvent]);

  const handleListenerPointerUp = useCallback(() => { dragging.current = false; }, []);

  const showChrome = !fullscreen && !minimal;

  return (
    <div
      ref={mapRef}
      className={`h-full relative overflow-hidden ${fullscreen ? 'fixed inset-0 z-50' : ''}`}
      style={{ background: 'var(--surface-inverse)' }}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
    >
      {userLocation ? (
        <>
          <div className="absolute inset-0 overflow-hidden bg-[#0B1220]">
            {mapTiles.map((tile) => (
              <img
                key={tile.key}
                src={tile.url}
                alt=""
                className="absolute h-64 w-64 max-w-none select-none"
                draggable={false}
                style={{
                  left: `calc(50% + ${tile.left}px)`,
                  top: `calc(50% + ${tile.top}px)`,
                  filter: 'saturate(0.82) contrast(1.05) brightness(0.72)'
                }}
              />
            ))}
          </div>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(4,10,20,0.28)' }} />
          <div className="absolute right-3 bottom-3 z-[1] rounded bg-black/45 px-1.5 py-0.5 text-[10px] text-white/75">
            © OpenStreetMap
          </div>
        </>
      ) : (
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          <rect width="100" height="100" fill="#0B1220" />
          <path d="M-5 78 C20 70 35 86 60 76 S95 64 110 74 L110 110 -5 110 Z" fill="#102A43" opacity="0.6" />
          <circle cx="28" cy="34" r="13" fill="#123524" opacity="0.7" />
          <circle cx="74" cy="62" r="10" fill="#123524" opacity="0.6" />
          {[18, 40, 62, 84].map((x) =>
            [16, 40, 64].map((y) => (
              <rect key={`${x}-${y}`} x={x - 8} y={y - 8} width="16" height="16" rx="2.5" fill="#0F1B30" opacity="0.7" />
            ))
          )}
          <g stroke="#1C2B45" strokeWidth="2.2" fill="none" strokeLinecap="round">
            <path d="M0 28 H100" />
            <path d="M0 52 H100" />
            <path d="M0 76 H100" />
            <path d="M30 0 V100" />
            <path d="M70 0 V100" />
          </g>
        </svg>
      )}

      {/* listener → 当前音源 连线 */}
      {activeSong && isPlaying && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line
            x1={listener.x} y1={listener.y}
            x2={activeSong.position.x} y2={activeSong.position.y}
            stroke={activeSong.color} strokeWidth="0.5" strokeDasharray="1.8 1.4"
            opacity={0.3 + spatialMetrics.gain * 0.5}
          />
        </svg>
      )}

      {/* 顶部栏 */}
      {showChrome && (
        <div className="absolute left-0 right-0 top-0 z-10 px-5 pt-safe pt-12">
          <div className="surface-3 r-pill px-2.5 py-2 flex items-center gap-3">
            <button onClick={onBack} className="icon-btn surface-1 t-1" aria-label="返回">
              <X className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0 text-center">
              <h1 className="text-base font-bold t-1">音乐地图</h1>
              <p className="text-xs t-2 truncate">{gpsStatus} · {compassText}</p>
            </div>
            <button
              onClick={gpsMode === 'simulated' ? onUseDeviceGps : onUseSimulatedGps}
              className="icon-btn text-white"
              style={{ background: 'var(--location-500)' }}
              aria-label="定位模式"
            >
              {gpsMode === 'simulated' ? <LocateFixed className="w-5 h-5" /> : <Crosshair className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}

      {/* 全屏切换 */}
      <div className={`absolute right-4 z-20 ${fullscreen ? 'top-4' : 'top-24'}`}>
        <button
          onClick={() => setFullscreen((f) => !f)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white/80"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)' }}
          aria-label={fullscreen ? '退出全屏' : '全屏'}
        >
          {fullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
      </div>

      {/* 音源 marker */}
      {songs.map((song) => {
        const selected = selectedSong.id === song.id;
        const active = activeSong?.id === song.id && isPlaying;
        const dx = song.position.x - listener.x;
        const dy = song.position.y - listener.y;
        const localGain = Math.max(0, (62 - Math.hypot(dx, dy)) / 62);

        return (
          <button
            key={song.id}
            onClick={(e) => { e.stopPropagation(); setSelectedId(song.id); }}
            className="absolute z-[2] -translate-x-1/2 -translate-y-1/2 min-h-0"
            style={{ left: `${song.position.x}%`, top: `${song.position.y}%` }}
            aria-label={song.title}
          >
            {/* 声场范围 */}
            <span
              className="absolute left-1/2 top-1/2 rounded-full -translate-x-1/2 -translate-y-1/2"
              style={{
                width: 56 + localGain * 56,
                height: 56 + localGain * 56,
                background: song.color,
                opacity: active ? 0.22 : 0.1
              }}
            />
            {active && (
              <span
                className="absolute left-1/2 top-1/2 w-12 h-12 rounded-full -translate-x-1/2 -translate-y-1/2 animate-pulse-ring"
                style={{ background: song.color }}
              />
            )}
            <span
              className={`relative flex items-center justify-center rounded-full text-white transition-transform ${selected ? 'scale-110' : ''}`}
              style={{
                width: 40, height: 40,
                background: `linear-gradient(145deg, ${song.color}, #14181F)`,
                boxShadow: selected ? '0 0 0 3px rgba(255,255,255,0.35), 0 8px 20px rgba(0,0,0,0.4)' : '0 6px 16px rgba(0,0,0,0.4)'
              }}
            >
              <Music2 className="w-4 h-4" />
            </span>
          </button>
        );
      })}

      {/* listener 蓝点 */}
      <div
        data-listener
        className="absolute z-[3] -translate-x-1/2 -translate-y-1/2 touch-none cursor-grab active:cursor-grabbing"
        style={{ left: `${listener.x}%`, top: `${listener.y}%` }}
        onPointerDown={handleListenerPointerDown}
        onPointerMove={handleListenerPointerMove}
        onPointerUp={handleListenerPointerUp}
      >
        <div className="relative">
          {heading !== null && (
            <div
              className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{ transform: `translate(-50%, -50%) rotate(${heading}deg)` }}
            >
              <div
                className="absolute left-1/2 top-0 h-4 w-2 -translate-x-1/2"
                style={{
                  background: 'var(--location-500)',
                  clipPath: 'polygon(50% 0, 100% 100%, 50% 78%, 0 100%)',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))'
                }}
              />
            </div>
          )}
          <div className="absolute left-1/2 top-1/2 w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full animate-pulse-ring" style={{ background: 'var(--location-500)' }} />
          <div
            className="relative w-5 h-5 rounded-full border-[3px] border-white"
            style={{ background: 'var(--location-500)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
          />
        </div>
      </div>

      {/* 底部 sheet */}
      {showChrome && (
        <div data-sheet className="absolute left-0 right-0 bottom-0 z-10">
          <div className="flex justify-center pb-1">
            <button
              onClick={() => setPanelOpen((v) => !v)}
              className="w-12 h-7 flex items-center justify-center rounded-full text-white/70"
              style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)' }}
              aria-label={panelOpen ? '收起' : '展开'}
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${panelOpen ? '' : 'rotate-180'}`} />
            </button>
          </div>

          <div
            className="transition-transform duration-300"
            style={{ transform: panelOpen ? 'translateY(0)' : 'translateY(100%)', transitionTimingFunction: 'var(--ease-out)' }}
          >
            <div className="px-5 pb-28 space-y-3">
              {/* 选中音源 */}
              <Card level={3} radius="sheet" className="p-4">
                <div className="flex items-center gap-3">
                  <Cover color={selectedSong.color} size={52} radius={16}>
                    <Music2 className="w-5 h-5" />
                  </Cover>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold t-1 truncate">{selectedSong.title}</h2>
                    <p className="text-sm t-2 truncate">{selectedSong.artist} · {selectedSong.location}</p>
                  </div>
                  <button
                    onClick={() => onSongSelect(selectedSong)}
                    className="pressable w-12 h-12 rounded-full text-white flex items-center justify-center"
                    style={{ background: selectedSong.color }}
                    aria-label="播放"
                  >
                    {activeSong?.id === selectedSong.id && isPlaying
                      ? <Pause className="w-5 h-5 fill-white" />
                      : <Play className="w-5 h-5 fill-white ml-0.5" />}
                  </button>
                </div>
              </Card>

              {/* 空间指标 */}
              <Card level={2} radius="card" className="p-3">
                <StatTrio
                  items={[
                    { label: '距离', value: `${Math.round(spatialMetrics.distance)} px` },
                    { label: '增益', value: `${Math.round(spatialMetrics.gain * 100)}%` },
                    { label: '声像', value: spatialMetrics.pan > 0.1 ? '右' : spatialMetrics.pan < -0.1 ? '左' : '中' }
                  ]}
                />
                <div className="mt-3 h-1.5 r-pill overflow-hidden" style={{ background: 'var(--surface-0)' }}>
                  <div
                    className="h-full r-pill"
                    style={{ width: `${Math.round(spatialMetrics.gain * 100)}%`, background: 'linear-gradient(90deg, var(--location-500), var(--route-500))' }}
                  />
                </div>
              </Card>

              <button
                onClick={onUseSimulatedGps}
                className="pressable w-full h-12 r-pill flex items-center justify-center gap-2 text-sm font-semibold text-white"
                style={{ background: 'var(--route-500)' }}
              >
                <Route className="w-4 h-4" />
                开启安静漫游
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
