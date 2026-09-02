import { useEffect, useState, useRef } from "react";
import "./app.css";
import PlayerCard from "./components/playercard";
import Radar from "./components/radar";
import SettingsButton from "./components/settings";
import MaskedIcon from "./components/maskedicon";

const WS_URL = import.meta.env.VITE_WS_URL || "";
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== "false";
const PRIVATE_KEY = (import.meta.env.VITE_PRIVATE_KEY || "").trim();
const MAINTENANCE = (import.meta.env.VITE_MAINTENANCE || "").trim() === "true";

const DEFAULT_SETTINGS = { dotSize: 2.4, bombSize: 0.8 };
const loadSettings = () => {
  try { const s = localStorage.getItem("radarSettings"); return s ? JSON.parse(s) : DEFAULT_SETTINGS; } catch { return DEFAULT_SETTINGS; }
};
const isAuthorized = () => {
  if (!PRIVATE_KEY) return true;
  try {
    const url = new URL(window.location.href);
    const k = url.searchParams.get("k");
    if (k === PRIVATE_KEY) {
      url.searchParams.delete("k");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      return true;
    }
    return false;
  } catch { return false; }
};
function getWsUrl() {
  if (WS_URL) return WS_URL;
  if (typeof window === "undefined") return null;
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1") return `ws://localhost:22006/cs2_webradar`;
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
  const mapRef = useRef();
  mapRef.current = mapData;
  const playersRef = useRef([]);
  playersRef.current = playerArray;

  useEffect(() => { localStorage.setItem("radarSettings", JSON.stringify(settings)); }, [settings]);

  useEffect(() => {
    let ws = null;
    let handshakeTimer = null;
    let reconnectTimer = null;
    let heartbeatTimer = null;
    let idleTimer = null;
    let cancelled = false;
    let hasData = false;
    let attempt = 0;
    let lastMsgAt = Date.now();

    const scheduleReconnect = () => {
      if (cancelled) return;
      const delay = Math.min(1500 * Math.pow(1.5, attempt) + Math.random() * 500, 20000);
      attempt++;
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => { if (!cancelled) connect(); }, delay);
    };

    const startHeartbeat = () => {
      clearInterval(heartbeatTimer);
      clearInterval(idleTimer);
      heartbeatTimer = setInterval(() => {
        try { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ ping: 1 })); } catch {}
      }, 25000);
      idleTimer = setInterval(() => {
        if (Date.now() - lastMsgAt > 15000 && ws && ws.readyState === 1) {
          try { ws.close(); } catch {}
        }
      }, 5000);
    };

    const connect = async () => {
      if (!authorized) { setStatus("Gizli"); return; }
      const url = getWsUrl();
      if (!url) { setStatus("Canlı bekleniyor - oyuna gir..."); return; }
      if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
      try { ws = new WebSocket(url); } catch (e) {
        setStatus(`Bağlantı hatası - yeniden deneniyor...`);
        scheduleReconnect();
        return;
      }
      const isFirst = !hasData;
      clearTimeout(handshakeTimer);
      handshakeTimer = setTimeout(() => {
        try { ws.close(); } catch {}
        setStatus(isFirst ? "Sunucu uyanıyor - bekleniyor..." : "Yeniden bağlanıyor...");
      }, isFirst ? 25000 : 7000);

      ws.onopen = () => {
        clearTimeout(handshakeTimer);
        attempt = 0;
        lastMsgAt = Date.now();
        setStatus(hasData ? "Canlı" : "Canlı - veri bekleniyor...");
        startHeartbeat();
      };
      ws.onclose = () => {
        clearTimeout(handshakeTimer);
        clearInterval(heartbeatTimer);
        clearInterval(idleTimer);
        if (cancelled) return;
        setStatus(hasData ? "Bağlantı koptu - yeniden bağlanıyor..." : "Bağlantı koptu");
        scheduleReconnect();
      };
      ws.onerror = () => {
        clearTimeout(handshakeTimer);
        setStatus(hasData ? "Bağlantı dalgalı - yeniden deneniyor..." : "WS hata");
        try { ws.close(); } catch {}
      };
      ws.onmessage = async (event) => {
        lastMsgAt = Date.now();
        let text;
        try {
          text = typeof event.data === "string" ? event.data : await event.data.text();
          const parsed = JSON.parse(text);
          const map = parsed.m_map;
          const players = parsed.m_players;
          const isInvalidMap = !map || map === "invalid";
          if (isInvalidMap) {
            hasData = false;
            setPlayerArray([]);
            setBombData(null);
            setStatus("Maç bitti - yeni maç bekleniyor...");
            return;
          }
          hasData = true;
          attempt = 0;
          setPlayerArray(Array.isArray(players) ? players : []);
          setLocalTeam(parsed.m_local_team);
          setBombData(parsed.m_bomb || null);
          try {
            const r = await fetch(`/data/${map}/data.json`);
            if (r.ok) {
              const jd = await r.json();
              setMapData(prev => prev && prev.name === map ? prev : { ...jd, name: map });
            }
          } catch {}
          setStatus("Canlı");
        } catch {}
      };
    };

    connect();
    const onVis = () => { if (document.visibilityState === "visible" && !cancelled && (!ws || ws.readyState !== 1)) connect(); };
    const onOnline = () => { attempt = 0; connect(); };
    const onOffline = () => setStatus("Çevrimdışı - internet yok");
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      cancelled = true;
      clearTimeout(handshakeTimer);
      clearTimeout(reconnectTimer);
      clearInterval(heartbeatTimer);
      clearInterval(idleTimer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      try { ws && ws.close(); } catch {}
    };
  }, [authorized]);

  if (MAINTENANCE) {
    return (
      <div className="w-screen h-screen flex items-center justify-center" style={{ background: `#0a1a2a` }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Bakımda</h1>
          <p className="text-white/60">Site geçici olarak kapalı.</p>
        </div>
      </div>
    );
  }
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
    <div className="w-screen h-screen flex flex-col overflow-hidden" style={{ background: `radial-gradient(50% 50% at 50% 50%, rgba(20, 40, 55, 0.95) 0%, rgba(7, 20, 30, 0.95) 100%)` }}>
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
