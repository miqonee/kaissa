/**
 * Имена иконок, доступных в AppIcon.
 * Вынесено отдельным файлом, чтобы тип можно было импортировать
 * из других компонентов (из <script setup> экспорт запрещён).
 */
export type IconName =
  | 'sun'
  | 'moon'
  | 'volume'
  | 'volume-x'
  | 'copy'
  | 'check'
  | 'close'
  | 'crown'
  | 'bell'
  | 'play'
  | 'pause'
  | 'skip-back'
  | 'skip-forward'
  | 'chevron-left'
  | 'chevron-right'
  | 'external'
  | 'download'
  | 'refresh'
  | 'rematch'
  | 'arrow-right'
  | 'arrow-left'
  | 'plus'
  | 'eye'
  | 'trash'
  | 'bolt'
  | 'flag';

/** Иконки, которые рисуются заливкой, а не обводкой */
export const FILLED_ICONS: ReadonlySet<IconName> = new Set<IconName>([
  'play',
  'pause',
  'skip-back',
  'skip-forward',
  'flag',
]);

/** Геометрия иконок в системе координат 24×24 */
export const ICON_PATHS: Record<IconName, string[]> = {
  sun: [
    'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4',
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  ],
  moon: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'],
  volume: [
    'M11 5L6 9H2v6h4l5 4V5z',
    'M15.54 8.46a5 5 0 0 1 0 7.07',
    'M19.07 4.93a10 10 0 0 1 0 14.14',
  ],
  'volume-x': [
    'M11 5L6 9H2v6h4l5 4V5z',
    'M23 9l-6 6',
    'M17 9l6 6',
  ],
  copy: [
    'M9 9h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z',
    'M5 15H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1',
  ],
  check: ['M20 6 9 17l-5-5'],
  close: ['M18 6 6 18M6 6l12 12'],
  crown: ['M3 8l4 4 5-7 5 7 4-4v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z'],
  bell: ['M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9', 'M13.7 21a2 2 0 0 1-3.4 0'],
  play: ['M6 3.5 20 12 6 20.5z'],
  pause: ['M7.5 4h3.5v16H7.5zM13 4h3.5v16H13z'],
  'skip-back': ['M20 5v14L9.5 12z', 'M5 5v14'],
  'skip-forward': ['M4 5v14l10.5-7z', 'M19 5v14'],
  'chevron-left': ['M15 18l-6-6 6-6'],
  'chevron-right': ['M9 18l6-6-6-6'],
  external: ['M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6', 'M15 3h6v6', 'M10 14 21 3'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  refresh: ['M23 4v6h-6', 'M20.5 15a9 9 0 1 1-2.1-9.4L23 10'],
  rematch: ['M1 4v6h6', 'M3.5 15a9 9 0 1 0 2.1-9.4L1 10'],
  'arrow-right': ['M5 12h14M12 5l7 7-7 7'],
  'arrow-left': ['M19 12H5M12 19l-7-7 7-7'],
  plus: ['M12 5v14M5 12h14'],
  eye: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  trash: [
    'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
  ],
  bolt: ['M13 2L3 14h9l-1 8 10-12h-9l1-8z'],
  flag: ['M4 3v18', 'M4 4h12l-2 4 2 4H4z'],
};
