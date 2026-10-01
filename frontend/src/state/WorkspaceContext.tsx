import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../services/api';
import { useCollection } from '../hooks/useCollection';
import type {
  CreateAction,
  Entity,
  ModalOpener,
  ModalRegistry,
  Toast,
  ToastTone,
  WorkspaceCounts
} from '../types';

/**
 * Shared workspace state.
 *
 * Two things live here rather than in individual pages:
 *
 *  1. The create-action registry. The header's "+ Create" menu and each
 *     module's own "+ Add X" button both need to open the same modal, from
 *     anywhere. Registering the modals once means a page can contribute a form
 *     and the global menu can launch it, with no prop drilling.
 *
 *  2. Entity counts for the sidebar badges. These are derived from the same
 *     collection hooks the pages use, so a badge can never disagree with the
 *     list it summarises. They resolve to 0 with no backend connected, which is
 *     the honest value.
 *
 * Nothing here fabricates data. `counts` starts as an empty object and is only
 * ever written from a real response.
 */

interface WorkspaceValue {
  entities: Entity[];
  createActions: CreateAction[];
  modals: ModalRegistry;
  registerModal: (name: string, render: ModalOpener) => void;
  unregisterModal: (name: string) => void;
  openModal: (name: string) => void;
  counts: WorkspaceCounts;
  toast: Toast | null;
  notify: (message: string, tone?: ToastTone) => void;
  dismissToast: () => void;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

/**
 * The entities the command palette can search and the "+ Create" menu can
 * launch. Declared as a registry so adding a module is a one-line change here
 * rather than an edit in three components.
 */
const ENTITIES: Entity[] = [
  { id: 'vehicles', label: 'Vehicles', path: '/vehicles', search: (p) => api.vehicles.list({ q: p }) },
  { id: 'drivers', label: 'Drivers', path: '/drivers', search: (p) => api.drivers.list({ q: p }) },
  { id: 'shipments', label: 'Shipments', path: '/shipments', search: (p) => api.shipments.list({ q: p }) },
  { id: 'warehouses', label: 'Warehouses', path: '/warehouses', search: (p) => api.warehouses.list({ q: p }) },
  { id: 'tracking', label: 'Active trips', path: '/tracking', search: (p) => api.trips.list({ q: p }) }
];

const CREATE_ACTIONS: CreateAction[] = [
  { id: 'shipment', label: 'New shipment', entity: 'shipments' },
  { id: 'driver-assign', label: 'Assign driver', entity: 'drivers' },
  { id: 'inbound', label: 'Inbound stock', entity: 'warehouses' },
  { id: 'vehicle', label: 'Add vehicle', entity: 'vehicles' }
];

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [modals, setModals] = useState<ModalRegistry>({});
  const [toast, setToast] = useState<Toast | null>(null);

  /**
   * A page calls this to publish a modal under a name. The header menu can then
   * open it by name. Returns an opener for convenience.
   */
  const registerModal = useCallback((name: string, render: ModalOpener) => {
    setModals((prev) => (prev[name] === render ? prev : { ...prev, [name]: render }));
  }, []);

  const unregisterModal = useCallback((name: string) => {
    setModals((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const notify = useCallback((message: string, tone: ToastTone = 'success') => {
    setToast({ message, tone, id: Date.now() });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  // Badge counts. Each is a real request; all resolve to empty with no backend.
  const vehicles = useCollection(api.vehicles.list);
  const shipments = useCollection(api.shipments.list);
  const notifications = useCollection(api.notifications.list);

  const counts = useMemo<WorkspaceCounts>(
    () => ({
      vehicles: vehicles.data.length,
      shipments: shipments.data.length,
      notifications: notifications.data.length,
      // Unread is a filtered read, not a separate endpoint, so it is derived
      // from the notification rows already in hand.
      notificationsUnread: notifications.data.filter((n) => n?.read === false).length
    }),
    [vehicles.data, shipments.data, notifications.data]
  );

  const value = useMemo<WorkspaceValue>(
    () => ({
      entities: ENTITIES,
      createActions: CREATE_ACTIONS,
      modals,
      registerModal,
      unregisterModal,
      openModal: (name: string) => modals[name]?.(),
      counts,
      toast,
      notify,
      dismissToast
    }),
    [modals, registerModal, unregisterModal, counts, toast, notify, dismissToast]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return context;
}

export { ENTITIES, CREATE_ACTIONS };
