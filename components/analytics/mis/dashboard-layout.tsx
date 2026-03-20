'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, Settings2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { CollapsibleSection } from './collapsible-section';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { WidgetConfig } from '@/types/database';

export interface WidgetDefinition {
  id: string;
  label: string;
  component: React.ReactNode;
  badge?: string;
}

interface DashboardLayoutProps {
  widgets: WidgetDefinition[];
  initialConfig: WidgetConfig[];
  dashboardName?: string;
  isAdmin: boolean;
}

function SortableWidget({
  widget,
  config,
  configuring,
  onToggleVisible,
}: {
  widget: WidgetDefinition;
  config: WidgetConfig;
  configuring: boolean;
  onToggleVisible: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (!config.visible && !configuring) return null;

  return (
    <div ref={setNodeRef} style={style}>
      {configuring ? (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
            <GripVertical className="h-4 w-4" />
          </button>
          <Switch
            checked={config.visible}
            onCheckedChange={() => onToggleVisible(widget.id)}
            aria-label={`Toggle ${widget.label}`}
          />
          <span className="text-sm font-medium">{widget.label}</span>
          {widget.badge && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{widget.badge}</span>}
          {!config.visible && <span className="text-xs text-muted-foreground ml-auto">Hidden</span>}
        </div>
      ) : (
        <CollapsibleSection title={widget.label} badge={widget.badge}>
          {widget.component}
        </CollapsibleSection>
      )}
    </div>
  );
}

const DEFAULT_CONFIG = (ids: string[]): WidgetConfig[] =>
  ids.map((id, i) => ({ id, visible: true, order: i }));

export function DashboardLayout({
  widgets,
  initialConfig,
  dashboardName = 'mis',
  isAdmin,
}: DashboardLayoutProps) {
  const [configs, setConfigs] = useState<WidgetConfig[]>(() => {
    if (initialConfig.length === 0) return DEFAULT_CONFIG(widgets.map((w) => w.id));
    // Merge: add any new widgets not in saved config
    const saved = [...initialConfig];
    for (const w of widgets) {
      if (!saved.find((c) => c.id === w.id)) {
        saved.push({ id: w.id, visible: true, order: saved.length });
      }
    }
    return saved.sort((a, b) => a.order - b.order);
  });
  const [configuring, setConfiguring] = useState(false);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sortedWidgets = configs
    .map((c) => ({ config: c, widget: widgets.find((w) => w.id === c.id)! }))
    .filter((x) => x.widget);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setConfigs((prev) => {
      const oldIdx = prev.findIndex((c) => c.id === active.id);
      const newIdx = prev.findIndex((c) => c.id === over.id);
      return arrayMove(prev, oldIdx, newIdx).map((c, i) => ({ ...c, order: i }));
    });
  }

  function handleToggleVisible(id: string) {
    setConfigs((prev) => prev.map((c) => c.id === id ? { ...c, visible: !c.visible } : c));
  }

  async function handleSave(asDefault = false) {
    setSaving(true);
    try {
      await fetch('/api/analytics/dashboard-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboard_name: dashboardName, config: { widgets: configs }, set_as_default: asDefault }),
      });
      toast.success(asDefault ? 'Default layout saved for all users' : 'Layout saved');
      setConfiguring(false);
    } catch {
      toast.error('Failed to save layout');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setConfigs(DEFAULT_CONFIG(widgets.map((w) => w.id)));
  }

  return (
    <div className="space-y-4">
      {/* Config toolbar */}
      <div className="flex items-center justify-end gap-2">
        {configuring ? (
          <>
            <Button size="sm" variant="outline" onClick={handleReset}>Reset to default</Button>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => handleSave(true)} disabled={saving}>
                Save as default for all
              </Button>
            )}
            <Button size="sm" onClick={() => handleSave(false)} disabled={saving}>
              {saving ? 'Saving...' : 'Save layout'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfiguring(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setConfiguring(true)}>
            <Settings2 className="h-3.5 w-3.5 mr-1" />Customise
          </Button>
        )}
      </div>

      {/* Widget list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={sortedWidgets.map((w) => w.widget.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {sortedWidgets.map(({ widget, config }) => (
              <SortableWidget
                key={widget.id}
                widget={widget}
                config={config}
                configuring={configuring}
                onToggleVisible={handleToggleVisible}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
