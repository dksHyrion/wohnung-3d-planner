import type { StoreApi } from 'zustand';
import type { BackgroundImageOverlay, FloorplanData } from '../core/types';
import type { FloorplanState } from './state';

export interface StoreDeps {
  set: StoreApi<FloorplanState>['setState'];
  get: () => FloorplanState;
  setWithCollisions: (patch: Partial<FloorplanState>, recordHistory?: boolean) => void;
  pushHistory: () => {
    undoStack: FloorplanState['undoStack'];
    redoStack: FloorplanState['redoStack'];
    canUndo: boolean;
    canRedo: boolean;
  };
  generateId: (prefix: string) => string;
  withRuntimeImage: (
    image: BackgroundImageOverlay | null | undefined
  ) => BackgroundImageOverlay | null;
  gcOverlays: () => void;
  cloneFloorplanData: (data: FloorplanData) => FloorplanData;
  captureFloorplanSnapshot: (state: {
    corners: FloorplanState['corners'];
    walls: FloorplanState['walls'];
    openings: FloorplanState['openings'];
    furniture: FloorplanState['furniture'];
    rugs?: FloorplanState['rugs'];
    roomLabels?: FloorplanState['roomLabels'];
    backgroundImage?: FloorplanState['backgroundImage'];
  }) => FloorplanData;
}
