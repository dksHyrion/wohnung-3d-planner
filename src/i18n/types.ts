export type Language = 'de' | 'en';

export type TranslationSchema = {
  common: {
    cancel: string;
    save: string;
    delete: string;
    close: string;
    edit: string;
    apply: string;
    reset: string;
    width: string;
    height: string;
    depth: string;
    elevation: string;
    rotation: string;
    color: string;
    area: string;
    loading: string;
    error: string;
    none: string;
  };
  topbar: {
    brand: string;
    groups: {
      views: string;
      tools: string;
      history: string;
      camera: string;
    };
    tools: {
      select: string;
      wall: string;
      door: string;
      window: string;
      measure: string;
    };
    views: {
      mode2d: string;
      mode3d: string;
      split: string;
    };
    cameraPresets: {
      perspective: string;
      isometric: string;
      topDown: string;
      firstPerson: string;
      axonometric: string;
      eyeLevelOption: string;
      eyeLevelAria: string;
      eyeLevelTitle: string;
      adultTitle: string;
      childTitle: string;
    };
    actions: {
      undo: string;
      undoTooltip: string;
      redo: string;
      redoTooltip: string;
      resetPlan: string;
      resetConfirm: string;
      lighting: string;
      export: string;
      json: string;
      overlay: string;
      shortcuts: string;
      wallSnapping: string;
      dimensions: string;
      clearances: string;
      decor: string;
      cutawayLabel: string;
      cutawayTitle: string;
      wallSnapLabel: string;
      themeStudioTitle: string;
      themeBlueprintTitle: string;
      dimensionsLabel: string;
      decorLabelActive: string;
      decorLabelInactive: string;
      decorTitleActive: string;
      decorTitleInactive: string;
      passagesLabel: string;
      passagesTitle: string;
      exportRenderLabel: string;
      exportRenderTitle: string;
      presetAria: string;
      resetLabel: string;
      underlayLabel: string;
      underlayError: string;
      planSvgLabel: string;
      jsonExportLabel: string;
      jsonExportTitle: string;
      jsonImportLabel: string;
      jsonImportTitle: string;
      collisionStatusZero: string;
      collisionStatusSingular: string;
      collisionStatusPlural: string;
      collisionTitle: string;
    };
    language: {
      switchLanguage: string;
      de: string;
      en: string;
    };
  };
  lighting: {
    title: string;
    timeOfDay: string;
    presetMoodTitle: string;
    presets: {
      morning: string;
      midday: string;
      noon: string;
      goldenHour: string;
      blueHour: string;
      night: string;
      neutral: string;
      blueprint: string;
    };
    quality: {
      title: string;
      fast: string;
      beautiful: string;
      hint: string;
      ariaLabelBeauty: string;
      ariaLabelPerformance: string;
      titleBeauty: string;
      titlePerformance: string;
    };
    options: {
      wallCaps: string;
      windowSun: string;
      windowSunHint: string;
      roomLights: string;
      roomLightsHint: string;
    };
  };
  dialogs: {
    shortcuts: {
      title: string;
      closeAriaLabel: string;
      sections: {
        editHistory: string;
        generalHelp: string;
        navigation2D: string;
        navigation3D: string;
      };
      keys: {
        ctrlOrCmd: string;
        shift: string;
        deleteOrBackspace: string;
        esc: string;
        questionMark: string;
        mouseWheel: string;
        middleClick: string;
        drag: string;
        leftClick: string;
        rightClick: string;
      };
      items: {
        undo: string;
        redo: string;
        redoAlt: string;
        deleteSelected: string;
        cancelOrDeselect: string;
        toggleShortcuts: string;
        zoom2D: string;
        pan2D: string;
        orbit3D: string;
        pan3D: string;
        zoom3D: string;
      };
      toolsGroup: string;
      viewsGroup: string;
      actionsGroup: string;
      navigation2D: string;
      navigation3D: string;
      mouseWheel: string;
      deleteSelected: string;
      undoAction: string;
      redoAction: string;
    };
    export: {
      title: string;
      description: string;
      scale: string;
      format: string;
      paperFormat: string;
      orientation: string;
      projectName: string;
      projectPlaceholder: string;
      scale50: string;
      scale100: string;
      paperA4: string;
      paperA3: string;
      orientationLandscape: string;
      orientationPortrait: string;
      scaleValue: string;
      includeFurniture: string;
      includeDimensions: string;
      includeRoomLabels: string;
      includeClearances: string;
      downloadSvg: string;
      downloadPng: string;
      close: string;
      cancel: string;
    };
    json: {
      title: string;
      exportTitle: string;
      importTitle: string;
      exportAriaLabel: string;
      importAriaLabel: string;
      placeholder: string;
      description: string;
      copy: string;
      copied: string;
      download: string;
      load: string;
      invalidJson: string;
      close: string;
    };
    overlay: {
      title: string;
      opacity: string;
      calibrate: string;
      calibratePrompt: string;
      calibrateApply: string;
      lock: string;
      unlock: string;
      hide: string;
      show: string;
      remove: string;
      uploadNew: string;
      toolbarAria: string;
      opacityAria: string;
      opacityTooltip: string;
      calibrateTooltip: string;
      lockAria: string;
      unlockAria: string;
      hideAria: string;
      showAria: string;
      calibrateAria: string;
      removeAria: string;
    };
    mobile: {
      title: string;
      description: string;
      bannerText: string;
      dismiss: string;
      closeAriaLabel: string;
    };
  };
  inspector: {
    noSelection: string;
    noSelectionHint: string;
    selectionHintTitle: string;
    catalogTitle: string;
    catalogTabs: {
      all: string;
      real: string;
      placeholder: string;
    };
    catalogEmpty: string;
    catalogRealBadge: string;
    catalogPlaceholderBadge: string;
    catalogDimensions: string;
    customFurniture: {
      title: string;
      defaultName: string;
      fallbackName: string;
      name: string;
      width: string;
      height: string;
      depth: string;
      color: string;
      add: string;
    };
    placedFurniture: {
      title: string;
    };
    placedRugs: {
      title: string;
      add: string;
    };
    stacking: {
      title: string;
      attachedTo: string;
      none: string;
      heightUnit: string;
      attachedChildrenCount: string;
      attachedChildrenHint: string;
    };
    corner: {
      title: string;
      posX: string;
      posZ: string;
      deleteCorner: string;
    };
    wall: {
      title: string;
      titleWithId: string;
      length: string;
      lengthLabel: string;
      thickness: string;
      thicknessLabel: string;
      height: string;
      heightLabel: string;
      endpointInfo: string;
      addDoor: string;
      addWindow: string;
      openingsOnWall: string;
      openingOffset: string;
      deleteOpening: string;
      deleteWall: string;
      none: string;
    };
    room: {
      title: string;
      titleWithName: string;
      defaultName: string;
      name: string;
      flooring: string;
      area: string;
      netArea: string;
      perimeter: string;
      ceilingHeight: string;
      deleteRoom: string;
      flooringOptions: {
        parquet: string;
        microcement: string;
        tile: string;
      };
      flooringTypes: {
        parquet: string;
        tile: string;
        microcement: string;
        carpet: string;
      };
      roomNames: {
        livingRoom: string;
        bedroom: string;
        kitchen: string;
        bathroom: string;
        hallway: string;
        balcony: string;
        office: string;
        dining: string;
      };
    };
    opening: {
      doorTitle: string;
      windowTitle: string;
      passageTitle: string;
      typeLabel: string;
      offsetFromCorner: string;
      width: string;
      height: string;
      sillHeight: string;
      flipSwing: string;
      flipHinge: string;
      slidingDirection: string;
      swingDirection: string;
      swingOptions: {
        inLeft: string;
        inRight: string;
        outLeft: string;
        outRight: string;
      };
      types: {
        door: string;
        'sliding-door': string;
        passage: string;
        'balcony-door': string;
        window: string;
      };
      deleteOpening: string;
      delete: string;
    };
    furniture: {
      title: string;
      titleWithUnit: string;
      dimensions: string;
      elevation: string;
      elevationHint: string;
      rotation: string;
      color: string;
      alignToWall: string;
      hasNightstands: string;
      hasNightstandsLabel: string;
      sofaBedUnfolded: string;
      wardrobeDoorsOpen: string;
      monitorsCount: string;
      deleteFurniture: string;
      duplicate: string;
      collisionAlert: string;
      realBadge: string;
      placeholderBadge: string;
      markAsReal: string;
      brand: string;
      brandPlaceholder: string;
      model: string;
      modelPlaceholder: string;
      name: string;
      visualRepresentation: string;
      visualAuto: string;
      width: string;
      height: string;
      depth: string;
      posX: string;
      posZ: string;
      osakaClosed: string;
      osakaOpen: string;
      osakaHint: string;
      masterliftHeight: string;
      masterliftOutOfRange: string;
      catalogDeviation: string;
      resetToCatalog: string;
      clearanceZone: string;
      checkClearanceZone: string;
      rotate45: string;
      rotate90: string;
      collisionDetected: string;
      fitsWithoutConflict: string;
      wallClearance: string;
      clearanceDistances: string;
      noOtherObjects: string;
      distanceTo: string;
      collisionZero: string;
      distanceToWall: string;
    };
    rug: {
      title: string;
      defaultName: string;
      name: string;
      width: string;
      depth: string;
      posX: string;
      posZ: string;
      rotation: string;
      rotate90: string;
      color: string;
      colorPresets: string;
      pattern: string;
      deleteRug: string;
      delete: string;
      presets: {
        linen: string;
        warmGray: string;
        anthracite: string;
        sage: string;
        terracotta: string;
        midnightBlue: string;
      };
    };
  };
  catalog: {
    categories: {
      living: string;
      bedroom: string;
      kitchen: string;
      bathroom: string;
      storage: string;
      office: string;
      lighting: string;
      decor: string;
    };
    searchPlaceholder: string;
    itemsCount: string;
  };
  ergonomics: {
    dinNotice: string;
    passageWarning: string;
    passageOk: string;
    wheelchairCircleNotice: string;
  };
};

export type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

export type TranslationKey = NestedKeyOf<TranslationSchema>;

