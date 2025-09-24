declare const __env__: "development" | "production";

declare const rootURI: string;
declare const addon: {
  id: string;
  version: string;
  rootURI: string;
  env: "development" | "production";
};

declare const ztoolkit: ZToolkit;
declare const _globalThis: any;

// Supabase types
interface SupabaseConfig {
  url: string;
  key: string;
}

interface Annotation {
  id?: string;
  key: string;
  type: string;
  text: string;
  comment: string;
  color: string;
  page: number;
  paperDoi?: string;
  position?: any;
  created_at?: string;
  user_id?: string;
  document_id?: string;
}

interface SharedAnnotation extends Annotation {
  user: string;
  likes: number;
  comments: number;
}

interface SupabaseAPI {
  uploadAnnotations(annotations: Annotation[]): Promise<any>;
  getSharedAnnotations(paperId: string): Promise<SharedAnnotation[]>;
  likeAnnotation(annotationId: string): Promise<any>;
  addComment(annotationId: string, comment: string): Promise<any>;
}

// Plugin namespace
declare namespace Zotero {
  var Researchopia: import("../src/addon").default;
}
