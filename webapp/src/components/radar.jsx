import Player from "./player";
import Bomb from "./bomb";

const Radar = ({ playerArray, radarImage, mapData, localTeam, bombData, settings }) => {
  return (
    <div id="radar" className="relative overflow-hidden w-full max-w-[98vw] lg:max-w-[88vmin] xl:max-w-[90vmin] aspect-square shrink-0 bg-black/20 rounded-lg">
      <img src={radarImage} alt="radar" className="w-full h-full object-contain select-none" draggable={false} onError={e=>{e.currentTarget.style.display='none'}} />
      {playerArray.map((player) => (
        <Player key={player.m_idx} playerData={player} mapData={mapData} localTeam={localTeam} settings={settings} />
      ))}
      {bombData && <Bomb bombData={bombData} mapData={mapData} localTeam={localTeam} settings={settings} />}
    </div>
  );
};
export default Radar;
