import type { FlooringType, RoomPolygon } from './types';

export type { FlooringType, RoomPolygon };

export {
  type WallGeometryInfo,
  getWallGeometry,
  setWallLengthCm,
  checkWallFitCm,
  findWallSnap,
  shouldCutawayWall,
  computeFitViewBox,
  snapAngleToOrthogonal,
  snapValueToGrid,
} from './wallGeometry';

export {
  computeFloorPolygons,
  pointInPolygon,
  isPointInRoom,
  applyRoomLabels,
  getInteriorWallIds,
} from './roomPolygons';

export {
  splitWallsAtCorner,
  splitCrossingWalls,
} from './wallTopology';
