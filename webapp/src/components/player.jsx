import { useEffect, useState, memo } from "react";
import { getRadarPosition } from "../utilities/utilities";

const rotationMap = new Map();
const getRotation = (key, target) => {
  const prev = rotationMap.get(key) ?? target;
  const delta = ((target - prev + 540) % 360) - 180;
  const next = (prev + delta * 0.35) % 360;
  rotationMap.set(key, next);
  return next;
};

const Player = ({ playerData, mapData, settings }) => {
  const id = playerData.m_steam_id || playerData.m_name || String(playerData.m_idx);
  const radarPos = getRadarPosition(mapData, playerData.m_position) || { x: 0, y: 0 };
  const invalid = radarPos.x <= 0 && radarPos.y <= 0 && !playerData.m_is_dead;
  const rot = getRotation(id, 270 - (playerData.m_eye_angle || 0));
  const [deadPos, setDeadPos] = useState(null);
  const isDead = !!playerData.m_is_dead;
  const isLocal = !!playerData.m_is_local;
  const base = settings.dotSize;
  const scaled = Math.max(0.9, 1.1 * base);
  const nameSize = Math.max(9, 6 + base * 3.2);
  const pos = isDead ? (deadPos || radarPos) : radarPos;
  const displayName = playerData.m_name || "";
  const bg = isLocal ? "#facc15" : playerData.m_team == 2 ? "#ef4444" : playerData.m_team == 3 ? "#3b82f6" : "red";

  useEffect(() => {
    if (isDead && !deadPos && radarPos.x > 0) setDeadPos(radarPos);
    else if (!isDead && deadPos) setDeadPos(null);
  }, [isDead, radarPos.x, radarPos.y, deadPos]);

  return (
    <div className="absolute left-0 top-0" style={{
      left: `${pos.x * 100}%`,
      top: `${pos.y * 100}%`,
      width: `${scaled}vmin`, height: `${scaled}vmin`,
      transform: `translate3d(-50%, -50%, 0)`,
      transition: `left 120ms linear, top 120ms linear`,
      zIndex: isDead ? 0 : 1,
      opacity: invalid ? 0 : isDead ? 0.8 : 1,
      willChange: "left, top",
      WebkitMask: isDead ? `url('./assets/icons/icon-enemy-death_png.png') no-repeat center / contain` : `none`,
    }}>
      <div style={{
        transform: `rotate(${isDead ? 0 : rot}deg)`,
        width: `${scaled}vmin`, height: `${scaled}vmin`,
        transition: `transform 120ms linear`,
      }}>
        <div className={`w-full h-full rounded-[50%_50%_50%_0%] rotate-[315deg] ${isLocal ? `ring-2 ring-yellow-300` : ``}`}
          style={{ backgroundColor: bg, boxShadow: isLocal ? `0 0 10px 2px rgba(250,204,21,0.9)` : `0 0 3px rgba(0,0,0,0.6)` }} />
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/85 text-white whitespace-nowrap pointer-events-none border border-white/15 text-center"
        style={{ top: `${scaled}vmin`, marginTop: `4px`, fontSize: `${nameSize}px`, lineHeight: 1, fontWeight: isLocal ? 800 : 600 }}>
        {displayName}{isLocal ? ` ★` : ``}
      </div>
    </div>
  );
};
export default memo(Player);
