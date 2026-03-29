import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor
client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || error.message;
    console.error('API Error:', message);
    return Promise.reject(error);
  }
);

// API methods
export const api = {
  // BOM Management
  getBoms: (params?: { page?: number; pageSize?: number; keyword?: string; status?: string }) =>
    client.get('/boms', { params }),
  getBom: (id: string) => client.get(`/boms/${id}`),
  getBomTree: (id: string) => client.get(`/boms/${id}/tree`),
  createBom: (data: any) => client.post('/boms', data),
  updateBom: (id: string, data: any) => client.put(`/boms/${id}`, data),
  deleteBom: (id: string) => client.delete(`/boms/${id}`),
  addNode: (bomId: string, data: any) => client.post(`/boms/${bomId}/nodes`, data),
  updateNode: (nodeId: string, data: any) => client.put(`/boms/nodes/${nodeId}`, data),
  deleteNode: (nodeId: string) => client.delete(`/boms/nodes/${nodeId}`),
  batchModify: (bomId: string, data: any) => client.post(`/boms/${bomId}/batch-modify`, data),
  getVersions: (bomId: string) => client.get(`/boms/${bomId}/versions`),
  releaseBom: (id: string, releasedBy: string) => client.post(`/boms/${id}/release`, { releasedBy }),
  duplicateBom: (id: string, data: any) => client.post(`/boms/${id}/duplicate`, data),

  // EBOM Import
  uploadFile: (file: FormData) =>
    client.post('/ebom/upload', file, { headers: { 'Content-Type': 'multipart/form-data' } }),
  parseFile: (data: { fileId: string; sourceType: string; sheetIndex?: number }) =>
    client.post('/ebom/parse', data),
  getTemplates: (sourceType?: string) => client.get('/ebom/templates', { params: { sourceType } }),
  saveTemplate: (data: any) => client.post('/ebom/templates', data),
  convertEBOM: (data: any) => client.post('/ebom/convert', data),
  getConversionTask: (id: string) => client.get(`/ebom/tasks/${id}`),

  // Validation
  getRules: (isActive?: boolean) => client.get('/validation/rules', { params: { isActive } }),
  createRule: (data: any) => client.post('/validation/rules', data),
  updateRule: (id: string, data: any) => client.put(`/validation/rules/${id}`, data),
  deleteRule: (id: string) => client.delete(`/validation/rules/${id}`),
  executeValidation: (data: { bomId: string; ruleIds?: string[]; stopOnError?: boolean }) =>
    client.post('/validation/execute', data),

  // Process Spec
  getProcessSpecs: (params?: { keyword?: string; specType?: string; status?: string }) =>
    client.get('/process-specs', { params }),
  getProcessSpec: (id: string) => client.get(`/process-specs/${id}`),
  getProcessOperations: (id: string) => client.get(`/process-specs/${id}/operations`),
  createProcessSpec: (data: any) => client.post('/process-specs', data),
  updateProcessSpec: (id: string, data: any) => client.put(`/process-specs/${id}`, data),
  deleteProcessSpec: (id: string) => client.delete(`/process-specs/${id}`),
  createNodeSpecRel: (data: any) => client.post('/process-specs/node-spec-rels', data),
  deleteNodeSpecRel: (id: string) => client.delete(`/process-specs/node-spec-rels/${id}`),
  getNodeSpecs: (nodeId: string) => client.get(`/process-specs/nodes/${nodeId}/specs`),
  getSpecNodes: (specId: string) => client.get(`/process-specs/specs/${specId}/nodes`),
  getNotifications: (isRead?: boolean) => client.get('/process-specs/notifications', { params: { read: isRead } }),
  markNotificationRead: (id: string) => client.put(`/process-specs/notifications/${id}/read`),
};

export default client;
