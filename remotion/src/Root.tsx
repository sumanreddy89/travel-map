import "./index.css";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { TripVideo, computeTotalDurationInFrames } from "./TripVideo";
import { FPS } from "./timing";
import type { TripVideoProps } from "./types";
import sampleProps from "./sampleProps.json";

const calculateMetadata: CalculateMetadataFunction<TripVideoProps> = ({ props }) => {
  return {
    durationInFrames: computeTotalDurationInFrames(props.trip, props.mapScenes),
    fps: FPS,
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="TripVideo"
      component={TripVideo}
      durationInFrames={300}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={sampleProps as unknown as TripVideoProps}
      calculateMetadata={calculateMetadata}
    />
  );
};
