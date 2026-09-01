import { useRef, useState, useEffect } from "react";
import { getRadarPosition, playerColors } from "../utilities/utilities";

let playerRotations = [];
const calculatePlayerRotation = (playerData) => {
  const playerViewAngle = 270 - playerData.m_eye_angle;
  const idx = playerData.m_idx;
  playerRotations[idx] = (playerRotations[idx] || 0) % 360;
  playerRotations[idx] += ((playerViewAngle - playerRotations[idx] + 540) % 360) - 180;
  return playerRotations[idx];
};

const Player = ({ playerData, mapData, radarImage, localTeam, settings }) => {
  const [lastKnownPosition, setLastKnownPosition] = useState(null);
  const radarPosition = getRadarPosition(mapData, playerData.m_position) || { x: 0, y: 0 };
  const invalidPosition = radarPosition.x <= 0 && radarPosition.y <= 0;
  const playerRef = useRef();
  const playerBounding = (playerRef.current && playerRef.current.getBoundingClientRect()) || { width: 0, height: 0 };
  const playerRotation = calculatePlayerRotation(playerData);
  const radarImageBounding = (radarImage !== undefined && radarImage.getBoundingClientRect()) || { width: 0, height: 0 };
  const isLocal = !!playerData.m_is_local;
  const base = settings.dotSize;
  const scaledSize = Math.max(0.9, 1.1 * base);
  const nameSize = Math.max(9, 6 + base * 3.2);
  const displayName = playerData.m_name || "";

  useEffect(() => {
    if (playerData.m_is_dead) { if (!lastKnownPosition) setLastKnownPosition(radarPosition); }
    else setLastKnownPosition(null);
  }, [playerData.m_is_dead, radarPosition, lastKnownPosition]);

  const effectivePosition = playerData.m_is_dead ? lastKnownPosition || { x: 0, y: 0 } : radarPosition;
  const radarImageTranslation = {
    x: radarImageBounding.width * effectivePosition.x - playerBounding.width * 0.5,
    y: radarImageBounding.height * effectivePosition.y - playerBounding.height * 0.5,
  };

  return (
    <div className={`absolute origin-center left-0 top-0`} ref={playerRef}
      style={{
        width: `${scaledSize}vmin`, height: `${scaledSize}vmin`,
        transform: `translate(${radarImageTranslation.x}px, ${radarImageTranslation.y}px)`,
        transition: `transform 80ms linear`,
        zIndex: `${(playerData.m_is_dead && `0`) || `1`}`,
        WebkitMask: `${(playerData.m_is_dead && `url('./assets/icons/icon-enemy-death_png.png') no-repeat center / contain`) || `none`}`,
      }}>
      <div style={{
        transform: `rotate(${(playerData.m_is_dead && `0`) || playerRotation}deg)`,
        width: `${scaledSize}vmin`, height: `${scaledSize}vmin`,
        transition: `transform 80ms linear`,
        opacity: `${(playerData.m_is_dead && `0.8`) || (invalidPosition && `0`) || `1`}`,
      }}>
        <div className={`w-full h-full rounded-[50%_50%_50%_0%] rotate-[315deg] ${isLocal ? `ring-2 ring-yellow-300` : ``}`}
          style={{
            backgroundColor: `${isLocal ? `#facc15` : (playerData.m_team == localTeam && playerColors[playerData.m_color]) || `red`}`,
            boxShadow: isLocal ? `0 0 10px 2px rgba(250,204,21,0.9)` : `0 0 3px rgba(0,0,0,0.6)`,
          }}
        />
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/85 text-white whitespace-nowrap pointer-events-none border border-white/15 text-center"
        style={{ top: `${scaledSize}vmin`, marginTop: `4px`, fontSize: `${nameSize}px`, lineHeight: 1, fontWeight: isLocal ? 800 : 600 }}>
        {displayName}{isLocal ? ` ★` : ``}
      </div>
    </div>
  );
};
export default Player;
