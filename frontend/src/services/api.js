import axios from 'axios';
import encryption from './encryption';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('Response Error:', error.response?.status, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// User API
export const userAPI = {
  login: async (username) => {
    const response = await api.post('/api/users/login', { username });
    return response.data;
  },
  
  getUser: async (userId) => {
    const response = await api.get(`/api/users/${userId}`);
    return response.data;
  },
  
  getUserStats: async (userId) => {
    const response = await api.get(`/api/users/${userId}/stats`);
    return response.data;
  },
};

// Entry API
export const entryAPI = {
    createEntry: async (entryData) => {
        // Encrypt before sending if encryption is enabled
        const dataToSend = encryption.isEncryptionEnabled()
          ? encryption.encryptObject(entryData, ['content', 'title'])
          : entryData;
        
        const response = await api.post('/api/entries', dataToSend);
        return response.data;
      },
  
  getEntry: async (entryId) => {
    const response = await api.get(`/api/entries/${entryId}`);
    return response.data;
  },
  
  getUserEntries: async (userId) => {
    const response = await api.get(`/api/users/${userId}/entries`);
    
    // Decrypt after receiving if encryption is enabled
    if (encryption.isEncryptionEnabled() && encryption.isPasswordSet()) {
      return response.data.map(entry => 
        encryption.decryptObject(entry, ['content', 'title'])
      );
    }
    
    return response.data;
  },
  
  updateEntry: async (entryId, entryData) => {
    const response = await api.put(`/api/entries/${entryId}`, entryData);
    return response.data;
  },
  
  deleteEntry: async (entryId) => {
    const response = await api.delete(`/api/entries/${entryId}`);
    return response.data;
  },
  
  searchEntries: async (userId, query) => {
    const response = await api.get(`/api/users/${userId}/search`, {
      params: { query },
    });
    return response.data;
  },
  
  getSubjects: async (userId) => {
    const response = await api.get(`/api/users/${userId}/subjects`);
    return response.data;
  },
  
  getEntriesBySubject: async (userId, subject) => {
    const response = await api.get(`/api/users/${userId}/subjects/${subject}/entries`);
    return response.data;
  },
};

// Upload and OCR API
export const uploadAPI = {
  uploadImage: async (file, userId) => {
    const formData = new FormData();
    formData.append('file', file);
    if (userId) {
      formData.append('user_id', userId);
    }
    
    const response = await api.post('/api/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  extractText: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/api/ocr/extract', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  extractTextMultiple: async (files) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    
    const response = await api.post('/api/ocr/extract-multiple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

// Health check
export const healthAPI = {
  check: async () => {
    const response = await api.get('/api/health');
    return response.data;
  },
};

export default api;