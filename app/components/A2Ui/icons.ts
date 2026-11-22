// Maps the semantic icon names A2UI uses to platform icons (SF Symbols +
// Material Symbols, via PlatformIcon). Falls back to a neutral help icon for
// names we don't map, so a model inventing an icon never renders nothing.

import type {
  MaterialSymbolProps,
  SFSymbolProps,
} from '@react-navigation/native';

export interface PlatformIconRef {
  iosIconName: SFSymbolProps['name'];
  androidIconName: MaterialSymbolProps['name'];
}

const ICONS: Record<string, PlatformIconRef> = {
  check: { iosIconName: 'checkmark', androidIconName: 'check' },
  close: { iosIconName: 'xmark', androidIconName: 'close' },
  plus: { iosIconName: 'plus', androidIconName: 'add' },
  minus: { iosIconName: 'minus', androidIconName: 'remove' },
  search: { iosIconName: 'magnifyingglass', androidIconName: 'search' },
  home: { iosIconName: 'house', androidIconName: 'home' },
  settings: { iosIconName: 'gearshape', androidIconName: 'settings' },
  gear: { iosIconName: 'gearshape', androidIconName: 'settings' },
  user: { iosIconName: 'person', androidIconName: 'person' },
  users: { iosIconName: 'person.2', androidIconName: 'group' },
  heart: { iosIconName: 'heart', androidIconName: 'favorite' },
  star: { iosIconName: 'star', androidIconName: 'star' },
  bell: { iosIconName: 'bell', androidIconName: 'notifications' },
  mail: { iosIconName: 'envelope', androidIconName: 'mail' },
  email: { iosIconName: 'envelope', androidIconName: 'mail' },
  phone: { iosIconName: 'phone', androidIconName: 'call' },
  camera: { iosIconName: 'camera', androidIconName: 'photo_camera' },
  photo: { iosIconName: 'photo', androidIconName: 'image' },
  image: { iosIconName: 'photo', androidIconName: 'image' },
  clock: { iosIconName: 'clock', androidIconName: 'schedule' },
  calendar: { iosIconName: 'calendar', androidIconName: 'calendar_month' },
  location: { iosIconName: 'location', androidIconName: 'location_on' },
  map: { iosIconName: 'map', androidIconName: 'map' },
  cart: { iosIconName: 'cart', androidIconName: 'shopping_cart' },
  info: { iosIconName: 'info.circle', androidIconName: 'info' },
  help: { iosIconName: 'questionmark.circle', androidIconName: 'help' },
  warning: { iosIconName: 'exclamationmark.triangle', androidIconName: 'warning' },
  alert: { iosIconName: 'exclamationmark.triangle', androidIconName: 'warning' },
  refresh: { iosIconName: 'arrow.clockwise', androidIconName: 'refresh' },
  edit: { iosIconName: 'pencil', androidIconName: 'edit' },
  pencil: { iosIconName: 'pencil', androidIconName: 'edit' },
  trash: { iosIconName: 'trash', androidIconName: 'delete' },
  delete: { iosIconName: 'trash', androidIconName: 'delete' },
  download: { iosIconName: 'arrow.down.circle', androidIconName: 'download' },
  upload: { iosIconName: 'arrow.up.circle', androidIconName: 'upload' },
  send: { iosIconName: 'paperplane', androidIconName: 'send' },
  eye: { iosIconName: 'eye', androidIconName: 'visibility' },
  lock: { iosIconName: 'lock', androidIconName: 'lock' },
  unlock: { iosIconName: 'lock.open', androidIconName: 'lock_open' },
  play: { iosIconName: 'play.fill', androidIconName: 'play_arrow' },
  pause: { iosIconName: 'pause.fill', androidIconName: 'pause' },
  music: { iosIconName: 'music.note', androidIconName: 'music_note' },
  mic: { iosIconName: 'mic', androidIconName: 'mic' },
  bookmark: { iosIconName: 'bookmark', androidIconName: 'bookmark' },
  flag: { iosIconName: 'flag', androidIconName: 'flag' },
  fire: { iosIconName: 'flame', androidIconName: 'local_fire_department' },
  globe: { iosIconName: 'globe', androidIconName: 'language' },
  link: { iosIconName: 'link', androidIconName: 'link' },
  share: { iosIconName: 'square.and.arrow.up', androidIconName: 'share' },
  sparkles: { iosIconName: 'sparkles', androidIconName: 'star' },
  lightbulb: { iosIconName: 'lightbulb', androidIconName: 'lightbulb' },
  sun: { iosIconName: 'sun.max', androidIconName: 'wb_sunny' },
  moon: { iosIconName: 'moon', androidIconName: 'dark_mode' },
  trophy: { iosIconName: 'trophy', androidIconName: 'flag' },
  gift: { iosIconName: 'gift', androidIconName: 'redeem' },
  menu: { iosIconName: 'line.3.horizontal', androidIconName: 'menu' },
  more: { iosIconName: 'ellipsis', androidIconName: 'more_horiz' },
};

const FALLBACK: PlatformIconRef = {
  iosIconName: 'circle',
  androidIconName: 'circle',
};

/** Resolve a semantic icon name to a platform icon reference. */
export const platformIconFor = (name: string): PlatformIconRef =>
  ICONS[name.trim().toLowerCase()] ?? FALLBACK;

/** The set of names the palette knows, for the catalog text. */
export const knownIconNames = (): string[] => Object.keys(ICONS).sort();