import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";

// The terrain is drawn with an SVG <image>, which Remotion doesn't wait for (it only waits for its
// own <Img>). Without this, the first frames of a map scene could render before the texture had
// decoded, showing a flat beige country instead of the relief.
export function useTerrainReady(srcs: string | string[]) {
  const list = Array.isArray(srcs) ? srcs : [srcs];
  const key = list.join("|");
  const [handle] = useState(() => delayRender(`Loading terrain ${key}`));
  useEffect(() => {
    Promise.all(
      list.map((src) => {
        const img = new Image();
        img.src = src;
        return img.decode().catch((err) => console.error(`Couldn't load the terrain texture ${src}`, err));
      })
    ).finally(() => continueRender(handle));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the joined list
  }, [key, handle]);
}
