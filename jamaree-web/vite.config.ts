import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // แยกไลบรารีใหญ่ออกเป็นไฟล์ของตัวเอง — อัปเดตแอปแล้วเบราว์เซอร์ไม่ต้องโหลดใหม่ทั้งก้อน
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // ทะเบียนที่อยู่ไทยหนักมาก ปล่อยให้ Rollup แยกเอง จะได้โหลดตอนเปิดฟอร์มที่อยู่เท่านั้น
          if (id.includes("thai-address-universal")) return;
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("lucide-react")) return "icons";
          return "react";
        },
      },
    },
  },
});
