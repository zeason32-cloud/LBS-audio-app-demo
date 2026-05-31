import { Map, Pause, Play, Route, Search } from 'lucide-react';
import { useState } from 'react';
import type { Song } from '../data/audioDemo';
import { Badge, Card, Cover, Screen, ScreenHeader, SectionTitle, SegmentedTabs, IconButton } from './ui/kit';

interface ExploreViewProps {
  songs: Song[];
  catalogStatus: 'loading' | 'backend' | 'demo' | 'error';
  currentSongId: string;
  isPlaying: boolean;
  onSongSelect: (song: Song) => void;
  onNavigateToMap: () => void;
  onTogglePlay: () => void;
}

type Filter = 'nearby' | 'latest' | 'trending' | 'routes';
const filters: { id: Filter; label: string }[] = [
  { id: 'nearby', label: '附近' },
  { id: 'latest', label: '最新' },
  { id: 'trending', label: '热门' },
  { id: 'routes', label: '路线' }
];

/* 静态迷你波形——接入真实分析数据前的视觉占位 */
function Waveform({ active, color }: { active: boolean; color: string }) {
  const bars = [6, 11, 7, 14, 9, 13, 5, 10, 8];
  return (
    <div className="flex items-end gap-[3px] h-4" aria-hidden>
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full"
          style={{
            height: h,
            background: active ? color : 'var(--ink-200)',
            opacity: active ? 0.9 : 1
          }}
        />
      ))}
    </div>
  );
}

export default function ExploreView({
  songs,
  catalogStatus,
  currentSongId,
  isPlaying,
  onSongSelect,
  onNavigateToMap,
  onTogglePlay
}: ExploreViewProps) {
  const [filter, setFilter] = useState<Filter>('nearby');
  const activeSong = songs.find((song) => song.id === currentSongId) ?? songs[0];
  const catalogLabel = { backend: '后端音源', demo: '演示音源', error: '后端离线', loading: '加载中' }[catalogStatus];

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Campus sound layer"
        title="探索"
        subtitle={`${catalogLabel} · ${songs.length} 个声源`}
        action={
          <IconButton variant="glass" size="lg" onClick={onNavigateToMap} aria-label="打开音乐地图">
            <Map className="w-5 h-5" style={{ color: 'var(--location-500)' }} />
          </IconButton>
        }
      />

      <main className="flex-1 px-5 space-y-5">
        {/* 搜索 */}
        <div className="surface-1 r-pill h-12 px-4 flex items-center gap-2 t-3">
          <Search className="w-4 h-4" />
          <span className="text-sm truncate">搜索地点、歌单或路线</span>
        </div>

        {/* 当前播放 */}
        {activeSong && (
          <Card level={2} radius="card" className="p-3">
            <div className="flex items-center gap-3">
              <Cover color={activeSong.color} size={52} radius={16}>
                <Waveform active={isPlaying} color="#fff" />
              </Cover>
              <div className="min-w-0 flex-1">
                <p className="eyebrow mb-0.5">现在听到</p>
                <h3 className="font-semibold t-1 truncate">{activeSong.title}</h3>
                <p className="text-sm t-2 truncate">{activeSong.location}</p>
              </div>
              <IconButton
                variant="solid"
                size="lg"
                onClick={onTogglePlay}
                aria-label={isPlaying ? '暂停' : '播放'}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
              </IconButton>
            </div>
          </Card>
        )}

        {/* 筛选 */}
        <SegmentedTabs options={filters} value={filter} onChange={setFilter} />

        {/* 声源列表 */}
        <section>
          <SectionTitle title="声源" meta={`${songs.length} 个可播放点`} />
          <div className="space-y-2.5">
            {songs.map((song) => {
              const active = song.id === currentSongId;
              return (
                <button
                  key={song.id}
                  onClick={() => onSongSelect(song)}
                  className="pressable w-full text-left"
                >
                  <Card
                    level={1}
                    radius="control"
                    className="p-3 flex items-center gap-3"
                    style={active ? { boxShadow: '0 0 0 1.5px color-mix(in srgb, var(--location-500) 45%, transparent), var(--elev-1)' } : undefined}
                  >
                    <Cover color={song.color} size={48} radius={14}>
                      <Waveform active={active && isPlaying} color="#fff" />
                    </Cover>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold t-1 truncate">{song.title}</h3>
                        {active && isPlaying && <Badge tone="var(--location-500)">ON</Badge>}
                      </div>
                      <p className="text-sm t-2 truncate">{song.artist} · {song.location}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <Badge tone="var(--route-500)">{song.distance}</Badge>
                      <span className="t-3">
                        {active && isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </span>
                    </div>
                  </Card>
                </button>
              );
            })}
          </div>
        </section>

        {/* 路线卡片 */}
        <section>
          <SectionTitle title="校园慢行路线" />
          <Card level={2} radius="card" className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Cover color="var(--route-500)" size={44} radius={14}>
                <Route className="w-5 h-5" />
              </Cover>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold t-1 truncate">湖畔到操场</h3>
                <p className="text-sm t-2">5 个声源 · 12 分钟 · 1.4km</p>
              </div>
            </div>
            <button
              onClick={onNavigateToMap}
              className="pressable w-full h-11 r-pill text-white text-sm font-semibold"
              style={{ background: 'var(--route-500)' }}
            >
              开始漫游
            </button>
          </Card>
        </section>
      </main>
    </Screen>
  );
}
