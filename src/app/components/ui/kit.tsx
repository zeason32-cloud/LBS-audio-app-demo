/**
 * UI Kit — 轻量布局/控件原语，组成整个 App 的视觉框架。
 * 只消费 theme.css 中的语义 token（surface-* / r-* / t-* / 功能色）。
 * 想换风格：改 theme.css 的 token；想加素材：往这些原语里塞内容即可。
 */
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

function cx(...parts: Array<string | false | undefined | null>) {
  return parts.filter(Boolean).join(' ');
}

/* ---------- Screen：统一页面容器 + 顶部安全区 ---------- */
export function Screen({
  children,
  scroll = true,
  padBottom = true,
  className
}: {
  children: ReactNode;
  scroll?: boolean;
  padBottom?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'app-surface h-full w-full max-w-full flex flex-col overflow-x-hidden',
        scroll ? 'overflow-y-auto' : 'overflow-hidden',
        padBottom && 'pb-28',
        className
      )}
    >
      {children}
    </div>
  );
}

/* ---------- ScreenHeader：标题 + 可选右侧动作 ---------- */
export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  action
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="px-6 pt-safe pt-12 pb-3 flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="text-3xl font-bold tracking-tight t-1 truncate">{title}</h1>
        {subtitle && <p className="text-sm t-2 mt-1 truncate">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

/* ---------- IconButton：圆形图标按钮（≥44px 触控区） ---------- */
type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'glass' | 'solid' | 'ghost' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  tone?: string; // 强调色（用于 accent / solid 背景）
};
export function IconButton({
  variant = 'glass',
  size = 'md',
  tone,
  className,
  style,
  children,
  ...rest
}: IconButtonProps) {
  const sizes = { sm: 'w-10 h-10', md: 'w-11 h-11', lg: 'w-12 h-12' };
  const variants: Record<string, string> = {
    glass: 'surface-2 t-1',
    ghost: 'bg-transparent t-2',
    solid: 'text-white',
    accent: 'text-white'
  };
  const bg =
    variant === 'solid'
      ? { background: tone ?? 'var(--ink-900, #0F1729)' }
      : variant === 'accent'
        ? { background: tone ?? 'var(--location-500)' }
        : undefined;
  return (
    <button
      {...rest}
      style={{ ...bg, ...style }}
      className={cx('icon-btn shrink-0', sizes[size], variants[variant], className)}
    >
      {children}
    </button>
  );
}

/* ---------- Card：统一卡片表面 ---------- */
export function Card({
  level = 1,
  radius = 'card',
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  level?: 1 | 2 | 3;
  radius?: 'control' | 'card' | 'sheet';
}) {
  const surf = { 1: 'surface-1', 2: 'surface-2', 3: 'surface-3' }[level];
  const r = { control: 'r-control', card: 'r-card', sheet: 'r-sheet' }[radius];
  return (
    <div {...rest} className={cx(surf, r, className)}>
      {children}
    </div>
  );
}

/* ---------- SectionTitle：区块标题 + 辅助信息 ---------- */
export function SectionTitle({
  title,
  meta,
  action
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3 px-1">
      <h2 className="text-lg font-semibold t-1">{title}</h2>
      {action ?? (meta && <span className="text-xs t-2">{meta}</span>)}
    </div>
  );
}

/* ---------- SegmentedTabs：信息流筛选 ---------- */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={cx(
              'pressable shrink-0 px-4 h-9 r-pill text-sm transition-colors',
              active ? 'bg-[var(--ink-900)] text-white font-semibold' : 'surface-1 t-2'
            )}
            style={{ minHeight: 36 }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Badge：小标签 ---------- */
export function Badge({
  children,
  tone = 'var(--location-500)'
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 r-pill text-[11px] font-semibold"
      style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}
    >
      {children}
    </span>
  );
}

/* ---------- StatTrio：三列数据展示（空间指标等复用） ---------- */
export function StatTrio({
  items
}: {
  items: { label: string; value: string }[];
}) {
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {items.map((it) => (
        <div key={it.label}>
          <p className="text-[11px] t-3">{it.label}</p>
          <p className="text-sm font-semibold t-1 mt-0.5">{it.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------- Cover：统一封面占位（接素材时换 img 即可） ---------- */
export function Cover({
  color,
  size = 48,
  radius = 16,
  children
}: {
  color: string;
  size?: number;
  radius?: number;
  children?: ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-center shrink-0 text-white"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `linear-gradient(145deg, ${color}, color-mix(in srgb, ${color} 35%, #0F1729))`
      }}
    >
      {children}
    </div>
  );
}
