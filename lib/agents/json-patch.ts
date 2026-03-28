/**
 * RFC 6902 JSON Patch Types
 */

export type JSONPatchOperation = 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test'

export interface JSONPatch {
  op: JSONPatchOperation
  path: string // JSON Pointer (RFC 6901)
  value?: any
  from?: string // For 'move' and 'copy' operations
}

/**
 * Apply a JSON Patch to an object
 * Basic implementation - consider using a library like fast-json-patch for production
 */
export function applyPatch(obj: any, patch: JSONPatch): any {
  // This is a simplified implementation
  // In production, use a library like fast-json-patch
  const result = JSON.parse(JSON.stringify(obj))
  
  switch (patch.op) {
    case 'add':
    case 'replace':
      setValueAtPath(result, patch.path, patch.value)
      break
    case 'remove':
      removeValueAtPath(result, patch.path)
      break
    // Add other operations as needed
  }
  
  return result
}

function setValueAtPath(obj: any, path: string, value: any): void {
  const parts = path.split('/').filter(p => p)
  let current = obj
  
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current)) {
      current[parts[i]] = {}
    }
    current = current[parts[i]]
  }
  
  current[parts[parts.length - 1]] = value
}

function removeValueAtPath(obj: any, path: string): void {
  const parts = path.split('/').filter(p => p)
  let current = obj
  
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current)) return
    current = current[parts[i]]
  }
  
  delete current[parts[parts.length - 1]]
}
