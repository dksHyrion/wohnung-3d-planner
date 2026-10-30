import { FloorplanData } from '../types';
import { standard55 } from './standard-55';
import { luxuryVilla } from './luxury-villa';
import { studioApartment } from './studio-apartment';
import { rectangularRoom } from './rectangular-room';
import { emptyRoom } from './empty-room';

export const PRESET_FLOORPLANS: Record<
  string,
  { label: string; description: string; data: FloorplanData }
> = {
  'standard-55': standard55,
  'luxury-villa': luxuryVilla,
  'studio-apartment': studioApartment,
  'rectangular-room': rectangularRoom,
  'empty-room': emptyRoom,
};
