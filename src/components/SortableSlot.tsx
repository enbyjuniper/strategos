import { type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './SortableSlot.module.scss';

interface Props {
  id: string;
  className: string;
  children: ReactNode;
  indicator?: 'top' | 'bottom';
}

export function SortableSlot({ id, className, children, indicator }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const indicatorClass = indicator ? ` ${styles[indicator === 'top' ? 'indicatorTop' : 'indicatorBottom']}` : '';
  return (
    <div
      ref={setNodeRef}
      className={`${className}${indicatorClass}`}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
