export async function enableBrowserNotifications(): Promise<string> {
  if (!("Notification" in window)) {
    throw new Error("This browser does not support notifications");
  }

  const permission = await Notification.requestPermission();

  if (permission === "granted") {
    return "Browser notifications enabled";
  }

  if (permission === "denied") {
    return "Browser notification permission was denied";
  }

  return "Browser notification permission is pending";
}

