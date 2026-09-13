import { create } from "zustand";

export type Theme = "light" | "dark";

const KEY = "jamaree_theme";

/** อ่านค่าที่เคยเลือกไว้ ถ้ายังไม่เคยเลือก — ใช้ตามการตั้งค่าของเครื่อง */
function initialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** ติด/ถอดคลาส dark ที่แท็ก <html> — จุดเดียวที่แตะ DOM */
function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialTheme(),

  setTheme: (theme) => {
    window.localStorage.setItem(KEY, theme);
    applyTheme(theme);
    set({ theme });
  },

  toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
}));

// ทาสีให้ตรงกับค่าที่อ่านมาตั้งแต่แรก (กันกรณีสคริปต์ใน index.html ไม่ทำงาน)
applyTheme(useThemeStore.getState().theme);
