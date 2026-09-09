export interface BlockInstance {
  id: string;
  metaName: string;
  props: Record<string, any>;
}

export interface PageSchema {
  id: string;
  title: string;
  blocks: BlockInstance[];
}
