import { continueRender, delayRender, staticFile } from "remotion";

// Oswald (SIL Open Font License, remotion/public/fonts/Oswald-OFL.txt), bundled so renders never
// fetch fonts from the network. One variable file covers every weight the scenes use (300-700).
export const fontFamily = "Oswald";

const ATTEMPT_MS = 10_000;
const ATTEMPTS = 3;

// Same approach as @remotion/google-fonts: a font load can occasionally hang in one of several
// parallel render tabs, so each attempt is capped and retried with a fresh FontFace.
function loadOnce(): Promise<FontFace> {
  const face = new FontFace(fontFamily, `url(${staticFile("fonts/Oswald-Variable.ttf")}) format("truetype")`, {
    weight: "200 700",
    style: "normal",
  });
  return Promise.race([
    face.load(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timed out loading Oswald")), ATTEMPT_MS)),
  ]);
}

if (typeof document !== "undefined" && typeof FontFace !== "undefined") {
  const handle = delayRender("Loading the bundled Oswald font", { timeoutInMilliseconds: ATTEMPT_MS * ATTEMPTS + 5_000 });
  const attempt = (left: number): void => {
    loadOnce()
      .then((face) => {
        document.fonts.add(face);
        continueRender(handle);
      })
      .catch((err) => {
        if (left > 1) {
          console.warn("Retrying the bundled Oswald font");
          attempt(left - 1);
        }
        else {
          console.error("Couldn't load the bundled Oswald font", err);
          continueRender(handle); // render with the fallback font rather than fail the whole video
        }
      });
  };
  attempt(ATTEMPTS);
}
