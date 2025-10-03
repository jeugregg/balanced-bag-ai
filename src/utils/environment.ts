export const isDevelopment = () => import.meta.env.VITE_MODE === 'development';
export const isProduction = () => import.meta.env.VITE_MODE === 'production';

// Environment mode - can be used for debugging
export const getEnvironmentMode = () => import.meta.env.VITE_MODE;
