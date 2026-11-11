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
    presets: {
      morning: string;
      midday: string;
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
    };
    options: {
      wallCaps: string;
      windowSun: string;
      roomLights: string;
    };
  };
  dialogs: {
    shortcuts: {
      title: string;
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
      scale: string;
      format: string;
      scaleValue: string;
      includeFurniture: string;
      includeDimensions: string;
      includeRoomLabels: string;
      includeClearances: string;
      downloadSvg: string;
      downloadPng: string;
      close: string;
    };
    json: {
      title: string;
      description: string;
      copy: string;
      copied: string;
      download: string;
      load: string;
      invalidJson: string;
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
    };
    mobile: {
      bannerText: string;
      dismiss: string;
    };
  };
  inspector: {
    noSelection: string;
    noSelectionHint: string;
    catalogTitle: string;
    wall: {
      title: string;
      length: string;
      thickness: string;
      height: string;
      deleteWall: string;
    };
    room: {
      title: string;
      name: string;
      flooring: string;
      area: string;
      ceilingHeight: string;
      deleteRoom: string;
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
      width: string;
      height: string;
      sillHeight: string;
      flipSwing: string;
      flipHinge: string;
      deleteOpening: string;
    };
    furniture: {
      title: string;
      dimensions: string;
      elevation: string;
      rotation: string;
      color: string;
      alignToWall: string;
      hasNightstands: string;
      sofaBedUnfolded: string;
      wardrobeDoorsOpen: string;
      monitorsCount: string;
      deleteFurniture: string;
      duplicate: string;
      collisionAlert: string;
    };
    rug: {
      title: string;
      pattern: string;
      deleteRug: string;
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

