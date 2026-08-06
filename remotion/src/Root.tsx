import "./index.css";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { TripVideo, computeTotalDurationInFrames } from "./TripVideo";
import { FPS } from "./timing";
import { VIDEO_DIMENSIONS } from "./config";
import type { TripVideoProps } from "./types";
import sampleProps from "./sampleProps.json";

const calculateMetadata: CalculateMetadataFunction<TripVideoProps> = ({ props }) => {
  const dims = VIDEO_DIMENSIONS[props.trip.orientation ?? "landscape"];
  return {
    durationInFrames: computeTotalDurationInFrames(props.trip, props.mapScenes),
    fps: FPS,
    width: dims.width,
    height: dims.height,
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
