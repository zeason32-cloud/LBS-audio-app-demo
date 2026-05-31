import { ChevronDown, Heart, MapPin, MessageCircle, Pause, Play, Share2, SkipBack, SkipForward } from 'lucide-react';
import { useState } from 'react';
import type { Song } from '../data/audioDemo';
import { Card, Cover, IconButton, StatTrio } from './ui/kit';

interface SpatialMetrics {
  distance: number;
  gain: number;
  pan: number;
}

interface PlayerViewProps {
  song: Song;
  songs: Song[];
  isPlaying: boolean;
  currentTime: number;
  spatialMetrics: SpatialMetrics;
  onClose: () => void;
  onTogglePlay: () => void;
  onSkip: (step: number) => void;
  onSelectSong: (id: string) => void;
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function PlayerView({
  song,
  songs,
  isPlaying,
  currentTime,
  spatialMetrics,
  onClose,
  onTogglePlay,
  onSkip,
  onSelectSong
}: PlayerViewProps) {
  const [liked, setLiked] = useState(false);
  const progress = Math.min(100, (currentTime / song.duration) * 100);
  const panLabel = spatialMetrics.pan > 0.1 ? '右耳' : spatialMetrics.pan < -0.1 ? '左耳' : '居中';

  const actions = [
    { icon: MapPin, label: '查看地点', tone: 'var(--location-500)' },
    { icon: MessageCircle, label: '留言', tone: 'var(--social-500)' },
    { icon: Share2, label: '分享', tone: 'var(--route-500)' }
  ];

  return (
    <div className="app-surface h-full flex flex-col overflow-hidden">
      <header className="px-5 pt-safe pt-12 pb-3 flex items-center gap-3">
        <IconButton variant="glass" onClick={onClose} aria-label="收起播放器">
          <ChevronDown className="w-5 h-5" />
        </IconButton>
        <div className="flex-1 min-w-0 text-center">
          <p className="eyebrow">正在播放来自</p>
          <p className="text-sm font-semibold t-1 truncate flex items-center justify-center gap-1">
            <MapPin className="w-3.5 h-3.5" style={{ color: 'var(--location-500)' }} />
            {song.location}
          </p>
        </div>
        <IconButton
          variant="glass"
          onClick={() => setLiked(!liked)}
          aria-label="收藏"
          className={liked ? 'text-[var(--social-500)]' : ''}
        >
          <Heart className="w-5 h-5" style={liked ? { fill: 'var(--social-500)', color: 'var(--social-500)' } : undefined} />
        </IconButton>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar px-5 pb-8 space-y-4">
        {/* 黑胶 + 主控 */}
        <Card level={3} radius="sheet" className="p-5">
          <div
            className="mx-auto w-[248px] max-w-[72vw] aspect-square r-pill flex items-center justify-center mb-6"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${song.color} 0 14%, #14181F 15% 60%, ${song.color} 61% 64%, #14181F 65%)`,
              boxShadow: `0 24px 70px color-mix(in srgb, ${song.color} 28%, transparent)`
            }}
          >
            <div className={`w-[70%] h-[70%] rounded-full border border-white/20 ${isPlaying ? 'animate-spin-slow' : ''}`}>
              <div className="w-full h-full rounded-full border-[10px] border-white/10" />
            </div>
          </div>

          <div className="text-center mb-5">
            <h1 className="display t-1">{song.title}</h1>
            <p className="t-2 mt-1">{song.artist}</p>
          </div>

          {/* 进度条（更大触控目标） */}
          <div className="mb-5">
            <div className="h-2.5 r-pill bg-[var(--surface-0)] overflow-hidden">
              <div
                className="h-full r-pill transition-[width] duration-500"
                style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${song.color}, var(--route-500))` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs t-2">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(song.duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-7">
            <IconButton variant="glass" size="lg" onClick={() => onSkip(-1)} aria-label="上一首">
              <SkipBack className="w-5 h-5" />
            </IconButton>
            <button
              onClick={onTogglePlay}
              aria-label={isPlaying ? '暂停' : '播放'}
              className="pressable w-[72px] h-[72px] rounded-full flex items-center justify-center text-white"
              style={{ background: `linear-gradient(145deg, ${song.color}, var(--sound-500))`, boxShadow: `0 14px 36px color-mix(in srgb, ${song.color} 40%, transparent)` }}
            >
              {isPlaying ? <Pause className="w-8 h-8 fill-white" /> : <Play className="w-8 h-8 fill-white ml-1" />}
            </button>
            <IconButton variant="glass" size="lg" onClick={() => onSkip(1)} aria-label="下一首">
              <SkipForward className="w-5 h-5" />
            </IconButton>
          </div>
        </Card>

        {/* 上下文动作 */}
        <div className="grid grid-cols-3 gap-2.5">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <button key={a.label} className="pressable">
                <Card level={1} radius="control" className="py-3 flex flex-col items-center gap-1.5">
                  <Icon className="w-5 h-5" style={{ color: a.tone }} />
                  <span className="text-xs t-2">{a.label}</span>
                </Card>
              </button>
            );
          })}
        </div>

        {/* 空间指标 */}
        <Card level={2} radius="card" className="p-4">
          <p className="eyebrow mb-3">空间音频</p>
          <StatTrio
            items={[
              { label: '距离', value: `${Math.round(spatialMetrics.distance)} px` },
              { label: '增益', value: `${Math.round(spatialMetrics.gain * 100)}%` },
              { label: '声像', value: panLabel }
            ]}
          />
        </Card>

        {/* 播放队列 */}
        <section>
          <div className="flex items-center justify-between px-1 mb-3">
            <h2 className="text-lg font-semibold t-1">播放队列</h2>
            <span className="text-xs t-2">{songs.length} 首</span>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {songs.map((item) => {
              const current = item.id === song.id;
              return (
                <button key={item.id} onClick={() => onSelectSong(item.id)} className="pressable shrink-0">
                  <Card level={current ? 3 : 1} radius="card" className="w-[150px] p-3 text-left">
                    <Cover color={item.color} size={40} radius={12} />
                    <p className="font-semibold text-sm t-1 truncate mt-3">{item.title}</p>
                    <p className="text-xs t-2 truncate">{item.location}</p>
                  </Card>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
