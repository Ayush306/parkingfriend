import React from "react";
import Svg, {
  Path,
  Rect,
  G,
  Circle,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";

export interface IllustrationProps {
  size?: number;
  color?: string;
}

export const ParkingHero: React.FC<IllustrationProps> = ({
  size = 200,
  color = "#0FB57E",
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 240 200" fill="none">
      <Defs>
        <LinearGradient id="phSign" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.95} />
          <Stop offset="1" stopColor={color} stopOpacity={0.72} />
        </LinearGradient>
        <LinearGradient id="phCar" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.55} />
          <Stop offset="1" stopColor={color} stopOpacity={0.3} />
        </LinearGradient>
      </Defs>

      {/* ground */}
      <Circle cx="120" cy="150" r="70" fill={color} opacity={0.07} />

      {/* location pin holding a P */}
      <G>
        <Path
          d="M120 20 c-26 0 -46 20 -46 46 c0 32 46 66 46 66 s46 -34 46 -66 c0 -26 -20 -46 -46 -46 z"
          fill="url(#phSign)"
        />
        <Circle cx="120" cy="66" r="28" fill="#FFFFFF" opacity={0.95} />
        <Path
          d="M110 50 h14 a12 12 0 0 1 0 24 h-6 v10 h-8 z m8 8 v8 h6 a4 4 0 0 0 0 -8 z"
          fill={color}
        />
      </G>

      {/* little car parked below */}
      <G>
        <Path
          d="M78 150 h12 l8 -12 h44 l8 12 h12 a6 6 0 0 1 6 6 v10 a4 4 0 0 1 -4 4 h-6 a10 10 0 0 1 -20 0 h-36 a10 10 0 0 1 -20 0 h-6 a4 4 0 0 1 -4 -4 v-10 a6 6 0 0 1 6 -6 z"
          fill="url(#phCar)"
        />
        <Path
          d="M100 140 h40 l5 8 h-50 z"
          fill="#FFFFFF"
          opacity={0.6}
        />
        <Circle cx="98" cy="170" r="8" fill={color} />
        <Circle cx="98" cy="170" r="3.5" fill="#FFFFFF" />
        <Circle cx="142" cy="170" r="8" fill={color} />
        <Circle cx="142" cy="170" r="3.5" fill="#FFFFFF" />
      </G>

      {/* accents */}
      <Rect x="40" y="60" width="10" height="10" rx="2" fill={color} opacity={0.25} />
      <Circle cx="196" cy="52" r="6" fill={color} opacity={0.3} />
      <Circle cx="206" cy="108" r="4" fill={color} opacity={0.25} />
    </Svg>
  );
};
