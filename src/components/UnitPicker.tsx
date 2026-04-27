import { useRef } from 'react';
import type { Army, Attachments, ImageTransform } from '../types';
import styles from './UnitPicker.module.scss';

interface Props {
  unitId: string;
  army: Army;
  attachments: Attachments;
  imageUrl?: string;
  imageTransform: ImageTransform;
  onClose: () => void;
  onDissolve: () => void;
  onDetach: () => void;
  onReattach: (newPrimaryId: string) => void;
  onAttach: (primaryId: string) => void;
  onSetImage: (url: string | null) => void;
  onSetImageTransform: (t: ImageTransform) => void;
}

export function UnitPicker({ unitId, army, attachments, imageUrl, imageTransform, onClose, onDissolve, onDetach, onReattach, onAttach, onSetImage, onSetImageTransform }: Props) {
  const unit = army.units.find(u => u.id === unitId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  if (!unit) return null;

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result;
      if (typeof dataUrl !== 'string') return;
      const img = new Image();
      img.onload = () => {
        const maxW = 300;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        onSetImage(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  const allAttachedIds = new Set(Object.values(attachments).flat());
  const isHost = !!(attachments[unitId]?.length);
  const primaryId = Object.entries(attachments).find(([, ids]) => ids.includes(unitId))?.[0] ?? null;
  const mode: 'free' | 'host' | 'attached' = isHost ? 'host' : primaryId ? 'attached' : 'free';
  const available = army.units.filter(u =>
    u.id !== unitId &&
    !allAttachedIds.has(u.id) &&
    u.id !== primaryId
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.handle} />
        <div className={styles.title}>{unit.name}</div>

        <div className={styles.section}>Unit image</div>
        <div className={styles.imageRow}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className={styles.fileInput}
            onChange={handleImageFile}
          />
          <button className={styles.action} onClick={() => fileInputRef.current?.click()}>
            {imageUrl ? 'Replace image' : 'Set image'}
          </button>
          {imageUrl && (
            <>
              <button className={`${styles.action} ${styles.danger}`} onClick={() => onSetImage(null)}>
                Remove image
              </button>
              {(() => {
                const maxPan = Math.round(50 * (imageTransform.zoom - 1));
                const clamp = (v: number) => Math.max(-maxPan, Math.min(maxPan, v));
                return (
                  <>
                    <div className={styles.sliderRow}>
                      <span className={styles.sliderLabel}>Zoom</span>
                      <input
                        type="range" min={1} max={3} step={0.05}
                        value={imageTransform.zoom}
                        className={styles.slider}
                        onChange={e => {
                          const zoom = Number(e.target.value);
                          const mp = Math.round(50 * (zoom - 1));
                          const c = (v: number) => Math.max(-mp, Math.min(mp, v));
                          onSetImageTransform({ zoom, x: c(imageTransform.x), y: c(imageTransform.y) });
                        }}
                      />
                    </div>
                    <div className={styles.sliderRow}>
                      <span className={styles.sliderLabel}>Left / Right</span>
                      <input
                        type="range" min={-maxPan} max={maxPan}
                        value={clamp(imageTransform.x)}
                        className={styles.slider}
                        onChange={e => onSetImageTransform({ ...imageTransform, x: Number(e.target.value) })}
                      />
                    </div>
                    <div className={styles.sliderRow}>
                      <span className={styles.sliderLabel}>Top / Bottom</span>
                      <input
                        type="range" min={-maxPan} max={maxPan}
                        value={clamp(imageTransform.y)}
                        className={styles.slider}
                        onChange={e => onSetImageTransform({ ...imageTransform, y: Number(e.target.value) })}
                      />
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </div>

        {mode === 'host' && (
          <button className={`${styles.action} ${styles.danger}`} onClick={onDissolve}>
            Dissolve cluster
          </button>
        )}

        {mode === 'attached' && (
          <>
            <button className={`${styles.action} ${styles.danger}`} onClick={onDetach}>
              Detach from {army.units.find(u => u.id === primaryId)?.name}
            </button>
            {available.length > 0 && (
              <>
                <div className={styles.section}>Re-attach to</div>
                <UnitList units={available} attachments={attachments} onSelect={onReattach} />
              </>
            )}
          </>
        )}

        {mode === 'free' && (
          available.length > 0 ? (
            <>
              <div className={styles.section}>Link with</div>
              <UnitList units={available} attachments={attachments} onSelect={onAttach} />
            </>
          ) : (
            <div className={styles.empty}>No available units to link</div>
          )
        )}
      </div>
    </div>
  );
}

function UnitList({ units, attachments, onSelect }: {
  units: Army['units'];
  attachments: Attachments;
  onSelect: (id: string) => void;
}) {
  return (
    <div className={styles.list}>
      {units.map(u => {
        const groupSize = attachments[u.id]?.length ?? 0;
        return (
          <button key={u.id} className={styles.item} onClick={() => onSelect(u.id)}>
            <span className={u.isChar ? styles.nameChar : styles.name}>{u.name}</span>
            <span className={styles.badges}>
              {groupSize > 0 && <span className={styles.groupBadge}>+{groupSize}</span>}
              {u.isChar && <span className={styles.charBadge}>CHAR</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
