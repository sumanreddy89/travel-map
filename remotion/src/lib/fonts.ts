import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

// Oswald (SIL Open Font License, remotion/public/fonts/Oswald-OFL.txt), bundled so renders never
// fetch fonts from the network. One variable file covers every weight the scenes use (300-700).
export const fontFamily = "Oswald";

// Called once from the root component. The render waits here (delayRender inside a component, the
// pattern Remotion supports) until the font is in document.fonts. Starting the wait at module
// load instead left it uncleared in some parallel render tabs, failing the render after 30s.
export function useBundledFont() {
  const [handle] = useState(() => delayRender("Loading the bundled Oswald font"));
  useEffect(() => {
    let cancelled = false;
    const face = new FontFace(fontFamily, `url(${staticFile("fonts/Oswald-Variable.ttf")}) format("truetype")`, {
      weight: "200 700",
      style: "normal",
    });
    face
      .load()
      .then((loaded) => {
        if (!cancelled) document.fonts.add(loaded);
      })
      .catch((err) => console.error("Couldn't load the bundled Oswald font", err))
      .finally(() => continueRender(handle));
    return () => {
      cancelled = true;
    };
  }, [handle]);
}
