import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { InspectorSidebar } from '../src/components/sidebar/InspectorSidebar';
import { WallInspector } from '../src/components/sidebar/WallInspector';
import { RoomInspector } from '../src/components/sidebar/RoomInspector';
import { FurnitureInspector } from '../src/components/sidebar/FurnitureInspector';
import { OpeningInspector } from '../src/components/sidebar/OpeningInspector';
import { RugInspector } from '../src/components/sidebar/RugInspector';
import { BackgroundOverlayControls } from '../src/components/editor2d/BackgroundOverlayControls';
import type { Wall, RoomPolygon, FurnitureItem, WallOpening, AreaRug, BackgroundImageOverlay } from '../src/core/types';

describe('Sidebar Inspectors & 2D Background Overlay Controls Localization (DE / EN)', () => {
  const sampleWall: Wall = {
    id: 'w-test',
    startCornerId: 'c1',
    endCornerId: 'c2',
    thicknessCm: 15,
    heightCm: 250,
  };

  const sampleRoom: RoomPolygon = {
    id: 'room-1',
    corners: [
      { id: 'c1', x: 0, z: 0 },
      { id: 'c2', x: 400, z: 0 },
      { id: 'c3', x: 400, z: 300 },
      { id: 'c4', x: 0, z: 300 },
    ],
    netCorners: [
      { x: 10, z: 10 },
      { x: 390, z: 10 },
      { x: 390, z: 290 },
      { x: 10, z: 290 },
    ],
    areaSqM: 12.0,
    netAreaSqM: 10.64,
    centroid: { x: 200, z: 150 },
    name: 'Wohnbereich',
    flooringType: 'parquet',
  };

  const sampleFurniture: FurnitureItem = {
    id: 'f-test',
    name: 'Standard Sofa',
    category: 'living',
    widthCm: 200,
    heightCm: 85,
    depthCm: 90,
    elevationCm: 0,
    x: 150,
    z: 150,
    rotationYDeg: 0,
    color: '#6366f1',
    isRealFurniture: false,
    visual: 'sofa',
  };

  const sampleRealFurniture: FurnitureItem = {
    id: 'f-real',
    name: 'BoConcept Osaka Sofa',
    category: 'living',
    widthCm: 170,
    heightCm: 77,
    depthCm: 88,
    elevationCm: 0,
    x: 150,
    z: 150,
    rotationYDeg: 0,
    color: '#475569',
    isRealFurniture: true,
    brand: 'BoConcept',
    modelName: 'Osaka',
    visual: 'boconcept-osaka',
  };

  const sampleDoorOpening: WallOpening = {
    id: 'op-door',
    wallId: 'w-test',
    type: 'door',
    offsetFromStartCm: 50,
    widthCm: 86,
    heightCm: 200,
    sillHeightCm: 0,
    swingDirection: 'in-left',
  };

  const sampleWindowOpening: WallOpening = {
    id: 'op-window',
    wallId: 'w-test',
    type: 'window',
    offsetFromStartCm: 100,
    widthCm: 120,
    heightCm: 130,
    sillHeightCm: 90,
  };

  const samplePassageOpening: WallOpening = {
    id: 'op-passage',
    wallId: 'w-test',
    type: 'passage',
    offsetFromStartCm: 80,
    widthCm: 100,
    heightCm: 210,
    sillHeightCm: 0,
  };

  const sampleRug: AreaRug = {
    id: 'rug-test',
    name: 'Living Room Carpet',
    widthCm: 220,
    depthCm: 160,
    x: 180,
    z: 180,
    rotationYDeg: 0,
    color: '#edece8',
  };

  const sampleOverlay: BackgroundImageOverlay = {
    id: 'bg-1',
    url: 'data:image/png;base64,sample',
    filename: 'floorplan_scan.png',
    xCm: 0,
    zCm: 0,
    widthCm: 800,
    heightCm: 600,
    rotationDeg: 0,
    opacity: 0.7,
    visible: true,
    locked: false,
    naturalWidthPx: 1600,
    naturalHeightPx: 1200,
  };

  beforeEach(() => {
    useFloorplanStore.getState().loadPreset('empty-room');
    useFloorplanStore.setState({
      selectedId: null,
      selectedType: null,
      backgroundImage: null,
      furniture: [],
      rugs: [],
    });
  });

  describe('English (EN)', () => {
    beforeEach(() => {
      useFloorplanStore.getState().setLanguage('en');
    });

    it('renders InspectorSidebar unselected state in English', () => {
      useFloorplanStore.setState({ selectedId: null, selectedType: null });
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar)
      );
      expect(html).toContain('Selection Hint');
      expect(html).toContain('Click on a wall, door/window, or furniture piece in 2D or 3D view');
      expect(html).toContain('Furniture Catalog (cm)');
      expect(html).toContain('All');
      expect(html).toContain('My Inventory (Real Furniture)');
      expect(html).toContain('Placeholders');
      expect(html).toContain('Custom Furniture (cm)');
      expect(html).toContain('Add furniture to room');
      expect(html).toContain('Rugs &amp; Textile Zones (0)');
    });

    it('renders WallInspector in English', () => {
      useFloorplanStore.setState({
        corners: [
          { id: 'c1', x: 0, z: 0 },
          { id: 'c2', x: 300, z: 0 },
        ],
        walls: [sampleWall],
        openings: [sampleDoorOpening],
      });
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(WallInspector, { selectedWall: sampleWall })
      );
      expect(html).toContain('Wall Inspector (w-test)');
      expect(html).toContain('Exact Wall Length (cm)');
      expect(html).toContain('Wall Thickness (cm)');
      expect(html).toContain('Wall Height (cm)');
      expect(html).toContain('End point: c2 (Connected walls moved: none)');
      expect(html).toContain('+ Door (86 cm)');
      expect(html).toContain('+ Window');
      expect(html).toContain('Openings on this wall (1)');
      expect(html).toContain('Offset: 50 cm');
    });

    it('renders RoomInspector in English', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(RoomInspector, { selectedRoom: sampleRoom, roomIndex: 0 })
      );
      expect(html).toContain('Room (Wohnbereich)');
      expect(html).toContain('Room Name');
      expect(html).toContain('Flooring (3D Material)');
      expect(html).toContain('Oak Parquet (Warm Wood)');
      expect(html).toContain('Microcement / Screed');
      expect(html).toContain('Porcelain Stoneware Tile');
      expect(html).toContain('Net Living Area');
      expect(html).toContain('Interior Perimeter');
    });

    it('renders FurnitureInspector in English for placeholder and real furniture', () => {
      // 1. Placeholder item
      const htmlPlaceholder = ReactDOMServer.renderToStaticMarkup(
        React.createElement(FurnitureInspector, { selectedFurniture: sampleFurniture })
      );
      expect(htmlPlaceholder).toContain('Furniture Inspector (cm)');
      expect(htmlPlaceholder).toContain('Remove');
      expect(htmlPlaceholder).toContain('Placeholder');
      expect(htmlPlaceholder).toContain('Mark as real furniture (inventory)');
      expect(htmlPlaceholder).toContain('Description');
      expect(htmlPlaceholder).toContain('3D Model Representation');
      expect(htmlPlaceholder).toContain('Auto (Catalog / Category)');
      expect(htmlPlaceholder).toContain('Width (cm)');
      expect(htmlPlaceholder).toContain('Height (cm)');
      expect(htmlPlaceholder).toContain('Depth (cm)');
      expect(htmlPlaceholder).toContain('Elevation above floor (cm)');
      expect(htmlPlaceholder).toContain('Rotate +45°');
      expect(htmlPlaceholder).toContain('Rotate +90°');
      expect(htmlPlaceholder).toContain('Fits without conflict in position');
      expect(htmlPlaceholder).toContain('Clearances &amp; Passages');

      // 2. Real designer item
      const htmlReal = ReactDOMServer.renderToStaticMarkup(
        React.createElement(FurnitureInspector, { selectedFurniture: sampleRealFurniture })
      );
      expect(htmlReal).toContain('Real Furniture (Inventory)');
      expect(htmlReal).toContain('Brand / Manufacturer');
      expect(htmlReal).toContain('Model');
      expect(htmlReal).toContain('folded');
      expect(htmlReal).toContain('unfolded');
    });

    it('renders OpeningInspector in English for Door, Window, and Passage', () => {
      // Door
      const htmlDoor = ReactDOMServer.renderToStaticMarkup(
        React.createElement(OpeningInspector, { selectedOpening: sampleDoorOpening })
      );
      expect(htmlDoor).toContain('Door Inspector');
      expect(htmlDoor).toContain('Construction / Opening Type');
      expect(htmlDoor).toContain('Hinged Door');
      expect(htmlDoor).toContain('Sliding Door');
      expect(htmlDoor).toContain('Wall Opening (Passage)');
      expect(htmlDoor).toContain('Balcony/Patio Door');
      expect(htmlDoor).toContain('Window');
      expect(htmlDoor).toContain('Offset from corner (cm)');
      expect(htmlDoor).toContain('Hinge / Swing Direction');
      expect(htmlDoor).toContain('Inside Left');
      expect(htmlDoor).toContain('Inside Right');
      expect(htmlDoor).toContain('Outside Left');
      expect(htmlDoor).toContain('Outside Right');
      expect(htmlDoor).toContain('Delete');

      // Window
      const htmlWindow = ReactDOMServer.renderToStaticMarkup(
        React.createElement(OpeningInspector, { selectedOpening: sampleWindowOpening })
      );
      expect(htmlWindow).toContain('Window Inspector');
      expect(htmlWindow).toContain('Sill Height (cm)');

      // Passage
      const htmlPassage = ReactDOMServer.renderToStaticMarkup(
        React.createElement(OpeningInspector, { selectedOpening: samplePassageOpening })
      );
      expect(htmlPassage).toContain('Passage Inspector');
    });

    it('renders RugInspector in English', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(RugInspector, { selectedRug: sampleRug })
      );
      expect(html).toContain('Rug Inspector');
      expect(html).toContain('Description');
      expect(html).toContain('Width (cm)');
      expect(html).toContain('Depth (cm)');
      expect(html).toContain('Position X (cm)');
      expect(html).toContain('Position Z (cm)');
      expect(html).toContain('Rotation (°)');
      expect(html).toContain('Color');
      expect(html).toContain('Architectural Color Presets');
      expect(html).toContain('Delete');
    });

    it('renders BackgroundOverlayControls in English', () => {
      useFloorplanStore.setState({ backgroundImage: sampleOverlay });
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(BackgroundOverlayControls)
      );
      expect(html).toContain('floorplan_scan.png');
      expect(html).toContain('Underlay opacity');
      expect(html).toContain('Lock underlay');
      expect(html).toContain('Hide underlay');
      expect(html).toContain('Calibrate');
      expect(html).toContain('Remove underlay');
      expect(html).toContain('Background underlay controls');
    });

    it('renders InspectorSidebar with corner selected in English', () => {
      useFloorplanStore.setState({
        corners: [{ id: 'c1', x: 120, z: 240 }],
        selectedId: 'c1',
        selectedType: 'corner',
      });
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar)
      );
      expect(html).toContain('Wall Corner (c1)');
      expect(html).toContain('Position X (cm)');
      expect(html).toContain('Position Z (cm)');
      expect(html).toContain('Remove Corner');
    });

    it('renders InspectorSidebar with wall selected (delete wall button) in English', () => {
      useFloorplanStore.setState({
        corners: [
          { id: 'c1', x: 0, z: 0 },
          { id: 'c2', x: 300, z: 0 },
        ],
        walls: [sampleWall],
        selectedId: 'w-test',
        selectedType: 'wall',
      });
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar)
      );
      expect(html).toContain('Remove Wall');
    });

    it('renders InspectorSidebar stacking section and placed lists in English', () => {
      const parent = { ...sampleFurniture, id: 'f-parent', name: 'Table' };
      const child = { ...sampleFurniture, id: 'f-child', name: 'Lamp', attachedToId: 'f-parent' };
      useFloorplanStore.setState({
        furniture: [parent, child],
        rugs: [sampleRug],
        selectedId: 'f-parent',
        selectedType: 'furniture',
      });
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar)
      );
      expect(html).toContain('Object Stacking &amp; Attachment');
      expect(html).toContain('Placed on / Attached to');
      expect(html).toContain('— Free standing (no attachment) —');
      expect(html).toContain('Attached objects (1):');
      expect(html).toContain('automatically follow movement, rotation, and elevation changes.');
      expect(html).toContain('Placed Furniture (2)');
      expect(html).toContain('Rugs &amp; Textile Zones (1)');
    });
  });

  describe('German (DE)', () => {
    beforeEach(() => {
      useFloorplanStore.getState().setLanguage('de');
    });

    it('renders InspectorSidebar unselected state in German', () => {
      useFloorplanStore.setState({ selectedId: null, selectedType: null });
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar)
      );
      expect(html).toContain('Auswahl-Hinweis');
      expect(html).toContain('Klicke im 2D-Grundriss oder in der 3D-Ansicht');
      expect(html).toContain('Möbel-Katalog (cm)');
      expect(html).toContain('Alle');
      expect(html).toContain('Mein Inventar (Echte Möbel)');
      expect(html).toContain('Platzhalter');
      expect(html).toContain('Eigenes Wunschmöbel (cm)');
      expect(html).toContain('Möbelstück in Raum einfügen');
      expect(html).toContain('Teppiche &amp; Textilzonen (0)');
    });

    it('renders WallInspector in German', () => {
      useFloorplanStore.setState({
        corners: [
          { id: 'c1', x: 0, z: 0 },
          { id: 'c2', x: 300, z: 0 },
        ],
        walls: [sampleWall],
        openings: [sampleDoorOpening],
      });
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(WallInspector, { selectedWall: sampleWall })
      );
      expect(html).toContain('Wand-Inspektor (w-test)');
      expect(html).toContain('Exakte Wandlänge (cm)');
      expect(html).toContain('Wandstärke (cm)');
      expect(html).toContain('Wandhöhe (cm)');
      expect(html).toContain('Endpunkt: c2 (Mitbewegte Wände: keine)');
      expect(html).toContain('+ Tür (86 cm)');
      expect(html).toContain('+ Fenster');
      expect(html).toContain('Öffnungen an dieser Wand (1)');
      expect(html).toContain('Abstand: 50 cm');
    });

    it('renders RoomInspector in German', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(RoomInspector, { selectedRoom: sampleRoom, roomIndex: 0 })
      );
      expect(html).toContain('Raum (Wohnbereich)');
      expect(html).toContain('Raumbezeichnung');
      expect(html).toContain('Bodenbelag (3D-Material)');
      expect(html).toContain('Eichenparkett (Warmholz)');
      expect(html).toContain('Mikrozement / Sichtestrich');
      expect(html).toContain('Feinsteinzeug-Fliese');
      expect(html).toContain('Netto-Wohnfläche');
      expect(html).toContain('Innenumfang');
    });

    it('renders FurnitureInspector in German for placeholder and real furniture', () => {
      const htmlPlaceholder = ReactDOMServer.renderToStaticMarkup(
        React.createElement(FurnitureInspector, { selectedFurniture: sampleFurniture })
      );
      expect(htmlPlaceholder).toContain('Möbel-Inspektor (cm)');
      expect(htmlPlaceholder).toContain('Entfernen');
      expect(htmlPlaceholder).toContain('Platzhalter');
      expect(htmlPlaceholder).toContain('Als echtes Möbelstück (Inventar) markieren');
      expect(htmlPlaceholder).toContain('Bezeichnung');
      expect(htmlPlaceholder).toContain('3D-Modell-Darstellung');
      expect(htmlPlaceholder).toContain('Auto (Katalog / Kategorie)');
      expect(htmlPlaceholder).toContain('Breite (cm)');
      expect(htmlPlaceholder).toContain('Höhe (cm)');
      expect(htmlPlaceholder).toContain('Tiefe (cm)');
      expect(htmlPlaceholder).toContain('Höhe ab Boden (cm)');
      expect(htmlPlaceholder).toContain('+45° drehen');
      expect(htmlPlaceholder).toContain('+90° drehen');
      expect(htmlPlaceholder).toContain('Passt konfliktfrei an Position');
      expect(htmlPlaceholder).toContain('📏 Lichte Durchgänge &amp; Abstände');

      const htmlReal = ReactDOMServer.renderToStaticMarkup(
        React.createElement(FurnitureInspector, { selectedFurniture: sampleRealFurniture })
      );
      expect(htmlReal).toContain('Echtes Möbel (Inventar)');
      expect(htmlReal).toContain('Marke / Hersteller');
      expect(htmlReal).toContain('Modell');
      expect(htmlReal).toContain('zugeklappt');
      expect(htmlReal).toContain('ausgeklappt');
    });

    it('renders OpeningInspector in German for Door, Window, and Passage', () => {
      const htmlDoor = ReactDOMServer.renderToStaticMarkup(
        React.createElement(OpeningInspector, { selectedOpening: sampleDoorOpening })
      );
      expect(htmlDoor).toContain('Tür-Inspektor');
      expect(htmlDoor).toContain('Bauart / Öffnungstyp');
      expect(htmlDoor).toContain('Drehtür');
      expect(htmlDoor).toContain('Schiebetür');
      expect(htmlDoor).toContain('Wanddurchbruch (offen)');
      expect(htmlDoor).toContain('Balkon-/Terrassentür');
      expect(htmlDoor).toContain('Fenster');
      expect(htmlDoor).toContain('Abstand ab Ecke (cm)');
      expect(htmlDoor).toContain('Anschlagrichtung');
      expect(htmlDoor).toContain('Innen Links');
      expect(htmlDoor).toContain('Innen Rechts');
      expect(htmlDoor).toContain('Außen Links');
      expect(htmlDoor).toContain('Außen Rechts');
      expect(htmlDoor).toContain('Löschen');

      const htmlWindow = ReactDOMServer.renderToStaticMarkup(
        React.createElement(OpeningInspector, { selectedOpening: sampleWindowOpening })
      );
      expect(htmlWindow).toContain('Fenster-Inspektor');
      expect(htmlWindow).toContain('Brüstungshöhe (cm)');

      const htmlPassage = ReactDOMServer.renderToStaticMarkup(
        React.createElement(OpeningInspector, { selectedOpening: samplePassageOpening })
      );
      expect(htmlPassage).toContain('Durchbruch-Inspektor');
    });

    it('renders RugInspector in German', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(RugInspector, { selectedRug: sampleRug })
      );
      expect(html).toContain('Teppich-Inspektor');
      expect(html).toContain('Bezeichnung');
      expect(html).toContain('Breite (cm)');
      expect(html).toContain('Tiefe (cm)');
      expect(html).toContain('Position X (cm)');
      expect(html).toContain('Position Z (cm)');
      expect(html).toContain('Drehung (°)');
      expect(html).toContain('Farbton');
      expect(html).toContain('Architektur-Farbvorlagen');
      expect(html).toContain('Löschen');
    });

    it('renders BackgroundOverlayControls in German', () => {
      useFloorplanStore.setState({ backgroundImage: sampleOverlay });
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(BackgroundOverlayControls)
      );
      expect(html).toContain('floorplan_scan.png');
      expect(html).toContain('Unterleger Deckkraft');
      expect(html).toContain('Unterleger sperren');
      expect(html).toContain('Unterleger ausblenden');
      expect(html).toContain('Kalibrieren');
      expect(html).toContain('Unterleger entfernen');
      expect(html).toContain('Unterleger-Steuerung');
    });

    it('renders InspectorSidebar with corner selected in German', () => {
      useFloorplanStore.setState({
        corners: [{ id: 'c1', x: 120, z: 240 }],
        selectedId: 'c1',
        selectedType: 'corner',
      });
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar)
      );
      expect(html).toContain('Wandecke (c1)');
      expect(html).toContain('Position X (cm)');
      expect(html).toContain('Position Z (cm)');
      expect(html).toContain('Wandecke entfernen');
    });

    it('renders InspectorSidebar with wall selected (delete wall button) in German', () => {
      useFloorplanStore.setState({
        corners: [
          { id: 'c1', x: 0, z: 0 },
          { id: 'c2', x: 300, z: 0 },
        ],
        walls: [sampleWall],
        selectedId: 'w-test',
        selectedType: 'wall',
      });
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar)
      );
      expect(html).toContain('Wand entfernen');
    });

    it('renders InspectorSidebar stacking section and placed lists in German', () => {
      const parent = { ...sampleFurniture, id: 'f-parent', name: 'Tisch' };
      const child = { ...sampleFurniture, id: 'f-child', name: 'Lampe', attachedToId: 'f-parent' };
      useFloorplanStore.setState({
        furniture: [parent, child],
        rugs: [sampleRug],
        selectedId: 'f-parent',
        selectedType: 'furniture',
      });
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar)
      );
      expect(html).toContain('Objekt-Kopplung (Trägerfläche)');
      expect(html).toContain('Steht auf / Gekoppelt mit');
      expect(html).toContain('— Frei im Raum (keine Kopplung) —');
      expect(html).toContain('Gekoppelte Objekte (1):');
      expect(html).toContain('wandern bei Verschiebung, Drehung und Höhenänderung automatisch mit.');
      expect(html).toContain('Platzierte Möbel (2)');
      expect(html).toContain('Teppiche &amp; Textilzonen (1)');
    });
  });
});
