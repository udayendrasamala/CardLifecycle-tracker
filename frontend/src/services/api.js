// src/services/api.js - API Service Layer
import axios from 'axios';
import toast from 'react-hot-toast';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add API key if available
    const apiKey = process.env.REACT_APP_API_KEY;
    if (apiKey) {
      config.headers['X-API-Key'] = apiKey;
    }
    
    // Add request timestamp for debugging
    config.metadata = { startTime: new Date() };
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Calculate request duration
    const duration = new Date() - response.config.metadata.startTime;
    
    // Log slow requests
    if (duration > 5000) {
      console.warn(`Slow API request: ${response.config.url} took ${duration}ms`);
    }
    
    return response;
  },
  (error) => {
    // Handle different error types
    if (error.code === 'ECONNABORTED') {
      toast.error('Request timeout - please try again');
    } else if (error.response?.status === 429) {
      toast.error('Too many requests - please wait a moment');
    } else if (error.response?.status >= 500) {
      toast.error('Server error - please try again later');
    } else if (error.response?.data?.error) {
      toast.error(error.response.data.error);
    } else if (error.message) {
      toast.error(error.message);
    }
    
    return Promise.reject(error);
  }
);

// Card API endpoints
export const cardAPI = {
  // Create new card
  create: (cardData) => api.post('/v1/cards', cardData),
  
  // Search cards
  search: (query, limit = 10) => 
    api.get(`/v1/cards/search?q=${encodeURIComponent(query)}&limit=${limit}`),
  
  // Get card by ID
  getById: (cardId) => api.get(`/v1/cards/${cardId}`),
  
  // Get cards by status
  getByStatus: (status, limit = 50, page = 1) =>
    api.get(`/v1/cards/status/${status}?limit=${limit}&page=${page}`),
  
  // Get delayed cards
  getDelayed: (hours = 96) => api.get(`/v1/cards/delayed?hours=${hours}`),
  
  // Retry failed card
  retry: (cardId, data) => api.put(`/v1/cards/${cardId}/retry`, data),
  
  // Export cards
  export: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/v1/cards/export?${queryString}`);
  },
  
  // Get card summary
  getSummary: (days = 30) => api.get(`/v1/cards/summary?days=${days}`)
};

// Analytics API endpoints
export const analyticsAPI = {
  // Dashboard analytics
  getDashboard: (timeRange = '24h') => 
    api.get(`/v1/analytics/dashboard?timeRange=${timeRange}`),
  
  // Bottleneck analysis
  getBottlenecks: (limit = 10, severity = null) => {
    const params = new URLSearchParams({ limit });
    if (severity) params.append('severity', severity);
    return api.get(`/v1/analytics/bottlenecks?${params}`);
  },
  
  // Performance trends
  getTrends: (days = 30) => api.get(`/v1/analytics/trends?days=${days}`),
  
  // Trigger manual analysis
  analyze: () => api.post('/v1/analytics/analyze'),
  
  // Get insights
  getInsights: (timeRange = '7d', limit = 10) =>
    api.get(`/v1/analytics/insights?timeRange=${timeRange}&limit=${limit}`),
  
  // Stage performance
  getStagePerformance: (stage, days = 7) =>
    api.get(`/v1/analytics/performance/${stage}?days=${days}`),
  
  // Regional performance
  getRegionalPerformance: (days = 7) =>
    api.get(`/v1/analytics/regional?days=${days}`),
  
  // SLA metrics
  getSLA: (days = 30) => api.get(`/v1/analytics/sla?days=${days}`),
  
  // Capacity metrics
  getCapacity: (date = null) => {
    const params = date ? `?date=${date}` : '';
    return api.get(`/v1/analytics/capacity${params}`);
  },
  
  // Forecast
  getForecast: (days = 7) => api.get(`/v1/analytics/forecast?days=${days}`),
  
  // Export analytics
  export: (type = 'bottlenecks', format = 'json', days = 30) =>
    api.get(`/v1/analytics/export?type=${type}&format=${format}&days=${days}`)
};

// System API endpoints
export const systemAPI = {
  // Health check
  health: () => api.get('/health'),
  
  // Metrics
  metrics: () => api.get('/metrics'),
  
  // Status
  status: () => api.get('/status'),
  
  // Documentation
  docs: () => api.get('/docs')
};

// Utility functions
export const apiUtils = {
  // Format error message
  formatError: (error) => {
    if (error.response?.data?.error) {
      return error.response.data.error;
    }
    if (error.message) {
      return error.message;
    }
    return 'An unexpected error occurred';
  },
  
  // Check if API is available
  checkConnection: async () => {
    try {
      await systemAPI.health();
      return true;
    } catch (error) {
      return false;
    }
  },
  
  // Download file from API response
  downloadFile: (response, filename) => {
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
  
  // Format API response for consistent handling
  formatResponse: (response) => ({
    data: response.data?.data || response.data,
    success: response.data?.success !== false,
    message: response.data?.message,
    meta: {
      count: response.data?.count,
      total: response.data?.total,
      page: response.data?.page,
      limit: response.data?.limit,
      generatedAt: response.data?.generatedAt,
      requestId: response.data?.requestId
    }
  })
};

// React Query hooks
export const useApiMutation = (mutationFn, options = {}) => {
  return {
    mutateAsync: async (variables) => {
      try {
        const response = await mutationFn(variables);
        return apiUtils.formatResponse(response);
      } catch (error) {
        throw new Error(apiUtils.formatError(error));
      }
    },
    ...options
  };
};

export default api;