export type CameraOption = {
  deviceId: string;
  label: string;
};

type DeviceLike = {
  kind: string;
  deviceId: string;
  label: string;
};

export function cameraOptions(devices: readonly DeviceLike[]): CameraOption[] {
  return devices
    .filter((device) => device.kind === "videoinput")
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label !== "" ? device.label : `Camera ${String(index + 1)}`,
    }));
}

export function shouldShowPicker(options: readonly CameraOption[]): boolean {
  return options.length > 1;
}
