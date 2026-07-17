export const SOUND_PREFERENCE_KEY = "world-cities-monopoly-sound-enabled";

export function readSoundEnabled(storage: Pick<Storage, "getItem"> | null | undefined): boolean {
  return storage?.getItem(SOUND_PREFERENCE_KEY) === "true";
}

export function writeSoundEnabled(storage: Pick<Storage, "setItem"> | null | undefined, enabled: boolean) {
  storage?.setItem(SOUND_PREFERENCE_KEY, String(enabled));
}
