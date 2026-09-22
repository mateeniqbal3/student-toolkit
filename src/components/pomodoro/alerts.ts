/**
 * The two ways the timer gets attention when a phase ends: a short chime and,
 * if the student allowed it, a system notification.
 *
 * The chime is synthesised with Web Audio rather than shipped as a sound file,
 * so it costs no download and works offline from the first visit.
 */

let context: AudioContext | null = null;

/**
 * Browsers only allow audio after a user gesture. Called from the Start
 * button, so the chime can play later when the phase ends on its own.
 */
export function unlockAudio(): void {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
  } catch {
    // No Web Audio: the timer still works, silently.
  }
}

/** Three rising notes, soft enough not to startle in a library. */
export function playChime(): void {
  if (!context) return;
  try {
    const start = context.currentTime + 0.05;
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      if (!context) return;
      const at = start + index * 0.18;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.65);
    });
  } catch {
    // A failed chime is not worth an error on screen.
  }
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

/**
 * Shows a notification. Chrome on Android refuses `new Notification()` and
 * only allows them through a service worker, so that route is tried first;
 * the constructor covers development, where no worker is registered.
 */
export async function notify(title: string, body: string): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const options: NotificationOptions = { body, tag: "pomodoro", icon: "/icon.png" };
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
      return;
    }
  } catch {
    // Fall through to the constructor.
  }
  try {
    new Notification(title, options);
  } catch {
    // Nothing else to try.
  }
}
