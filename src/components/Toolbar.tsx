import { useRef } from 'react';
import type { Army } from '../types';
import styles from './Toolbar.module.scss';

interface Props {
  army: Army | null;
  onRawJson: (raw: string) => void;
}

export function Toolbar({ army, onRawJson }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      onRawJson(ev.target!.result as string);
    };
    reader.readAsText(file);
  }

  return (
    <div className={styles.toolbar}>
      <div>
        <div className={styles.title}>{army?.name ?? 'No list loaded'}</div>
        <div className={styles.meta}>
          {army
            ? `${army.points}pts · ${army.units.length} units`
            : 'Import a New Recruit JSON to begin'}
        </div>
      </div>
      <div className={styles.right}>
        <button className={styles.importBtn} onClick={() => inputRef.current?.click()}>
          ↑ Import New Recruit JSON
        </button>
        <div className={styles.hint}>Export from newrecruit.eu → Share → Download JSON</div>
      </div>
      <input ref={inputRef} type="file" accept=".json" className={styles.fileInput} onChange={handleFile} />
    </div>
  );
}
