import { FloorplanData } from '../types';

export const emptyRoom: { label: string; description: string; data: FloorplanData } = {
    label: 'Leerer Raum (400 × 320 cm)',
    description:
      'Leerer Start-Grundriss (400 cm × 320 cm) zur sofortigen freien Maßeingabe eigener Wände und Möbel.',
    data: {
      corners: [
        { id: 'c1', x: 0, z: 0 },
        { id: 'c2', x: 400, z: 0 },
        { id: 'c3', x: 400, z: 320 },
        { id: 'c4', x: 0, z: 320 },
      ],
      walls: [
        { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
        { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 15, heightCm: 250 },
        { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 15, heightCm: 250 },
        { id: 'w4', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 15, heightCm: 250 },
      ],
      openings: [
        {
          id: 'op-door-empty',
          wallId: 'w3',
          type: 'door',
          offsetFromStartCm: 160,
          widthCm: 86,
          heightCm: 200,
          sillHeightCm: 0,
          swingDirection: 'in-left',
        },
      ],
      furniture: [],
    },
  };
