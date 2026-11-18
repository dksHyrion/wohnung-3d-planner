import React from 'react';
import { Footprints, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { useTranslation } from '../../i18n/useTranslation';
import type { ScorecardGrade } from '../../core/ergonomicsScorecard';
import { computeFurnitureOBBs } from '../../core/collisionEngine';
import { evaluateMepDiagnostics } from '../../core/mepFixtures';
import { computeFloorPolygons } from '../../core/wallMath';
import { evaluateWalkAndSightlines } from '../../core/walkAndSightlines';

const GRADE_COLORS: Record<ScorecardGrade, string> = {
  A: '#10b981',
  B: '#38bdf8',
  C: '#f59e0b',
  D: '#ef4444',
};

export const ErgonomicsScorecardSection: React.FC = () => {
  const { t } = useTranslation();
  const showPassageHeatmap = useFloorplanStore((s) => s.showPassageHeatmap);
  const ergonomicsScorecard = useFloorplanStore((s) => s.ergonomicsScorecard);
  const isComputingErgonomics = useFloorplanStore((s) => s.isComputingErgonomics);
  const setShowPassageHeatmap = useFloorplanStore((s) => s.setShowPassageHeatmap);
  const corners = useFloorplanStore((s) => s.corners);
  const walls = useFloorplanStore((s) => s.walls);
  const openings = useFloorplanStore((s) => s.openings);
  const furniture = useFloorplanStore((s) => s.furniture);
  const fixtures = useFloorplanStore((s) => s.fixtures);
  const timeOfDay = useFloorplanStore((s) => s.timeOfDay);
  const alignSunWithWindows = useFloorplanStore((s) => s.alignSunWithWindows);

  const mepDiagnostics = React.useMemo(() => {
    if (!showPassageHeatmap || !fixtures || fixtures.length === 0) return null;
    const obbMap = new Map(furniture.map((f) => [f.id, computeFurnitureOBBs(f)]));
    const rooms = computeFloorPolygons(corners, walls);
    return evaluateMepDiagnostics({ corners, walls, openings, furniture, fixtures }, obbMap, rooms);
  }, [showPassageHeatmap, corners, walls, openings, furniture, fixtures]);

  const walkSightReport = React.useMemo(() => {
    if (!showPassageHeatmap) return null;
    return evaluateWalkAndSightlines(
      { corners, walls, openings, furniture },
      { timeOfDay, alignSunWithWindows }
    );
  }, [showPassageHeatmap, corners, walls, openings, furniture, timeOfDay, alignSunWithWindows]);

  return (
    <section className="sidebar-section" data-testid="ergonomics-scorecard-section">
      <div className="sidebar-title">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <Footprints size={14} />
          <span>{t('ergonomics.scorecard.title')}</span>
        </span>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          {isComputingErgonomics && (
            <span
              data-testid="ergonomics-computing-badge"
              style={{ fontSize: '0.68rem', color: '#38bdf8' }}
            >
              {t('ergonomics.scorecard.computing')}
            </span>
          )}
          <button
            type="button"
            className={`btn ${showPassageHeatmap ? 'active' : 'btn-outline'}`}
            style={{ padding: '3px 8px', fontSize: '0.72rem' }}
            onClick={() => setShowPassageHeatmap(!showPassageHeatmap)}
          >
            {showPassageHeatmap
              ? t('ergonomics.scorecard.hideOverlay')
              : t('ergonomics.scorecard.runCheck')}
          </button>
        </div>
      </div>

      {showPassageHeatmap && ergonomicsScorecard && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px',
              borderRadius: '6px',
              background: 'rgba(15, 23, 42, 0.45)',
              border: `1px solid ${GRADE_COLORS[ergonomicsScorecard.overallGrade]}`,
            }}
          >
            <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
              {t('ergonomics.scorecard.overallScore', {
                score: ergonomicsScorecard.overallScore,
                grade: ergonomicsScorecard.overallGrade,
              })}
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '1px 7px',
                borderRadius: '4px',
                background: GRADE_COLORS[ergonomicsScorecard.overallGrade],
                color: '#0f172a',
              }}
            >
              {ergonomicsScorecard.overallGrade}
            </span>
          </div>

          {ergonomicsScorecard.rooms.map((rm) => (
            <div
              key={rm.roomId}
              style={{
                padding: '6px 8px',
                borderRadius: '6px',
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(71, 85, 105, 0.4)',
                fontSize: '0.72rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 600,
                  marginBottom: '3px',
                }}
              >
                <span>
                  {rm.roomName} ({rm.netAreaSqM.toFixed(1)} m²)
                </span>
                <span style={{ color: GRADE_COLORS[rm.grade] }}>
                  {rm.score} · {rm.grade}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  color: '#cbd5e1',
                  fontSize: '0.68rem',
                }}
              >
                <span>{t('ergonomics.scorecard.freeSpace', { percent: rm.freeFloorPercent })}</span>
                <span>·</span>
                <span style={{ color: rm.reachableFromEntrance ? '#34d399' : '#f87171' }}>
                  {rm.reachableFromEntrance
                    ? t('ergonomics.scorecard.reachable')
                    : t('ergonomics.scorecard.unreachable')}
                </span>
                <span>·</span>
                <span style={{ color: rm.hasTurningCircle150 ? '#34d399' : '#fbbf24' }}>
                  {rm.hasTurningCircle150
                    ? t('ergonomics.scorecard.turningOk')
                    : t('ergonomics.scorecard.turningMissing', { maxCm: rm.maxTurningDiameterCm })}
                </span>
              </div>
            </div>
          ))}

          {ergonomicsScorecard.unreachableFurnitureIds.length > 0 && (
            <div style={{ fontSize: '0.7rem', color: '#f87171', display: 'flex', gap: '5px', alignItems: 'center' }}>
              <AlertTriangle size={12} />
              <span>
                {t('ergonomics.scorecard.unreachableFurniture', {
                  count: ergonomicsScorecard.unreachableFurnitureIds.length,
                })}
              </span>
            </div>
          )}

          {ergonomicsScorecard.deliveryChecks
            .filter((d) => d.status !== 'fits')
            .map((d) => (
              <div
                key={`del-${d.furnitureId}`}
                style={{
                  fontSize: '0.7rem',
                  color: d.status === 'blocked' ? '#f87171' : '#fbbf24',
                  display: 'flex',
                  gap: '5px',
                  alignItems: 'center',
                }}
              >
                <AlertTriangle size={12} />
                <span>
                  {d.status === 'blocked'
                    ? t('ergonomics.scorecard.deliveryBlocked', { name: d.furnitureName })
                    : t('ergonomics.scorecard.deliveryTilted', { name: d.furnitureName })}
                </span>
              </div>
            ))}

          {ergonomicsScorecard.chairPullbackIssues.map((c) => (
            <div
              key={`pull-${c.furnitureId}`}
              style={{
                fontSize: '0.7rem',
                color: c.severity === 'critical' ? '#f87171' : '#fbbf24',
                display: 'flex',
                gap: '5px',
                alignItems: 'center',
              }}
            >
              <AlertTriangle size={12} />
              <span>
                {t('ergonomics.scorecard.pullbackWarn', {
                  name: c.furnitureName,
                  actual: c.availableCm,
                  rec: c.recommendedCm,
                })}
              </span>
            </div>
          ))}

          {ergonomicsScorecard.foldOpenDiffs.map((fd) => (
            <div
              key={`fold-${fd.furnitureId}`}
              style={{
                fontSize: '0.7rem',
                color: fd.introducesCollisions ? '#f87171' : '#34d399',
                display: 'flex',
                gap: '5px',
                alignItems: 'center',
              }}
            >
              {fd.introducesCollisions ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
              <span>
                {fd.introducesCollisions
                  ? t('ergonomics.scorecard.foldOpenCollision', {
                      name: fd.furnitureName,
                      pose: fd.simulatedPose,
                      count: fd.newIssueMessages.length,
                    })
                  : t('ergonomics.scorecard.foldOpenOk', {
                      name: fd.furnitureName,
                      pose: fd.simulatedPose,
                    })}
              </span>
            </div>
          ))}

          {mepDiagnostics && mepDiagnostics.socketDistances.map((sd) => (
            <div
              key={`mep-sock-${sd.furnitureId}`}
              style={{
                fontSize: '0.7rem',
                color: sd.warning ? '#fbbf24' : '#34d399',
                display: 'flex',
                gap: '5px',
                alignItems: 'center',
              }}
            >
              {sd.warning ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
              <span>
                {sd.distanceCm !== null
                  ? t('ergonomics.scorecard.socketDistance', {
                      name: sd.furnitureName,
                      dist: sd.distanceCm,
                    })
                  : t('ergonomics.scorecard.noSocketNear', { name: sd.furnitureName })}
              </span>
            </div>
          ))}

          {walkSightReport && walkSightReport.glareIssues.map((gl, idx) => (
            <div
              key={`glare-${gl.furnitureId}-${gl.windowId}-${idx}`}
              style={{
                fontSize: '0.7rem',
                color: gl.severity === 'critical' ? '#f87171' : '#fbbf24',
                display: 'flex',
                gap: '5px',
                alignItems: 'center',
              }}
            >
              <AlertTriangle size={12} />
              <span>
                {gl.kind === 'reflection-glare'
                  ? t('ergonomics.scorecard.glareReflection', {
                      name: gl.furnitureName,
                      dist: gl.distanceCm,
                    })
                  : t('ergonomics.scorecard.glareBacklight', {
                      name: gl.furnitureName,
                      dist: gl.distanceCm,
                    })}
              </span>
            </div>
          ))}

          {walkSightReport && walkSightReport.sightlines.map((sl, idx) => (
            <div
              key={`sight-${sl.fromId}-${sl.toId}-${idx}`}
              style={{
                fontSize: '0.7rem',
                color:
                  sl.status === 'obstructed'
                    ? '#f87171'
                    : sl.status === 'angled'
                    ? '#fbbf24'
                    : '#34d399',
                display: 'flex',
                gap: '5px',
                alignItems: 'center',
              }}
            >
              {sl.status === 'clear' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
              <span>
                {sl.status === 'obstructed'
                  ? t('ergonomics.scorecard.sightlineBlocked', {
                      from: sl.fromName,
                      to: sl.toName,
                      blocker: sl.obstructedByWall
                        ? t('ergonomics.scorecard.wallObstacle')
                        : sl.obstructedByName ?? '',
                    })
                  : t('ergonomics.scorecard.sightlineOk', {
                      from: sl.fromName,
                      to: sl.toName,
                      dist: sl.distanceCm,
                      angle: sl.viewingAngleDeg,
                    })}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
