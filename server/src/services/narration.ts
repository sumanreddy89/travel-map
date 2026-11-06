import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "../config.js";
import type { Stop, Trip } from "../types.js";

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

async function complete(prompt: string, maxTokens: number): Promise<string> {
  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join(" ")
    .trim();
}

export async function generateNarration(tripTitle: string, stop: Stop): Promise<string> {
  const prompt = `You are writing the voiceover script for one stop in a short travel montage video titled "${tripTitle}".
Stop: ${stop.name}${stop.date ? ` (${stop.date})` : ""}
Traveler's notes: ${stop.notes?.trim() || "(none provided)"}

Write 2-3 short sentences of warm, vivid travel-documentary narration for this stop, in the style of a travel show host. Plain prose only, no markdown, no quotation marks, no stage directions.`;

  return complete(prompt, 200);
}

export async function generateClosingNarration(tripTitle: string, countryName: string): Promise<string> {
  const prompt = `You are writing the closing voiceover line for a short travel montage video titled "${tripTitle}", right as it wraps up the ${countryName} leg of the trip (there may be more countries after this, or this may be the end of the whole video).

Write ONE warm, short sentence (or two very short ones) in the style of a travel show host bidding farewell to ${countryName} - wistful but not sad, more "see you again" than "goodbye". For tone, something like: "This wasn't a goodbye, ${countryName} - just a see-you-again. Thanks for having me." is the kind of feeling to hit, but write your own line, don't reuse that one verbatim. Plain prose only, no markdown, no quotation marks, no stage directions.`;

  return complete(prompt, 120);
}

export async function generateTravelNarration(
  tripTitle: string,
  fromName: string,
  toName: string,
  isFinalLeg: boolean,
  otherLines: string[] = []
): Promise<string> {
  // Each line is written on its own, so without seeing the others they all
  // settle on the same sentence shape. Compass directions are banned because
  // nothing here tells the model which way the leg actually runs.
  const rules = `Plain prose only, no markdown, no quotation marks, no stage directions. Do not mention compass directions such as north or south, or how the journey is made, since neither is known here.${
    otherLines.length > 0
      ? `

Other transition lines already in this video:
${otherLines.map((line) => `- ${line}`).join("\n")}

Yours will be heard alongside these, so use a clearly different sentence structure, opening and verb. Do not reuse their phrasing.`
      : ""
  }`;

  const prompt = isFinalLeg
    ? `You are writing a one-line voiceover for a short travel montage video titled "${tripTitle}", spoken as the map animates the final leg of the journey, arriving at ${toName} - the last stop of the entire trip.

Write ONE very short sentence, under 12 words, in the style of a travel documentary host marking that this is the journey's final destination. ${rules}`
    : `You are writing a one-line voiceover for a short travel montage video titled "${tripTitle}", spoken as the map animates travel from ${fromName} to ${toName}.

Write ONE very short sentence, under 12 words, in the style of a travel documentary host narrating the transit between the two places. ${rules}`;

  return complete(prompt, 60);
}

export async function generateOpeningNarration(trip: Pick<Trip, "title" | "stops">): Promise<string> {
  const stopNames = trip.stops.map((s) => s.name).filter(Boolean);
  const first = stopNames[0];
  const placesLine =
    stopNames.length > 1
      ? `The route runs through: ${stopNames.join(", ")}.`
      : first
        ? `It starts in ${first}.`
        : "";

  const prompt = `You are writing the opening voiceover line for a short travel montage video titled "${trip.title}", spoken right at the very start over a title card, before anything else plays.
${placesLine}

Write ONE or TWO short, warm, excited sentences in the style of a travel show host setting off on a journey - inviting the viewer along, not a dry summary. Plain prose only, no markdown, no quotation marks, no stage directions.`;

  return complete(prompt, 140);
}
