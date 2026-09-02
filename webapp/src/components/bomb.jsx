import { getRadarPosition, teamEnum } from "../utilities/utilities";

const Bomb = ({ bombData, mapData, localTeam, settings }) => {
  const pos = getRadarPosition(mapData, bombData?.m_position || bombData) || { x: 0, y: 0 };
  if (pos.x <= 0 && pos.y <= 0) return null;
  const baseSize = 1.5;
  const scaledSize = baseSize * settings.bombSize;
  const bg = (bombData.m_is_defused && `#50904c`) || (localTeam == teamEnum.counterTerrorist && `#6492b4`) || `#c90b0b`;
  return (
    <div className="absolute left-0 top-0 rounded-[100%]" style={{
      left: `${pos.x * 100}%`, top: `${pos.y * 100}%`,
      width: `${scaledSize}vw`, height: `${scaledSize}vw`,
      transform: `translate3d(-50%, -50%, 0)`,
      transition: `left 120ms linear, top 120ms linear`,
      backgroundColor: bg,
      WebkitMask: `url('./assets/icons/c4_sml.png') no-repeat center / contain`,
      willChange: "left, top",
    }} />
  );
};
export default Bomb;
