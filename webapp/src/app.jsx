import { useEffect, useState } from "react";
import "./app.css";
import PlayerCard from "./components/playercard";
import Radar from "./components/radar";
import SettingsButton from "./components/settings";
import MaskedIcon from "./components/maskedicon";

const CONNECTION_TIMEOUT = 7000;
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

const isAuthorized = () => {
  if (!PRIVATE_KEY) return true;
  try {
    const url = new URL(window.location.href);
    const urlK = url.searchParams.get("k");
    if (urlK === PRIVATE_KEY) {
      url.searchParams.delete("k");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      return true;
    }
    return false;
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

  useEffect(() => { localStorage.setItem("radarSettings", JSON.stringify(settings)); document.body.style.backgroundImage = ""; document.body.style.backgroundColor = "#0a1a2a"; }, [settings]);

  useEffect(() => {
    let ws = null;
    let timeout = null;
    let cancelled = false;
    let hasData = false;

    const startDemo = async (msg) => {
      if (!authorized) {
        setStatus("Gizli");
        return;
      }
      if (msg) setStatus(msg); else setStatus("Canlı bekleniyor - oyuna gir...");
      if (hasData) return;
      if (!DEMO_MODE) return;
    };

    const connect = async () => {
      if (!authorized) { startDemo(); return; }
      const url = getWsUrl();
      if (!url) { startDemo(); return; }
      try { ws = new WebSocket(url); } catch (e) { startDemo(`Bağlantı hatası: ${e.message}`); setTimeout(()=>{ if(!cancelled) connect(); }, 2000); return; }
      timeout = setTimeout(() => { try { ws.close(); } catch {} setStatus("Yeniden bağlanıyor..."); }, CONNECTION_TIMEOUT);
      ws.onopen = () => { clearTimeout(timeout); setStatus(hasData ? "Canlı" : "Canlı - veri bekleniyor..."); };
      ws.onclose = () => { clearTimeout(timeout); if (cancelled) return; setStatus(hasData ? "Bağlantı koptu - yeniden bağlanıyor..." : "Bağlantı koptu"); setTimeout(()=>{ if(!cancelled) connect(); }, 1500); };
      ws.onerror = () => { clearTimeout(timeout); setStatus(hasData ? "Bağlantı dalgalı - yeniden deneniyor..." : "WS hata"); };
      ws.onmessage = async (event) => {
        let parsed;
        try { parsed = JSON.parse(await event.data.text()); } catch { return; }
        const map = parsed.m_map;
        const players = parsed.m_players || [];
        const isMatchOver = !map || map === "invalid" || players.length === 0;
        if (isMatchOver) {
          hasData = false;
          setPlayerArray([]);
          setBombData(null);
          setStatus("Maç bitti - yeni maç bekleniyor...");
          return;
        }
        hasData = true;
        setPlayerArray(players);
        setLocalTeam(parsed.m_local_team);
        setBombData(parsed.m_bomb || null);
        if (map && map !== "invalid") {
          try {
            const jd = await (await fetch(`/data/${map}/data.json`)).json();
            setMapData(prev => prev && prev.name === map ? prev : { ...jd, name: map });
          } catch {}
        }
        setStatus("Canlı");
      };
    };
    connect();
    const onVis = () => { if (document.visibilityState === "visible" && !cancelled) { try { if (!ws || ws.readyState !== 1) connect(); } catch {} } };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; clearTimeout(timeout); document.removeEventListener("visibilitychange", onVis); try { ws && ws.close(); } catch {} };
  }, [authorized]);

  if (PRIVATE_KEY && !authorized) {
    return (
      <div className="w-screen h-screen flex items-center justify-center" style={{ background: `radial-gradient(50% 50% at 50% 50%, rgba(20,40,55,0.95) 0%, rgba(7,20,30,0.95) 100%)` }}>
        <div className="bg-[#0f1f2f] border border-[#2a4a66] rounded-xl p-8 w-[90%] max-w-sm text-center shadow-2xl">
          <h1 className="text-xl font-bold text-[#b1d0e7] mb-2">🔒 Gizli Radar</h1>
          <p className="text-sm text-white/60 mb-4">Bu radar özel. Şifreyi gir.</p>
          <input type="password" value={inputKey} onChange={e=>setInputKey(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'){ if(inputKey===PRIVATE_KEY){ setAuthorized(true); } else setLoginError("Hatalı şifre"); } }} placeholder="Şifre" className="w-full px-3 py-2 rounded bg-black/40 border border-white/20 text-white outline-none mb-2" />
          {loginError && <p className="text-red-400 text-xs mb-2">{loginError}</p>}
          <button onClick={()=>{ if(inputKey===PRIVATE_KEY){ setAuthorized(true); } else setLoginError("Hatalı şifre"); }} className="w-full py-2 rounded bg-[#6492b4] hover:bg-[#7aa8cb] text-white font-medium">Giriş</button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden" style={{ background: `radial-gradient(50% 50% at 50% 50%, rgba(20, 40, 55, 0.95) 0%, rgba(7, 20, 30, 0.95) 100%)`, backdropFilter: `blur(7.5px)` }}>
      <div className="w-full h-full flex flex-col justify-center overflow-hidden relative p-1 lg:p-2">
        <div className="absolute right-2.5 top-2.5 z-50 flex items-center gap-2">
          <span className="hidden lg:inline text-xs px-2 py-1 rounded bg-black/40 text-white/70">{status === "Canlı" ? "● Canlı" : status}</span>
          <SettingsButton settings={settings} onSettingsChange={setSettings} />
        </div>
        {bombData && bombData.m_blow_time > 0 && !bombData.m_is_defused && (
          <div className="absolute left-1/2 top-2 flex-col items-center gap-1 z-50"><div className="flex justify-center items-center gap-1"><MaskedIcon path={`./assets/icons/c4_sml.png`} height={32} color={(bombData.m_is_defusing && bombData.m_blow_time - bombData.m_defuse_time > 0 && `bg-radar-green`) || (bombData.m_blow_time - bombData.m_defuse_time < 0 && `bg-radar-red`) || `bg-radar-secondary`} /><span>{`${bombData.m_blow_time.toFixed(1)}s ${(bombData.m_is_defusing && `(${bombData.m_defuse_time.toFixed(1)}s)`) || ""}`}</span></div></div>
        )}
        <div className="flex items-center justify-center gap-1 sm:gap-2 w-full h-full max-h-[64vh] sm:max-h-[92vh] overflow-hidden">
          <ul id="terrorist" className="hidden sm:flex flex-col gap-1 sm:gap-2 m-0 p-0 shrink-0 scale-[0.55] lg:scale-[0.68] xl:scale-[0.78] 2xl:scale-[0.85] origin-center overflow-hidden">
            {playerArray.filter((p) => p.m_team == 2).map((player) => (<PlayerCard isOnRightSide={false} key={player.m_idx} playerData={player} />))}
          </ul>
          <div className="flex-1 flex justify-center items-center min-w-0 h-full overflow-hidden">
          {(mapData) ? (
            <div className="relative flex-1 flex justify-center items-center min-w-0 h-full overflow-hidden">
              <Radar playerArray={playerArray} radarImage={`/data/${mapData.name}/radar.png`} mapData={mapData} localTeam={localTeam} bombData={bombData} settings={settings} />
              {status !== "Canlı" && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-black/70 border border-white/20 text-white text-[10px] sm:text-xs whitespace-nowrap backdrop-blur pointer-events-none">
                  {status}
                </div>
              )}
            </div>
          ) : (
            <div id="radar" className="flex flex-1 justify-center items-center min-w-0 h-full text-center p-6"><h1 className="text-lg animate-pulse">{status}</h1></div>
          )}
          </div>
          <ul id="counterTerrorist" className="hidden sm:flex flex-col gap-1 sm:gap-2 m-0 p-0 shrink-0 scale-[0.55] lg:scale-[0.68] xl:scale-[0.78] 2xl:scale-[0.85] origin-center overflow-hidden">
            {playerArray.filter((p) => p.m_team == 3).map((player) => (<PlayerCard isOnRightSide={true} key={player.m_idx} playerData={player} settings={settings} />))}
          </ul>
        </div>
        <div className="sm:hidden flex flex-col gap-2 mt-1 px-1 max-h-[32vh] overflow-y-auto">
          <div>
            <div className="flex items-center gap-1 mb-1"><span className="w-2 h-2 rounded-full" style={{background:"#ef4444"}}></span><span className="text-[10px] font-bold tracking-widest" style={{color:"#ef4444"}}>TERRORIST</span><span className="text-[9px] opacity-50 ml-1">T</span></div>
            <div className="grid grid-cols-3 gap-1">
              {playerArray.filter(p=>p.m_team==2).map(p=>(
                <div key={p.m_idx} className="flex items-center gap-1 rounded-md px-1 py-1 text-[10px] overflow-hidden" style={{background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.35)"}}>
                  <img src={`./assets/characters/${p.m_model_name||'tm_phoenix'}.png`} className="w-5 h-5 object-contain shrink-0 bg-black/20 rounded" onError={e=>e.currentTarget.style.display='none'} />
                  <div className="flex flex-col leading-none min-w-0 flex-1">
                    <span className="font-bold truncate text-[10px] leading-none" style={{color: p.m_is_local ? "#facc15" : "#fca5a5"}}>{p.m_name}{p.m_is_local?' ★':''}</span>
                    <span className="opacity-70 text-[8px] leading-none" style={{color:"#fca5a5"}}>{p.m_health}hp • ${p.m_money||0}</span>
                    <span className="opacity-60 text-[7px] leading-none truncate" style={{color:"#fca5a5"}}>{[p.m_weapons?.m_primary, p.m_weapons?.m_secondary].filter(Boolean).join(" • ")}{p.m_has_bomb?" • C4":""}</span>
                  </div>
                </div>
              ))}
              {playerArray.filter(p=>p.m_team==2).length===0 && <span className="text-[9px] opacity-30 col-span-3">Oyuncu yok</span>}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1"><span className="w-2 h-2 rounded-full" style={{background:"#3b82f6"}}></span><span className="text-[10px] font-bold tracking-widest" style={{color:"#3b82f6"}}>COUNTER-TERRORIST</span><span className="text-[9px] opacity-50 ml-1">CT</span></div>
            <div className="grid grid-cols-3 gap-1">
              {playerArray.filter(p=>p.m_team==3).map(p=>(
                <div key={p.m_idx} className="flex items-center gap-1 rounded-md px-1 py-1 text-[10px] overflow-hidden" style={{background:"rgba(59,130,246,0.12)", border:"1px solid rgba(59,130,246,0.35)"}}>
                  <img src={`./assets/characters/${p.m_model_name||'ctm_sas'}.png`} className="w-5 h-5 object-contain shrink-0 bg-black/20 rounded" onError={e=>e.currentTarget.style.display='none'} />
                  <div className="flex flex-col leading-none min-w-0 flex-1">
                    <span className="font-bold truncate text-[10px] leading-none" style={{color: p.m_is_local ? "#facc15" : "#93c5fd"}}>{p.m_name}{p.m_is_local?' ★':''}</span>
                    <span className="opacity-70 text-[8px] leading-none" style={{color:"#93c5fd"}}>{p.m_health}hp • ${p.m_money||0}</span>
                    <span className="opacity-60 text-[7px] leading-none truncate" style={{color:"#93c5fd"}}>{[p.m_weapons?.m_primary, p.m_weapons?.m_secondary].filter(Boolean).join(" • ")}{p.m_has_defuser?" • kit":""}</span>
                  </div>
                </div>
              ))}
              {playerArray.filter(p=>p.m_team==3).length===0 && <span className="text-[9px] opacity-30 col-span-3">Oyuncu yok</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default App;
