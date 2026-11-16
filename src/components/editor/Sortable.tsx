import type { CSSProperties, ReactNode } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

interface Props<T extends { id: string }> {
  items: T[]
  /** The reordered list, plus which item moved and to which index */
  onReorder: (next: T[], moved: { id: string; to: number }) => void
  className?: string
  /** Render one row; place `handle` where the grip should appear. */
  children: (item: T, handle: ReactNode, index: number) => ReactNode
}

/**
 * Vertical drag-and-drop list. Rows are dragged by their grip handle only, so inputs and
 * buttons inside a row keep working. Keyboard: focus the grip, Space to lift, arrows to move,
 * Space to drop, Esc to cancel.
 */
export function SortableList<T extends { id: string }>({ items, onReorder, className, children }: Props<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = items.findIndex((i) => i.id === active.id)
    const to = items.findIndex((i) => i.id === over.id)
    if (from < 0 || to < 0) return
    onReorder(arrayMove(items, from, to), { id: items[from].id, to })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable: 'Espace pour saisir, flèches pour déplacer, Espace pour déposer, Échap pour annuler.',
        },
      }}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className={`sortable-list ${className ?? ''}`}>
          {items.map((item, index) => (
            <SortableRow key={item.id} id={item.id}>
              {(handle) => children(item, handle, index)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({ id, children }: { id: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  }
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className="drag-handle"
      title="Glisser pour réordonner"
      aria-label="Glisser pour réordonner"
      {...attributes}
      {...listeners}
      // Don't toggle the card / row the handle sits in
      onClick={(e) => e.stopPropagation()}
    >
      <GripVertical size={15} />
    </button>
  )
  return (
    <div ref={setNodeRef} style={style} className={`sortable-row${isDragging ? ' is-dragging' : ''}`}>
      {children(handle)}
    </div>
  )
}
