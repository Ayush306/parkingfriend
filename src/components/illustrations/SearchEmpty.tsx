import React from "react";
import Svg, {
  Path,
  Circle,
  Line,
  G,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";

export interface IllustrationProps {
  size?: number;
  color?: string;
}

export const SearchEmpty: React.FC<IllustrationProps> = ({
  size = 160,
  color = "#0FB57E",
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Defs>
        <LinearGradient id="seLens" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.18} />
          <Stop offset="1" stopColor={color} stopOpacity={0.05} />
        </LinearGradient>
      </Defs>
      <Circle cx="100" cy="100" r="80" fill={color} opacity={0.06} />

      {/* magnifier */}
      <G>
        <Circle
          cx="88"
          cy="88"
          r="42"
          fill="url(#seLens)"
          stroke={color}
          strokeWidth={6}
          strokeOpacity={0.7}
        />
        <Line
          x1="120"
          y1="120"
          x2="150"
          y2="150"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeOpacity={0.7}
        />
        {/* empty face inside lens */}
        <Circle cx="76" cy="82" r="4" fill={color} opacity={0.55} />
        <Circle cx="100" cy="82" r="4" fill={color} opacity={0.55} />
        <Path
          d="M78 102 q10 -8 20 0"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
          opacity={0.55}
        />
      </G>

      {/* scattered dots suggesting no results */}
      <Circle cx="150" cy="60" r="5" fill={color} opacity={0.3} />
      <Circle cx="52" cy="140" r="4" fill={color} opacity={0.25} />
      <Circle cx="160" cy="104" r="3" fill={color} opacity={0.3} />
    </Svg>
  );
};
