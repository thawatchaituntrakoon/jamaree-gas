import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installUuidFallback } from "./lib/uid.ts";
import "./index.css";
import App from "./App.tsx";

// ต้องเติมก่อนโหลดแอป — เปิดผ่าน http ธรรมดาเบราว์เซอร์จะไม่มี crypto.randomUUID ให้
installUuidFallback();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
