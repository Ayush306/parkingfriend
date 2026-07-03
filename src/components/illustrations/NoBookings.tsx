import React from "react";
import Svg, {
  Path,
  Rect,
  G,
  Circle,
  Line,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";

export interface IllustrationProps {
  size?: number;
  color?: string;
}

export const NoBookings: React.FC<IllustrationProps> = ({
  size = 160,
  color = "#0FB57E",
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Defs>
        <LinearGradient id="nbCard" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.16} />
          <Stop offset="1" stopColor={color} stopOpacity={0.06} />
        </LinearGradient>
      </Defs>
      <Circle cx="100" cy="100" r="80" fill={color} opacity={0.06} />
      {/* ticket / booking card */}
      <G>
        <Rect
          x="48"
          y="58"
          width="104"
          height="84"
          rx="14"
          fill="url(#nbCard)"
          stroke={color}
          strokeWidth={2.5}
          strokeOpacity={0.5}
        />
        {/* perforation */}
        <Line
          x1="48"
          y1="92"
          x2="152"
          y2="92"
          stroke={color}
          strokeWidth={2}
          strokeDasharray="5 5"
          strokeOpacity={0.4}
        />
        <Circle cx="48" cy="92" r="7" fill={color} opacity={0.1} />
        <Circle cx="152" cy="92" r="7" fill={color} opacity={0.1} />
        {/* car glyph */}
        <Path
          d="M74 76 h20 l4 6 h4 a4 4 0 0 1 4 4 v3 h-40 v-3 a4 4 0 0 1 4 -4 h4 z"
          fill={color}
          opacity={0.55}
        />
        <Circle cx="80" cy="90" r="3.5" fill={color} opacity={0.7} />
        <Circle cx="104" cy="90" r="3.5" fill={color} opacity={0.7} />
        {/* lines */}
        <Rect x="66" y="108" width="52" height="6" rx="3" fill={color} opacity={0.3} />
        <Rect x="66" y="122" width="34" height="6" rx="3" fill={color} opacity={0.2} />
      </G>
      {/* magnifier accent */}
      <Circle
        cx="138"
        cy="134"
        r="16"
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeOpacity={0.55}
      />
      <Line
        x1="150"
        y1="146"
        x2="162"
        y2="158"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeOpacity={0.55}
      />
    </Svg>
  );
};
