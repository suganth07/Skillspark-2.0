import { requireNativeModule } from "expo-modules-core";

export type NormalizedLandmark = {
  x: number;
  y: number;
  z: number;
};

export type FaceLandmarksResult = {
  width: number;
  height: number;
  landmarks: NormalizedLandmark[];
};

type FaceLandmarksModuleType = {
  detectFromImageAsync(uri: string): Promise<FaceLandmarksResult>;
};

export const FaceLandmarks =
  requireNativeModule<FaceLandmarksModuleType>("FaceLandmarks");
