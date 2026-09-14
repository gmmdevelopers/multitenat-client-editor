import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { BlockInstance } from "@/types/editor-state";
import { getDefaultPropsForOrganism } from "@/lib/editor-registry";

// Helper para generar IDs únicos en cualquier entorno (HTTP / HTTPS)
function generateUniqueId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

interface EditorStore {
  blocks: BlockInstance[];
  selectedBlockId: string | null;
  /** Pagina que se esta editando; la usa el preview para no mostrar otra. */
  pageId: string | null;
  loadBlocks: (blocks: BlockInstance[], pageId?: string | null) => void;
  setSelectedBlockId: (id: string | null) => void;
  addOrganism: (metaName: string) => void;
  updateBlockProp: (blockId: string, propName: string, value: any) => void;
  resetBlockProps: (blockId: string) => void;
  reorderBlocksById: (activeId: string, overId: string) => void;
  deleteBlock: (id: string) => void;
  clearCanvas: () => void;
}

export const useEditorStore = create<EditorStore>()(
  persist(
    (set) => ({
      blocks: [],
      selectedBlockId: null,
      pageId: null,

      // Normalizamos lo que llega de la API: un bloque sin `props` es una
      // forma valida en la respuesta pero rompe el panel de propiedades.
      loadBlocks: (blocks, pageId) =>
        set({
          ...(pageId !== undefined ? { pageId } : {}),
          blocks: (blocks ?? []).map((block) => ({
            ...block,
            props:
              block.props && typeof block.props === "object"
                ? block.props
                : {},
          })),
          selectedBlockId: null,
        }),

      setSelectedBlockId: (id) => set({ selectedBlockId: id }),

      addOrganism: (metaName) =>
        set((state) => {
          const newBlock: BlockInstance = {
            id: generateUniqueId(),
            metaName,
            props: getDefaultPropsForOrganism(metaName),
          };
          return {
            blocks: [...state.blocks, newBlock],
            selectedBlockId: newBlock.id,
          };
        }),

      updateBlockProp: (blockId, propName, value) =>
        set((state) => ({
          blocks: state.blocks.map((block) =>
            block.id === blockId
              ? { ...block, props: { ...block.props, [propName]: value } }
              : block,
          ),
        })),

      resetBlockProps: (blockId) =>
        set((state) => ({
          blocks: state.blocks.map((block) =>
            block.id === blockId
              ? { ...block, props: getDefaultPropsForOrganism(block.metaName) }
              : block,
          ),
        })),

      reorderBlocksById: (activeId, overId) =>
        set((state) => {
          const oldIndex = state.blocks.findIndex((b) => b.id === activeId);
          const newIndex = state.blocks.findIndex((b) => b.id === overId);
          if (oldIndex === -1 || newIndex === -1) return state;

          const newBlocks = [...state.blocks];
          const [moved] = newBlocks.splice(oldIndex, 1);
          newBlocks.splice(newIndex, 0, moved);

          return { blocks: newBlocks };
        }),

      deleteBlock: (id) =>
        set((state) => ({
          blocks: state.blocks.filter((b) => b.id !== id),
          selectedBlockId:
            state.selectedBlockId === id ? null : state.selectedBlockId,
        })),

      clearCanvas: () => set({ blocks: [], selectedBlockId: null }),
    }),
    {
      name: "clinic-page-builder-storage", // Clave en localStorage
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
