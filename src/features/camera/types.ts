export interface Camera {
  x: number; // Top-left x of the camera in world coordinates
  y: number; // Top-left y of the camera in world coordinates
  viewportWidth: number;
  viewportHeight: number;
  zoom: number; // Scale multiplier (>1 zooms in, <1 zooms out)
}
