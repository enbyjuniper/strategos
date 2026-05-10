import { useRef, useState } from 'react';
import type { Army, Attachments } from '../types';
import { isLeader } from '../utils/abilities';
import { BottomSheet } from './BottomSheet';
import styles from './UnitPicker.module.scss';

interface Props {
  unitId: string;
  section: 'image' | 'cluster';
  army: Army;
  attachments: Attachments;
  imageUrl?: string;
  clusterColor?: string;
  onClose: () => void;
  onDissolve: () => void;
  onDetach: () => void;
  onDetachUnit: (uid: string) => void;
  onReattach: (newPrimaryId: string) => void;
  onAttach: (primaryId: string) => void;
  onSetImage: (url: string | null) => void;
  onSetClusterColor: (hex: string) => void;
}

export function UnitPicker({ unitId, section, army, attachments, imageUrl, clusterColor, onClose, onDissolve, onDetach, onDetachUnit, onReattach, onAttach, onSetImage, onSetClusterColor }: Props) {
  const unit = army.units.find(u => u.id === unitId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isRemoteUrl = imageUrl && !imageUrl.startsWith('data:');
  const [prevImageUrl, setPrevImageUrl] = useState(imageUrl);
  const [urlInput, setUrlInput] = useState(isRemoteUrl ? imageUrl : '');

  if (imageUrl !== prevImageUrl) {
    setPrevImageUrl(imageUrl);
    setUrlInput(imageUrl && !imageUrl.startsWith('data:') ? imageUrl : '');
  }

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

  function handleUrlSubmit() {
    const trimmed = urlInput.trim();
    if (trimmed) onSetImage(trimmed);
  }

  const allAttachedIds = new Set(Object.values(attachments).flat());
  const isHost = !!(attachments[unitId]?.length);
  const primaryId = Object.entries(attachments).find(([, ids]) => ids.includes(unitId))?.[0] ?? null;
  const mode: 'free' | 'host' | 'attached' = isHost ? 'host' : primaryId ? 'attached' : 'free';
  const unitIsLeader = isLeader(unit);

  // Units a Leader can pull into their cluster: free units not already hosting their own cluster
  const availableForCluster = army.units.filter(u =>
    u.id !== unitId &&
    !allAttachedIds.has(u.id) &&
    !attachments[u.id]?.length
  );

  // Units an attached unit can re-join: only Leader units not themselves attached elsewhere
  const availableForReattach = army.units.filter(u =>
    isLeader(u) &&
    u.id !== unitId &&
    !allAttachedIds.has(u.id) &&
    u.id !== primaryId
  );

  return (
    <BottomSheet onClose={onClose}>
      <div className={styles.content}>
        <div className={styles.title}>{unit.name}</div>

        {section === 'image' && (
          <>
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
                {imageUrl ? 'Replace image (file)' : 'Set image (file)'}
              </button>
              <div className={styles.urlRow}>
                <input
                  type="url"
                  className={styles.urlInput}
                  placeholder="Or paste image URL…"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleUrlSubmit(); }}
                />
                <button className={styles.urlBtn} onClick={handleUrlSubmit}>Set</button>
              </div>
              {imageUrl && (
                <button className={`${styles.action} ${styles.danger}`} onClick={() => onSetImage(null)}>
                  Remove image
                </button>
              )}
            </div>
          </>
        )}

        {section === 'cluster' && (mode === 'free' || mode === 'host') && unitIsLeader && (
          availableForCluster.length > 0 ? (
            <>
              <div className={styles.section}>Add to cluster</div>
              <UnitList units={availableForCluster} attachments={attachments} onSelect={onAttach} />
            </>
          ) : (
            <div className={styles.empty}>No available units to add</div>
          )
        )}

        {section === 'cluster' && mode === 'host' && (
          <>
            <div className={styles.section}>Attached units</div>
            <div className={styles.list}>
              {(attachments[unitId] ?? []).map(uid => {
                const u = army.units.find(x => x.id === uid);
                if (!u) return null;
                return (
                  <div key={uid} className={styles.detachRow}>
                    <span className={u.isChar ? styles.nameChar : styles.name}>{u.name}</span>
                    <button className={styles.detachBtn} onClick={() => onDetachUnit(uid)}>Detach</button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {section === 'cluster' && mode === 'host' && (
          <>
            <div className={styles.section}>Cluster colour</div>
            <div className={styles.colorRow}>
              <span className={styles.colorSwatch} style={{ background: clusterColor }} />
              <span className={styles.colorHex}>{clusterColor}</span>
              <input
                type="color"
                className={styles.colorInput}
                value={clusterColor}
                onChange={e => onSetClusterColor(e.target.value)}
              />
            </div>
          </>
        )}

        {section === 'cluster' && mode === 'host' && (
          <button className={`${styles.action} ${styles.danger}`} onClick={onDissolve}>
            Dissolve cluster
          </button>
        )}

        {section === 'cluster' && mode === 'attached' && (
          <>
            <button className={`${styles.action} ${styles.danger}`} onClick={onDetach}>
              Detach from {army.units.find(u => u.id === primaryId)?.name}
            </button>
            {availableForReattach.length > 0 && (
              <>
                <div className={styles.section}>Re-attach to</div>
                <UnitList units={availableForReattach} attachments={attachments} onSelect={onReattach} />
              </>
            )}
          </>
        )}
      </div>
    </BottomSheet>
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
