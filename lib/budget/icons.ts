import {
  Utensils, ShoppingCart, Car, ShoppingBag, Receipt, Home, HeartPulse,
  Clapperboard, Plane, GraduationCap, Repeat, Shapes, Banknote, Briefcase,
  TrendingUp, Gift, CircleDollarSign, Wallet, Landmark, CreditCard,
  PiggyBank, MoreHorizontal, Coffee, Dumbbell, Gamepad2, Baby, Dog,
  Wrench, Gem, Wifi, Phone, Film, Music, Book, Fuel, Bus, Bike,
  Shirt, Scissors, Stethoscope, Pill, Sparkles, Umbrella, Building2,
  type LucideIcon,
} from "lucide-react";

export const ICON_MAP: Record<string, LucideIcon> = {
  utensils: Utensils,
  "shopping-cart": ShoppingCart,
  car: Car,
  "shopping-bag": ShoppingBag,
  receipt: Receipt,
  home: Home,
  "heart-pulse": HeartPulse,
  clapperboard: Clapperboard,
  plane: Plane,
  "graduation-cap": GraduationCap,
  repeat: Repeat,
  shapes: Shapes,
  banknote: Banknote,
  briefcase: Briefcase,
  "trending-up": TrendingUp,
  gift: Gift,
  "circle-dollar-sign": CircleDollarSign,
  wallet: Wallet,
  landmark: Landmark,
  "credit-card": CreditCard,
  "piggy-bank": PiggyBank,
  coffee: Coffee,
  dumbbell: Dumbbell,
  "gamepad-2": Gamepad2,
  baby: Baby,
  dog: Dog,
  wrench: Wrench,
  gem: Gem,
  wifi: Wifi,
  phone: Phone,
  film: Film,
  music: Music,
  book: Book,
  fuel: Fuel,
  bus: Bus,
  bike: Bike,
  shirt: Shirt,
  scissors: Scissors,
  stethoscope: Stethoscope,
  pill: Pill,
  sparkles: Sparkles,
  umbrella: Umbrella,
  "building-2": Building2,
};

export const ICON_PICKER_LIST = Object.keys(ICON_MAP);

export function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? MoreHorizontal;
}

export const ACCOUNT_TYPE_ICON: Record<string, string> = {
  cash: "wallet",
  bank: "landmark",
  card: "credit-card",
  savings: "piggy-bank",
  other: "shapes",
};

export const COLOR_SWATCHES = [
  "#f97316", "#ef4444", "#ec4899", "#a855f7", "#6366f1",
  "#3b82f6", "#06b6d4", "#22c55e", "#16a34a", "#84cc16",
  "#eab308", "#f43f5e", "#8b5cf6", "#0ea5e9", "#059669",
  "#d946ef", "#64748b",
];
