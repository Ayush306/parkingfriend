import React from "react";
import Svg, {
  Path,
  Circle,
  G,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";

export interface IllustrationProps {
  size?: number;
  color?: string;
}

export const SuccessCheck: React.FC<IllustrationProps> = ({
  size = 160,
  color = "#16A34A",
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Defs>
        <LinearGradient id="scRing" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.95} />
          <Stop offset="1" stopColor={color} stopOpacity={0.7} />
        </LinearGradient>
      </Defs>
      {/* halo rings */}
      <Circle cx="100" cy="100" r="82" fill={color} opacity={0.06} />
      <Circle cx="100" cy="100" r="64" fill={color} opacity={0.1} />
      {/* main disc */}
      <Circle cx="100" cy="100" r="46" fill="url(#scRing)" />
      {/* check */}
      <Path
        d="M80 100 L94 114 L122 84"
        stroke="#FFFFFF"
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* sparkles */}
      <G opacity={0.7}>
        <Path
          d="M150 58 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z"
          fill={color}
        />
        <Path
          d="M46 128 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z"
          fill={color}
          opacity={0.8}
        />
      </G>
      <Circle cx="52" cy="66" r="4" fill={color} opacity={0.5} />
      <Circle cx="146" cy="140" r="4" fill={color} opacity={0.5} />
    </Svg>
  );
};
