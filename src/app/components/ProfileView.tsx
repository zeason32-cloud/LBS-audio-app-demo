import { ChevronRight, Clock, Heart, MapPin, Music, Route, Settings } from 'lucide-react';
import { Card, Cover, IconButton, Screen, ScreenHeader, SectionTitle } from './ui/kit';

export default function ProfileView() {
  const stats = [
    { label: '捕获地点', value: '24', tone: 'var(--location-500)' },
    { label: '收藏歌曲', value: '127', tone: 'var(--sound-500)' },
    { label: '完成路线', value: '12', tone: 'var(--route-500)' }
  ];

  const menu = [
    { icon: Heart, label: '我的收藏', count: '45 项', color: 'var(--social-500)' },
    { icon: Clock, label: '最近播放', count: '12 项', color: 'var(--location-500)' },
    { icon: MapPin, label: '我的地点', count: '8 项', color: 'var(--route-500)' },
    { icon: Music, label: '我的歌单', count: '5 个', color: 'var(--sound-500)' }
  ];

  return (
    <Screen>
      <ScreenHeader
        eyebrow="@music_explorer"
        title="我的"
        action={
          <IconButton variant="glass" size="lg" aria-label="设置">
            <Settings className="w-5 h-5" />
          </IconButton>
        }
      />

      <main className="px-5 space-y-5">
        {/* 身份卡 */}
        <Card level={3} radius="sheet" className="p-5">
          <div className="flex items-center gap-4 mb-5">
            <div
              className="w-18 h-18 r-card flex items-center justify-center text-white text-2xl font-bold"
              style={{ width: 72, height: 72, background: 'linear-gradient(145deg, var(--location-500), var(--route-500))' }}
            >
              ME
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold t-1">音乐探索者</h2>
              <p className="text-sm t-2 mt-0.5">等级 8 · 活跃 23 天</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {stats.map((stat) => (
              <div key={stat.label} className="surface-0 r-control p-3 text-center">
                <p className="text-xl font-bold" style={{ color: stat.tone }}>{stat.value}</p>
                <p className="text-xs t-2 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* 菜单 */}
        <Card level={1} radius="card" className="overflow-hidden divide-y" style={{ borderColor: 'transparent' }}>
          {menu.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className="pressable w-full min-h-[60px] px-4 flex items-center gap-3 text-left"
                style={index > 0 ? { borderTop: '1px solid var(--border-soft)' } : undefined}
              >
                <Cover color={item.color} size={40} radius={12}>
                  <Icon className="w-5 h-5" />
                </Cover>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold t-1">{item.label}</p>
                  <p className="text-sm t-2">{item.count}</p>
                </div>
                <ChevronRight className="w-5 h-5 t-3" />
              </button>
            );
          })}
        </Card>

        {/* 足迹 */}
        <section>
          <SectionTitle title="本周足迹" meta="常听区域" />
          <Card level={2} radius="card" className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <Cover color="var(--route-500)" size={40} radius={12}>
                <Route className="w-5 h-5" />
              </Cover>
              <div>
                <p className="font-semibold t-1">8.2 km</p>
                <p className="text-sm t-2">穿越 24 个声源</p>
              </div>
            </div>
            <div className="r-control overflow-hidden h-36" style={{ background: 'var(--surface-inverse)' }}>
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M-5 68 C18 52 38 74 58 56 S84 42 106 54" fill="none" stroke="#203456" strokeWidth="3" />
                <path d="M20 -4 C28 24 18 44 36 68 S48 86 44 106" fill="none" stroke="#1A2A47" strokeWidth="2.4" />
                <circle cx="30" cy="60" r="4.5" fill="var(--location-500)" />
                <circle cx="66" cy="42" r="4" fill="var(--route-500)" />
                <circle cx="78" cy="66" r="3.6" fill="var(--sound-500)" />
              </svg>
            </div>
          </Card>
        </section>
      </main>
    </Screen>
  );
}
