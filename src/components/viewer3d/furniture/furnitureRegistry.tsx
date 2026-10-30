import React from 'react';
import type { FurnitureVisualType } from '../../../core/types';
import { FurnitureModelProps, SofaModel } from './SofaModel';
import { BedModel } from './BedModel';
import { DiningTableModel } from './DiningTableModel';
import { KitchenIslandModel } from './KitchenIslandModel';
import { PlantModel } from './PlantModel';
import { BathtubModel } from './BathtubModel';
import {
  ShowerModel,
  ToiletModel,
  WashingMachineModel,
} from './BathroomFixtures3D';
import { BoConceptOsakaModel } from './BoConceptOsakaModel';
import { Vitsoe606Model } from './Vitsoe606Model';
import { ArtemideTolomeoModel } from './ArtemideTolomeoModel';
import { KitchenUnitModel } from './KitchenUnitModel';
import { WardrobeModel } from './WardrobeModel';
import { MusterringSorrentModel } from './MusterringSorrentModel';
import { InwerkMasterliftModel } from './InwerkMasterliftModel';
import { SteelcaseGestureModel } from './SteelcaseGestureModel';
import { DeskMonitorModel } from './DeskMonitorModel';
import { RegalraumLiumModel } from './RegalraumLiumModel';
import { NeonaVivaModel } from './NeonaVivaModel';
import { DeskModel } from './DeskModel';
import { CoffeeTableModel } from './CoffeeTableModel';
import { GenericArchitecturalModel } from './GenericArchitecturalModel';
import { PictureRailModel, WallPictureModel } from './WallPictureModel';

const coffeeTable =
  (variant: 'coffee-table' | 'sideboard' | 'vanity'): React.FC<FurnitureModelProps> =>
  (props) => <CoffeeTableModel {...props} variant={variant} />;

const genericModel =
  (subType: 'table' | 'seating' | 'storage' | 'bed' | 'box'): React.FC<FurnitureModelProps> =>
  (props) => <GenericArchitecturalModel {...props} subType={subType} />;

export const FURNITURE_MODELS = {
  sofa: SofaModel,
  'sectional-sofa': SofaModel,
  'dining-table': DiningTableModel,
  bed: BedModel,
  wardrobe: WardrobeModel,
  desk: DeskModel,
  'coffee-table': coffeeTable('coffee-table'),
  sideboard: coffeeTable('sideboard'),
  bookcase: WardrobeModel,
  'kitchen-unit': KitchenUnitModel,
  'kitchen-island': KitchenIslandModel,
  'boconcept-osaka': BoConceptOsakaModel,
  'vitsoe-606': Vitsoe606Model,
  'artemide-tolomeo': ArtemideTolomeoModel,
  'musterring-sorrent': MusterringSorrentModel,
  'inwerk-masterlift': InwerkMasterliftModel,
  'steelcase-gesture': SteelcaseGestureModel,
  'desk-monitor': DeskMonitorModel,
  'regalraum-lium': RegalraumLiumModel,
  'neona-viva': NeonaVivaModel,
  bathtub: BathtubModel,
  shower: ShowerModel,
  toilet: ToiletModel,
  'washing-machine': WashingMachineModel,
  plant: PlantModel,
  'wall-picture': WallPictureModel,
  'picture-rail': PictureRailModel,
  'generic-table': genericModel('table'),
  'generic-seating': genericModel('seating'),
  'generic-storage': genericModel('storage'),
  'generic-bed': genericModel('bed'),
  vanity: coffeeTable('vanity'),
  box: genericModel('box'),
} satisfies Record<FurnitureVisualType, React.FC<FurnitureModelProps>>;
