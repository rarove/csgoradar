import { useEffect, useState } from "react";
import "./app.css";
import PlayerCard from "./components/playercard";
import Radar from "./components/radar";
import SettingsButton from "./components/settings";
import MaskedIcon from "./components/maskedicon";

const CONNECTION_TIMEOUT = 5000;
const WS_URL = import.meta.env.VITE_WS_URL || "";
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== "false";
const PRIVATE_KEY = (import.meta.env.VITE_PRIVATE_KEY || "").trim();

const DEFAULT_SETTINGS = {
  dotSize: 2.4,
  bombSize: 0.8,
};

const loadSettings = () => {
  try {
    const saved = localStorage.getItem("radarSettings");
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
};

const getStoredKey = () => {
  try { return localStorage.getItem("radar_k") || ""; } catch { return ""; }
};
const isAuthorized = () => {
  if (!PRIVATE_KEY) return true;
  try {
    const urlK = new URL(window.location.href).searchParams.get("k");
    if (urlK && urlK === PRIVATE_KEY) { try{ localStorage.setItem("radar_k", urlK); }catch{} return true; }
    const stored = getStoredKey();
    if (stored === PRIVATE_KEY) return true;
    return urlK === PRIVATE_KEY;
  } catch { return false; }
};

const MOCK_DATA = {
  m_map: "de_mirage",
  m_local_team: 3,
  m_bomb: { m_blow_time: 0, m_defuse_time: 0, m_is_defusing: false, m_is_defused: false, m_position: { x: 0, y: 0, z: 0 } },
  m_players: [
    { m_idx: 0, m_team: 2, m_health: 100, m_name: "T_Player1", m_position: { x: -800, y: 200, z: 0 }, m_yaw: 90, m_has_bomb: true, m_is_local: false },
    { m_idx: 1, m_team: 2, m_health: 75, m_name: "T_Player2", m_position: { x: -600, y: -400, z: 0 }, m_yaw: 180, m_has_bomb: false, m_is_local: false },
    { m_idx: 2, m_team: 3, m_health: 100, m_name: "CT_Player1", m_position: { x: 500, y: 800, z: 0 }, m_yaw: 270, m_has_bomb: false, m_is_local: true },
    { m_idx: 3, m_team: 3, m_health: 45, m_name: "CT_Player2", m_position: { x: 300, y: -200, z: 0 }, m_yaw: 0, m_has_bomb: false, m_is_local: false },
  ]
};

function getWsUrl() {
  if (WS_URL) return WS_URL;
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return `ws://localhost:22006/cs2_webradar`;
  return null;
}

const App = () => {
  const [playerArray, setPlayerArray] = useState([]);
  const [mapData, setMapData] = useState();
  const [localTeam, setLocalTeam] = useState();
  const [bombData, setBombData] = useState();
  const [settings, setSettings] = useState(loadSettings());
  const [status, setStatus] = useState("Bağlanıyor...");
  const [authorized, setAuthorized] = useState(isAuthorized());
  const [inputKey, setInputKey] = useState("");
  const [loginError, setLoginError] = useState("");

  useEffect(() => { localStorage.setItem("radarSettings", JSON.stringify(settings)); }, [settings]);

  useEffect(() => {
    let ws = null;
    let timeout = null;
    let demoTimer = null;
    let cancelled = false;

    const startDemo = async (msg) => {
      if (msg) setStatus(msg);
      else if (!authorized) setStatus("Gizli mod - yetkisiz, demo gösteriliyor");
      else if (!DEMO_MODE) setStatus("Demo kapalı");
      else setStatus("Demo modu - Canlı bekleniyor");
      try {
        const map = MOCK_DATA.m_map;
        const data = await (await fetch(`data/${map}/data.json`)).json();
        if (cancelled) return;
        setMapData({ ...data, name: map });
        document.body.style.backgroundImage = `url(./data/${map}/background.png)`;
        setPlayerArray(MOCK_DATA.m_players);
        setLocalTeam(MOCK_DATA.m_local_team);
        setBombData(MOCK_DATA.m_bomb);
        let tick = 0;
        demoTimer = setInterval(() => {
          tick += 0.05;
          setPlayerArray(prev => prev.map(p => ({
            ...p,
            m_position: { ...p.m_position, x: p.m_position.x + Math.sin(tick + p.m_idx) * 2, y: p.m_position.y + Math.cos(tick + p.m_idx) * 2 }
          })));
        }, 100);
      } catch (e) { console.error(e); }
    };

    const connect = async () => {
      if (!authorized) { startDemo(); return; }
      const url = getWsUrl();
      if (!url) { startDemo(); return; }
      try { ws = new WebSocket(url); } catch (e) { startDemo(`Bağlantı hatası: ${e.message}`); return; }
      timeout = setTimeout(() => { try { ws.close(); } catch {} startDemo("Zaman aşımı - demo"); }, CONNECTION_TIMEOUT);
      ws.onopen = () => { clearTimeout(timeout); setStatus("Canlı"); if (demoTimer) { clearInterval(demoTimer); demoTimer = null; } };
      ws.onclose = () => { clearTimeout(timeout); if (playerArray.length === 0) startDemo(); };
      ws.onerror = () => { clearTimeout(timeout); startDemo(`WS bağlanamadı: ${url}`); };
      ws.onmessage = async (event) => {
        const parsed = JSON.parse(await event.data.text());
        setPlayerArray(parsed.m_players);
        setLocalTeam(parsed.m_local_team);
        setBombData(parsed.m_bomb);
        const map = parsed.m_map;
        if (map !== "invalid") {
          const jd = await (await fetch(`data/${map}/data.json`)).json();
          setMapData({ ...jd, name: map });
          document.body.style.backgroundImage = `url(./data/${map}/background.png)`;
        }
        setStatus("Canlı");
      };
    };
    connect();
    return () => { cancelled = true; clearTimeout(timeout); if (demoTimer) clearInterval(demoTimer); try { ws && ws.close(); } catch {} };
  }, []);

  if (PRIVATE_KEY && !authorized) {
    return (
      <div className="w-screen h-screen flex items-center justify-center" style={{ background: `radial-gradient(50% 50% at 50% 50%, rgba(20,40,55,0.95) 0%, rgba(7,20,30,0.95) 100%)` }}>
        <div className="bg-[#0f1f2f] border border-[#2a4a66] rounded-xl p-8 w-[90%] max-w-sm text-center shadow-2xl">
          <h1 className="text-xl font-bold text-[#b1d0e7] mb-2">🔒 Gizli Radar</h1>
          <p className="text-sm text-white/60 mb-4">Bu radar özel. Şifreyi gir.</p>
          <input type="password" value={inputKey} onChange={e=>setInputKey(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'){ if(inputKey===PRIVATE_KEY){ try{localStorage.setItem("radar_k",inputKey);}catch{} setAuthorized(true); } else setLoginError("Hatalı şifre"); } }} placeholder="Şifre" className="w-full px-3 py-2 rounded bg-black/40 border border-white/20 text-white outline-none mb-2" />
          {loginError && <p className="text-red-400 text-xs mb-2">{loginError}</p>}
          <button onClick={()=>{ if(inputKey===PRIVATE_KEY){ try{localStorage.setItem("radar_k",inputKey);}catch{} setAuthorized(true); } else setLoginError("Hatalı şifre"); }} className="w-full py-2 rounded bg-[#6492b4] hover:bg-[#7aa8cb] text-white font-medium">Giriş</button>
          <p className="text-xs text-white/40 mt-3">Demo görmek istemiyorsan doğru şifre gerek.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden" style={{ background: `radial-gradient(50% 50% at 50% 50%, rgba(20, 40, 55, 0.95) 0%, rgba(7, 20, 30, 0.95) 100%)`, backdropFilter: `blur(7.5px)` }}>
      <div className="w-full h-full flex flex-col justify-center overflow-hidden relative p-1 lg:p-2">
        <div className="absolute right-2.5 top-2.5 z-50 flex items-center gap-2">
          <span className="hidden lg:inline text-xs px-2 py-1 rounded bg-black/40 text-white/70">{status}</span>
          <SettingsButton settings={settings} onSettingsChange={setSettings} />
        </div>
        {bombData && bombData.m_blow_time > 0 && !bombData.m_is_defused && (
          <div className="absolute left-1/2 top-2 flex-col items-center gap-1 z-50"><div className="flex justify-center items-center gap-1"><MaskedIcon path={`./assets/icons/c4_sml.png`} height={32} color={(bombData.m_is_defusing && bombData.m_blow_time - bombData.m_defuse_time > 0 && `bg-radar-green`) || (bombData.m_blow_time - bombData.m_defuse_time < 0 && `bg-radar-red`) || `bg-radar-secondary`} /><span>{`${bombData.m_blow_time.toFixed(1)}s ${(bombData.m_is_defusing && `(${bombData.m_defuse_time.toFixed(1)}s)`) || ""}`}</span></div></div>
        )}
        <div className="flex items-center justify-center gap-1 lg:gap-2 w-full max-w-[1850px] mx-auto h-full">
          <ul id="terrorist" className="hidden xl:flex flex-col gap-2 m-0 p-0 shrink-0 scale-[0.70] origin-center max-h-[92vh] overflow-y-auto overflow-x-hidden">
            {playerArray.filter((p) => p.m_team == 2).map((player) => (<PlayerCard isOnRightSide={false} key={player.m_idx} playerData={player} />))}
          </ul>
          <div className="flex-1 flex justify-center items-center min-w-0 h-full">
          {(playerArray.length > 0 && mapData && (<Radar playerArray={playerArray} radarImage={`./data/${mapData.name}/radar.png`} mapData={mapData} localTeam={localTeam} bombData={bombData} settings={settings} />)) || (
            <div id="radar" className="relative overflow-hidden origin-center text-center p-4"><h1 className="radar_message text-lg">{status}</h1><p className="text-sm opacity-60 mt-2 max-w-md">{!authorized ? `Gizli radar - ?k=${PRIVATE_KEY} ile gir` : `Demo`}</p></div>
          )}
          </div>
          <ul id="counterTerrorist" className="hidden xl:flex flex-col gap-2 m-0 p-0 shrink-0 scale-[0.70] origin-center max-h-[92vh] overflow-y-auto overflow-x-hidden">
            {playerArray.filter((p) => p.m_team == 3).map((player) => (<PlayerCard isOnRightSide={true} key={player.m_idx} playerData={player} settings={settings} />))}
          </ul>
        </div>
        <div className="xl:hidden flex justify-center gap-2 mt-2 text-[11px] opacity-60">
          <span>{playerArray.filter(p=>p.m_team==2).length}T</span><span>•</span><span>{playerArray.filter(p=>p.m_team==3).length}CT</span><span>• {mapData?.name||""}</span>
        </div>
      </div>
    </div>
  );
};
export default App;
