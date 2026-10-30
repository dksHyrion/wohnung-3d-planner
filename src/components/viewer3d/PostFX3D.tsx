import React, { useMemo } from 'react';
import {
  EffectComposer,
  N8AO,
  Bloom,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { interpolateMood } from '../../core/lighting/moodPresets';

export const N8AO_RADIUS_CM = 36;
export const BLOOM_LUMINANCE_THRESHOLD = 1.0;

// @react-three/postprocessing v2 restricts children to JSX.Element, disallowing conditionals
const Composer = EffectComposer as unknown as React.FC<{
  multisampling?: number;
  enableNormalPass?: boolean;
  children?: React.ReactNode;
}>;

export const PostFX3D: React.FC = () => {
  const qualityMode = useFloorplanStore((s) => s.qualityMode);
  const timeOfDay = useFloorplanStore((s) => s.timeOfDay);
  const renderTheme = useFloorplanStore((s) => s.renderTheme);

  const mood = useMemo(() => interpolateMood(timeOfDay), [timeOfDay]);
  const isBeauty = qualityMode === 'beauty' && renderTheme === 'studio';

  if (!isBeauty) {
    return null;
  }

  return (
    <Composer multisampling={0} enableNormalPass={true}>
      <N8AO
        aoRadius={N8AO_RADIUS_CM}
        distanceFalloff={0.6}
        intensity={mood.n8aoIntensity}
        color="#2e241f"
        halfRes={false}
        quality="high"
      />
      <Bloom
        mipmapBlur
        luminanceThreshold={BLOOM_LUMINANCE_THRESHOLD}
        intensity={mood.lampBloomIntensity}
      />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <Vignette offset={0.3} darkness={mood.vignetteDarkness} />
    </Composer>
  );
};
