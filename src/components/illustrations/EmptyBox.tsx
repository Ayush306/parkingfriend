import React from "react";
import Svg, {
  Path,
  Rect,
  G,
  Defs,
  LinearGradient,
  Stop,
  Circle,
} from "react-native-svg";

export interface IllustrationProps {
  size?: number;
  color?: string;
}

export const EmptyBox: React.FC<IllustrationProps> = ({
  size = 160,
  color = "#0FB57E",
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Defs>
        <LinearGradient id="ebLid" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.9} />
          <Stop offset="1" stopColor={color} stopOpacity={0.6} />
        </LinearGradient>
      </Defs>
      <Circle cx="100" cy="150" r="44" fill={color} opacity={0.08} />
      {/* box back */}
      <Path
        d="M52 96 L100 118 L148 96 L148 150 L100 172 L52 150 Z"
        fill={color}
        opacity={0.18}
      />
      {/* box left face */}
      <Path d="M52 96 L100 118 L100 172 L52 150 Z" fill={color} opacity={0.32} />
      {/* box right face */}
      <Path
        d="M148 96 L100 118 L100 172 L148 150 Z"
        fill={color}
        opacity={0.24}
      />
      {/* open flaps */}
      <Path
        d="M52 96 L74 74 L122 96 L100 118 Z"
        fill="url(#ebLid)"
        opacity={0.85}
      />
      <Path
        d="M148 96 L126 74 L78 96 L100 118 Z"
        fill={color}
        opacity={0.55}
      />
      {/* floating dots */}
      <Circle cx="100" cy="52" r="5" fill={color} opacity={0.5} />
      <Circle cx="70" cy="60" r="3" fill={color} opacity={0.35} />
      <Circle cx="132" cy="60" r="3" fill={color} opacity={0.35} />
      <G opacity={0.35}>
        <Rect x="96" y="40" width="8" height="2" rx="1" fill={color} />
        <Rect x="99" y="37" width="2" height="8" rx="1" fill={color} />
      </G>
    </Svg>
  );
};
