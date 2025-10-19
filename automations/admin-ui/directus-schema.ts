// Minimal Directus schema helper used by AutomationEditor schemaProvider prop
// You can import this in your frontend and pass functions to the component.

export function makeDirectusSchemaProvider({ baseUrl, token }: { baseUrl: string; token: string }) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  } as const;

  return {
    async loadCollections(): Promise<string[]> {
      const res = await fetch(`${baseUrl}/items/directus_collections?limit=-1`, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      const items = data?.data || [];
      return items.map((x: any) => x.collection).filter(Boolean);
    },
    async loadFields(collection: string): Promise<string[]> {
      const res = await fetch(`${baseUrl}/items/directus_fields?filter[collection][_eq]=${encodeURIComponent(collection)}&limit=-1`, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      const items = data?.data || [];
      return items.map((x: any) => x.field).filter(Boolean);
    },
  };
}
