import { useEffect, useState } from "react";
import "./app.css";
import PlayerCard from "./components/playercard";
import Radar from "./components/radar";
import SettingsButton from "./components/settings";
import MaskedIcon from "./components/maskedicon";

const CONNECTION_TIMEOUT = 5000;
const WS_URL = import.meta.env.VITE_WS_URL || "";
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== "false";

const DEFAULT_SETTINGS = {
  dotSize: 1,
  bombSize: 0.5,
};

const loadSettings = () => {
  try {
    const saved = localStorage.getItem("radarSettings");
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
};

const MOCK_DATA = {
  m_map: "de_mirage",
  m_local_team: 3,
  m_bomb: { m_blow_time: 0, m_defuse_time: 0, m_is_defusing: false, m_is_defused: false, m_position: { x: 0, y: 0, z: 0 } },
  m_players: [
    { m_idx: 0, m_team: 2, m_health: 100, m_name: "T_Player1", m_position: { x: -800, y: 200, z: 0 }, m_yaw: 90, m_has_bomb: true, m_is_defusing: false, m_weapon: "ak47", m_is_alive: true },
    { m_idx: 1, m_team: 2, m_health: 75, m_name: "T_Player2", m_position: { x: -600, y: -400, z: 0 }, m_yaw: 180, m_has_bomb: false, m_is_defusing: false, m_weapon: "galilar", m_is_alive: true },
    { m_idx: 2, m_team: 3, m_health: 100, m_name: "CT_Player1", m_position: { x: 500, y: 800, z: 0 }, m_yaw: 270, m_has_bomb: false, m_is_defusing: false, m_weapon: "m4a1", m_is_alive: true },
    { m_idx: 3, m_team: 3, m_health: 45, m_name: "CT_Player2", m_position: { x: 300, y: -200, z: 0 }, m_yaw: 0, m_has_bomb: false, m_is_defusing: false, m_weapon: "awp", m_is_alive: true },
  ]
};

function getWsUrl() {
  if (WS_URL) return WS_URL;
  if (typeof window === "undefined") return null;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
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
  const [bannerOpened, setBannerOpened] = useState(true);
  const [status, setStatus] = useState("Bağlanıyor...");

  useEffect(() => { localStorage.setItem("radarSettings", JSON.stringify(settings)); }, [settings]);

  useEffect(() => {
    let ws = null;
    let timeout = null;
    let demoTimer = null;
    let cancelled = false;

    const startDemo = async () => {
      if (!DEMO_MODE) { setStatus("WebSocket yapılandırılmadı. Demo kapalı."); return; }
      setStatus("Demo modu - Canlı veri bekleniyor");
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
      const url = getWsUrl();
      if (!url) {
        startDemo();
        return;
      }
      try {
        ws = new WebSocket(url);
      } catch (e) {
        setStatus(`Bağlantı hatası: ${e.message}`);
        startDemo();
        return;
      }

      timeout = setTimeout(() => { try { ws.close(); } catch {} setStatus("Bağlantı zaman aşımı - demo moda geçiliyor"); startDemo(); }, CONNECTION_TIMEOUT);

      ws.onopen = () => { clearTimeout(timeout); setStatus("Bağlandı"); console.info("connected", url); if (demoTimer) { clearInterval(demoTimer); demoTimer = null; } };
      ws.onclose = () => { clearTimeout(timeout); console.warn("disconnected"); if (playerArray.length === 0) startDemo(); };
      ws.onerror = () => { clearTimeout(timeout); setStatus(`WebSocket bağlanamadı: ${url} — demo gösteriliyor`); startDemo(); };
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

  return (
    <div className="w-screen h-screen flex flex-col" style={{ background: `radial-gradient(50% 50% at 50% 50%, rgba(20, 40, 55, 0.95) 0%, rgba(7, 20, 30, 0.95) 100%)`, backdropFilter: `blur(7.5px)` }}>
      {bannerOpened && (
        <section className="w-full flex items-center justify-between p-2 bg-radar-primary">
          <span className="w-full text-center text-[#1E3A54]">
            <span className="font-medium">CS2 WebRadar</span> - Vercel Demo Modu aktif {WS_URL ? `- WS: ${WS_URL}` : ""}
            <a className="ml-2 inline banner-link text-[#1E3A54]" href="https://github.com/clauadv/cs2_webradar" target="_blank" rel="noreferrer">GitHub</a>
            <span className="ml-2 text-xs opacity-70">[{status}]</span>
          </span>
          <button onClick={() => setBannerOpened(false)} className="hover:bg-[#9BC5E4] p-1">
            <svg width="16" height="16" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#4E799F" d="M 7.21875 5.78125 L 5.78125 7.21875 L 14.5625 16 L 5.78125 24.78125 L 7.21875 26.21875 L 16 17.4375 L 24.78125 26.21875 L 26.21875 24.78125 L 17.4375 16 L 26.21875 7.21875 L 24.78125 5.78125 L 16 14.5625 Z" /></svg>
          </button>
        </section>
      )}
      <div className="w-full h-full flex flex-col justify-center overflow-hidden relative">
        <div className="absolute right-2.5 top-2.5 z-50">
          <SettingsButton settings={settings} onSettingsChange={setSettings} />
        </div>
        {bombData && bombData.m_blow_time > 0 && !bombData.m_is_defused && (
          <div className="absolute left-1/2 top-2 flex-col items-center gap-1 z-50">
            <div className="flex justify-center items-center gap-1">
              <MaskedIcon path={`./assets/icons/c4_sml.png`} height={32} color={(bombData.m_is_defusing && bombData.m_blow_time - bombData.m_defuse_time > 0 && `bg-radar-green`) || (bombData.m_blow_time - bombData.m_defuse_time < 0 && `bg-radar-red`) || `bg-radar-secondary`} />
              <span>{`${bombData.m_blow_time.toFixed(1)}s ${(bombData.m_is_defusing && `(${bombData.m_defuse_time.toFixed(1)}s)`) || ""}`}</span>
            </div>
          </div>
        )}
        <div className="flex items-center justify-evenly">
          <ul id="terrorist" className="lg:flex hidden flex-col gap-7 m-0 p-0">
            {playerArray.filter((p) => p.m_team == 2).map((player) => (<PlayerCard isOnRightSide={false} key={player.m_idx} playerData={player} />))}
          </ul>
          {(playerArray.length > 0 && mapData && (<Radar playerArray={playerArray} radarImage={`./data/${mapData.name}/radar.png`} mapData={mapData} localTeam={localTeam} bombData={bombData} settings={settings} />)) || (
            <div id="radar" className="relative overflow-hidden origin-center text-center p-8">
              <h1 className="radar_message text-lg">{status}</h1>
              <p className="text-sm opacity-60 mt-2 max-w-md">Vercel'de WebSocket server çalışmaz. Canlı veri için <code>usermode.exe</code> + harici WS server gerekli. Şu an demo verisi gösteriliyor. Kendi WS sunucun varsa <code>VITE_WS_URL</code> env ayarla.</p>
            </div>
          )}
          <ul id="counterTerrorist" className="lg:flex hidden flex-col gap-7 m-0 p-0">
            {playerArray.filter((p) => p.m_team == 3).map((player) => (<PlayerCard isOnRightSide={true} key={player.m_idx} playerData={player} settings={settings} />))}
          </ul>
        </div>
      </div>
    </div>
  );
};
export default App;
